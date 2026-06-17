import jwt from "jsonwebtoken";
import { query } from "../config/db.js";

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [admin] = await query(
      "SELECT id, email, role, permissions FROM admins WHERE id = :id",
      { id: payload.id }
    );
    if (!admin) return res.status(401).json({ error: "Unauthorized" });
    req.admin = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions ? JSON.parse(admin.permissions) : null,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
