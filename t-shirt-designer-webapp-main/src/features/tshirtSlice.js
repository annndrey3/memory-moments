import { createSlice } from "@reduxjs/toolkit";
import { PRODUCT_TYPES } from "../constants/designConstants";

const initialState = {
  selectedType: "crew-neck",
  tshirtColor: "#FFFFFF",
  selectedView: "front",
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
    },
    setSelectedView: (state, action) => {
      state.selectedView = action.payload;
    },
    addToCart: (state, action) => {
      const { id, productType, productName, designTextureFront, designTextureBack, fabricFront, fabricBack, color, quantity } = action.payload;
      state.cartItems.push({
        id,
        productType,
        productName,
        designTextureFront,
        designTextureBack,
        fabricFront,
        fabricBack,
        color,
        quantity: quantity || 1,
      });
      state.isCartOpen = true;
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
  addToCart,
  removeFromCart,
  updateQuantity,
  clearCart,
  toggleCart
} = tshirtSlice.actions;

export default tshirtSlice.reducer;
