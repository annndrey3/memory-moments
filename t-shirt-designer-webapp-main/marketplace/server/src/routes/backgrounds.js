// Готові фони для альбомів (фотокниг) — керуються з адмінки, конструктор тягне
// активні через публічний GET. Зображення вантажиться окремо (/api/upload).
import { Router } from "express";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Public: активні фони для конструктора.
router.get("/", async (_req, res) => {
  try {
    const rows = await query(
      "SELECT id, image_url, name FROM backgrounds WHERE is_active = 1 ORDER BY sort_order, id"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch backgrounds" });
  }
});

// Admin: усі фони.
router.get("/admin/all", authMiddleware, async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM backgrounds ORDER BY sort_order, id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch backgrounds" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { image_url, name, sort_order = 0, is_active = 1 } = req.body;
    if (!image_url) return res.status(400).json({ error: "Потрібне зображення фону" });
    const result = await query(
      `INSERT INTO backgrounds (image_url, name, sort_order, is_active)
       VALUES (:image_url, :name, :sort_order, :is_active)`,
      { image_url, name: name || null, sort_order: Number(sort_order) || 0, is_active: is_active ? 1 : 0 }
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create background" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query("SELECT id FROM backgrounds WHERE id = :id", { id });
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const { name, sort_order, is_active } = req.body;
    await query(
      `UPDATE backgrounds SET name = :name, sort_order = :sort_order, is_active = :is_active,
       updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { id, name: name || null, sort_order: Number(sort_order) || 0, is_active: is_active ? 1 : 0 }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update background" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM backgrounds WHERE id = :id", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete background" });
  }
});

export default router;
