/**
 * DB-agnostic initial-data seeder — works on BOTH SQLite and PostgreSQL,
 * because it goes through the query()/transaction() abstraction in config/db.js
 * instead of talking to a driver directly (unlike reseedPrices.js).
 *
 * Why it exists: the SQLite branch of config/db.js self-seeds the demo catalog
 * and the price list on first run, but the PostgreSQL branch only creates the
 * schema + a default admin. Running this after `seed-admin` gives a fresh
 * Postgres database the same starting data, so SQLite and Postgres deploys are
 * identical. Idempotent — each block is skipped when its table already has rows,
 * so it is safe to run on every deploy (on SQLite it is effectively a no-op).
 *
 * Run: node src/scripts/seedInitialData.js
 */
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { query, transaction } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// pg returns COUNT(*) as a string; Number() normalises both drivers.
async function rowCount(table) {
  const rows = await query(`SELECT COUNT(*) AS c FROM ${table}`);
  return Number(rows[0]?.c ?? 0);
}

// ── Демо-каталог (ті самі дані, що SQLite сіє автоматично). ──────────────────
// Це демонстраційні товари — заміни/видали їх в адмінці після запуску.
async function seedCatalog() {
  if ((await rowCount("categories")) > 0) {
    console.log("• categories not empty — skip catalog");
    return;
  }

  await transaction(async (tx) => {
    const cats = [
      ["Одяг", "odyag", "Футболки та текстиль", 1],
      ["Посуд", "posud", "Чашки та аксесуари", 2],
      ["Фотоформати", "fotoformaty", "Друк фото різних форматів", 3],
      ["Подарунки", "podarunky", "Готові ідеї для подарунків", 4],
    ];
    const id = {};
    for (const [name, slug, description, sort_order] of cats) {
      const r = await tx.run(
        "INSERT INTO categories (name, slug, description, sort_order) VALUES (:name, :slug, :description, :sort_order)",
        { name, slug, description, sort_order }
      );
      id[slug] = r.insertId;
    }

    // [category_id, name, slug, short_desc, desc, price, compare_at, sku, stock, designer_type, is_active, is_featured, image_url]
    const products = [
      [id.odyag, "Футболка Premium", "futbolka-premium", "Бавовняна футболка з можливістю друку", "Якісна бавовняна футболка 180 г/м². Друк DTG високої якості. Передня та задня сторона.", 599.0, 749.0, "TSH-PREM-001", 100, "crew-neck", 1, 1, "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80"],
      [id.posud, "Чашка керамічна", "chashka-keramichna", "Білa чашка 330 мл з повнокольоровим друком", "Керамічна чашка з друком навколо. Можна створити унікальний дизайн у конструкторі.", 349.0, null, "MUG-CER-001", 50, "mug", 1, 1, "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80"],
      [id.fotoformaty, "Фото 10×15", "foto-10x15", "Класичний портретний формат", "Друк фото 10×15 см на преміум папері.", 29.0, null, "PHO-10X15", 999, "photo-10x15", 1, 0, "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80"],
      [id.fotoformaty, "Полароїд", "polaroid", "Стиль фото Polaroid з підписом", "Друк у форматі полароїд з білим полем для підпису.", 49.0, 59.0, "PHO-POLAR", 200, "polaroid", 1, 1, "https://images.unsplash.com/photo-1493863641943-9b67165f6163?w=600&q=80"],
      [id.fotoformaty, "Instax Mini", "instax-mini", "Формат миттєвого фото", "Друк у стилі Instax Mini — ідеальний подарунок.", 59.0, null, "PHO-INSTAX", 150, "instax-mini", 1, 0, "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&q=80"],
    ];

    const variantsBySlug = {
      "futbolka-premium": [
        ["size", "S", 0, 25, "TSH-PREM-S"],
        ["size", "M", 0, 30, "TSH-PREM-M"],
        ["size", "L", 0, 25, "TSH-PREM-L"],
        ["size", "XL", 50, 20, "TSH-PREM-XL"],
      ],
      "chashka-keramichna": [
        ["color", "Білий", 0, 30, "MUG-WHT"],
        ["color", "Чорний", 30, 20, "MUG-BLK"],
      ],
    };

    for (const [category_id, name, slug, short_description, description, price, compare_at_price, sku, stock, designer_type, is_active, is_featured, image] of products) {
      const r = await tx.run(
        `INSERT INTO products
           (category_id, name, slug, short_description, description, price, compare_at_price, sku, stock_quantity, designer_type, is_active, is_featured)
         VALUES
           (:category_id, :name, :slug, :short_description, :description, :price, :compare_at_price, :sku, :stock, :designer_type, :is_active, :is_featured)`,
        { category_id, name, slug, short_description, description, price, compare_at_price, sku, stock, designer_type, is_active, is_featured }
      );
      const productId = r.insertId;

      await tx.run(
        "INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary) VALUES (:pid, :url, :alt, 0, 1)",
        { pid: productId, url: image, alt: name }
      );

      for (const [attribute_name, attribute_value, price_modifier, stock_quantity, vsku] of variantsBySlug[slug] ?? []) {
        await tx.run(
          `INSERT INTO product_variants (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku)
           VALUES (:pid, :an, :av, :pm, :st, :sku)`,
          { pid: productId, an: attribute_name, av: attribute_value, pm: price_modifier, st: stock_quantity, sku: vsku }
        );
      }
    }
  });

  console.log("✓ catalog seeded (demo products — replace/delete via admin)");
}

// ── Прайс-лист послуг (реальні дані з priceList.json). ───────────────────────
async function seedServices() {
  if ((await rowCount("services")) > 0) {
    console.log("• services not empty — skip price list");
    return;
  }

  const priceFile = path.resolve(__dirname, "../data/priceList.json");
  const priceData = JSON.parse(fs.readFileSync(priceFile, "utf-8"));

  await transaction(async (tx) => {
    for (let ci = 0; ci < priceData.categories.length; ci++) {
      const cat = priceData.categories[ci];
      const r = await tx.run(
        "INSERT INTO service_categories (name, sort_order) VALUES (:name, :sort)",
        { name: cat.name, sort: ci }
      );
      const catId = r.insertId;

      for (let ii = 0; ii < cat.items.length; ii++) {
        const it = cat.items[ii];
        await tx.run(
          `INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order)
           VALUES (:cat, :code, :name, :format, :price, :insta, :sort)`,
          {
            cat: catId,
            code: it.code || null,
            name: it.name,
            format: it.format || null,
            price: it.price ?? null,
            insta: it.price_insta ?? null,
            sort: ii,
          }
        );
      }
    }
  });

  console.log(`✓ price list seeded: ${priceData.categories.length} categories`);
}

await seedCatalog();
await seedServices();
console.log("✅ seedInitialData complete");
process.exit(0);
