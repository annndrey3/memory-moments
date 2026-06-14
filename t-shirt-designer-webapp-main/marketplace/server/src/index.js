import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/categories.js";
import productRoutes from "./routes/products.js";
import uploadRoutes from "./routes/upload.js";
import designRoutes from "./routes/designs.js";
import orderRoutes from "./routes/orders.js";
import serviceRoutes from "./routes/services.js";
import prerenderRoutes from "./prerender.js";

dotenv.config();

// Безпековий guard: не стартуємо з відсутнім/дефолтним/коротким JWT_SECRET —
// інакше токени можна підробити будь-яким ключем із прикладу.
const INSECURE_JWT_DEFAULT = "change-me-in-production-use-long-random-string";
const jwtSecret = process.env.JWT_SECRET || "";
if (!jwtSecret || jwtSecret === INSECURE_JWT_DEFAULT || jwtSecret.length < 32) {
  console.error(
    "FATAL: JWT_SECRET відсутній, дорівнює прикладу або закороткий (<32 символів).\n" +
      "Згенеруйте надійний ключ і додайте у marketplace/server/.env:\n" +
      '  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// За nginx/reverse-proxy: довіряємо першому хопу, щоб rate-limit бачив реальну IP клієнта.
app.set("trust proxy", 1);

// Allow both the marketplace client and the standalone designer to call the API.
// CORS_ORIGIN may be a single origin or a comma-separated list.
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5174,http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Безпечні HTTP-заголовки. crossOriginResourcePolicy послаблено, бо /uploads
// віддаються на інший origin (конструктор/маркетплейс) як <img>.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin / non-browser requests (no Origin header) and whitelisted origins.
      // For other origins respond without CORS headers (browser blocks) instead of erroring.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  })
);

// Замовлення можуть нести base64-прев'ю макетів для Telegram — окремий більший ліміт.
// Реєструємо ДО глобального парсера: express.json пропускає вже розпарсене тіло.
app.use("/api/orders", express.json({ limit: "20mb" }));
// Глобально — невеликий ліміт як захист від memory-DoS на публічних end-point'ах.
app.use(express.json({ limit: "1mb" }));

const uploadDir = path.resolve(process.env.UPLOAD_DIR || "uploads");
app.use("/uploads", express.static(uploadDir));

// API-відповіді — динамічні: забороняємо кешування браузером,
// щоб список одразу показував свіжі дані після створення/редагування.
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "memory-moments-marketplace-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/designs", designRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/upload", uploadRoutes);

// SSR-пререндер OG для сторінок товару (/product/:slug). nginx направляє сюди
// лише ботів соцмереж/месенджерів; живі відвідувачі отримують SPA зі статики.
app.use(prerenderRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  // Відомі помилки парсера тіла повертаємо як 4xx, решту — узагальнено,
  // щоб не світити внутрішні деталі клієнту.
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Занадто великий запит" });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Некоректний JSON" });
  }
  res.status(err.status || 500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Marketplace API running on http://localhost:${PORT}`);
});
