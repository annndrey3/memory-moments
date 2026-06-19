import { createSlice } from "@reduxjs/toolkit";
import { PRODUCT_TYPES } from "../constants/designConstants";

const initialState = {
  selectedType: "crew-neck",
  tshirtColor: "#FFFFFF",
  selectedView: "front",
  size: "M", // розмір футболки
  printSize: "A4", // формат друку футболки (А4/А3) — впливає на ціну з прайсу
  canvasSize: "30x40", // розмір полотна (натяжка) — впливає на ціну з прайсу
  slimBookFormat: "21x30", // формат Slim Book — ціна (прайс) + пропорції обкладинки
  slimBookSpreads: 10, // базова кіл-ть розворотів (10/15)
  slimBookExtra: 0, // додаткові розвороти понад базу
  slimBookPhotos: [], // фото для внутрішніх розворотів (data URL)
  paperType: "matte", // тип паперу для фотодруку
  quantity: 1, // кількість поточного дизайну (спільна для панелі та сайдбару)
  // Чи змінювався дизайн/опції з моменту останнього додавання в кошик.
  // true → «Замовити!» додасть нову позицію; false → лише відкриє кошик
  // (захист від дублювання тієї самої позиції подвійним кліком).
  designDirty: true,
  cartItems: [],
  isCartOpen: false,
};

export const tshirtSlice = createSlice({
  name: "designer",
  initialState,
  reducers: {
    setSelectedType: (state, action) => {
      state.selectedType = action.payload;
      const product = PRODUCT_TYPES[action.payload];
      if (product && !product.views[state.selectedView]) {
        state.selectedView = Object.keys(product.views)[0];
      }
    },
    setTshirtColor: (state, action) => {
      state.tshirtColor = action.payload;
      state.designDirty = true;
    },
    setSelectedView: (state, action) => {
      state.selectedView = action.payload;
    },
    setSize: (state, action) => {
      state.size = action.payload;
      state.designDirty = true;
    },
    setPrintSize: (state, action) => {
      state.printSize = action.payload;
      state.designDirty = true;
    },
    setCanvasSize: (state, action) => {
      state.canvasSize = action.payload;
      state.designDirty = true;
    },
    setSlimBookFormat: (state, action) => {
      state.slimBookFormat = action.payload;
      state.designDirty = true;
    },
    setSlimBookSpreads: (state, action) => {
      state.slimBookSpreads = Number(action.payload) || 10;
      state.designDirty = true;
    },
    setSlimBookExtra: (state, action) => {
      state.slimBookExtra = Math.max(0, Number(action.payload) || 0);
      state.designDirty = true;
    },
    addSlimBookPhotos: (state, action) => {
      const arr = Array.isArray(action.payload) ? action.payload : [action.payload];
      state.slimBookPhotos.push(...arr.filter(Boolean));
      state.designDirty = true;
    },
    removeSlimBookPhoto: (state, action) => {
      state.slimBookPhotos.splice(action.payload, 1);
      state.designDirty = true;
    },
    clearSlimBookPhotos: (state) => {
      state.slimBookPhotos = [];
    },
    reorderSlimBookPhotos: (state, action) => {
      const { from, to } = action.payload || {};
      const arr = state.slimBookPhotos;
      if (from == null || to == null || from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return;
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      state.designDirty = true;
    },
    setPaperType: (state, action) => {
      state.paperType = action.payload;
      state.designDirty = true;
    },
    // Дизайн змінився на полотні (додали/прибрали/посунули об'єкт).
    markDesignDirty: (state) => {
      state.designDirty = true;
    },
    setQuantity: (state, action) => {
      state.quantity = Math.max(1, Number(action.payload) || 1);
    },
    addToCart: (state, action) => {
      const { id, productType, productName, designTextureFront, designTextureBack, rawDesignFront, rawDesignBack, printFront, printBack, fabricFront, fabricBack, color, size, printSize, canvasSize, paperType, slimBookFormat, slimBookSpreads, slimBookExtra, innerPhotos, variantLabel, quantity } = action.payload;
      state.cartItems.push({
        id,
        productType,
        productName,
        designTextureFront,
        designTextureBack,
        rawDesignFront,
        rawDesignBack,
        printFront, // друкарський макет (повна роздільність) — спереду
        printBack, //  — ззаду
        fabricFront,
        fabricBack,
        color,
        size,
        printSize, // формат друку футболки (А4/А3) — для ціни з прайсу
        canvasSize, // розмір полотна — для ціни з прайсу
        paperType,
        slimBookFormat, // формат Slim Book — для ціни
        slimBookSpreads, // база розворотів (10/15)
        slimBookExtra, // дод. розвороти понад базу
        innerPhotos, // фото для розворотів (data URL) — студія розкладає
        variantLabel, // готовий підпис опцій (розмір/папір/колір) для кошика й замовлення
        quantity: quantity || 1,
      });
      state.isCartOpen = true;
      state.designDirty = false; // поточний дизайн зафіксовано в кошику
      state.slimBookPhotos = []; // фото перенесено в позицію — очищаємо буфер
    },
    removeFromCart: (state, action) => {
      state.cartItems = state.cartItems.filter(item => item.id !== action.payload);
    },
    updateQuantity: (state, action) => {
      const { id, quantity } = action.payload;
      const item = state.cartItems.find(item => item.id === id);
      if (item) {
        item.quantity = quantity;
      }
    },
    clearCart: (state) => {
      state.cartItems = [];
    },
    toggleCart: (state, action) => {
      state.isCartOpen = action.payload !== undefined ? action.payload : !state.isCartOpen;
    },
  },
});

export const {
  setSelectedType,
  setTshirtColor,
  setSelectedView,
  setSize,
  setPrintSize,
  setCanvasSize,
  setSlimBookFormat,
  setSlimBookSpreads,
  setSlimBookExtra,
  addSlimBookPhotos,
  removeSlimBookPhoto,
  clearSlimBookPhotos,
  reorderSlimBookPhotos,
  setPaperType,
  markDesignDirty,
  setQuantity,
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  toggleCart
} = tshirtSlice.actions;

export default tshirtSlice.reducer;
