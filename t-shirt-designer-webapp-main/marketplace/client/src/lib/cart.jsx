import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSiteConfig } from "./siteConfig";
import { readCart, writeCart, toOrderItem, photoUnits } from "./sharedCart";

const CartContext = createContext(null);

// Знижка на друк фото за кількістю (усі формати) — фолбек, якщо немає налаштувань.
// Реальні пороги беруться з налаштувань сайту (як і на сервері в orders.js).
const PHOTO_DISCOUNT_TIERS = [
  { min: 400, pct: 30 }, { min: 300, pct: 25 }, { min: 200, pct: 20 },
  { min: 150, pct: 15 }, { min: 100, pct: 10 }, { min: 50, pct: 5 },
];
function photoDiscountPct(count, tiers = PHOTO_DISCOUNT_TIERS) {
  for (const t of tiers) if (count >= t.min) return t.pct;
  return 0;
}

// Унікальний ключ позиції. Дизайнерські позиції мають власний key (з конструктора);
// каталог/фотодрук — товар + варіант + дизайн.
function lineKey(item) {
  if (item.type === "design" && item.key) return item.key;
  return [item.product_id, item.variant_id || 0, item.design_id || 0].join(":");
}
const idOf = (i) => i.key ?? lineKey(i);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const { discounts } = useSiteConfig();
  // Пороги знижки з налаштувань сайту; нормалізовано й відсортовано за спаданням.
  const tiers = useMemo(() => {
    const arr = Array.isArray(discounts?.photo) && discounts.photo.length ? discounts.photo : PHOTO_DISCOUNT_TIERS;
    return [...arr].map((t) => ({ min: Number(t.min), pct: Number(t.pct) })).sort((a, b) => b.min - a.min);
  }, [discounts]);

  // СПІЛЬНИЙ кошик (IndexedDB, спільний з конструктором на одному домені).
  useEffect(() => {
    let alive = true;
    readCart().then((c) => { if (alive) { setItems(Array.isArray(c) ? c : []); setLoaded(true); } });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (loaded) writeCart(items); }, [items, loaded]);

  const addItem = (item, quantity = 1) => {
    const type = item.type || "catalog";
    const key = lineKey({ ...item, type });
    setItems((prev) => {
      const existing = prev.find((i) => idOf(i) === key);
      if (existing) return prev.map((i) => (idOf(i) === key ? { ...i, quantity: i.quantity + quantity } : i));
      return [...prev, { ...item, type, key, quantity }];
    });
  };

  const updateQty = (key, quantity) => {
    const q = Math.max(1, Number(quantity) || 1);
    setItems((prev) => prev.map((i) => (idOf(i) === key ? { ...i, quantity: q } : i)));
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => idOf(i) !== key));

  const clear = () => setItems([]);

  const value = useMemo(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + (i.unit_price || 0) * i.quantity, 0);
    // Знижка на друк фото (photo_print + пачки фото з конструктора) за кількістю.
    const photoCount = items.reduce((n, i) => n + photoUnits(i), 0);
    const photoSubtotal = items.reduce((s, i) => s + (photoUnits(i) > 0 ? (i.unit_price || 0) * i.quantity : 0), 0);
    const discountPct = photoDiscountPct(photoCount, tiers);
    const discount = Math.round((photoSubtotal * discountPct) / 100);
    const total = subtotal - discount;
    return { items, loaded, addItem, updateQty, removeItem, clear, count, subtotal, photoCount, discountPct, discount, total, toOrderItem };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loaded, tiers]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
