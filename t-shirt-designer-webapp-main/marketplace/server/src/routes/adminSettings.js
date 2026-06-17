import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission, requireSuperadmin } from "../middleware/requirePermission.js";
import { getSetting, setSetting } from "../utils/settings.js";

const router = Router();
router.use(authMiddleware);

// GET /api/admin/settings/profile
router.get("/profile", async (req, res) => {
  try {
    const [admin] = await query(
      "SELECT id, email, role FROM admins WHERE id = :id",
      { id: req.admin.id }
    );
    if (!admin) return res.status(404).json({ error: "Not found" });
    res.json({ admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// PUT /api/admin/settings/profile  — update email only
router.put("/profile", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: "Вкажіть email" });
    }
    const [existing] = await query("SELECT * FROM admins WHERE id = :id", { id: req.admin.id });
    if (!existing) return res.status(404).json({ error: "Not found" });

    if (email !== existing.email) {
      const dup = await query(
        "SELECT id FROM admins WHERE email = :email AND id != :id LIMIT 1",
        { email, id: req.admin.id }
      );
      if (dup.length) return res.status(409).json({ error: "Email вже використовується" });
    }

    await query(
      "UPDATE admins SET email = :email, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
      { id: req.admin.id, email: email.trim() }
    );
    const [updated] = await query(
      "SELECT id, email, role FROM admins WHERE id = :id",
      { id: req.admin.id }
    );
    res.json({ admin: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// GET /api/admin/settings/users  — list all admins
router.get("/users", requireSuperadmin, async (req, res) => {
  try {
    const users = await query(
      "SELECT id, email, role, permissions, created_at FROM admins ORDER BY id ASC"
    );
    res.json({
      users: users.map((u) => ({
        ...u,
        permissions: u.permissions ? JSON.parse(u.permissions) : null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/admin/settings/users  — create new admin
router.post("/users", requireSuperadmin, async (req, res) => {
  try {
    const { email, password, role = "admin" } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email і пароль обов'язкові" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Пароль — мінімум 8 символів" });
    }
    if (!["admin", "superadmin"].includes(role)) {
      return res.status(400).json({ error: "Невалідна роль" });
    }
    const dup = await query(
      "SELECT id FROM admins WHERE email = :email LIMIT 1",
      { email: email.trim() }
    );
    if (dup.length) return res.status(409).json({ error: "Email вже використовується" });

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      "INSERT INTO admins (email, password_hash, name, role, permissions) VALUES (:email, :hash, :name, :role, :permissions)",
      { email: email.trim(), hash, name: email.trim().split("@")[0], role, permissions: "[]" }
    );
    const [created] = await query(
      "SELECT id, email, role, permissions, created_at FROM admins WHERE id = :id",
      { id: result.insertId }
    );
    res.status(201).json({
      user: { ...created, permissions: created.permissions ? JSON.parse(created.permissions) : [] },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/admin/settings/users/:id/permissions  — update user permissions
router.put("/users/:id/permissions", requireSuperadmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.admin.id) {
      return res.status(400).json({ error: "Власні дозволи не можна редагувати тут" });
    }
    const [target] = await query(
      "SELECT id, role FROM admins WHERE id = :id",
      { id: targetId }
    );
    if (!target) return res.status(404).json({ error: "Користувача не знайдено" });
    if (target.role === "superadmin") {
      return res.status(400).json({ error: "Дозволи суперадміна не редагуються" });
    }

    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: "permissions має бути масивом" });
    }

    const ALLOWED = [
      "orders.view", "orders.manage",
      "products.view", "products.manage",
      "designs.view", "designs.manage",
      "services.view", "services.manage",
      "settings.system",
    ];
    const clean = permissions.filter((p) => ALLOWED.includes(p));

    await query(
      "UPDATE admins SET permissions = :permissions, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
      { permissions: JSON.stringify(clean), id: targetId }
    );
    res.json({ permissions: clean });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update permissions" });
  }
});

// DELETE /api/admin/settings/users/:id  — remove admin (cannot delete yourself)
router.delete("/users/:id", requireSuperadmin, async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    if (targetId === req.admin.id) {
      return res.status(400).json({ error: "Не можна видалити власний акаунт" });
    }
    const [target] = await query("SELECT id FROM admins WHERE id = :id", { id: targetId });
    if (!target) return res.status(404).json({ error: "Користувача не знайдено" });

    await query("DELETE FROM admins WHERE id = :id", { id: targetId });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/admin/settings/password
router.put("/password", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Обидва паролі обов'язкові" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Новий пароль — мінімум 8 символів" });
    }

    const [admin] = await query("SELECT * FROM admins WHERE id = :id", { id: req.admin.id });
    if (!admin) return res.status(404).json({ error: "Not found" });

    const valid = await bcrypt.compare(currentPassword, admin.password_hash);
    if (!valid) return res.status(401).json({ error: "Поточний пароль невірний" });

    const hash = await bcrypt.hash(newPassword, 12);
    await query(
      "UPDATE admins SET password_hash = :hash, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
      { hash, id: req.admin.id }
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to change password" });
  }
});

// GET /api/admin/settings/gemini  — returns masked key
router.get("/gemini", requirePermission("settings.system"), async (req, res) => {
  try {
    const key = await getSetting("gemini_api_key");
    const envKey = process.env.GEMINI_API_KEY;
    const active = key || envKey || null;
    res.json({
      // Повертаємо лише маску, щоб не світити ключ у браузері
      hasKey: Boolean(active),
      source: key ? "db" : envKey ? "env" : null,
      masked: active ? active.slice(0, 8) + "••••••••" + active.slice(-4) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Gemini settings" });
  }
});

// PUT /api/admin/settings/gemini
router.put("/gemini", requirePermission("settings.system"), async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey?.trim()) {
      return res.status(400).json({ error: "API ключ не може бути порожнім" });
    }
    await setSetting("gemini_api_key", apiKey.trim());
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save Gemini key" });
  }
});

// DELETE /api/admin/settings/gemini  — clear stored key (fall back to .env)
router.delete("/gemini", requirePermission("settings.system"), async (req, res) => {
  try {
    await query("DELETE FROM settings WHERE key = 'gemini_api_key'");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to clear Gemini key" });
  }
});

export default router;
