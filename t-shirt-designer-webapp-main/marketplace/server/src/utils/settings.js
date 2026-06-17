import { query } from "../config/db.js";

export async function getSetting(key) {
  const rows = await query("SELECT value FROM settings WHERE key = :key LIMIT 1", { key });
  return rows.length ? rows[0].value : null;
}

export async function setSetting(key, value) {
  await query(
    `INSERT INTO settings (key, value) VALUES (:key, :value)
     ON CONFLICT(key) DO UPDATE SET value = :value, updated_at = CURRENT_TIMESTAMP`,
    { key, value }
  );
}
