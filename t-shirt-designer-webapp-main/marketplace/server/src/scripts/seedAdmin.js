import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { query } from "../config/db.js";

dotenv.config();

const email = process.env.ADMIN_EMAIL || "admin@memory-moments.local";
const password = process.env.ADMIN_PASSWORD || "admin123";

const hash = await bcrypt.hash(password, 10);
const existing = await query("SELECT id FROM admins WHERE email = :email", { email });

if (existing.length) {
  await query("UPDATE admins SET password_hash = :hash WHERE email = :email", { hash, email });
  console.log(`Admin password updated for ${email}`);
} else {
  await query(
    "INSERT INTO admins (email, password_hash, name, role) VALUES (:email, :hash, :name, :role)",
    { email, hash, name: "Адміністратор", role: "superadmin" }
  );
  console.log(`Admin created: ${email} / ${password}`);
}

process.exit(0);
