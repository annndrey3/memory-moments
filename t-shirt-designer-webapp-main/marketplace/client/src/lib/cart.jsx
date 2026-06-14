import { createContext, useContext, useEffect, useMemo, useState } from "react";

const CartContext = createContext(null);
const STORAGE_KEY = "mm_cart";

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
    return { items, addItem, updateQty, removeItem, clear, count, subtotal };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
