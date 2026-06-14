import { Link } from "react-router-dom";
import { formatPrice, cn } from "@/lib/utils";
import { Badge } from "./ui";
import { useInView } from "./Reveal";
import { Sparkles } from "lucide-react";

export function ProductCard({ product, index = 0 }) {
  const [ref, inView] = useInView();
  const hasDiscount =
    product.compare_at_price && Number(product.compare_at_price) > Number(product.price);

  return (
    <Link
      ref={ref}
      to={`/product/${product.slug}`}
      // До появи у в'юпорті — прихована (opacity-0); коли вкочується — програє
      // fade-in-up. Анімація (а не transition) не конфліктує з hover-lift нижче.
      // Stagger по колонці (index % 3) дає приємну хвилю зліва направо в рядку.
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-soft transition-all duration-300 hover:shadow-elevated hover:-translate-y-1.5",
        inView ? "animate-fade-in-up" : "opacity-0"
      )}
      style={{ animationDelay: `${(index % 3) * 80}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {product.primary_image ? (
          <img
            src={product.primary_image}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400 text-sm">
            Без фото
          </div>
        )}
        {/* М'який світлий перелив, що проявляється при наведенні */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-violet-500/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        {product.is_featured ? (
          <div className="absolute top-3 left-3">
            <Badge className="gap-1 shadow-sm animate-pulse-glow">
              <Sparkles className="h-3 w-3" />
              Топ
            </Badge>
          </div>
        ) : null}
        {hasDiscount ? (
          <div className="absolute top-3 right-3">
            <Badge variant="danger">Знижка</Badge>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 gap-2">
        <p className="text-xs text-violet-600 font-medium">{product.category_name}</p>
        <h3 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-violet-700 transition-colors">
          {product.name}
        </h3>
        {product.short_description && (
          <p className="text-sm text-slate-500 line-clamp-2">{product.short_description}</p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-lg font-bold text-slate-900">{formatPrice(product.price)}</span>
          {hasDiscount && (
            <span className="text-sm text-slate-400 line-through">
              {formatPrice(product.compare_at_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-80 rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-100 via-white to-slate-100 bg-[length:200%_100%] animate-gradient-x"
            style={{ animationDelay: `${i * 90}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!products?.length) {
    return (
      <div className="text-center py-20 text-slate-500">
        <p className="text-lg font-medium">Товарів не знайдено</p>
        <p className="text-sm mt-1">Спробуйте інший фільтр або пошук</p>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6")}>
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} index={i} />
      ))}
    </div>
  );
}
