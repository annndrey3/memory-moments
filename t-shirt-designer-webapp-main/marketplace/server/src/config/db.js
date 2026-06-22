import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// .env МАЄ бути завантажений тут — на рівні модуля нижче ми читаємо
// process.env.DATABASE_URL, щоб вибрати драйвер (PostgreSQL/SQLite). Через
// підняття ES-імпортів db.js виконується РАНІШЕ за dotenv.config() в index.js,
// тому без цього рядка DATABASE_URL із .env не видно і застосунок мовчки
// стартує на SQLite. dotenv.config() ідемпотентний — повторні виклики не шкодять.
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Named-param converter :name → $1, $2, … ─────────────────────────
// Shared by the PostgreSQL driver; SQLite uses named params natively.
function namedToPositional(sql, params = {}) {
  const values = [];
  const seen = {};
  const text = sql.replace(/:(\w+)/g, (_, name) => {
    if (!(name in seen)) {
      seen[name] = values.length + 1;
      values.push(params[name] ?? null);
    }
    return `$${seen[name]}`;
  });
  return { text, values };
}

let _query, _transaction, _pool;

// ═══════════════════════════════════════════════════════════════════════
// PostgreSQL  (activated by DATABASE_URL env var)
// ═══════════════════════════════════════════════════════════════════════
if (process.env.DATABASE_URL) {
  const { default: pg } = await import("pg");
  const { Pool } = pg;

  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  console.log("✅ Using PostgreSQL");

  _query = async (sql, params = {}) => {
    // Дзеркалимо поведінку SQLite-гілки: SELECT/WITH → масив рядків; мутації →
    // { insertId, affectedRows }. Для INSERT авто-додаємо RETURNING id (окрім
    // settings: PK = key, колонки id немає), щоб insertId був доступний і через
    // плейн query(), а не лише в transaction().tx.run. Без цього на Postgres
    // result.insertId === undefined ламав admin-create та Excel-імпорт нових рядків.
    const trimmed = sql.trim();
    const isRead = /^\s*(SELECT|WITH)/i.test(trimmed);
    const isInsert = /^\s*INSERT/i.test(trimmed);
    const intoSettings = /^\s*INSERT\s+INTO\s+settings\b/i.test(trimmed);
    const finalSql =
      isInsert && !intoSettings && !/RETURNING/i.test(trimmed)
        ? trimmed.replace(/;?\s*$/, "") + " RETURNING id"
        : sql;
    const { text, values } = namedToPositional(finalSql, params);
    const result = await _pool.query(text, values);
    if (isRead) return result.rows;
    return { insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount };
  };

  _transaction = async (fn) => {
    const client = await _pool.connect();
    try {
      await client.query("BEGIN");
      const tx = {
        run: async (sql, params = {}) => {
          // Auto-append RETURNING id to INSERT so callers get insertId.
          // Виняток — settings: PK = key, колонки id немає (інакше "column id does not exist").
          // Її upsert-и (лічильник номерів замовлень) insertId не потребують.
          const isInsert = /^\s*INSERT/i.test(sql);
          const intoSettings = /^\s*INSERT\s+INTO\s+settings\b/i.test(sql);
          const finalSql =
            isInsert && !intoSettings && !/RETURNING/i.test(sql)
              ? sql.replace(/;?\s*$/, "") + " RETURNING id"
              : sql;
          const { text, values } = namedToPositional(finalSql, params);
          const result = await client.query(text, values);
          return { insertId: result.rows[0]?.id ?? null, affectedRows: result.rowCount };
        },
        all: async (sql, params = {}) => {
          const { text, values } = namedToPositional(sql, params);
          return (await client.query(text, values)).rows;
        },
        get: async (sql, params = {}) => {
          const { text, values } = namedToPositional(sql, params);
          return (await client.query(text, values)).rows[0] ?? null;
        },
      };
      const result = await fn(tx);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch { /* */ }
      throw e;
    } finally {
      client.release();
    }
  };

  // Idempotent schema init for PostgreSQL
  await _pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      permissions TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS categories (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      image_url TEXT,
      parent_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS products (
      id BIGSERIAL PRIMARY KEY,
      category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_description TEXT,
      description TEXT,
      price NUMERIC(12,2) NOT NULL DEFAULT 0,
      compare_at_price NUMERIC(12,2),
      sku TEXT UNIQUE,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      designer_type TEXT,
      design_id BIGINT,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS designs (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      product_type TEXT NOT NULL,
      fabric_data TEXT NOT NULL,
      preview_image TEXT,
      width INTEGER DEFAULT 300,
      height INTEGER DEFAULT 300,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_variants (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      attribute_name TEXT NOT NULL,
      attribute_value TEXT NOT NULL,
      price_modifier NUMERIC(12,2) NOT NULL DEFAULT 0,
      stock_quantity INTEGER NOT NULL DEFAULT 0,
      sku TEXT UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS product_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      product_id BIGINT,
      admin_id BIGINT,
      action TEXT NOT NULL,
      changes TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id BIGSERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      customer_phone TEXT,
      shipping_address TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      source TEXT NOT NULL DEFAULT 'marketplace',
      subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
      total NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
      variant_id BIGINT,
      design_id BIGINT,
      design_data TEXT,
      design_preview TEXT,
      product_name TEXT NOT NULL,
      variant_label TEXT,
      unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS service_categories (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS services (
      id BIGSERIAL PRIMARY KEY,
      category_id BIGINT NOT NULL REFERENCES service_categories(id) ON DELETE CASCADE,
      code TEXT,
      name TEXT NOT NULL,
      format TEXT,
      price NUMERIC(12,2),
      price_insta NUMERIC(12,2),
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS slides (
      id BIGSERIAL PRIMARY KEY,
      image_url TEXT,
      title TEXT,
      subtitle TEXT,
      link TEXT,
      cta_label TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS backgrounds (
      id BIGSERIAL PRIMARY KEY,
      image_url TEXT NOT NULL,
      name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id BIGSERIAL PRIMARY KEY,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Default admin (idempotent)
  await _pool.query(`
    INSERT INTO admins (email, password_hash, name, role)
    VALUES ('admin@memory-moments.local',
            '$2b$10$bCf89d.88IQJ0GVA3o6VUOIEJs0yKALw7ItbfKa0C3I5kzZrac6QS',
            'Адміністратор', 'superadmin')
    ON CONFLICT (email) DO NOTHING
  `);

  // Idempotent column migrations (PostgreSQL)
  await _pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT;");
  // Клієнти із замовлень конструктора часто без email (там обов'язковий лише телефон).
  await _pool.query("ALTER TABLE customers ALTER COLUMN email DROP NOT NULL;");
  // Ідемпотентність замовлення + статус сповіщення власника.
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;");
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS notify_status TEXT NOT NULL DEFAULT 'pending';");
  // Знижка на друк фото за кількістю — сума знижки (₴) на замовлення.
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;");
  // ZIP-архів фотокниги (збирається фоном): посилання + статус (pending/ready/failed).
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS archive_url TEXT;");
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS archive_status TEXT;");
  // Доставка фото клієнтів у сховище дизайнера (SFTP): статус/час/спроби.
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_delivery_status TEXT;");
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_delivery_at TIMESTAMP;");
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS photo_delivery_attempts INTEGER NOT NULL DEFAULT 0;");
  // Причина скасування (показуємо в адмінці + у листі клієнту).
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;");
  // Номер ТТН (Нова Пошта) — вводиться при статусі «Відправлено», йде клієнту в листі.
  await _pool.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;");
  // Пріоритет відображення товару у вітрині (більше = вище). Керується в адмінці.
  await _pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;");
  // Частковий унікальний індекс: дублі ключа заборонені, але багато NULL дозволені.
  await _pool.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;");

// ═══════════════════════════════════════════════════════════════════════
// SQLite  (default when DATABASE_URL is not set)
// ═══════════════════════════════════════════════════════════════════════
} else {
  const { default: Database } = await import("better-sqlite3");
  const dbPath = path.resolve(__dirname, "../../marketplace.db");
  const isNewDb = !fs.existsSync(dbPath);
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  console.log("✅ Using SQLite:", dbPath);

  _query = async (sql, params = {}) => {
    try {
      const stmt = db.prepare(sql);
      if (/^\s*(SELECT|PRAGMA)/i.test(sql.trim())) return stmt.all(params);
      const info = stmt.run(params);
      return { insertId: info.lastInsertRowid, affectedRows: info.changes };
    } catch (e) {
      if (e.message?.includes("UNIQUE constraint failed")) e.code = "ER_DUP_ENTRY";
      throw e;
    }
  };

  // Async-compatible transaction: tx methods return Promise.resolve of sync results.
  // Node.js is single-threaded and all SQLite ops complete before any microtask yields,
  // so manual BEGIN/COMMIT is safe — no concurrent transaction can interleave.
  _transaction = async (fn) => {
    const tx = {
      run: (sql, params = {}) => {
        try {
          const info = db.prepare(sql).run(params);
          return Promise.resolve({ insertId: info.lastInsertRowid, affectedRows: info.changes });
        } catch (e) {
          if (e.message?.includes("UNIQUE constraint failed")) e.code = "ER_DUP_ENTRY";
          return Promise.reject(e);
        }
      },
      all: (sql, params = {}) => Promise.resolve(db.prepare(sql).all(params)),
      get: (sql, params = {}) => Promise.resolve(db.prepare(sql).get(params) ?? null),
    };
    db.exec("BEGIN");
    try {
      const result = await fn(tx);
      db.exec("COMMIT");
      return result;
    } catch (e) {
      try { db.exec("ROLLBACK"); } catch { /* */ }
      throw e;
    }
  };

  // Initialize schema if new database
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
        image_url TEXT NULL,
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

  // Idempotent self-healing migrations
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
    CREATE TABLE IF NOT EXISTS slides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT,
      title TEXT,
      subtitle TEXT,
      link TEXT,
      cta_label TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS backgrounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      name TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed price list on first run
  const serviceCount = db.prepare("SELECT COUNT(*) AS c FROM services").get().c;
  if (serviceCount === 0) {
    try {
      const priceFile = path.resolve(__dirname, "../data/priceList.json");
      const priceData = JSON.parse(fs.readFileSync(priceFile, "utf-8"));
      const insertCat = db.prepare("INSERT INTO service_categories (name, sort_order) VALUES (?, ?)");
      const insertSvc = db.prepare(
        `INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      db.transaction(() => {
        priceData.categories.forEach((cat, ci) => {
          const { lastInsertRowid: catId } = insertCat.run(cat.name, ci);
          cat.items.forEach((it, ii) => {
            insertSvc.run(catId, it.code || null, it.name, it.format || null, it.price ?? null, it.price_insta ?? null, ii);
          });
        });
      })();
      console.log(`✅ Seeded price list: ${priceData.categories.length} categories`);
    } catch (e) {
      console.error("Price list seed skipped:", e.message);
    }
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Робимо email необов'язковим, якщо таблиця створена раніше з NOT NULL.
  // SQLite не вміє DROP NOT NULL через ALTER — перебудовуємо таблицю.
  const customerCols = db.prepare("PRAGMA table_info(customers)").all();
  const emailCol = customerCols.find((c) => c.name === "email");
  if (emailCol && emailCol.notnull === 1) {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE customers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT,
          notes TEXT,
          source TEXT NOT NULL DEFAULT 'manual',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO customers_new (id, name, email, phone, notes, source, created_at, updated_at)
          SELECT id, name, NULLIF(email, ''), phone, notes, source, created_at, updated_at FROM customers;
        DROP TABLE customers;
        ALTER TABLE customers_new RENAME TO customers;
      `);
    })();
  }

  // Column migrations (idempotent)
  const adminCols = db.prepare("PRAGMA table_info(admins)").all();
  if (!adminCols.some((c) => c.name === "permissions")) {
    db.exec("ALTER TABLE admins ADD COLUMN permissions TEXT NULL;");
  }

  const catCols = db.prepare("PRAGMA table_info(categories)").all();
  if (catCols.length && !catCols.some((c) => c.name === "image_url")) {
    db.exec("ALTER TABLE categories ADD COLUMN image_url TEXT NULL;");
  }

  const productCols = db.prepare("PRAGMA table_info(products)").all();
  if (!productCols.some((c) => c.name === "design_id")) {
    db.exec("ALTER TABLE products ADD COLUMN design_id INTEGER;");
  }
  if (!productCols.some((c) => c.name === "sort_order")) {
    db.exec("ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;");
  }

  const orderCols = db.prepare("PRAGMA table_info(orders)").all();
  if (orderCols.length && !orderCols.some((c) => c.name === "source")) {
    db.exec("ALTER TABLE orders ADD COLUMN source TEXT NOT NULL DEFAULT 'marketplace';");
  }

  const oiCols = db.prepare("PRAGMA table_info(order_items)").all();
  if (oiCols.length && !oiCols.some((c) => c.name === "variant_id")) {
    db.exec("ALTER TABLE order_items ADD COLUMN variant_id INTEGER;");
  }
  if (oiCols.length && !oiCols.some((c) => c.name === "design_data")) {
    db.exec("ALTER TABLE order_items ADD COLUMN design_data TEXT;");
  }
  if (oiCols.length && !oiCols.some((c) => c.name === "design_preview")) {
    db.exec("ALTER TABLE order_items ADD COLUMN design_preview TEXT;");
  }

  // Ідемпотентність замовлення + статус сповіщення власника.
  if (orderCols.length && !orderCols.some((c) => c.name === "idempotency_key")) {
    db.exec("ALTER TABLE orders ADD COLUMN idempotency_key TEXT;");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "notify_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN notify_status TEXT NOT NULL DEFAULT 'pending';");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "discount")) {
    db.exec("ALTER TABLE orders ADD COLUMN discount REAL NOT NULL DEFAULT 0;");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "archive_url")) {
    db.exec("ALTER TABLE orders ADD COLUMN archive_url TEXT;");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "archive_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN archive_status TEXT;");
  }
  // Доставка фото клієнтів у сховище дизайнера (SFTP).
  if (orderCols.length && !orderCols.some((c) => c.name === "photo_delivery_status")) {
    db.exec("ALTER TABLE orders ADD COLUMN photo_delivery_status TEXT;");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "photo_delivery_at")) {
    db.exec("ALTER TABLE orders ADD COLUMN photo_delivery_at DATETIME;");
  }
  if (orderCols.length && !orderCols.some((c) => c.name === "photo_delivery_attempts")) {
    db.exec("ALTER TABLE orders ADD COLUMN photo_delivery_attempts INTEGER NOT NULL DEFAULT 0;");
  }
  // Причина скасування (показуємо в адмінці + у листі клієнту).
  if (orderCols.length && !orderCols.some((c) => c.name === "cancel_reason")) {
    db.exec("ALTER TABLE orders ADD COLUMN cancel_reason TEXT;");
  }
  // Номер ТТН (Нова Пошта) — при статусі «Відправлено».
  if (orderCols.length && !orderCols.some((c) => c.name === "tracking_number")) {
    db.exec("ALTER TABLE orders ADD COLUMN tracking_number TEXT;");
  }
  // Частковий унікальний індекс: дублі ключа заборонені, NULL дозволені.
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idem ON orders(idempotency_key) WHERE idempotency_key IS NOT NULL;");
}

// Named exports — the only ones imported by route files.
export const query = _query;
export const transaction = _transaction;
// Backward-compat default (designs.js imports `pool` but never uses it).
export default _pool ?? {};
