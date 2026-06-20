import { configureStore } from "@reduxjs/toolkit";
import tshirtReducer, { hydrateCart } from "../features/tshirtSlice";
// import canvasReducer from "../features/canvasSlice";

// Кошик конструктора зберігаємо в localStorage під ВЛАСНИМ ключем (окремо від
// кошика маркетплейсу "mm_cart"), щоб він не губився при переході в маркетплейс
// чи оновленні сторінки і не конфліктував з кошиком вітрини.
const CART_KEY = "mm_designer_cart";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export const store = configureStore({
  reducer: {
    tshirt: tshirtReducer,
    // canvas: canvasReducer,
  },
});

// Відновлюємо кошик після створення стора.
const saved = loadCart();
if (saved.length) store.dispatch(hydrateCart(saved));

// Зберігаємо кошик при кожній зміні (тільки коли реально змінився — щоб не писати зайве).
let lastCart = store.getState().tshirt.cartItems;
store.subscribe(() => {
  const cart = store.getState().tshirt.cartItems;
  if (cart !== lastCart) {
    lastCart = cart;
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* ignore quota */ }
  }
});

export default store;
