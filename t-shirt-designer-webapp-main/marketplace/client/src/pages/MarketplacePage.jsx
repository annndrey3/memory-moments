import { useEffect, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Search, LayoutGrid } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroBanner } from "@/components/HeroBanner";
import { ProductGrid } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { Input, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";
import { scrollToCatalog } from "@/lib/scroll";

// Плитка категорії: квадратна іконка (картинка з адмінки або плейсхолдер) + назва.
function CategoryTile({ name, count, image, active, onClick, all }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col items-center gap-2 rounded-2xl p-2 transition-all active:scale-95",
        active ? "bg-violet-50 ring-2 ring-violet-400 shadow-sm" : "ring-1 ring-transparent hover:bg-slate-50"
      )}
    >
      <div
        className={cn(
          "relative w-full aspect-square rounded-xl overflow-hidden flex items-center justify-center",
          image ? "bg-slate-100" : "bg-gradient-to-br from-violet-100 to-fuchsia-100"
        )}
      >
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : all ? (
          <LayoutGrid className="h-7 w-7 text-violet-400" />
        ) : (
          <span className="text-2xl font-bold text-violet-300">{name?.[0] || "?"}</span>
        )}
      </div>
      <span
        className={cn(
          "text-xs font-medium text-center leading-tight line-clamp-2",
          active ? "text-violet-700" : "text-slate-600"
        )}
      >
        {name}
        {count !== undefined && <span className="text-slate-400"> ({count})</span>}
      </span>
    </button>
  );
}

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const category = searchParams.get("category") || "";
  const page = Number(searchParams.get("page") || 1);
  const location = useLocation();

  useSeo();

  // Перехід із шапки на іншій сторінці веде на /#catalog — доскролюємо до
  // секції каталогу після монтування головної.
  useEffect(() => {
    if (location.hash === "#catalog") {
      requestAnimationFrame(() => scrollToCatalog());
    }
  }, [location.hash]);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .getProducts({
        category: category || undefined,
        search: searchParams.get("search") || undefined,
        page,
        limit: 12,
      })
      .then((data) => {
        setProducts(data.items);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category, searchParams, page]);

  const setCategory = (slug) => {
    const params = new URLSearchParams(searchParams);
    if (slug) params.set("category", slug);
    else params.delete("category");
    params.delete("page");
    setSearchParams(params);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (search) params.set("search", search);
    else params.delete("search");
    params.delete("page");
    setSearchParams(params);
  };

  const totalPages = Math.ceil(total / 12);

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />
      <HeroBanner categories={categories} onCategorySelect={setCategory} />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {/* Якір для кнопки «Каталог товарів» з банера. scroll-mt-24 — відступ,
            щоб заголовок не ховався під липким хедером. */}
        <Reveal as="section" id="catalog" className="mb-8 scroll-mt-24">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Каталог <span className="text-gradient-animated">подарунків</span>
          </h1>
          <p className="mt-2 text-slate-500 max-w-xl">
            Оберіть товар і створіть унікальний дизайн у нашому конструкторі
          </p>
        </Reveal>

        {/* Категорії — плитками з іконками (картинки редагуються в адмінці) */}
        <Reveal as="section" className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Категорії
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 md:gap-4">
            <CategoryTile name="Усі товари" all active={!category} onClick={() => setCategory("")} />
            {categories.map((c) => (
              <CategoryTile
                key={c.id}
                name={c.name}
                count={c.product_count}
                image={c.image_url}
                active={category === c.slug}
                onClick={() => setCategory(c.slug)}
              />
            ))}
          </div>
        </Reveal>

        <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Пошук товарів..."
              className="pl-10 rounded-xl"
            />
          </div>
          <Button type="submit" className="rounded-xl">Знайти</Button>
        </form>

        <ProductGrid products={products} loading={loading} />

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === page ? "default" : "outline"}
                size="sm"
                className="rounded-lg w-9"
                onClick={() => {
                  const params = new URLSearchParams(searchParams);
                  params.set("page", String(p));
                  setSearchParams(params);
                }}
              >
                {p}
              </Button>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
