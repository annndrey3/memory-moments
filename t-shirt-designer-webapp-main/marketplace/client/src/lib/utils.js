import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatPrice(value) {
  return new Intl.NumberFormat("uk-UA", {
    style: "currency",
    currency: "UAH",
    minimumFractionDigits: 0,
  }).format(Number(value));
}

// Дати в БД зберігаються в UTC (CURRENT_TIMESTAMP). SQLite віддає рядок
// "YYYY-MM-DD HH:MM:SS" БЕЗ зони, Postgres — ISO з "Z". Якщо показати як є,
// власник у Києві (UTC+3) бачить час на 3 години раніше. Тому парсимо значення
// як UTC і форматуємо у київському часі.
export function toUtcDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  let s = String(value).trim();
  // Рядок з датою+часом без позначки зони → трактуємо як UTC (додаємо Z).
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !hasZone) {
    s = s.replace(" ", "T") + "Z";
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value, { timeZone = "Europe/Kyiv" } = {}) {
  const d = toUtcDate(value);
  if (!d) return "";
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone,
  }).format(d);
}
