import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./index.css";
import App from "./App.jsx";
import { CartProvider } from "./lib/cart";

createRoot(document.getElementById("root")).render(
  <CartProvider>
    <App />
  </CartProvider>
);
