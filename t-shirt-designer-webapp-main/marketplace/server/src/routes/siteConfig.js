import { Router } from "express";
import { getPublicSiteConfig } from "../utils/siteConfig.js";

// Публічна конфігурація сайту для вітрини й конструктора (контакти, доставка,
// знижки, hero, SEO). Без секретів (Telegram-токен не віддається).
const router = Router();

router.get("/", async (_req, res) => {
  try {
    res.json(await getPublicSiteConfig());
  } catch (err) {
    console.error("site-config load failed:", err.message);
    res.status(500).json({ error: "Failed to load site config" });
  }
});

export default router;
