import { getSetting, setSetting } from "./settings.js";

// ─────────────────────────────────────────────────────────────────────────────
// Бізнес-налаштування сайту, що раніше були зашиті в коді (контакти, доставка,
// знижки фотодруку, hero-текст, SEO, Telegram). Тепер редагуються з адмінки.
//
// Джерело істини: дефолти нижче. У БД (таблиця settings, ключі site_*) лежать
// лише ПЕРЕКРИТТЯ — тож нічого не ламається, якщо в БД порожньо, і не потрібні
// міграції/сіди. Секрети (Telegram-токен) у публічну конфігурацію не потрапляють.
// ─────────────────────────────────────────────────────────────────────────────

export const SITE_DEFAULTS = {
  contacts: {
    phone: "+38(068) 555-05-64",
    instagram: "memory_moments.od.ua",
    telegram: "memory_moments_chern12",
    viber: "+38(068) 555-05-64",
    address: "вул. Артура Савельєва, 12, м. Одеса",
    mapsUrl: "https://maps.app.goo.gl/DHby2xSEnGdzn1gZA",
    branches: [
      { address: "просп. Князя Ярослава Мудрого, 14/4, Одеса", mapsUrl: "https://maps.app.goo.gl/By3bwyX4DNDwsuqBA" },
      { address: "вул. Академіка Корольова, 70/1, Одеса", mapsUrl: "https://share.google/0TE04wraWVbbZsvTR" },
      { address: "вул. Преображенська, 48, Одеса", mapsUrl: "https://maps.app.goo.gl/g8moWYVnz2aUyCTt8" },
      { address: "вул. Артура Савельєва, 12, Одеса", mapsUrl: "https://maps.app.goo.gl/DHby2xSEnGdzn1gZA" },
    ],
    hours: [
      { days: "Пн–Пт", time: "09:00–19:00" },
      { days: "Сб–Нд", time: "10:00–18:00" },
    ],
  },
  delivery: {
    methods: [
      { id: "nova_poshta", label: "Нова Пошта", enabled: true, kind: "address" },
      { id: "pickup", label: "Самовивіз", enabled: true, kind: "pickup" },
    ],
    pickupBranches: [
      "просп. Князя Ярослава Мудрого, 14/4, Одеса",
      "вул. Академіка Корольова, 70/1, Одеса",
      "вул. Преображенська, 48, Одеса",
      "вул. Артура Савельєва, 12, Одеса",
    ],
  },
  discounts: {
    // Знижка на друк фото за кількістю (усі формати): поріг → відсоток.
    photo: [
      { min: 400, pct: 30 }, { min: 300, pct: 25 }, { min: 200, pct: 20 },
      { min: 150, pct: 15 }, { min: 100, pct: 10 }, { min: 50, pct: 5 },
    ],
  },
  hero: {
    headline: "Зберігаємо ваші моменти",
    tagline: "Фото · Друк · Дизайн · Сувеніри",
  },
  seo: {
    siteName: "Memory Moments",
    description: "Друк фото, сувеніри та конструктор кастомних товарів — Memory Moments.",
  },
  // «Умови та терміни» — блок унизу сторінки цін. items: список рядків.
  terms: {
    items: [
      "Термін виготовлення книг — 5 робочих днів після затвердження макета.",
      "Термін виготовлення візиток — 4-5 робочих днів після затвердження макета.",
      "Термін виготовлення замовлень — 1-2 робочих дні після затвердження макета.",
      "Замовлення прийняті до 16:00 будуть готові наступного дня, після 16:00 — через день.",
      "Сувенірна продукція та широкоформатний друк від 30×40, прийняті в пʼятницю після 15:00, будуть готові у вівторок.",
      "Мінімальне замовлення — від 100 грн. Акційна ціна діє при замовленні від 40 фото.",
      "Знижка на друк фото — за кількістю (див. таблицю «Система знижок» вище). Від 300 фото — безкоштовна доставка.",
    ],
  },
};

const KEY = {
  contacts: "site_contacts",
  delivery: "site_delivery",
  discounts: "site_discounts",
  hero: "site_hero",
  seo: "site_seo",
  terms: "site_terms",
  telegram: "telegram",
};

export const SITE_SECTIONS = ["contacts", "delivery", "discounts", "hero", "seo", "terms"];

function parse(json) {
  try { return json ? JSON.parse(json) : null; } catch { return null; }
}

// Поверхневе злиття: збережені поля верхнього рівня перекривають дефолт.
const merge = (def, saved) => (saved && typeof saved === "object" && !Array.isArray(saved) ? { ...def, ...saved } : def);

export async function getSection(name) {
  const saved = parse(await getSetting(KEY[name]));
  return merge(SITE_DEFAULTS[name], saved);
}

export async function setSection(name, value) {
  if (!SITE_SECTIONS.includes(name)) throw new Error(`Unknown site section: ${name}`);
  await setSetting(KEY[name], JSON.stringify(value));
}

// Публічна конфігурація для вітрини/конструктора — без секретів.
export async function getPublicSiteConfig() {
  const [contacts, delivery, discounts, hero, seo, terms] = await Promise.all([
    getSection("contacts"), getSection("delivery"), getSection("discounts"),
    getSection("hero"), getSection("seo"), getSection("terms"),
  ]);
  return { contacts, delivery, discounts, hero, seo, terms };
}

// Пороги знижки фотодруку — для серверного перерахунку ціни. Нормалізовано
// й відсортовано за спаданням порогу (як того очікує photoDiscountPct).
export async function getPhotoDiscountTiers() {
  const d = await getSection("discounts");
  const raw = Array.isArray(d?.photo) ? d.photo : SITE_DEFAULTS.discounts.photo;
  return raw
    .map((t) => ({ min: Number(t.min), pct: Number(t.pct) }))
    .filter((t) => Number.isFinite(t.min) && Number.isFinite(t.pct) && t.min > 0)
    .sort((a, b) => b.min - a.min);
}

// Telegram: збережене у БД перекриває .env (токен секретний, лишається на сервері).
export async function getTelegramConfig() {
  const saved = parse(await getSetting(KEY.telegram)) || {};
  return {
    token: String(saved.botToken || process.env.TG_BOT_TOKEN || "").trim(),
    chatId: String(saved.chatId || process.env.TG_CHAT_ID || "").trim(),
    source: saved.botToken ? "db" : process.env.TG_BOT_TOKEN ? "env" : null,
  };
}

// ── Сховище фото клієнтів (SFTP на ПК/сервер дизайнера) ──────────────────────
export async function getStorageConfig() {
  const s = parse(await getSetting("sftp_storage")) || {};
  return {
    enabled: !!s.enabled,
    host: s.host || "",
    port: Number(s.port) || 22,
    username: s.username || "",
    password: s.password || "",
    remotePath: s.remotePath || "/",
  };
}

// Зберігає налаштування SFTP. Пароль МІНЯЄМО лише коли введено новий непорожній
// (і не маску). Порожнє поле «Пароль» = НЕ ЧІПАТИ наявний (раніше порожнє стирало
// пароль → доставка падала з «authentication methods failed» при повторному save).
export async function saveStorageConfig(patch = {}) {
  const cur = parse(await getSetting("sftp_storage")) || {};
  const next = { ...cur };
  for (const k of ["enabled", "host", "port", "username", "remotePath"]) {
    if (patch[k] !== undefined) next[k] = patch[k];
  }
  if (typeof patch.password === "string" && patch.password !== "" && !patch.password.includes("•")) {
    next.password = patch.password;
  }
  await setSetting("sftp_storage", JSON.stringify(next));
}

// Зберігає Telegram-налаштування, не стираючи токен, якщо його не передали
// (UI показує лише маску). Порожній botToken === "" — очистити (фолбек на .env).
export async function saveTelegramConfig({ botToken, chatId } = {}) {
  const existing = parse(await getSetting(KEY.telegram)) || {};
  const next = { ...existing };
  if (typeof chatId === "string") next.chatId = chatId.trim();
  if (typeof botToken === "string") {
    if (botToken === "") delete next.botToken;          // очистити → .env
    else if (!botToken.includes("•")) next.botToken = botToken.trim(); // не маска
  }
  await setSetting(KEY.telegram, JSON.stringify(next));
}
