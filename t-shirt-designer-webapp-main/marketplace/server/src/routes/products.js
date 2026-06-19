import { Router } from "express";
import { query, transaction } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { getProductById, logAuditSync, slugify, uniqueSlug } from "../utils/helpers.js";
import { DESIGNER_SERVICE_MAP, buildTshirtMatrix, buildCanvasMatrix, buildSlimBookMatrix, servicePriceFor } from "../utils/designerPricing.js";

const router = Router();

async function listProducts(filters = {}) {
  const { category, featured, search, activeOnly = true, hideDesignerTypes = false, page = 1, limit = 12 } = filters;
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = { limit: Number(limit), offset: Number(offset) };

  if (activeOnly) conditions.push("p.is_active = 1");
  if (hideDesignerTypes) conditions.push("p.designer_type IS NULL");
  if (featured) conditions.push("p.is_featured = 1");
  if (category) {
    conditions.push("c.slug = :category");
    params.category = category;
  }
  if (search) {
    conditions.push("(p.name LIKE :search OR p.short_description LIKE :search)");
    params.search = `%${search}%`;
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const items = await query(
    `SELECT p.id, p.name, p.slug, p.short_description, p.price, p.compare_at_price,
            p.stock_quantity, p.designer_type, p.is_active, p.is_featured,
            c.name AS category_name, c.slug AS category_slug,
            (SELECT image_url FROM product_images pi
             WHERE pi.product_id = p.id AND pi.is_primary = 1 LIMIT 1) AS primary_image
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY p.is_featured DESC, p.created_at DESC
     LIMIT :limit OFFSET :offset`,
    params
  );

  const countParams = { ...params };
  delete countParams.limit;
  delete countParams.offset;

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM products p
     JOIN categories c ON c.id = p.category_id ${where}`,
    countParams
  );

  return { items, total, page: Number(page), limit: Number(limit) };
}

// Public: list products
router.get("/", async (req, res) => {
  try {
    const result = await listProducts({
      category: req.query.category,
      featured: req.query.featured === "1",
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 12,
      activeOnly: true,
      // Товари з типом конструктора теж показуємо у каталозі — їх можна обрати
      // й натиснути «Створити власний дизайн».
      hideDesignerTypes: false,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Public: prices for the live price in the constructor.
//  - types:  designer_type → catalog price (mug, photo formats…). Mirrors the
//            checkout query in orders.js (is_featured DESC, id).
//  - tshirt: футболка з ПРАЙСУ (services): біла(985)/чорна(986) × А4/А3 + друга
//            сторона(1353). Прайс — єдине джерело: правка в адмінці діє й тут,
//            і при оформленні (orders.js рахує так само).
router.get("/designer-prices", async (req, res) => {
  try {
    const services = await query("SELECT code, format, price FROM services WHERE is_active = 1");

    // Каталог (products.designer_type) — для назв та фолбеку, якщо в прайсі нема рядка.
    const catRows = await query(
      `SELECT designer_type, price, compare_at_price, name
       FROM products
       WHERE designer_type IS NOT NULL AND is_active = 1
       ORDER BY is_featured DESC, id`
    );
    const catalog = {};
    for (const r of catRows) if (!catalog[r.designer_type]) catalog[r.designer_type] = r;

    // types: ціна кожного типу з ПРАЙСУ за мапою; фолбек — каталог.
    const types = {};
    for (const dt of Object.keys(DESIGNER_SERVICE_MAP)) {
      const p = servicePriceFor(dt, services);
      if (p != null) types[dt] = { price: p, compare_at_price: null, name: catalog[dt]?.name || null };
    }
    for (const dt of Object.keys(catalog)) {
      if (types[dt]) continue; // прайс має пріоритет
      types[dt] = {
        price: Number(catalog[dt].price),
        compare_at_price: catalog[dt].compare_at_price != null ? Number(catalog[dt].compare_at_price) : null,
        name: catalog[dt].name,
      };
    }

    // Футболка — матриця з прайсу (біла/чорна × А4/А3 + друга сторона).
    const tshirt = buildTshirtMatrix(services);
    // Полотно — матриця розмір → ціна.
    const canvas = buildCanvasMatrix(services);
    // Slim book — матриця формат → { s10, s15, extra }.
    const slimBook = buildSlimBookMatrix(services);

    res.json({ types, tshirt, canvas, slimBook });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch designer prices" });
  }
});

// Admin: list all products (including inactive)
router.get("/admin/all", authMiddleware, requirePermission("products.view"), async (req, res) => {
  try {
    const result = await listProducts({
      category: req.query.category,
      search: req.query.search,
      page: req.query.page || 1,
      limit: req.query.limit || 20,
      activeOnly: false,
      // В адмінці показуємо ВСІ товари, зокрема з типом конструктора — інакше
      // після призначення типу товар «зникав» зі списку.
      hideDesignerTypes: false,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// Public: single product by slug
router.get("/slug/:slug", async (req, res) => {
  try {
    const rows = await query(
      "SELECT id FROM products WHERE slug = :slug AND is_active = 1",
      { slug: req.params.slug }
    );
    if (!rows.length) return res.status(404).json({ error: "Product not found" });

    const product = await getProductById({ query }, rows[0].id, { activeOnly: true });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

// Admin: single product by id
router.get("/:id", authMiddleware, requirePermission("products.view"), async (req, res) => {
  try {
    const product = await getProductById({ query }, req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

router.post("/", authMiddleware, requirePermission("products.manage"), async (req, res) => {
  try {
    const {
      category_id, name, short_description, description,
      price, compare_at_price, sku, stock_quantity,
      designer_type, design_id, is_active = true, is_featured = false,
      images = [], variants = [],
    } = req.body;

    if (!category_id || !name || price == null) {
      return res.status(400).json({ error: "category_id, name and price are required" });
    }

    const slug = await uniqueSlug({ query }, slugify(req.body.slug || name));

    const productId = await transaction(async (tx) => {
      const { insertId } = await tx.run(
        `INSERT INTO products
         (category_id, name, slug, short_description, description, price, compare_at_price,
          sku, stock_quantity, designer_type, design_id, is_active, is_featured)
         VALUES (:category_id, :name, :slug, :short_description, :description, :price,
                 :compare_at_price, :sku, :stock_quantity, :designer_type, :design_id, :is_active, :is_featured)`,
        {
          category_id, name, slug,
          short_description: short_description || null,
          description: description || null,
          price, compare_at_price: compare_at_price || null,
          sku: sku || null, stock_quantity: stock_quantity ?? 0,
          designer_type: designer_type || null,
          design_id: design_id || null,
          is_active: is_active ? 1 : 0,
          is_featured: is_featured ? 1 : 0,
        }
      );

      for (const [i, img] of images.entries()) {
        await tx.run(
          `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
           VALUES (:product_id, :image_url, :alt_text, :sort_order, :is_primary)`,
          {
            product_id: insertId,
            image_url: img.image_url,
            alt_text: img.alt_text || name,
            sort_order: img.sort_order ?? i,
            is_primary: img.is_primary ? 1 : i === 0 ? 1 : 0,
          }
        );
      }

      for (const v of variants) {
        await tx.run(
          `INSERT INTO product_variants
           (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku)
           VALUES (:product_id, :attribute_name, :attribute_value, :price_modifier, :stock_quantity, :sku)`,
          {
            product_id: insertId,
            attribute_name: v.attribute_name,
            attribute_value: v.attribute_value,
            price_modifier: v.price_modifier ?? 0,
            stock_quantity: v.stock_quantity ?? 0,
            sku: v.sku || null,
          }
        );
      }

      await logAuditSync(tx, {
        productId: insertId, adminId: req.admin.id, action: "create", changes: { name, slug },
      });

      return insertId;
    });

    const product = await getProductById({ query }, productId);
    res.status(201).json(product);
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "Product with this slug or SKU already exists" });
    }
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/:id", authMiddleware, requirePermission("products.manage"), async (req, res) => {
  try {
    const productId = req.params.id;
    const existing = await getProductById({ query }, productId);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    const {
      category_id, name, slug, short_description, description,
      price, compare_at_price, sku, stock_quantity,
      designer_type, design_id, is_active, is_featured,
      images, variants,
    } = req.body;

    const resolvedSlug = slug
      ? await uniqueSlug({ query }, slugify(slug), { excludeId: productId })
      : existing.slug;

    await transaction(async (tx) => {
      await tx.run(
        `UPDATE products SET
           category_id = COALESCE(:category_id, category_id),
           name = COALESCE(:name, name),
           slug = COALESCE(:slug, slug),
           short_description = :short_description,
           description = :description,
           price = COALESCE(:price, price),
           compare_at_price = :compare_at_price,
           sku = :sku,
           stock_quantity = COALESCE(:stock_quantity, stock_quantity),
           designer_type = :designer_type,
           design_id = :design_id,
           is_active = COALESCE(:is_active, is_active),
           is_featured = COALESCE(:is_featured, is_featured)
         WHERE id = :id`,
        {
          id: productId,
          category_id: category_id ?? existing.category_id,
          name: name ?? existing.name,
          slug: resolvedSlug,
          short_description: short_description ?? existing.short_description,
          description: description ?? existing.description,
          price: price ?? existing.price,
          compare_at_price: compare_at_price !== undefined ? compare_at_price : existing.compare_at_price,
          sku: sku !== undefined ? sku : existing.sku,
          stock_quantity: stock_quantity ?? existing.stock_quantity,
          designer_type: designer_type !== undefined ? designer_type : existing.designer_type,
          design_id: design_id !== undefined ? design_id : existing.design_id || null,
          is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
          is_featured: is_featured !== undefined ? (is_featured ? 1 : 0) : existing.is_featured,
        }
      );

      if (Array.isArray(images)) {
        await tx.run("DELETE FROM product_images WHERE product_id = :id", { id: productId });
        for (const [i, img] of images.entries()) {
          await tx.run(
            `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
             VALUES (:product_id, :image_url, :alt_text, :sort_order, :is_primary)`,
            {
              product_id: productId,
              image_url: img.image_url,
              alt_text: img.alt_text || name || existing.name,
              sort_order: img.sort_order ?? i,
              is_primary: img.is_primary ? 1 : i === 0 ? 1 : 0,
            }
          );
        }
      }

      if (Array.isArray(variants)) {
        await tx.run("DELETE FROM product_variants WHERE product_id = :id", { id: productId });
        for (const v of variants) {
          await tx.run(
            `INSERT INTO product_variants
             (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku)
             VALUES (:product_id, :attribute_name, :attribute_value, :price_modifier, :stock_quantity, :sku)`,
            {
              product_id: productId,
              attribute_name: v.attribute_name,
              attribute_value: v.attribute_value,
              price_modifier: v.price_modifier ?? 0,
              stock_quantity: v.stock_quantity ?? 0,
              sku: v.sku || null,
            }
          );
        }
      }

      await logAuditSync(tx, {
        productId, adminId: req.admin.id, action: "update", changes: req.body,
      });
    });

    const product = await getProductById({ query }, productId);
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/:id", authMiddleware, requirePermission("products.manage"), async (req, res) => {
  try {
    const productId = req.params.id;
    const existing = await getProductById({ query }, productId);
    if (!existing) return res.status(404).json({ error: "Product not found" });

    if (existing.designer_type) {
      return res.status(409).json({
        error: `Цей товар прив'язаний до конструктора (тип «${existing.designer_type}») і не може бути видалений. Деактивуйте його замість цього.`,
      });
    }

    // Видалення + запис у журнал — атомарно. Товар уже не існуватиме, тож аудит
    // лишаємо з product_id = null (FK увімкнено), ім'я зберігаємо в changes.
    await transaction(async (tx) => {
      await tx.run("DELETE FROM products WHERE id = :id", { id: productId });
      await logAuditSync(tx, {
        productId: null,
        adminId: req.admin.id,
        action: "delete",
        changes: { id: Number(productId), name: existing.name },
      });
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
