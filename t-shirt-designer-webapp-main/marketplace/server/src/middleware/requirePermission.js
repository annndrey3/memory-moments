// Available permissions:
//   orders.view / orders.manage
//   products.view / products.manage
//   designs.view / designs.manage
//   services.view / services.manage
//   settings.profile  (implicit for all users — own password/email)
//   settings.system   (Gemini key etc — superadmin only)
//   settings.users    (user management — superadmin only)
//
// Rules:
//   superadmin role → all permissions granted unconditionally
//   null permissions → no access (new users start with no permissions)
//   *.manage implies *.view automatically

export function hasPermission(admin, perm) {
  if (!admin) return false;
  if (admin.role === "superadmin") return true;
  const perms = Array.isArray(admin.permissions) ? admin.permissions : [];
  if (perms.includes(perm)) return true;
  if (perm.endsWith(".view")) {
    return perms.includes(perm.replace(".view", ".manage"));
  }
  return false;
}

export function requirePermission(perm) {
  return (req, res, next) => {
    if (!hasPermission(req.admin, perm)) {
      return res.status(403).json({ error: "Недостатньо прав" });
    }
    next();
  };
}

export function requireSuperadmin(req, res, next) {
  if (req.admin?.role !== "superadmin") {
    return res.status(403).json({ error: "Тільки для суперадміна" });
  }
  next();
}
