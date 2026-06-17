import { Router } from "express";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { slugify, uniqueSlug } from "../utils/helpers.js";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const categories = await query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1 AND p.designer_type IS NULL
       WHERE c.is_active = 1
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.get("/admin/all", authMiddleware, async (_req, res) => {
  try {
    const categories = await query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id AND p.designer_type IS NULL
       GROUP BY c.id
       ORDER BY c.sort_order, c.name`
    );
    res.json(categories);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, description, parent_id, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const slug = await uniqueSlug({ query }, slugify(name), { table: "categories" });
    const result = await query(
      `INSERT INTO categories (name, slug, description, parent_id, sort_order)
       VALUES (:name, :slug, :description, :parent_id, :sort_order)`,
      { name, slug, description: description || null, parent_id: parent_id || null, sort_order }
    );
    res.status(201).json({ id: result.insertId, slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, sort_order, is_active, parent_id } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });

    const rows = await query("SELECT id FROM categories WHERE id = :id", { id });
    if (!rows.length) return res.status(404).json({ error: "Not found" });

    await query(
      `UPDATE categories
       SET name = :name,
           description = :description,
           sort_order = :sort_order,
           is_active = :is_active,
           parent_id = :parent_id,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        name,
        description: description || null,
        sort_order: sort_order ?? 0,
        is_active: is_active ? 1 : 0,
        parent_id: parent_id || null,
      }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const [row] = await query(
      "SELECT COUNT(*) AS cnt FROM products WHERE category_id = :id AND designer_type IS NULL",
      { id }
    );
    if (row.cnt > 0) {
      return res.status(409).json({
        error: `Неможливо видалити: у категорії є ${row.cnt} товар(ів). Спочатку перемістіть або видаліть товари.`,
      });
    }

    // Перемістити designer_type товари в іншу категорію перед видаленням,
    // щоб не порушити FK constraint (category_id NOT NULL).
    const [fallback] = await query(
      "SELECT id FROM categories WHERE id != :id ORDER BY id LIMIT 1",
      { id }
    );
    if (fallback) {
      await query(
        "UPDATE products SET category_id = :fallback WHERE category_id = :id AND designer_type IS NOT NULL",
        { fallback: fallback.id, id }
      );
    }

    await query("DELETE FROM categories WHERE id = :id", { id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to delete category" });
  }
});

export default router;
