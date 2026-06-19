import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSiteConfig } from "./siteConfig";

const CartContext = createContext(null);
const STORAGE_KEY = "mm_cart";

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

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Унікальний ключ позиції: товар + варіант + дизайн.
function lineKey(item) {
  return [item.product_id, item.variant_id || 0, item.design_id || 0].join(":");
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadCart);
  const { discounts } = useSiteConfig();
  // Пороги знижки з налаштувань сайту; нормалізовано й відсортовано за спаданням.
  const tiers = useMemo(() => {
    const arr = Array.isArray(discounts?.photo) && discounts.photo.length ? discounts.photo : PHOTO_DISCOUNT_TIERS;
    return [...arr]
      .map((t) => ({ min: Number(t.min), pct: Number(t.pct) }))
      .sort((a, b) => b.min - a.min);
  }, [discounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (item, quantity = 1) => {
    const key = lineKey(item);
    setItems((prev) => {
      const existing = prev.find((i) => i.key === key);
      if (existing) {
        return prev.map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ...item, key, quantity }];
    });
  };

  const updateQty = (key, quantity) => {
    const q = Math.max(1, Number(quantity) || 1);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, quantity: q } : i)));
  };

  const removeItem = (key) => setItems((prev) => prev.filter((i) => i.key !== key));

  const clear = () => setItems([]);

  const value = useMemo(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    // Знижка на друк фото (позиції photo_print) за сумарною кількістю.
    const photoItems = items.filter((i) => i.type === "photo_print");
    const photoCount = photoItems.reduce((n, i) => n + i.quantity, 0);
    const photoSubtotal = photoItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const discountPct = photoDiscountPct(photoCount, tiers);
    const discount = Math.round((photoSubtotal * discountPct) / 100);
    const total = subtotal - discount;
    return { items, addItem, updateQty, removeItem, clear, count, subtotal, photoCount, discountPct, discount, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tiers]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
