import { Link, useLocation } from "react-router-dom";
import { Palette, Store, ShoppingCart, Tag, Phone, Camera } from "lucide-react";
import { Button } from "./ui";
import { useCart } from "@/lib/cart";
import { scrollToCatalog, scrollToId } from "@/lib/scroll";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5173";

export function SiteHeader() {
  const { count } = useCart();
  const location = useLocation();

  // «Каталог»: на головній — плавно скролимо до секції; на інших сторінках
  // даємо <Link> перейти на /#catalog (доскролить уже MarketplacePage).
  const handleCatalog = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      scrollToCatalog();
      window.history?.replaceState?.(null, "", "/#catalog");
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl animate-fade-in">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8">
        <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center min-w-0" title="На головну">
          <img
            src="/logo-brand.png"
            alt="Memory Moments"
            className="h-12 w-auto object-contain transition-transform duration-300 hover:scale-105"
          />
        </Link>

        <nav className="flex items-center gap-2 font-brand tracking-wide">
          <a href={DESIGNER_URL}>
            <Button variant="outline" size="sm" className="rounded-xl">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Конструктор</span>
            </Button>
          </a>
          <Link to="/#catalog" onClick={handleCatalog}>
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Каталог</span>
            </Button>
          </Link>
          <Link to="/print">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">Фото</span>
            </Button>
          </Link>
          <Link to="/prices">
            <Button variant="ghost" size="sm" className="rounded-xl">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Ціни</span>
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl"
            onClick={() => scrollToId("contacts", "end")}
          >
            <Phone className="h-4 w-4" />
            <span className="hidden sm:inline">Контакти</span>
          </Button>
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
        </nav>
      </div>
    </header>
  );
}
