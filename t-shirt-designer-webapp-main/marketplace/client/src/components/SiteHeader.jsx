import { Link } from "react-router-dom";
import { Palette, Store, ShoppingCart, Tag } from "lucide-react";
import { Button } from "./ui";
import { useCart } from "@/lib/cart";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5173";

export function SiteHeader({ showAdminLink = true }) {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl animate-fade-in">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link to="/" className="flex items-center min-w-0">
          <picture>
            <source srcSet="/logo-mm.webp" type="image/webp" />
            <img
              src="/logo-mm.png"
              alt="Memory Moments"
              className="h-10 w-auto object-contain transition-transform duration-300 hover:scale-105"
            />
          </picture>
        </Link>

        <nav className="flex items-center gap-2 font-brand tracking-wide">
          <a href={DESIGNER_URL}>
            <Button variant="outline" size="sm" className="rounded-xl">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Конструктор</span>
            </Button>
          </a>
          <Link to="/">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Каталог</span>
            </Button>
          </Link>
          <Link to="/prices">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Ціни</span>
            </Button>
          </Link>
          <Link to="/cart" className="relative">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Кошик</span>
            </Button>
            {count > 0 && (
              <span
                key={count}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[11px] font-semibold text-white shadow-glow animate-badge-pop"
              >
                {count}
              </span>
            )}
          </Link>
          {showAdminLink && (
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="rounded-xl text-slate-500">
                Адмін
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
