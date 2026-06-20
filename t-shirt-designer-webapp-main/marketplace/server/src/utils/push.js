// Web-push сповіщення власнику (нові замовлення тощо). VAPID-ключі генеруємо
// один раз і зберігаємо в settings; підписки пристроїв — у таблиці push_subscriptions.
import webpush from "web-push";
import { query } from "../config/db.js";
import { getSetting, setSetting } from "./settings.js";

let cached = null; // { publicKey, privateKey }

// Повертає VAPID-ключі: з settings, або генерує й зберігає при першому виклику.
export async function getVapidKeys() {
  if (cached) return cached;
  let publicKey = await getSetting("push_vapid_public");
  let privateKey = await getSetting("push_vapid_private");
  if (!publicKey || !privateKey) {
    const keys = webpush.generateVAPIDKeys();
    publicKey = keys.publicKey;
    privateKey = keys.privateKey;
    await setSetting("push_vapid_public", publicKey);
    await setSetting("push_vapid_private", privateKey);
    console.log("Generated new VAPID keys for web-push.");
  }
  cached = { publicKey, privateKey };
  return cached;
}

async function configure() {
  const { publicKey, privateKey } = await getVapidKeys();
  const subject = process.env.PUSH_SUBJECT || "mailto:admin@memory-moments.online";
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function getPublicKey() {
  return (await getVapidKeys()).publicKey;
}

export async function saveSubscription(sub) {
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    const e = new Error("Invalid subscription");
    e.status = 400;
    throw e;
  }
  // Upsert за endpoint (повторна підписка того ж пристрою не плодить дублі).
  await query("DELETE FROM push_subscriptions WHERE endpoint = :e", { e: sub.endpoint });
  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (:e, :p, :a)`,
    { e: sub.endpoint, p: sub.keys.p256dh, a: sub.keys.auth }
  );
}

export async function deleteSubscription(endpoint) {
  if (!endpoint) return;
  await query("DELETE FROM push_subscriptions WHERE endpoint = :e", { e: endpoint });
}

export async function subscriptionCount() {
  const [{ n }] = await query("SELECT COUNT(*) AS n FROM push_subscriptions");
  return Number(n) || 0;
}

// Шле пуш усім підпискам власника. Підписки, які протухли (404/410), видаляємо.
// Best-effort: помилки не кидаємо назовні (виклик з критичного шляху замовлення).
export async function sendPushToOwner({ title, body, url, tag } = {}) {
  let subs;
  try {
    subs = await query("SELECT endpoint, p256dh, auth FROM push_subscriptions");
  } catch (e) {
    console.warn("push: cannot read subscriptions:", e.message);
    return { sent: 0, removed: 0 };
  }
  if (!subs.length) return { sent: 0, removed: 0 };
  await configure();
  const payload = JSON.stringify({
    title: title || "Memory Moments",
    body: body || "",
    url: url || "/admin/orders",
    tag: tag || "mm-order",
  });
  let sent = 0, removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      const subscription = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
      try {
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await deleteSubscription(s.endpoint).catch(() => {});
          removed++;
        } else {
          console.warn("push send failed:", err.statusCode || err.message);
        }
      }
    })
  );
  return { sent, removed };
}
