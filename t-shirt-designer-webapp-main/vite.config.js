import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // У продакшні конструктор живе під /designer (єдиний домен з маркетплейсом),
  // у dev — у корені (http://localhost:5174/).
  base: command === "build" ? "/designer/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // доступ по локальній мережі (0.0.0.0)
    port: 5174,
    // Проксі на API, щоб у dev звертатися до /api з того ж origin (без CORS).
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
    },
  },
}));
