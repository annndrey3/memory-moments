-- Migration: Add Designs table for storing design data
-- Created: 2026-06-14

-- Create designs table
CREATE TABLE designs (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL UNIQUE,
  description     TEXT,
  product_type    VARCHAR(60) NOT NULL COMMENT 'crew-neck, mug, polaroid, instax-mini, photo-10x15, photo-15x10',
  fabric_data     LONGTEXT NOT NULL COMMENT 'JSON fabric.js canvas data',
  preview_image   VARCHAR(500) COMMENT 'Base64 or URL for preview thumbnail',
  width           INT DEFAULT 300,
  height          INT DEFAULT 300,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_designs_product_type (product_type),
  INDEX idx_designs_created_at (created_at)
) ENGINE=InnoDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add design_id column to products table
ALTER TABLE products ADD COLUMN design_id INT UNSIGNED NULL AFTER designer_type;

-- Add foreign key constraint
ALTER TABLE products 
ADD CONSTRAINT fk_products_design
FOREIGN KEY (design_id) REFERENCES designs(id)
ON DELETE SET NULL 
ON UPDATE CASCADE;

-- Add index for performance
CREATE INDEX idx_products_design_id ON products(design_id);

-- Note: To run this migration, execute:
-- mysql -u root -p memory_moments_marketplace < migrations/001_add_designs_table.sql
