-- Memory Moments Marketplace — MySQL Schema
-- Charset: utf8mb4 for Ukrainian text support

CREATE DATABASE IF NOT EXISTS memory_moments_marketplace
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE memory_moments_marketplace;

-- ─── Admins ───────────────────────────────────────────────────────────────────
CREATE TABLE admins (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(120) NOT NULL,
  role          ENUM('admin', 'superadmin') NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ─── Categories ─────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(120) NOT NULL,
  slug        VARCHAR(140) NOT NULL UNIQUE,
  description TEXT,
  parent_id   INT UNSIGNED NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_id) REFERENCES categories(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ─── Products ─────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id        INT UNSIGNED NOT NULL,
  name               VARCHAR(255) NOT NULL,
  slug               VARCHAR(280) NOT NULL UNIQUE,
  short_description  VARCHAR(500),
  description        TEXT,
  price              DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  compare_at_price   DECIMAL(10, 2) NULL,
  sku                VARCHAR(80) UNIQUE,
  stock_quantity     INT NOT NULL DEFAULT 0,
  designer_type      VARCHAR(60) NULL COMMENT 'Link to designer PRODUCT_TYPES key',
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  is_featured        TINYINT(1) NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_products_active_featured (is_active, is_featured),
  INDEX idx_products_category (category_id)
) ENGINE=InnoDB;

-- ─── Product Images ───────────────────────────────────────────────────────────
CREATE TABLE product_images (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED NOT NULL,
  image_url   VARCHAR(500) NOT NULL,
  alt_text    VARCHAR(255),
  sort_order  INT NOT NULL DEFAULT 0,
  is_primary  TINYINT(1) NOT NULL DEFAULT 0,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_product_images_primary (product_id, is_primary)
) ENGINE=InnoDB;

-- ─── Product Variants ───────────────────────────────────────────────────────────
CREATE TABLE product_variants (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id      INT UNSIGNED NOT NULL,
  attribute_name  VARCHAR(60) NOT NULL COMMENT 'e.g. color, size',
  attribute_value VARCHAR(120) NOT NULL,
  price_modifier  DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock_quantity  INT NOT NULL DEFAULT 0,
  sku             VARCHAR(80) UNIQUE,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_variants_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_product_variants_product (product_id)
) ENGINE=InnoDB;

-- ─── Audit Log ──────────────────────────────────────────────────────────────────
CREATE TABLE product_audit_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NULL,
  admin_id   INT UNSIGNED NULL,
  action     ENUM('create', 'update', 'delete', 'activate', 'deactivate') NOT NULL,
  changes    JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_audit_admin
    FOREIGN KEY (admin_id) REFERENCES admins(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;
