// Слайди банера маркетплейсу (керуються з адмінки).
import { Router } from "express";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// Public: активні слайди для банера.
router.get("/", async (_req, res) => {
  try {
    const slides = await query(
      "SELECT id, image_url, title, subtitle, link, cta_label, sort_order FROM slides WHERE is_active = 1 ORDER BY sort_order, id"
    );
    res.json(slides);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slides" });
  }
});

// Admin: усі слайди.
router.get("/admin/all", authMiddleware, async (_req, res) => {
  try {
    const slides = await query("SELECT * FROM slides ORDER BY sort_order, id");
    res.json(slides);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch slides" });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { image_url, title, subtitle, link, cta_label, sort_order = 0, is_active = 1 } = req.body;
    const result = await query(
      `INSERT INTO slides (image_url, title, subtitle, link, cta_label, sort_order, is_active)
       VALUES (:image_url, :title, :subtitle, :link, :cta_label, :sort_order, :is_active)`,
      {
        image_url: image_url || null, title: title || null, subtitle: subtitle || null,
        link: link || null, cta_label: cta_label || null, sort_order: Number(sort_order) || 0,
        is_active: is_active ? 1 : 0,
      }
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create slide" });
  }
});

// Створити слайди з активних категорій (щоб «авто-слайди» головної стали
// редагованими). Не дублює: пропускає категорії, для яких слайд уже є (за link).
router.post("/seed-from-categories", authMiddleware, async (_req, res) => {
  try {
    const BG = [
      "/bg/bg-wood-04.jpg", "/bg/bg-wood-01.jpg", "/bg/bg-wood-10.jpg", "/bg/bg-wood-09.jpg",
      "/bg/bg-wood-07.jpg", "/bg/bg-wood-08.jpg", "/bg/bg-wood-06.jpg", "/bg/bg-wood-03.jpg",
    ];
    const cats = await query("SELECT name, slug FROM categories WHERE is_active = 1 ORDER BY sort_order, name");
    const existing = await query("SELECT link FROM slides");
    const haveLink = new Set(existing.map((s) => s.link));
    let created = 0;
    for (let i = 0; i < cats.length; i++) {
      const link = `/?category=${cats[i].slug}`;
      if (haveLink.has(link)) continue;
      await query(
        `INSERT INTO slides (image_url, title, subtitle, link, cta_label, sort_order, is_active)
         VALUES (:img, :title, NULL, :link, :cta, :so, 1)`,
        { img: BG[i % BG.length], title: cats[i].name, link, cta: "Переглянути товари", so: i }
      );
      created++;
    }
    res.json({ ok: true, created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to seed slides" });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await query("SELECT id FROM slides WHERE id = :id", { id });
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    const { image_url, title, subtitle, link, cta_label, sort_order, is_active } = req.body;
    await query(
      `UPDATE slides SET image_url=:image_url, title=:title, subtitle=:subtitle, link=:link,
       cta_label=:cta_label, sort_order=:sort_order, is_active=:is_active, updated_at=CURRENT_TIMESTAMP
       WHERE id=:id`,
      {
        id, image_url: image_url || null, title: title || null, subtitle: subtitle || null,
        link: link || null, cta_label: cta_label || null, sort_order: Number(sort_order) || 0,
        is_active: is_active ? 1 : 0,
      }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update slide" });
  }
});

router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    await query("DELETE FROM slides WHERE id = :id", { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete slide" });
  }
});

export default router;
