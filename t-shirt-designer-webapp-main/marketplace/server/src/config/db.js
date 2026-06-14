import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../marketplace.db");
const isNewDb = !fs.existsSync(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Provide a mysql2-compatible wrapper for non-transactional reads/writes.
const pool = {
  execute: async (sql, params = {}) => {
    // sqlite doesn't support SELECT ... FOR UPDATE or similar things, but let's just run it
    try {
      const stmt = db.prepare(sql);
      if (sql.trim().toUpperCase().startsWith("SELECT") || sql.trim().toUpperCase().startsWith("PRAGMA")) {
        const rows = stmt.all(params);
        return [rows, []];
      } else {
        const info = stmt.run(params);
        return [{ insertId: info.lastInsertRowid, affectedRows: info.changes }, []];
      }
    } catch (e) {
      // simulate ER_DUP_ENTRY for duplicate keys
      if (e.message.includes("UNIQUE constraint failed")) {
        e.code = "ER_DUP_ENTRY";
      }
      throw e;
    }
  },
};

export default pool;

export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Synchronous executor passed into transaction() callbacks.
// run() повертає { insertId, affectedRows } (як мок mysql2), all()/get() — рядки.
const txExecutor = {
  run: (sql, params = {}) => {
    try {
      const info = db.prepare(sql).run(params);
      return { insertId: info.lastInsertRowid, affectedRows: info.changes };
    } catch (e) {
      if (e.message.includes("UNIQUE constraint failed")) e.code = "ER_DUP_ENTRY";
      throw e;
    }
  },
  all: (sql, params = {}) => db.prepare(sql).all(params),
  get: (sql, params = {}) => db.prepare(sql).get(params),
};

// Виконує fn(tx) атомарно й СИНХРОННО. better-sqlite3 проганяє BEGIN/…/COMMIT
// без виходу в event-loop, тож одночасні запити не можуть переплестися
// (усуває гонку «transaction within a transaction» старої async-обгортки).
// Якщо fn кидає — транзакція відкочується, помилка прокидається далі.
export function transaction(fn) {
  return db.transaction(() => fn(txExecutor))();
}

// Initialize schema if new
if (isNewDb) {
  db.exec(`
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      parent_id INTEGER NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
    );

    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_description TEXT,
      description TEXT,
      price REAL NOT NULL DEFAULT 0.00,
      compare_at_price REAL NULL,
      sku TEXT UNIQUE,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      designer_type TEXT NULL,
      design_id INTEGER NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
    );

    CREATE TABLE designs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      product_type TEXT NOT NULL,
      fabric_data TEXT NOT NULL,
      preview_image TEXT,
      width INTEGER DEFAULT 300,
      height INTEGER DEFAULT 300,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE product_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      attribute_name TEXT NOT NULL,
      attribute_value TEXT NOT NULL,
      price_modifier REAL NOT NULL DEFAULT 0.00,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      sku TEXT UNIQUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
    );

    CREATE TABLE product_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NULL,
      admin_id INTEGER NULL,
      action TEXT NOT NULL,
      changes TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL ON UPDATE CASCADE
    );

    -- Seed data
    INSERT INTO admins (email, password_hash, name, role) VALUES
    ('admin@memory-moments.local', '$2b$10$bCf89d.88IQJ0GVA3o6VUOIEJs0yKALw7ItbfKa0C3I5kzZrac6QS', 'Адміністратор', 'superadmin');

    INSERT INTO categories (name, slug, description, sort_order) VALUES
    ('Одяг', 'odyag', 'Футболки та текстиль', 1),
    ('Посуд', 'posud', 'Чашки та аксесуари', 2),
    ('Фотоформати', 'fotoformaty', 'Друк фото різних форматів', 3),
    ('Подарунки', 'podarunky', 'Готові ідеї для подарунків', 4);

    INSERT INTO products (category_id, name, slug, short_description, description, price, compare_at_price, sku, stock_quantity, designer_type, is_active, is_featured) VALUES
    (1, 'Футболка Premium', 'futbolka-premium', 'Бавовняна футболка з можливістю друку', 'Якісна бавовняна футболка 180 г/м². Друк DTG високої якості. Передня та задня сторона.', 599.00, 749.00, 'TSH-PREM-001', 100, 'crew-neck', 1, 1),
    (2, 'Чашка керамічна', 'chashka-keramichna', 'Білa чашка 330 мл з повнокольоровим друком', 'Керамічна чашка з друком навколо. Можна створити унікальний дизайн у конструкторі.', 349.00, NULL, 'MUG-CER-001', 50, 'mug', 1, 1),
    (3, 'Фото 10×15', 'foto-10x15', 'Класичний портретний формат', 'Друк фото 10×15 см на преміум папері.', 29.00, NULL, 'PHO-10X15', 999, 'photo-10x15', 1, 0),
    (3, 'Полароїд', 'polaroid', 'Стиль фото Polaroid з підписом', 'Друк у форматі полароїд з білим полем для підпису.', 49.00, 59.00, 'PHO-POLAR', 200, 'polaroid', 1, 1),
    (4, 'Instax Mini', 'instax-mini', 'Формат миттєвого фото', 'Друк у стилі Instax Mini — ідеальний подарунок.', 59.00, NULL, 'PHO-INSTAX', 150, 'instax-mini', 1, 0);

    INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary) VALUES
    (1, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&q=80', 'Футболка Premium', 0, 1),
    (2, 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=600&q=80', 'Чашка керамічна', 0, 1),
    (3, 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=600&q=80', 'Фото 10x15', 0, 1),
    (4, 'https://images.unsplash.com/photo-1493863641943-9b67165f6163?w=600&q=80', 'Полароїд', 0, 1),
    (5, 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=600&q=80', 'Instax Mini', 0, 1);

    INSERT INTO product_variants (product_id, attribute_name, attribute_value, price_modifier, stock_quantity, sku) VALUES
    (1, 'size', 'S', 0.00, 25, 'TSH-PREM-S'),
    (1, 'size', 'M', 0.00, 30, 'TSH-PREM-M'),
    (1, 'size', 'L', 0.00, 25, 'TSH-PREM-L'),
    (1, 'size', 'XL', 50.00, 20, 'TSH-PREM-XL'),
    (2, 'color', 'Білий', 0.00, 30, 'MUG-WHT'),
    (2, 'color', 'Чорний', 30.00, 20, 'MUG-BLK');
  `);
}

// Idempotent self-healing migrations — keep older databases in sync with the
// schema above without requiring the standalone migrate.js script to be run.
db.exec(`
  CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    product_type TEXT NOT NULL,
    fabric_data TEXT NOT NULL,
    preview_image TEXT,
    width INTEGER DEFAULT 300,
    height INTEGER DEFAULT 300,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT,
    shipping_address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'marketplace',
    subtotal REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    variant_id INTEGER,
    design_id INTEGER,
    design_data TEXT,
    design_preview TEXT,
    product_name TEXT NOT NULL,
    variant_label TEXT,
    unit_price REAL NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total REAL NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE
  );

  CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    code TEXT,
    name TEXT NOT NULL,
    format TEXT,
    price REAL,
    price_insta REAL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE ON UPDATE CASCADE
  );
`);

// Seed the price list from the bundled file on first run (empty services table).
const serviceCount = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
if (serviceCount === 0) {
  try {
    const priceFile = path.resolve(__dirname, "../data/priceList.json");
    const priceData = JSON.parse(fs.readFileSync(priceFile, "utf-8"));
    const insertCat = db.prepare(
      "INSERT INTO service_categories (name, sort_order) VALUES (?, ?)"
    );
    const insertSvc = db.prepare(
      `INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const seedPrices = db.transaction(() => {
      priceData.categories.forEach((cat, ci) => {
        const { lastInsertRowid: catId } = insertCat.run(cat.name, ci);
        cat.items.forEach((it, ii) => {
          insertSvc.run(
            catId,
            it.code || null,
            it.name,
            it.format || null,
            it.price ?? null,
            it.price_insta ?? null,
            ii
          );
        });
      });
    });
    seedPrices();
    console.log(`✅ Seeded price list: ${priceData.categories.length} categories`);
  } catch (e) {
    console.error("Price list seed skipped:", e.message);
  }
}

const productColumns = db.prepare("PRAGMA table_info(products)").all();
if (!productColumns.some((col) => col.name === "design_id")) {
  db.exec("ALTER TABLE products ADD COLUMN design_id INTEGER;");
}

const orderColumns = db.prepare("PRAGMA table_info(orders)").all();
if (orderColumns.length && !orderColumns.some((col) => col.name === "source")) {
  db.exec("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'marketplace';");
}

// variant_id у позиціях замовлення — потрібен, щоб списувати/повертати склад
// саме того варіанта (розмір/колір), а не лише товару в цілому.
const orderItemColumns = db.prepare("PRAGMA table_info(order_items)").all();
if (orderItemColumns.length && !orderItemColumns.some((col) => col.name === "variant_id")) {
  db.exec("ALTER TABLE order_items ADD COLUMN variant_id INTEGER;");
}

// design_data (fabric JSON макета) + design_preview (PNG-прев'ю) — щоб замовлення
// з конструктора зберігало сам макет покупця, а не лише прев'ю в Telegram.
const orderItemColumns2 = db.prepare("PRAGMA table_info(order_items)").all();
if (orderItemColumns2.length && !orderItemColumns2.some((col) => col.name === "design_data")) {
  db.exec("ALTER TABLE order_items ADD COLUMN design_data TEXT;");
}
if (orderItemColumns2.length && !orderItemColumns2.some((col) => col.name === "design_preview")) {
  db.exec("ALTER TABLE order_items ADD COLUMN design_preview TEXT;");
}
