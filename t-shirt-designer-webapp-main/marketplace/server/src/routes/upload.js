import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Розширення визначаємо СУВОРО зі списку дозволених mimetype, а не з імені
// файлу клієнта. Інакше через originalname можна було б зберегти .svg/.html і
// отримати stored-XSS з нашого origin (mimetype теж керований клієнтом, але
// helmet виставляє X-Content-Type-Options: nosniff, тож image/* не виконається).
const EXT_BY_MIME = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = EXT_BY_MIME[file.mimetype] || ".bin";
    cb(null, `${unique}${ext}`);
  },
});

const MAX_MB = 10;
const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("UNSUPPORTED_TYPE"));
  },
});

// Обгортаємо multer, щоб віддавати зрозумілу JSON-помилку (а не HTML-500),
// інакше клієнт показує «Request failed: 500» і незрозуміло, що сталося.
router.post("/", authMiddleware, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      const msg =
        err.code === "LIMIT_FILE_SIZE"
          ? `Файл завеликий — максимум ${MAX_MB} МБ. Стисніть зображення і спробуйте ще раз.`
          : err.message === "UNSUPPORTED_TYPE"
          ? "Непідтримуваний формат. Дозволені: JPEG, PNG, WEBP, GIF (не HEIC)."
          : "Не вдалося завантажити файл.";
      return res.status(400).json({ error: msg });
    }
    if (!req.file) return res.status(400).json({ error: "Файл не надіслано" });
    res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename });
  });
});

export default router;
