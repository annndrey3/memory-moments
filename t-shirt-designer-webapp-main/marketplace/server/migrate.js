import Database from 'better-sqlite3';

const db = new Database('marketplace.db');

try {
  // Create designs table
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Add design_id column to products if not exists
  const tableInfo = db.prepare("PRAGMA table_info(products)").all();
  const hasDesignId = tableInfo.some(col => col.name === 'design_id');
  
  if (!hasDesignId) {
    db.exec(`ALTER TABLE products ADD COLUMN design_id INTEGER;`);
    console.log('✅ Added design_id column to products');
  }

  console.log('✅ Migration applied successfully!');
  console.log('📊 Tables created:');
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  tables.forEach(t => console.log(`   - ${t.name}`));
  
} catch (err) {
  console.error('❌ Migration failed:', err.message);
} finally {
  db.close();
}
