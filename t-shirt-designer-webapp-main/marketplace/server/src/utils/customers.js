// Авто-захоплення клієнтів із замовлень зі злиттям за телефоном/email.
// Викликається best-effort при кожному замовленні — клієнт одразу зʼявляється в адмінці.
import { query } from "../config/db.js";

// Email: trim + lowercase; порожнє → null.
export function normalizeEmail(raw) {
  const e = String(raw ?? "").trim().toLowerCase();
  return e || null;
}

// Ключ телефону для звірки: лише цифри, останні 9 (укр. абонентський номер).
// "+38 (068) 555-05-64" → "685550564"; "0685550564" → "685550564" — той самий клієнт.
export function phoneKey(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return digits.length > 9 ? digits.slice(-9) : digits;
}

// Шукає наявного клієнта: спершу за email (унікальний), потім за телефоном.
// email/phone тут уже очищені (normalizeEmail / trim).
export async function findCustomerByContact({ email, phone }) {
  if (email) {
    const byEmail = await query(
      "SELECT * FROM customers WHERE LOWER(email) = :email LIMIT 1",
      { email }
    );
    if (byEmail[0]) return byEmail[0];
  }
  const key = phoneKey(phone);
  if (key) {
    // Телефон зберігається у вільному форматі — звіряємо нормалізовано в JS.
    const withPhone = await query(
      "SELECT * FROM customers WHERE phone IS NOT NULL AND phone <> ''"
    );
    const match = withPhone.find((c) => phoneKey(c.phone) === key);
    if (match) return match;
  }
  return null;
}

// Створює або зливає клієнта з контактів замовлення.
// Злиття: заповнюємо порожні поля, імʼя оновлюємо на найсвіжіше; наявні контакти не затираємо.
// Повертає { id, merged } або null, якщо немає жодного контакту для ідентифікації.
export async function upsertCustomerFromContact({ name, email, phone, source = "order" } = {}) {
  const cleanEmail = normalizeEmail(email);
  const cleanPhone = String(phone ?? "").trim() || null;
  const cleanName = String(name ?? "").trim();

  // Потрібен хоча б один контакт (email або телефон), інакше клієнта не ідентифікувати.
  if (!cleanEmail && !phoneKey(cleanPhone)) return null;

  const existing = await findCustomerByContact({ email: cleanEmail, phone: cleanPhone });

  if (existing) {
    // COALESCE лишає наявний контакт; новий підставляється лише якщо поле порожнє.
    // Збіг за телефоном гарантує, що cleanEmail ще нікому не належить → UNIQUE безпечний.
    await query(
      `UPDATE customers SET
         name  = :name,
         email = COALESCE(email, :email),
         phone = COALESCE(NULLIF(phone, ''), :phone),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      { name: cleanName || existing.name, email: cleanEmail, phone: cleanPhone, id: existing.id }
    );
    return { id: existing.id, merged: true };
  }

  const ins = await query(
    "INSERT INTO customers (name, email, phone, source) VALUES (:name, :email, :phone, :source)",
    { name: cleanName || "Клієнт", email: cleanEmail, phone: cleanPhone, source }
  );
  return { id: ins.insertId, merged: false };
}
