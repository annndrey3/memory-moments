import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, "../../uploads"));
const CLEAN_PREFIXES = ["print_", "photo-"];

const router = Router();

// GET /api/admin/cleanup?days=30  — preview без видалення
// POST /api/admin/cleanup         — { days: 30 } — фактичне видалення
router.get("/", authMiddleware, requirePermission("products.manage"), async (req, res) => {
  try {
    const days = Math.max(1, Number(req.query.days ?? 30));
    const result = await runCleanup(days, true);
    res.json(result);
  } catch (err) {
    console.error("cleanup preview error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/", authMiddleware, requirePermission("products.manage"), async (req, res) => {
  try {
    const days = Math.max(1, Number(req.body.days ?? 30));
    const result = await runCleanup(days, false);
    res.json(result);
  } catch (err) {
    console.error("cleanup error:", err);
    res.status(500).json({ error: err.message });
  }
});

async function runCleanup(days, dryRun) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  // Файли свіжих замовлень — не чіпаємо
  const recentItems = await query(`
    SELECT oi.design_data
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.created_at >= datetime('now', '-${days} days')
  `);

  const activeFiles = new Set();
  for (const { design_data } of recentItems) {
    try {
      const d = JSON.parse(design_data || "{}");
      [d.printFrontUrl, d.printBackUrl, d.photoUrl].forEach(u => {
        if (u) activeFiles.add(path.basename(u));
      });
    } catch { /* */ }
  }

  // Зображення товарів — ніколи не видаляємо
  const productImages = await query("SELECT image_url FROM product_images");
  productImages.forEach(({ image_url }) => activeFiles.add(path.basename(image_url)));

  const files = fs.readdirSync(UPLOAD_DIR);
  const deleted = [];
  const kept = [];
  let bytesFreed = 0;

  for (const file of files) {
    if (!CLEAN_PREFIXES.some(p => file.startsWith(p))) continue;

    const fullPath = path.join(UPLOAD_DIR, file);
    let stat;
    try { stat = fs.statSync(fullPath); } catch { continue; }

    if (activeFiles.has(file) || stat.mtimeMs > cutoff) {
      kept.push({ file, size: stat.size });
      continue;
    }

    if (!dryRun) fs.unlinkSync(fullPath);
    deleted.push({ file, size: stat.size });
    bytesFreed += stat.size;
  }

  return {
    dryRun,
    days,
    deleted: deleted.length,
    kept: kept.length,
    bytesFreed,
    mbFreed: +(bytesFreed / 1024 / 1024).toFixed(2),
    files: deleted,
  };
}

export default router;
