import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { getSetting } from "../utils/settings.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(xlsx|xls|ods|csv)$/i.test(file.originalname);
    cb(ok ? null : new Error("Непідтримуваний формат файлу"), ok);
  },
});

const GEMINI_MODEL = "gemini-1.5-flash";

const EXTRACT_PROMPT = `
Ти — асистент для обробки прайс-листів фотосалону.
Я передаю тобі таблицю (CSV або текст) з цінами на послуги.

Твоє завдання — витягнути з неї структуровані дані та повернути ТІЛЬКИ валідний JSON-масив без жодного пояснення, коментарів чи форматування (без \`\`\`).

Формат кожного елементу:
{
  "category": "назва категорії (рядок або секція)",
  "name": "назва послуги",
  "format": "формат (розмір) або null",
  "price": число або null,
  "price_insta": число або null
}

Правила:
- Якщо є одна колонка ціни — клади в "price", price_insta = null.
- Якщо є дві цінові колонки (роздріб + інста/опт/оптова) — перша в price, друга в price_insta.
- Якщо в клітинці є символ валюти (₴, грн, UAH) — прибери його, залиш тільки число.
- Якщо рядок є заголовком категорії (без ціни) — використовуй його як "category" для наступних рядків.
- Пропускай порожні рядки, заголовки таблиці, підсумки.
- Якщо формат вказаний окремим стовпцем — перенеси в "format". Якщо вбудований у назву — залиш у "name", format = null.

Таблиця:
`;

// POST /api/prices/import/preview
// Отримує Excel/CSV, аналізує через Gemini, повертає масив рядків для прев'ю.
router.post("/preview", authMiddleware, requirePermission("services.manage"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });

    // Ключ з БД (налаштування адмінки) має пріоритет над .env
    const apiKey = (await getSetting("gemini_api_key")) || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Gemini API ключ не налаштовано. Вкажіть його в Налаштуваннях адмінки." });

    // Парсимо Excel → CSV-текст
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const csvText = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName], { blankrows: false });

    if (!csvText.trim()) return res.status(400).json({ error: "Файл порожній або не містить даних" });

    // Надсилаємо до Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(EXTRACT_PROMPT + csvText);
    const text = result.response.text().trim();

    // Витягуємо JSON з відповіді (Gemini іноді огортає у ```)
    const jsonStr = text.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "").trim();
    let rows;
    try {
      rows = JSON.parse(jsonStr);
    } catch {
      return res.status(422).json({ error: "Gemini повернув некоректний JSON", raw: text.slice(0, 500) });
    }

    if (!Array.isArray(rows)) return res.status(422).json({ error: "Gemini повернув не масив", raw: text.slice(0, 500) });

    // Базова валідація рядків
    const cleaned = rows
      .filter((r) => r && typeof r.name === "string" && r.name.trim())
      .map((r) => ({
        category: String(r.category || "Загальне").trim(),
        name: String(r.name).trim(),
        format: r.format ? String(r.format).trim() : null,
        price: r.price != null && !isNaN(Number(r.price)) ? Number(r.price) : null,
        price_insta: r.price_insta != null && !isNaN(Number(r.price_insta)) ? Number(r.price_insta) : null,
      }));

    res.json({ rows: cleaned, sheet: sheetName });
  } catch (err) {
    console.error("priceImport/preview:", err);
    res.status(500).json({ error: err.message || "Помилка аналізу файлу" });
  }
});

// POST /api/prices/import/apply
// Приймає масив рядків (підтверджений юзером) і оновлює/створює послуги в БД.
router.post("/apply", authMiddleware, requirePermission("services.manage"), async (req, res) => {
  try {
    const { rows } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "Порожній масив рядків" });
    }

    let created = 0;
    let updated = 0;

    // Кеш категорій (name → id) щоб не дублювати запити
    const catCache = {};
    const getCategoryId = async (name) => {
      const key = name.toLowerCase();
      if (catCache[key]) return catCache[key];
      const existing = await query(
        "SELECT id FROM service_categories WHERE lower(name) = :key LIMIT 1",
        { key }
      );
      if (existing.length) {
        catCache[key] = existing[0].id;
        return existing[0].id;
      }
      const ins = await query(
        "INSERT INTO service_categories (name, sort_order) VALUES (:name, 0)",
        { name }
      );
      catCache[key] = ins.insertId;
      return ins.insertId;
    };

    for (const row of rows) {
      if (!row.name?.trim()) continue;
      const categoryId = await getCategoryId(row.category || "Загальне");

      // Шукаємо послугу за назвою (і категорією) — оновлюємо якщо знайшли
      const existing = await query(
        "SELECT id FROM services WHERE category_id = :category_id AND lower(name) = :name LIMIT 1",
        { category_id: categoryId, name: row.name.toLowerCase() }
      );

      if (existing.length) {
        await query(
          `UPDATE services SET
             format = :format,
             price = CASE WHEN :price IS NOT NULL THEN :price ELSE price END,
             price_insta = CASE WHEN :price_insta IS NOT NULL THEN :price_insta ELSE price_insta END,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = :id`,
          {
            id: existing[0].id,
            format: row.format ?? null,
            price: row.price ?? null,
            price_insta: row.price_insta ?? null,
          }
        );
        updated++;
      } else {
        await query(
          `INSERT INTO services (category_id, name, format, price, price_insta, sort_order)
           VALUES (:category_id, :name, :format, :price, :price_insta, 0)`,
          {
            category_id: categoryId,
            name: row.name,
            format: row.format ?? null,
            price: row.price ?? null,
            price_insta: row.price_insta ?? null,
          }
        );
        created++;
      }
    }

    res.json({ created, updated, total: created + updated });
  } catch (err) {
    console.error("priceImport/apply:", err);
    res.status(500).json({ error: err.message || "Помилка оновлення БД" });
  }
});

export default router;
