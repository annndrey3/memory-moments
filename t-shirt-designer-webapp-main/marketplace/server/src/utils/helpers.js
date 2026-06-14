// Транслітерація українсько/російської кирилиці в латиницю для коректних slug.
const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ё: "e",
  ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "iu", я: "ia",
};

function slugify(text) {
  const base = (text || "")
    .toLowerCase()
    .trim()
    .replace(/[а-яёіїєґ]/g, (ch) => TRANSLIT[ch] ?? "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "item";
}

// Повертає slug, унікальний у вказаній таблиці (додає -2, -3, … за потреби).
async function uniqueSlug(db, baseSlug, { table = "products", excludeId = null } = {}) {
  let slug = baseSlug;
  let counter = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const rows = await db.query(
      `SELECT id FROM ${table} WHERE slug = :slug${excludeId ? " AND id != :excludeId" : ""}`,
      excludeId ? { slug, excludeId } : { slug }
    );
    if (!rows.length) return slug;
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }
}

export { slugify, uniqueSlug };

export async function getProductById(db, id, { activeOnly = false } = {}) {
  const activeClause = activeOnly ? "AND p.is_active = 1" : "";
  const products = await db.query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug,
            d.name AS design_name, d.preview_image AS design_preview,
            d.product_type AS design_product_type
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN designs d ON d.id = p.design_id
     WHERE p.id = :id ${activeClause}`,
    { id }
  );
  if (!products.length) return null;

  const product = products[0];
  const images = await db.query(
    `SELECT * FROM product_images WHERE product_id = :id ORDER BY sort_order, id`,
    { id }
  );
  const variants = await db.query(
    `SELECT * FROM product_variants WHERE product_id = :id ORDER BY attribute_name, attribute_value`,
    { id }
  );

  return { ...product, images, variants };
}

export async function logAudit(db, { productId, adminId, action, changes }) {
  await db.query(
    `INSERT INTO product_audit_logs (product_id, admin_id, action, changes)
     VALUES (:productId, :adminId, :action, :changes)`,
    {
      productId,
      adminId,
      action,
      changes: JSON.stringify(changes),
    }
  );
}

// Синхронний варіант для виклику всередині transaction() (tx.run — синхронний).
export function logAuditSync(tx, { productId, adminId, action, changes }) {
  tx.run(
    `INSERT INTO product_audit_logs (product_id, admin_id, action, changes)
     VALUES (:productId, :adminId, :action, :changes)`,
    { productId, adminId, action, changes: JSON.stringify(changes) }
  );
}
