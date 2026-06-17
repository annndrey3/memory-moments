import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { query } from "../config/db.js";

const router = Router();

// Захист від брутфорсу: не більше 10 спроб входу за 15 хв з однієї IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Рахуємо лише невдалі спроби — успішний вхід не наближає до ліміту.
  skipSuccessfulRequests: true,
  message: { error: "Забагато спроб входу. Спробуйте за 15 хвилин." },
});

router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const admins = await query(
      "SELECT * FROM admins WHERE email = :email LIMIT 1",
      { email }
    );
    if (!admins.length) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const admin = admins[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    const permissions = admin.permissions ? JSON.parse(admin.permissions) : null;
    res.json({
      token,
      admin: { id: admin.id, email: admin.email, role: admin.role, permissions },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", async (req, res) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    const admins = await query(
      "SELECT id, email, role, permissions FROM admins WHERE id = :id",
      { id: payload.id }
    );
    if (!admins.length) return res.status(401).json({ error: "Unauthorized" });
    const a = admins[0];
    res.json({
      admin: {
        id: a.id,
        email: a.email,
        role: a.role,
        permissions: a.permissions ? JSON.parse(a.permissions) : null,
      },
    });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
