-- Memory Moments Marketplace — SQLite Schema
-- Engine: better-sqlite3, foreign_keys = ON, WAL journal mode
-- Source of truth: marketplace/server/src/config/db.js

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',   -- 'admin' | 'superadmin'
  permissions   TEXT NULL,                        -- JSON array; NULL = superadmin (all access)
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id   INTEGER NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE designs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,
  description   TEXT,
  product_type  TEXT NOT NULL,   -- 'crew-neck' | 'mug' | 'polaroid' | 'instax-mini' | 'photo-*'
  fabric_data   TEXT NOT NULL,   -- Fabric.js JSON
  preview_image TEXT,            -- base64 data URL or path
  width         INTEGER DEFAULT 300,
  height        INTEGER DEFAULT 300,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id       INTEGER NOT NULL,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  short_description TEXT,
  description       TEXT,
  price             REAL NOT NULL DEFAULT 0.00,
  compare_at_price  REAL NULL,
  sku               TEXT UNIQUE,
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  designer_type     TEXT NULL,    -- links to PRODUCT_TYPES key in constructor
  design_id         INTEGER NULL, -- linked design template
  is_active         INTEGER NOT NULL DEFAULT 1,
  is_featured       INTEGER NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  image_url  TEXT NOT NULL,
  alt_text   TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE product_variants (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id      INTEGER NOT NULL,
  attribute_name  TEXT NOT NULL,   -- e.g. 'size', 'color'
  attribute_value TEXT NOT NULL,
  price_modifier  REAL NOT NULL DEFAULT 0.00,
  stock_quantity  INTEGER NOT NULL DEFAULT 0,
  sku             TEXT UNIQUE,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE product_audit_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NULL,
  admin_id   INTEGER NULL,
  action     TEXT NOT NULL,  -- 'create' | 'update' | 'delete' | 'activate' | 'deactivate'
  changes    TEXT,           -- JSON diff
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE,
  FOREIGN KEY (admin_id)   REFERENCES admins(id)   ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT NOT NULL UNIQUE,
  customer_name    TEXT NOT NULL,
  customer_email   TEXT NOT NULL,
  customer_phone   TEXT,
  shipping_address TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',      -- pending|paid|shipped|completed|cancelled
  source           TEXT NOT NULL DEFAULT 'marketplace',  -- 'marketplace' | 'designer'
  subtotal         REAL NOT NULL DEFAULT 0,
  total            REAL NOT NULL DEFAULT 0,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL,
  product_id     INTEGER NULL,   -- SET NULL if product deleted; snapshot in product_name
  variant_id     INTEGER NULL,
  design_id      INTEGER NULL,
  design_data    TEXT,           -- Fabric.js JSON макета покупця
  design_preview TEXT,           -- URL PNG прев'ю
  product_name   TEXT NOT NULL,  -- snapshot at order time
  variant_label  TEXT,
  unit_price     REAL NOT NULL DEFAULT 0,
  quantity       INTEGER NOT NULL DEFAULT 1,
  line_total     REAL NOT NULL DEFAULT 0,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE service_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE services (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  code        TEXT,
  name        TEXT NOT NULL,
  format      TEXT,
  price       REAL,
  price_insta REAL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
