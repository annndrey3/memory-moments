import { Router } from "express";
import pool, { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// GET /api/designs - List all designs with optional filters
router.get("/", async (req, res) => {
  try {
    const { productType, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = { limit: Number(limit), offset: Number(offset) };

    if (productType) {
      whereConditions.push("product_type = :productType");
      params.productType = productType;
    }

    if (search) {
      whereConditions.push("(name LIKE :search OR description LIKE :search)");
      params.search = `%${search}%`;
    }

    const where = whereConditions.length ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const items = await query(
      `SELECT id, name, description, product_type, preview_image, fabric_data,
              width, height, created_at, updated_at
       FROM designs
       ${where}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    const countParams = { ...params };
    delete countParams.limit;
    delete countParams.offset;
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM designs ${where}`,
      countParams
    );

    res.json({
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("Error fetching designs:", err);
    res.status(500).json({ error: "Failed to fetch designs" });
  }
});

// GET /api/designs/:id - Get design by ID
router.get("/:id", async (req, res) => {
  try {
    const [design] = await query("SELECT * FROM designs WHERE id = :id", {
      id: req.params.id,
    });

    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }

    // Parse fabric_data if it's a string
    if (typeof design.fabric_data === "string") {
      design.fabric_data = JSON.parse(design.fabric_data);
    }

    res.json(design);
  } catch (err) {
    console.error("Error fetching design:", err);
    res.status(500).json({ error: "Failed to fetch design" });
  }
});

// POST /api/designs - Create new design (admin only)
router.post("/", authMiddleware, requirePermission("designs.manage"), async (req, res) => {
  try {
    const { name, description, productType, fabricData, previewImage, width, height } = req.body;

    if (!name || !productType || !fabricData) {
      return res.status(400).json({
        error: "Missing required fields: name, productType, fabricData",
      });
    }

    const fabricDataStr = typeof fabricData === "string" ? fabricData : JSON.stringify(fabricData);

    const result = await query(
      `INSERT INTO designs (name, description, product_type, fabric_data, preview_image, width, height)
       VALUES (:name, :description, :productType, :fabricData, :previewImage, :width, :height)`,
      {
        name,
        description,
        productType,
        fabricData: fabricDataStr,
        previewImage: previewImage || null,
        width: width || 300,
        height: height || 300,
      }
    );

    const [design] = await query("SELECT * FROM designs WHERE id = :id", {
      id: result.insertId,
    });

    if (typeof design.fabric_data === "string") {
      design.fabric_data = JSON.parse(design.fabric_data);
    }

    res.status(201).json(design);
  } catch (err) {
    console.error("Error creating design:", err);
    if (err.code === "ER_DUP_ENTRY" || err.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ error: "Design name must be unique" });
    }
    res.status(500).json({ error: "Failed to create design" });
  }
});

// PUT /api/designs/:id - Update design (admin only)
router.put("/:id", authMiddleware, requirePermission("designs.manage"), async (req, res) => {
  try {
    const { name, description, fabricData, previewImage, width, height } = req.body;

    // Check if design exists
    const [design] = await query("SELECT * FROM designs WHERE id = :id", {
      id: req.params.id,
    });

    if (!design) {
      return res.status(404).json({ error: "Design not found" });
    }

    const fabricDataStr = fabricData ? (typeof fabricData === "string" ? fabricData : JSON.stringify(fabricData)) : design.fabric_data;

    await query(
      `UPDATE designs
       SET name = :name, description = :description, fabric_data = :fabricData,
           preview_image = :previewImage, width = :width, height = :height, updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        name: name || design.name,
        description: description || design.description,
        fabricData: fabricDataStr,
        previewImage: previewImage !== undefined ? previewImage : design.preview_image,
        width: width || design.width,
        height: height || design.height,
        id: req.params.id,
      }
    );

    const [updated] = await query("SELECT * FROM designs WHERE id = :id", {
      id: req.params.id,
    });

    if (typeof updated.fabric_data === "string") {
      updated.fabric_data = JSON.parse(updated.fabric_data);
    }

    res.json(updated);
  } catch (err) {
    console.error("Error updating design:", err);
    res.status(500).json({ error: "Failed to update design" });
  }
});

// DELETE /api/designs/:id - Delete design (admin only)
router.delete("/:id", authMiddleware, requirePermission("designs.manage"), async (req, res) => {
  try {
    // Check if design is used by products
    const [usage] = await query(
      "SELECT COUNT(*) as count FROM products WHERE design_id = :id",
      { id: req.params.id }
    );

    if (usage.count > 0) {
      return res.status(400).json({
        error: `Cannot delete design: used by ${usage.count} product(s)`,
      });
    }

    const result = await query("DELETE FROM designs WHERE id = :id", {
      id: req.params.id,
    });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Design not found" });
    }

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting design:", err);
    res.status(500).json({ error: "Failed to delete design" });
  }
});

export default router;
