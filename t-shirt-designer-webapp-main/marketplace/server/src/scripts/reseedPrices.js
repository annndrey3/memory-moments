/**
 * Reseed service_categories and services tables from priceList.json.
 * Clears existing records and re-inserts from the JSON source.
 * Run: node src/scripts/reseedPrices.js
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../marketplace.db");
const priceFile = path.resolve(__dirname, "../data/priceList.json");

const db = new Database(dbPath);
const priceData = JSON.parse(fs.readFileSync(priceFile, "utf-8"));

const clearCategories = db.prepare("DELETE FROM service_categories");
const insertCat = db.prepare(
  "INSERT INTO service_categories (name, sort_order) VALUES (?, ?)"
);
const insertSvc = db.prepare(
  `INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
);

const reseed = db.transaction(() => {
  clearCategories.run();

  priceData.categories.forEach((cat, ci) => {
    const { lastInsertRowid: catId } = insertCat.run(cat.name, ci);
    cat.items.forEach((item, ii) => {
      insertSvc.run(
        catId,
        item.code || null,
        item.name,
        item.format || null,
        item.price ?? null,
        item.price_insta ?? null,
        ii
      );
    });
  });
});

reseed();
db.close();

const verify = new Database(dbPath);
const catCount = verify.prepare("SELECT COUNT(*) AS c FROM service_categories").get().c;
const svcCount = verify.prepare("SELECT COUNT(*) AS c FROM services").get().c;
verify.close();

console.log(`✅ Reseed complete: ${catCount} categories, ${svcCount} services`);
