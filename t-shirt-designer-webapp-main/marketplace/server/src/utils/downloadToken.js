// Підписаний токен для приватного посилання на завантаження фото замовлення
// (надсилається власнику в Telegram, коли ПК офлайн). Без БД — HMAC(JWT_SECRET).
import crypto from "crypto";

const secret = () => process.env.JWT_SECRET || "mm-download-fallback-secret";

export function photoToken(orderId) {
  return crypto.createHmac("sha256", secret()).update(`photos:${orderId}`).digest("hex").slice(0, 32);
}

export function verifyPhotoToken(orderId, token) {
  if (!token) return false;
  const expected = photoToken(orderId);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch { return false; }
}
