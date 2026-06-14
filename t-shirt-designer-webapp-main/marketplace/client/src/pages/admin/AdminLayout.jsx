import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, LogOut, Store, Palette, ShoppingBag, Tag } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui";

export default function AdminLayout() {
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
      <aside className="w-56 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="p-5 border-b border-slate-800">
          <p className="font-bold text-sm">Memory Moments</p>
          <p className="text-xs text-slate-400">Admin Panel</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <Link
            to="/admin/products"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Package className="h-4 w-4" />
            Товари
          </Link>
          <Link
            to="/admin/designs"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Palette className="h-4 w-4" />
            Дизайни
          </Link>
          <Link
            to="/admin/orders"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            Замовлення
          </Link>
          <Link
            to="/admin/services"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Tag className="h-4 w-4" />
            Прайс
          </Link>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <Store className="h-4 w-4" />
            Маркетплейс
          </Link>
        </nav>
        <div className="p-3 border-t border-slate-800">
          <Button
            variant="ghost"
            onClick={logout}
            className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Вийти
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-violet-600" />
          <h1 className="font-semibold text-slate-900">Керування товарами</h1>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
