import { Router } from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { query } from "./config/db.js";
import { getProductById } from "./utils/helpers.js";

// ────────────────────────────────────────────────────────────────────────────
//  SSR-пререндер OG-тегів для сторінок товару.
//
//  Навіщо: маркетплейс — SPA без SSR. Боти соцмереж/месенджерів
//  (TelegramBot, facebookexternalhit, Twitterbot…) НЕ виконують JS, тож
//  хук useSeo на клієнті їм не допомагає — для будь-якого посилання вони бачать
//  один дефолтний OG із статичного index.html. Тут ми віддаємо тим самим ботам
//  index.html з ПІДМІНЕНИМИ <title>/description/og:*/twitter:* під конкретний
//  товар, щоб прев'ю посилання показувало його назву й фото.
//
//  nginx маршрутизує на цей роут лише ботів (див. nginx.conf.example); живі
//  відвідувачі й далі отримують звичайний SPA.
// ────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Зібраний клієнт: marketplace/client/dist/index.html
const DIST_INDEX = path.resolve(__dirname, "../../client/dist/index.html");

// Запасний шаблон на випадок, якщо dist ще не зібрано (dev): мінімум для ботів.
const FALLBACK_HTML = `<!DOCTYPE html>
<html lang="uk"><head>
<meta charset="UTF-8" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Memory Moments" />
<meta property="og:locale" content="uk_UA" />
<meta name="twitter:card" content="summary_large_image" />
</head><body><div id="root"></div></body></html>`;

// Теги, які ми перезаписуємо під товар. Решту (og:type/site_name/locale,
// twitter:card, favicon тощо) лишаємо з шаблону без змін.
const MANAGED_META = [
  ["name", "description"],
  ["property", "og:title"],
  ["property", "og:description"],
  ["property", "og:image"],
  ["property", "og:url"],
  ["name", "twitter:title"],
  ["name", "twitter:description"],
  ["name", "twitter:image"],
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Екранування для безпечної вставки в content="..." (назва/опис товару —
// фактично користувацький текст, який не має ламати розмітку чи інжектити теги).
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plain(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function truncate(s, n = 200) {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function readTemplate() {
  try {
    return fs.readFileSync(DIST_INDEX, "utf-8");
  } catch {
    return FALLBACK_HTML;
  }
}

// Origin сайту з урахуванням reverse-proxy (nginx передає X-Forwarded-*).
function siteOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || req.protocol || "https")
    .split(",")[0]
    .trim();
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

// Робить URL абсолютним (og:image вимагає абсолютний). Зовнішні (unsplash) —
// як є; локальні /uploads/... — додаємо origin сайту.
function absoluteUrl(req, maybe) {
  if (!maybe) return null;
  if (/^https?:\/\//i.test(maybe)) return maybe;
  return `${siteOrigin(req)}${maybe.startsWith("/") ? "" : "/"}${maybe}`;
}

function stripManaged(html) {
  let out = html;
  for (const [attr, key] of MANAGED_META) {
    const re = new RegExp(
      `\\s*<meta[^>]*\\b${attr}=["']${escapeRegex(key)}["'][^>]*>`,
      "gi"
    );
    out = out.replace(re, "");
  }
  return out.replace(/\s*<title>[\s\S]*?<\/title>/i, "");
}

function injectMeta(html, { title, description, image, url }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const u = escapeHtml(url);
  const block = `
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:url" content="${u}" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />`;

  const stripped = stripManaged(html);
  return stripped.includes("</head>")
    ? stripped.replace("</head>", `${block}\n  </head>`)
    : stripped + block;
}

const router = Router();

router.get("/product/:slug", async (req, res) => {
  const template = readTemplate();
  try {
    const rows = await query(
      "SELECT id FROM products WHERE slug = :slug AND is_active = 1",
      { slug: req.params.slug }
    );

    // Невідомий/неактивний товар → дефолтний шаблон (бренд-прев'ю), без кешу.
    if (!rows.length) {
      res.set("Cache-Control", "no-store");
      return res.type("html").send(template);
    }

    const product = await getProductById({ query }, rows[0].id, { activeOnly: true });
    const primary =
      (product.images || []).find((i) => i.is_primary) || product.images?.[0];
    const image =
      absoluteUrl(req, primary?.image_url) || absoluteUrl(req, "/og-image.png");
    const description = truncate(
      plain(product.short_description || product.description) ||
        "Memory Moments — друк фото, сувеніри та кастомні товари."
    );

    const html = injectMeta(template, {
      title: `${product.name} — Memory Moments`,
      description,
      image,
      url: `${siteOrigin(req)}/product/${encodeURIComponent(product.slug)}`,
    });

    // Боти заходять рідко — короткий кеш зменшує навантаження без ризику застою.
    res.set("Cache-Control", "public, max-age=300");
    res.type("html").send(html);
  } catch (err) {
    console.error("prerender error", err);
    // Ніколи не валимо прев'ю помилкою — віддаємо дефолтний шаблон.
    res.type("html").send(template);
  }
});

export default router;
