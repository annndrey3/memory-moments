import { useEffect } from "react";

// Клієнтський SEO-хелпер: оновлює <title> та мета-теги (description/OG/Twitter)
// при зміні сторінки. ВАЖЛИВО: це SPA без SSR — соц-скрапери (Telegram/Facebook),
// які не виконують JS, бачать лише статичні мета з index.html. Цей хук покращує
// вкладки браузера та SEO для краулерів, що рендерять JS (Googlebot).
const SITE = "Memory Moments";
const DEFAULT_DESC =
  "Друк фото, сувеніри та конструктор кастомних товарів: футболки, чашки, фотоформати. Створіть унікальний дизайн онлайн.";
const DEFAULT_IMAGE = "/og-image.png";

function setMeta(attr, key, value) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function useSeo({ title, description, image } = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} · ${SITE}` : `${SITE} — Маркетплейс`;
    const desc = description || DEFAULT_DESC;
    const img = new URL(image || DEFAULT_IMAGE, window.location.origin).href;
    const url = window.location.href;

    document.title = fullTitle;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("property", "og:url", url);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", desc);
    setMeta("name", "twitter:image", img);
  }, [title, description, image]);
}
