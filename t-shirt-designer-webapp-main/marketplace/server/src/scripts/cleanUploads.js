/**
 * Чищення папки uploads/ від файлів замовлень старших N днів.
 * Безпечно: зберігає зображення товарів (product_images), видаляє тільки:
 *   - print_*   (PNG для друку з конструктора)
 *   - photo-*   (фото клієнтів для фото-замовлень)
 *
 * Запуск вручну:  node src/scripts/cleanUploads.js [--days=30] [--dry-run]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads"));
const DB_PATH    = path.resolve(__dirname, "../../../marketplace.db");

const args     = Object.fromEntries(process.argv.slice(2).map(a => a.replace("--","").split("=")));
const DAYS     = Number(args.days ?? 30);
const DRY_RUN  = "dry-run" in args;
const CUTOFF   = Date.now() - DAYS * 24 * 60 * 60 * 1000;

console.log(`\n🧹 cleanUploads  days=${DAYS}  dry-run=${DRY_RUN}`);
console.log(`   uploads dir : ${UPLOAD_DIR}`);
console.log(`   cutoff      : ${new Date(CUTOFF).toISOString()}\n`);

// Завантажуємо всі URL, які ще активно використовуються в БД
const db = new Database(DB_PATH, { readonly: true });

const activeUrls = new Set();

// Зображення товарів — ніколи не чіпаємо
db.prepare("SELECT image_url FROM product_images").all()
  .forEach(r => activeUrls.add(path.basename(r.image_url)));

// design_data може містити printFrontUrl / printBackUrl / photoUrl зі свіжих замовлень
db.prepare(`
  SELECT di.design_data
  FROM order_items di
  JOIN orders o ON o.id = di.order_id
  WHERE o.created_at >= datetime('now', '-${DAYS} days')
`).all().forEach(({ design_data }) => {
  try {
    const d = JSON.parse(design_data || "{}");
    [d.printFrontUrl, d.printBackUrl, d.photoUrl].forEach(u => {
      if (u) activeUrls.add(path.basename(u));
    });
  } catch { /* */ }
});

db.close();

// Проходимо по файлах
const CLEAN_PREFIXES = ["print_", "photo-"];

let deleted = 0, skipped = 0, sizeFreed = 0;

for (const file of fs.readdirSync(UPLOAD_DIR)) {
  if (!CLEAN_PREFIXES.some(p => file.startsWith(p))) continue;
  if (activeUrls.has(file)) { skipped++; continue; }

  const fullPath = path.join(UPLOAD_DIR, file);
  const { mtimeMs, size } = fs.statSync(fullPath);
  if (mtimeMs > CUTOFF) { skipped++; continue; }

  if (DRY_RUN) {
    console.log(`  [dry] would delete  ${file}  (${(size / 1024).toFixed(0)} KB)`);
  } else {
    fs.unlinkSync(fullPath);
    console.log(`  deleted  ${file}  (${(size / 1024).toFixed(0)} KB)`);
  }
  deleted++;
  sizeFreed += size;
}

console.log(`\n✅  ${DRY_RUN ? "[dry-run] " : ""}deleted=${deleted}  skipped=${skipped}  freed=${(sizeFreed / 1024 / 1024).toFixed(2)} MB\n`);
