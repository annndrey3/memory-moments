// Імпорт/експорт даних через EXCEL (.xlsx): категорії, прайс (services), товари.
// ВАЖЛИВО: імпорт — лише UPSERT, нічого не видаляє. Тому коди прайсу, до яких
// прив'язаний конструктор (985/986/1353, 217/268/265/220/256, 44, 110 …),
// завжди зберігаються — імпорт лише оновлює ціни або додає нові рядки.
import { Router } from "express";
import multer from "multer";
import ExcelJS from "exceljs";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { slugify, uniqueSlug } from "../utils/helpers.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ── Стовпці кожного типу (порядок = порядок у таблиці) ──
const COLUMNS = {
  categories: ["name", "slug", "description", "image_url", "sort_order", "is_active"],
  services: ["category", "code", "name", "format", "price", "price_insta", "sort_order"],
  products: ["name", "slug", "category_slug", "short_description", "description", "price",
    "compare_at_price", "sku", "stock_quantity", "designer_type", "is_active", "is_featured", "images", "variants"],
};

// ── Розгортання значення комірки exceljs у примітив ──
const cv = (v) => {
  if (v == null) return v;
  if (typeof v === "object") return v.text ?? v.result ?? v.hyperlink ?? (Array.isArray(v.richText) ? v.richText.map((p) => p.text).join("") : "");
  return v;
};
const s = (v) => { const x = cv(v); return x == null ? "" : String(x).trim(); };
const n = (v) => { const x = cv(v); if (x === "" || x == null) return null; const num = Number(x); return Number.isNaN(num) ? null : num; };
const b = (v, dflt = false) => { const x = cv(v); if (x === "" || x == null) return dflt; return x === true || x === 1 || /^(1|true|так|yes|y)$/i.test(String(x)); };

// ─────────────────────────────── EXPORT (.xlsx) ───────────────────────────────
async function rowsCategories() {
  return query("SELECT name, slug, description, image_url, sort_order, is_active FROM categories ORDER BY sort_order, id");
}
async function rowsServices() {
  return query(
    `SELECT sc.name AS category, s.code, s.name, s.format, s.price, s.price_insta, s.sort_order
     FROM services s JOIN service_categories sc ON sc.id = s.category_id
     ORDER BY sc.sort_order, sc.id, s.sort_order, s.id`
  );
}
async function rowsProducts() {
  const products = await query("SELECT * FROM products ORDER BY id");
  const cats = await query("SELECT id, slug FROM categories");
  const slugById = new Map(cats.map((c) => [c.id, c.slug]));
  const out = [];
  for (const p of products) {
    const images = await query("SELECT image_url FROM product_images WHERE product_id=:id ORDER BY sort_order, id", { id: p.id });
    const variants = await query("SELECT attribute_name, attribute_value, price_modifier, stock_quantity, sku FROM product_variants WHERE product_id=:id", { id: p.id });
    out.push({
      name: p.name, slug: p.slug, category_slug: slugById.get(p.category_id) || "",
      short_description: p.short_description, description: p.description, price: p.price,
      compare_at_price: p.compare_at_price, sku: p.sku, stock_quantity: p.stock_quantity,
      designer_type: p.designer_type, is_active: p.is_active, is_featured: p.is_featured,
      images: images.map((i) => i.image_url).join(", "),
      variants: variants.length ? JSON.stringify(variants) : "",
    });
  }
  return out;
}

async function buildWorkbook(kind) {
  const rows = kind === "categories" ? await rowsCategories() : kind === "services" ? await rowsServices() : await rowsProducts();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(kind);
  ws.columns = COLUMNS[kind].map((c) => ({ header: c, key: c, width: c === "description" || c === "variants" || c === "images" ? 40 : 18 }));
  ws.getRow(1).font = { bold: true };
  for (const r of rows) ws.addRow(r);
  return wb;
}

router.get("/export/:kind", authMiddleware, async (req, res) => {
  try {
    const { kind } = req.params;
    if (!COLUMNS[kind]) return res.status(400).json({ error: "Невідомий тип експорту" });
    const wb = await buildWorkbook(kind);
    const buf = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", XLSX_MIME);
    res.setHeader("Content-Disposition", `attachment; filename="mm-${kind}.xlsx"`);
    res.send(Buffer.from(buf));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка експорту" });
  }
});

// ── Читання .xlsx → масив об'єктів за заголовками першого рядка ──
async function parseSheet(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const headers = {};
  ws.getRow(1).eachCell((cell, col) => { headers[col] = s(cell.value); });
  const rows = [];
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    const obj = {};
    let any = false;
    for (const col of Object.keys(headers)) {
      const h = headers[col];
      if (!h) continue;
      const val = row.getCell(Number(col)).value;
      obj[h] = val;
      if (s(val) !== "") any = true;
    }
    if (any) rows.push(obj);
  });
  return rows;
}

// ─────────────────────────────── IMPORT (upsert) ───────────────────────────────
async function importCategories(rows) {
  let created = 0, updated = 0;
  for (const r of rows) {
    const name = s(r.name);
    if (!name) continue;
    const slug = s(r.slug) || slugify(name);
    const existing = await query("SELECT id FROM categories WHERE slug = :slug", { slug });
    const fields = { name, description: s(r.description) || null, image_url: s(r.image_url) || null, sort_order: n(r.sort_order) ?? 0, is_active: b(r.is_active, true) ? 1 : 0 };
    if (existing[0]) {
      await query(
        `UPDATE categories SET name=:name, description=:description, image_url=:image_url,
         sort_order=:sort_order, is_active=:is_active, updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
        { ...fields, id: existing[0].id }
      );
      updated++;
    } else {
      const uslug = await uniqueSlug({ query }, slug, { table: "categories" });
      await query(
        "INSERT INTO categories (name, slug, description, image_url, sort_order, is_active) VALUES (:name,:slug,:description,:image_url,:sort_order,:is_active)",
        { ...fields, slug: uslug }
      );
      created++;
    }
  }
  return { created, updated };
}

async function importServices(rows) {
  const allSvc = await query("SELECT id, code, name, format FROM services");
  const catRows = await query("SELECT id, name FROM service_categories");
  const catByName = new Map(catRows.map((c) => [c.name, c.id]));
  let created = 0, updated = 0;
  for (const r of rows) {
    const name = s(r.name);
    if (!name) continue;
    const catName = s(r.category) || "Інше";
    let catId = catByName.get(catName);
    if (!catId) {
      const ins = await query("INSERT INTO service_categories (name, sort_order) VALUES (:n, :so)", { n: catName, so: 0 });
      catId = ins.insertId;
      catByName.set(catName, catId);
    }
    const code = s(r.code) || null;
    const fmt = s(r.format) || null;
    // Збіг за КОДОМ+форматом (стабільно для конструктора), інакше за назвою+форматом.
    const found = allSvc.find(
      (x) => (x.format ?? null) === fmt &&
        ((code && String(x.code) === code) || (!code && x.name === name))
    );
    const price = n(r.price);
    const insta = n(r.price_insta);
    const so = n(r.sort_order) ?? 0;
    if (found) {
      await query("UPDATE services SET price=:price, price_insta=:insta, sort_order=:so, category_id=:cat, updated_at=CURRENT_TIMESTAMP WHERE id=:id",
        { id: found.id, price, insta, so, cat: catId });
      updated++;
    } else {
      const ins = await query("INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order) VALUES (:cat,:code,:name,:format,:price,:insta,:so)",
        { cat: catId, code, name, format: fmt, price, insta, so });
      allSvc.push({ id: ins.insertId, code, name, format: fmt });
      created++;
    }
  }
  return { created, updated };
}

async function importProducts(rows) {
  const cats = await query("SELECT id, slug FROM categories");
  const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
  const fallbackCat = cats[0]?.id || null;
  let created = 0, updated = 0, skipped = 0;
  for (const r of rows) {
    const name = s(r.name);
    const price = n(r.price);
    if (!name || price == null) { skipped++; continue; }
    const categoryId = catBySlug.get(s(r.category_slug)) || fallbackCat;
    if (!categoryId) { skipped++; continue; }
    const slug = s(r.slug) || slugify(name);
    const existing = await query("SELECT id FROM products WHERE slug = :slug", { slug });
    const fields = {
      category_id: categoryId, name, short_description: s(r.short_description) || null,
      description: s(r.description) || null, price, compare_at_price: n(r.compare_at_price),
      sku: s(r.sku) || null, stock_quantity: n(r.stock_quantity) ?? 0, designer_type: s(r.designer_type) || null,
      is_active: b(r.is_active, true) ? 1 : 0, is_featured: b(r.is_featured, false) ? 1 : 0,
    };
    let productId;
    if (existing[0]) {
      productId = existing[0].id;
      await query(
        `UPDATE products SET category_id=:category_id, name=:name, short_description=:short_description,
         description=:description, price=:price, compare_at_price=:compare_at_price, sku=:sku,
         stock_quantity=:stock_quantity, designer_type=:designer_type, is_active=:is_active,
         is_featured=:is_featured, updated_at=CURRENT_TIMESTAMP WHERE id=:id`,
        { ...fields, id: productId }
      );
      await query("DELETE FROM product_images WHERE product_id=:id", { id: productId });
      await query("DELETE FROM product_variants WHERE product_id=:id", { id: productId });
      updated++;
    } else {
      const uslug = await uniqueSlug({ query }, slug);
      const ins = await query(
        `INSERT INTO products (category_id, name, slug, short_description, description, price,
         compare_at_price, sku, stock_quantity, designer_type, is_active, is_featured)
         VALUES (:category_id,:name,:slug,:short_description,:description,:price,:compare_at_price,
         :sku,:stock_quantity,:designer_type,:is_active,:is_featured)`,
        { ...fields, slug: uslug }
      );
      productId = ins.insertId;
      created++;
    }
    const imgs = s(r.images).split(",").map((u) => u.trim()).filter(Boolean);
    for (const [i, url] of imgs.entries()) {
      await query("INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary) VALUES (:pid,:url,:alt,:so,:prim)",
        { pid: productId, url, alt: name, so: i, prim: i === 0 ? 1 : 0 });
    }
    let variants = [];
    try { variants = JSON.parse(s(r.variants) || "[]"); } catch { variants = []; }
    for (const v of Array.isArray(variants) ? variants : []) {
      if (!v?.attribute_name) continue;
      await query("INSERT INTO product_variants (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku) VALUES (:pid,:an,:av,:pm,:sq,:sku)",
        { pid: productId, an: v.attribute_name, av: v.attribute_value, pm: v.price_modifier ?? 0, sq: v.stock_quantity ?? 0, sku: v.sku || null });
    }
  }
  return { created, updated, skipped };
}

router.post("/import/:kind", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    const { kind } = req.params;
    if (!COLUMNS[kind]) return res.status(400).json({ error: "Невідомий тип імпорту" });
    if (!req.file) return res.status(400).json({ error: "Файл не надіслано" });
    const rows = await parseSheet(req.file.buffer);
    const result =
      kind === "categories" ? await importCategories(rows)
      : kind === "services" ? await importServices(rows)
      : await importProducts(rows);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Помилка імпорту: " + (e.message || "невідома") });
  }
});

export default router;
