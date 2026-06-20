import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { query } from "../config/db.js";
import { getStorageConfig } from "./siteConfig.js";
import { sendFallbackPhotoLink } from "./telegram.js";
import { photoToken } from "./downloadToken.js";

// Доставка фото/макетів замовлення у сховище дизайнера через SFTP. VPS лишається
// джерелом істини (файли вже на сервері); сюди ми їх ЛИШЕ копіюємо. Якщо ПК
// дизайнера вимкнено (ніч) — фонова черга повторює спроби, поки він не з'явиться.
const require = createRequire(import.meta.url);
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || "uploads");

// Збирає локальні файли замовлення зі скана URL-ів у позиціях (/uploads/<file>).
async function collectOrderFiles(orderId) {
  const items = await query(
    "SELECT design_data, design_preview FROM order_items WHERE order_id = :id",
    { id: orderId }
  );
  const names = new Set();
  const re = /\/uploads\/([\w.\-]+)/g;
  for (const it of items) {
    const hay = `${it.design_data || ""} ${it.design_preview || ""}`;
    let m;
    while ((m = re.exec(hay))) names.add(m[1]);
  }
  const files = [];
  for (const name of names) {
    const p = path.join(UPLOAD_DIR, name);
    try { if (fs.existsSync(p)) files.push({ name, path: p }); } catch { /* ignore */ }
  }
  return files;
}

function makeClient() {
  const SftpClient = require("ssh2-sftp-client");
  return new SftpClient();
}

// Перевірка з'єднання — для кнопки «Тест» в адмінці.
export async function testStorageConnection() {
  const cfg = await getStorageConfig();
  if (!cfg.host || !cfg.username) throw new Error("Вкажіть host і користувача");
  const sftp = makeClient();
  try {
    await sftp.connect({ host: cfg.host, port: cfg.port, username: cfg.username, password: cfg.password, readyTimeout: 15000 });
    await sftp.list(cfg.remotePath || "/").catch(() => {});
    return true;
  } finally {
    try { await sftp.end(); } catch { /* ignore */ }
  }
}

// Доставка одного замовлення. Повертає {ok, delivered|reason}.
export async function deliverOrderFiles(order) {
  const cfg = await getStorageConfig();
  if (!cfg.enabled || !cfg.host || !cfg.username) return { ok: false, reason: "not-configured" };
  const files = await collectOrderFiles(order.id);
  if (!files.length) return { ok: true, delivered: 0 };

  const sftp = makeClient();
  try {
    await sftp.connect({ host: cfg.host, port: cfg.port, username: cfg.username, password: cfg.password, readyTimeout: 20000 });
    const base = (cfg.remotePath || "/").replace(/\/+$/, "");
    const remoteDir = `${base}/${order.order_number}`;
    await sftp.mkdir(remoteDir, true).catch(() => {});
    for (const f of files) {
      await sftp.fastPut(f.path, `${remoteDir}/${f.name}`);
    }
    return { ok: true, delivered: files.length };
  } finally {
    try { await sftp.end(); } catch { /* ignore */ }
  }
}

// ПК офлайн: один раз шлемо власнику захищене посилання на ZIP з нашого сервера.
// Повертає true, якщо лінк надіслано (щоб не дублювати на кожному повторі).
async function sendOfflineFallback(orderId) {
  try {
    const files = await collectOrderFiles(orderId);
    if (!files.length) return false; // нема файлів — нема чого слати
    const base = (process.env.PUBLIC_URL || "").replace(/\/+$/, "");
    if (!base) { console.warn("fallback link skipped: PUBLIC_URL not set"); return false; }
    const [order] = await query(
      "SELECT order_number, customer_name FROM orders WHERE id = :id",
      { id: orderId }
    );
    const link = `${base}/api/orders/${orderId}/photos-download?token=${photoToken(orderId)}`;
    return await sendFallbackPhotoLink({
      orderNumber: order?.order_number,
      customerName: order?.customer_name,
      count: files.length,
      link,
    });
  } catch (e) {
    console.warn("fallback link failed:", e.message);
    return false;
  }
}

// Спроба доставки з оновленням статусу замовлення.
export async function tryDeliverOrder(orderId) {
  try {
    const [order] = await query("SELECT id, order_number FROM orders WHERE id = :id", { id: orderId });
    if (!order) return false;
    const res = await deliverOrderFiles(order);
    if (res.ok) {
      await query(
        "UPDATE orders SET photo_delivery_status = 'sent', photo_delivery_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
        { id: orderId }
      );
      return true;
    }
    // not-configured → лишаємо 'pending', доставимо коли налаштують сховище.
    return false;
  } catch (e) {
    // SFTP недоступний (ПК офлайн). Якщо лінк ще не слали (статус не 'fallback') —
    // шлемо власнику захищене посилання раз, далі мовчки повторюємо SFTP.
    const [cur] = await query("SELECT photo_delivery_status FROM orders WHERE id = :id", { id: orderId }).catch(() => [{}]);
    if (cur?.photo_delivery_status !== "fallback") {
      const sent = await sendOfflineFallback(orderId);
      await query(
        "UPDATE orders SET photo_delivery_status = :st, photo_delivery_attempts = COALESCE(photo_delivery_attempts,0) + 1 WHERE id = :id",
        { st: sent ? "fallback" : "pending", id: orderId }
      ).catch(() => {});
    } else {
      await query(
        "UPDATE orders SET photo_delivery_attempts = COALESCE(photo_delivery_attempts,0) + 1 WHERE id = :id",
        { id: orderId }
      ).catch(() => {});
    }
    console.warn(`photo delivery: order ${orderId} failed:`, e.message);
    return false;
  }
}

// Позначити замовлення на доставку (викликається при створенні, якщо є файли).
export async function markOrderForDelivery(orderId) {
  await query(
    "UPDATE orders SET photo_delivery_status = 'pending' WHERE id = :id AND (photo_delivery_status IS NULL OR photo_delivery_status NOT IN ('sent','fallback'))",
    { id: orderId }
  ).catch(() => {});
}

// Фонова черга: кожні 10 хв добирає 'pending' замовлення й намагається доставити.
// Перший прохід — через 20с після старту (доставляє все, що накопичилось).
let started = false;
export function startPhotoDeliveryWorker() {
  if (started) return;
  started = true;
  const tick = async () => {
    try {
      const cfg = await getStorageConfig();
      if (!cfg.enabled) return;
      // 'fallback' теж добираємо — лінк уже надіслано, але фото мають лягти й на ПК.
      const pending = await query(
        "SELECT id FROM orders WHERE photo_delivery_status IN ('pending','fallback') ORDER BY id ASC LIMIT 20"
      );
      for (const o of pending) {
        await tryDeliverOrder(o.id); // послідовно — не навантажуємо канал
      }
    } catch (e) {
      console.warn("photo delivery worker:", e.message);
    }
  };
  setInterval(tick, 10 * 60 * 1000);
  setTimeout(tick, 20 * 1000);
}
