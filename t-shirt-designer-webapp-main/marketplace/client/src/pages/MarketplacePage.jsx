import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { HeroBanner } from "@/components/HeroBanner";
import { ProductGrid } from "@/components/ProductCard";
import { Input, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

export default function MarketplacePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");

  const category = searchParams.get("category") || "";
  const page = Number(searchParams.get("page") || 1);

  useSeo();

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
      <HeroBanner />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <section className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Каталог <span className="text-gradient-animated">подарунків</span>
          </h1>
          <p className="mt-2 text-slate-500 max-w-xl">
            Оберіть товар і створіть унікальний дизайн у нашому конструкторі
          </p>
        </section>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Категорії
            </p>
            <div className="flex flex-wrap lg:flex-col gap-2">
              <button
                onClick={() => setCategory("")}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm text-left transition-all duration-200 active:scale-95 lg:hover:translate-x-1",
                  !category ? "bg-violet-100 text-violet-700 font-medium shadow-sm" : "hover:bg-slate-100 text-slate-600"
                )}
              >
                Усі товари
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.slug)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm text-left transition-all duration-200 active:scale-95 lg:hover:translate-x-1",
                    category === c.slug
                      ? "bg-violet-100 text-violet-700 font-medium shadow-sm"
                      : "hover:bg-slate-100 text-slate-600"
                  )}
                >
                  {c.name}
                  <span className="ml-1 text-xs text-slate-400">({c.product_count})</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <form onSubmit={handleSearch} className="flex gap-2 mb-6">
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
          </div>
        </div>
      </main>
    </div>
  );
}
