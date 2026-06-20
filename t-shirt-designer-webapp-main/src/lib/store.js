import { configureStore } from "@reduxjs/toolkit";
import tshirtReducer, { hydrateCart } from "../features/tshirtSlice";
import { loadCart, saveCart } from "./cartStorage";
// import canvasReducer from "../features/canvasSlice";

// Кошик конструктора зберігається в IndexedDB (cartStorage) — він може містити
// великі зображення (мокапи, друк-файли, пачки фото), для яких localStorage
// замалий. Завдяки цьому кошик не губиться при переході в маркетплейс/оновленні.
export const store = configureStore({
  reducer: {
    tshirt: tshirtReducer,
    // canvas: canvasReducer,
  },
});

// Відновлюємо кошик (асинхронно — IndexedDB). Поки вантажиться, кошик порожній.
loadCart()
  .then((items) => { if (Array.isArray(items) && items.length) store.dispatch(hydrateCart(items)); })
  .catch(() => {});

// Зберігаємо кошик при кожній зміні (debounce — щоб не писати на кожен кадр).
let lastCart = store.getState().tshirt.cartItems;
let saveTimer = null;
store.subscribe(() => {
  const cart = store.getState().tshirt.cartItems;
  if (cart === lastCart) return;
  lastCart = cart;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveCart(cart); }, 300);
});

export default store;
