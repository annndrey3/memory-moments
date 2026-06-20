import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { CONTACTS } from "./contacts";

// Клієнтські дефолти = поточні зашиті значення. Використовуються як фолбек, поки
// конфіг вантажиться з /api/site-config (або якщо запит не вдався) — тож вітрина
// ніколи не лишається без контактів/доставки.
export const SITE_DEFAULTS = {
  contacts: CONTACTS,
  delivery: {
    methods: [
      { id: "nova_poshta", label: "Нова Пошта", enabled: true, kind: "address" },
      { id: "pickup", label: "Самовивіз", enabled: true, kind: "pickup" },
    ],
    pickupBranches: CONTACTS.branches.map((b) => b.address),
  },
  discounts: {
    photo: [
      { min: 400, pct: 30 }, { min: 300, pct: 25 }, { min: 200, pct: 20 },
      { min: 150, pct: 15 }, { min: 100, pct: 10 }, { min: 50, pct: 5 },
    ],
  },
  hero: { headline: "Зберігаємо ваші моменти", tagline: "Фото · Друк · Дизайн · Сувеніри" },
  seo: {
    siteName: "Memory Moments",
    description:
      "Друк фото, сувеніри та конструктор кастомних товарів: футболки, чашки, фотоформати. Створіть унікальний дизайн онлайн.",
  },
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

const mergeCfg = (cfg) => ({
  contacts: { ...SITE_DEFAULTS.contacts, ...(cfg?.contacts || {}) },
  delivery: { ...SITE_DEFAULTS.delivery, ...(cfg?.delivery || {}) },
  discounts: { ...SITE_DEFAULTS.discounts, ...(cfg?.discounts || {}) },
  hero: { ...SITE_DEFAULTS.hero, ...(cfg?.hero || {}) },
  seo: { ...SITE_DEFAULTS.seo, ...(cfg?.seo || {}) },
  terms: { ...SITE_DEFAULTS.terms, ...(cfg?.terms || {}) },
});

const SiteConfigContext = createContext(SITE_DEFAULTS);

export function SiteConfigProvider({ children }) {
  const [cfg, setCfg] = useState(SITE_DEFAULTS);
  useEffect(() => {
    let alive = true;
    api.getSiteConfig()
      .then((d) => { if (alive && d) setCfg(mergeCfg(d)); })
      .catch(() => { /* лишаємо дефолти */ });
    return () => { alive = false; };
  }, []);
  return <SiteConfigContext.Provider value={cfg}>{children}</SiteConfigContext.Provider>;
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}
