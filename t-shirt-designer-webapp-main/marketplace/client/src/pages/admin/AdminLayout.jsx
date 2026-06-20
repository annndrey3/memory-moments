import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Package, LogOut, Store, Palette, ShoppingBag, Tag, Settings, Layers, GalleryHorizontal, Users, Globe, Image as ImageIcon, Bell, BookOpen, Menu, X } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";
import { PermissionsProvider, usePermissions } from "@/contexts/PermissionsContext";

function Sidebar({ onLogout, open, onClose }) {
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
    { to: "/admin/notifications", icon: Bell,      label: "Сповіщення",   show: true },
    { to: "/admin/settings",   icon: Settings,    label: "Налаштування", show: true },
    { to: "/admin/guide",      icon: BookOpen,    label: "Посібник",     show: true },
    { to: "/",               icon: Store,       label: "Маркетплейс",   show: true },
  ];

  return (
    <>
      {/* Затемнення під час відкритого мобільного меню */}
      {open && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-slate-900 text-white flex flex-col
          transform transition-transform duration-200 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Memory Moments</p>
            <p className="text-xs text-slate-400">{isSuperadmin ? "Суперадмін" : "Адмін"}</p>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1" aria-label="Закрити меню">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.filter((i) => i.show).map(({ to, icon: Icon, label }) => (
            <Link
              key={to}
              to={to}
              onClick={onClose}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <Icon className="h-4 w-4 shrink-0" />
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
    </>
  );
}

function AdminLayoutInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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

  // Закривати мобільне меню при зміні сторінки.
  useEffect(() => setNavOpen(false), [location.pathname]);

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
    <div className="min-h-screen bg-slate-50 lg:flex">
      <Sidebar onLogout={logout} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-3 md:px-6 py-3 flex items-center gap-2">
          <button
            onClick={() => setNavOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-violet-600"
            aria-label="Меню"
          >
            <Menu className="h-6 w-6" />
          </button>
          <LayoutDashboard className="h-5 w-5 text-violet-600 shrink-0" />
          <h1 className="font-semibold text-slate-900">Керування</h1>
        </header>
        <main className="p-4 md:p-6">
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
