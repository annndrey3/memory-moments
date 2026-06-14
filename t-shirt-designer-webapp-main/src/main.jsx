// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./index.css";
import App from "./App.jsx";
import { store } from "./lib/store";
import { Provider } from "react-redux";
import { CanvasProvider } from "./hooks/useCanvas";

createRoot(document.getElementById("root")).render(
  // <StrictMode>
  <Provider store={store}>
    <CanvasProvider>
      <App />
    </CanvasProvider>
  </Provider>
  // </StrictMode>
);
