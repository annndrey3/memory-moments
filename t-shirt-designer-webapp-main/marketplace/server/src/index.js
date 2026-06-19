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
import priceImportRoutes from "./routes/priceImport.js";
import adminSettingsRoutes from "./routes/adminSettings.js";
import photoUploadRoutes from "./routes/photoUpload.js";
import cleanupRouter from "./routes/cleanup.js";
import dataIORoutes from "./routes/dataIO.js";
import slideRoutes from "./routes/slides.js";
import customerRoutes from "./routes/customers.js";
import siteConfigRoutes from "./routes/siteConfig.js";
import prerenderRoutes from "./prerender.js";
import { query } from "./config/db.js";

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

// Замовлення з конструктора несуть base64: стиснені прев'ю + друкарські макети
// у повній роздільності (документи для Telegram) — тому окремий більший ліміт.
// Реєструємо ДО глобального парсера: express.json пропускає вже розпарсене тіло.
app.use("/api/orders", express.json({ limit: "100mb" }));
// Імпорт даних (товари/прайс/категорії) може бути великим JSON.
app.use("/api/admin/data", express.json({ limit: "25mb" }));
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

// Лёгке структурне логування на стику HTTP: метод, шлях, статус, тривалість,
// розмір тіла. Статика /uploads віддана вище й сюди не доходить. Без зовнішніх
// залежностей — рядок JSON на запит (далі підхопить pm2-logrotate у проді).
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      JSON.stringify({
        t: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        ms: Math.round(ms),
        bytes: Number(req.headers["content-length"]) || 0,
      })
    );
  });
  next();
});

app.get("/api/health", async (_req, res) => {
  // Глибока перевірка: доступність БД. 503 дозволяє зовнішньому монітору/PM2
  // реагувати на «живий процес, але мертва БД», а не вважати сервіс здоровим.
  try {
    await query("SELECT 1 AS ok");
    res.json({ status: "ok", service: "memory-moments-marketplace-api" });
  } catch (err) {
    console.error("health check failed:", err.message);
    res.status(503).json({ status: "error", service: "memory-moments-marketplace-api" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/site-config", siteConfigRoutes);
app.use("/api/slides", slideRoutes);
app.use("/api/products", productRoutes);
app.use("/api/designs", designRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/prices/import", priceImportRoutes);
app.use("/api/admin/settings", adminSettingsRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/photos", photoUploadRoutes);
app.use("/api/admin/cleanup", cleanupRouter);
app.use("/api/admin/data", dataIORoutes);
app.use("/api/admin/customers", customerRoutes);

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
