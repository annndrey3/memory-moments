import { Router } from "express";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { findCustomerByContact, normalizeEmail, phoneKey } from "../utils/customers.js";

const router = Router();
router.use(authMiddleware);

// GET /api/admin/customers?search=&limit=100
router.get("/", requirePermission("orders.view"), async (req, res) => {
  try {
    const { search, limit = 100 } = req.query;
    let sql = "SELECT * FROM customers";
    const params = {};

    if (search?.trim()) {
      // LOWER(...) LIKE LOWER(...) — case-insensitive і в PostgreSQL, і в SQLite
      sql += " WHERE LOWER(name) LIKE LOWER(:s) OR LOWER(email) LIKE LOWER(:s) OR phone LIKE :s";
      params.s = `%${search.trim()}%`;
    }

    sql += " ORDER BY created_at DESC LIMIT :limit";
    params.limit = Number(limit);

    const rows = await query(sql, params);
    res.json({ items: rows, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Не вдалося отримати клієнтів" });
  }
});

// POST /api/admin/customers — додає лише нового; дублі звіряються за email АБО телефоном.
router.post("/", requirePermission("orders.manage"), async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Ім'я обов'язкове" });
    }

    const cleanEmail = normalizeEmail(email);
    const cleanPhone = phone?.trim() || null;

    // Прив'язка йде за телефоном або email — потрібен хоча б один контакт.
    if (!cleanEmail && !phoneKey(cleanPhone)) {
      return res.status(400).json({ error: "Вкажіть email або телефон" });
    }

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (cleanEmail && !emailRe.test(cleanEmail)) {
      return res.status(400).json({ error: "Невалідний email" });
    }

    const existing = await findCustomerByContact({ email: cleanEmail, phone: cleanPhone });
    if (existing) {
      return res.status(409).json({ error: "Клієнт з таким email або телефоном вже існує" });
    }

    const result = await query(
      `INSERT INTO customers (name, email, phone, notes, source)
       VALUES (:name, :email, :phone, :notes, 'manual')`,
      {
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        notes: notes?.trim() || null,
      }
    );

    const [created] = await query(
      "SELECT * FROM customers WHERE id = :id",
      { id: result.insertId }
    );
    res.status(201).json({ customer: created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Не вдалося створити клієнта" });
  }
});

// DELETE /api/admin/customers/:id
router.delete("/:id", requirePermission("orders.manage"), async (req, res) => {
  try {
    const [c] = await query("SELECT id FROM customers WHERE id = :id", { id: req.params.id });
    if (!c) return res.status(404).json({ error: "Клієнта не знайдено" });
    await query("DELETE FROM customers WHERE id = :id", { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Не вдалося видалити клієнта" });
  }
});

export default router;
