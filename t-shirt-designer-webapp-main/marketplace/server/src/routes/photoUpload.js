import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";

const router = Router();

const uploadDir = process.env.UPLOAD_DIR || "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `photo_${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Дозволені тільки JPEG, PNG або WebP"));
  },
});

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Забагато завантажень. Спробуйте за хвилину." },
});

router.post("/", limiter, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Файл не завантажено" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

export default router;
