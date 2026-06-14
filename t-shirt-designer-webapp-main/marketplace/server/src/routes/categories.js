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
       LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
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

export default router;
