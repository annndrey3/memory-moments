import { Router } from "express";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

function groupByCategory(categories, services) {
  const byCat = {};
  for (const s of services) {
    (byCat[s.category_id] ||= []).push(s);
  }
  return categories.map((c) => ({ ...c, services: byCat[c.id] || [] }));
}

// GET /api/services — public price list (active only).
router.get("/", async (_req, res) => {
  try {
    const categories = await query(
      "SELECT * FROM service_categories WHERE is_active = 1 ORDER BY sort_order, id"
    );
    const services = await query(
      "SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order, id"
    );
    res.json({ categories: groupByCategory(categories, services) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// GET /api/services/admin/all — full list incl. inactive (admin).
router.get("/admin/all", authMiddleware, async (_req, res) => {
  try {
    const categories = await query("SELECT * FROM service_categories ORDER BY sort_order, id");
    const services = await query("SELECT * FROM services ORDER BY sort_order, id");
    res.json({ categories: groupByCategory(categories, services) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

/* ---------- Categories (admin) ---------- */

router.post("/categories", authMiddleware, async (req, res) => {
  try {
    const { name, sort_order = 0 } = req.body;
    if (!name) return res.status(400).json({ error: "Назва обов'язкова" });
    const result = await query(
      "INSERT INTO service_categories (name, sort_order) VALUES (:name, :sort_order)",
      { name, sort_order }
    );
    const [category] = await query("SELECT * FROM service_categories WHERE id = :id", {
      id: result.insertId,
    });
    res.status(201).json(category);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/categories/:id", authMiddleware, async (req, res) => {
  try {
    const { name, sort_order, is_active } = req.body;
    const [existing] = await query("SELECT * FROM service_categories WHERE id = :id", {
      id: req.params.id,
    });
    if (!existing) return res.status(404).json({ error: "Category not found" });

    await query(
      `UPDATE service_categories
       SET name = :name, sort_order = :sort_order, is_active = :is_active, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        name: name ?? existing.name,
        sort_order: sort_order ?? existing.sort_order,
        is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id: req.params.id,
      }
    );
    const [updated] = await query("SELECT * FROM service_categories WHERE id = :id", {
      id: req.params.id,
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", authMiddleware, async (req, res) => {
  try {
    // FK cascade is not enforced in SQLite by default — remove children explicitly.
    await query("DELETE FROM services WHERE category_id = :id", { id: req.params.id });
    await query("DELETE FROM service_categories WHERE id = :id", { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

/* ---------- Services (admin) ---------- */

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { category_id, code, name, format, price, price_insta, sort_order = 0 } = req.body;
    if (!category_id || !name) {
      return res.status(400).json({ error: "category_id та name обов'язкові" });
    }
    const result = await query(
      `INSERT INTO services (category_id, code, name, format, price, price_insta, sort_order)
       VALUES (:category_id, :code, :name, :format, :price, :price_insta, :sort_order)`,
      {
        category_id,
        code: code || null,
        name,
        format: format || null,
        price: price ?? null,
        price_insta: price_insta ?? null,
        sort_order,
      }
    );
    const [service] = await query("SELECT * FROM services WHERE id = :id", { id: result.insertId });
    res.status(201).json(service);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const [existing] = await query("SELECT * FROM services WHERE id = :id", { id: req.params.id });
    if (!existing) return res.status(404).json({ error: "Service not found" });

    const { category_id, code, name, format, price, price_insta, sort_order, is_active } = req.body;
    await query(
      `UPDATE services SET
         category_id = :category_id, code = :code, name = :name, format = :format,
         price = :price, price_insta = :price_insta, sort_order = :sort_order,
         is_active = :is_active, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        category_id: category_id ?? existing.category_id,
        code: code !== undefined ? code || null : existing.code,
        name: name ?? existing.name,
        format: format !== undefined ? format || null : existing.format,
        price: price !== undefined ? price : existing.price,
        price_insta: price_insta !== undefined ? price_insta : existing.price_insta,
        sort_order: sort_order ?? existing.sort_order,
        is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
        id: req.params.id,
      }
    );
    const [updated] = await query("SELECT * FROM services WHERE id = :id", { id: req.params.id });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update service" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM services WHERE id = :id", { id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

export default router;
