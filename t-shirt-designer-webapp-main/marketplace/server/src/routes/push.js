// Web-push: видача VAPID-ключа, підписка/відписка пристрою, тестовий пуш.
import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { getPublicKey, saveSubscription, deleteSubscription, sendPushToOwner, subscriptionCount } from "../utils/push.js";

const router = Router();

// Публічний VAPID-ключ потрібен браузеру для підписки.
router.get("/vapid-public-key", authMiddleware, async (_req, res) => {
  try {
    res.json({ key: await getPublicKey() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get VAPID key" });
  }
});

router.get("/status", authMiddleware, async (_req, res) => {
  try {
    res.json({ subscriptions: await subscriptionCount() });
  } catch {
    res.json({ subscriptions: 0 });
  }
});

router.post("/subscribe", authMiddleware, async (req, res) => {
  try {
    await saveSubscription(req.body?.subscription || req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to subscribe" });
  }
});

router.post("/unsubscribe", authMiddleware, async (req, res) => {
  try {
    await deleteSubscription(req.body?.endpoint);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to unsubscribe" });
  }
});

router.post("/test", authMiddleware, async (_req, res) => {
  try {
    const r = await sendPushToOwner({
      title: "🔔 Тест сповіщення",
      body: "Пуш працює! Ви отримуватимете нові замовлення сюди.",
      url: "/admin/orders",
    });
    res.json({ ok: r.sent > 0, ...r });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send test push" });
  }
});

export default router;
