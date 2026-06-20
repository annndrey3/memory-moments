import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, LogOut, Store, Palette, ShoppingBag, Tag, Settings, Layers, GalleryHorizontal, Users, Globe, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";

function Sidebar({ onLogout }) {
  const { can, role } = usePermissions();
  const isSuperadmin = role === "superadmin";

  const navItems = [
    { to: "/admin/orders",     icon: ShoppingBag, label: "Замовлення",   show: can("orders.view") },
    { to: "/admin/customers",  icon: Users,       label: "Клієнти",      show: can("orders.view") },
    { to: "/admin/products",   icon: Package,     label: "Товари",       show: can("products.view") },
    { to: "/admin/categories", icon: Layers,      label: "Категорії",    show: can("products.view") },
    { to: "/admin/slides",     icon: GalleryHorizontal, label: "Слайди",   show: true },
    { to: "/admin/backgrounds", icon: ImageIcon,  label: "Фони",         show: true },
    { to: "/admin/designs",    icon: Palette,     label: "Дизайни",      show: can("designs.view") },
    { to: "/admin/services",   icon: Tag,         label: "Прайс",        show: can("services.view") },
    { to: "/admin/site",       icon: Globe,       label: "Сайт",         show: can("settings.system") },
    { to: "/admin/settings",   icon: Settings,    label: "Налаштування", show: true },
    { to: "/",               icon: Store,       label: "Маркетплейс",   show: true },
  ];

  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col">
      <div className="p-5 border-b border-slate-800">
        <p className="font-bold text-sm">Memory Moments</p>
        <p className="text-xs text-slate-400">
          {isSuperadmin ? "Суперадмін" : "Адмін"}
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.filter((i) => i.show).map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <Button
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Вийти
        </Button>
      </div>
    </aside>
  );
}

function AdminLayoutInner() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!api.getToken()) {
      setChecking(false);
      return;
    }
    api
      .me()
      .then(() => setAuthorized(true))
      .catch(() => api.clearToken())
      .finally(() => setChecking(false));
  }, []);

  const logout = () => {
    api.clearToken();
    navigate("/admin/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">Завантаження...</div>
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar onLogout={logout} />
      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-violet-600" />
          <h1 className="font-semibold text-slate-900">Керування</h1>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <PermissionsProvider>
      <AdminLayoutInner />
    </PermissionsProvider>
  );
}
