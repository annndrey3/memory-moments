import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Palette, Sparkles, ShoppingCart, Minus, Plus, Check } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useSeo } from "@/lib/seo";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5173";

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [variantId, setVariantId] = useState(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  useSeo({
    title: product?.name,
    description: product?.short_description || product?.description,
    image: product?.images?.[0]?.image_url,
  });

  useEffect(() => {
    setLoading(true);
    api
      .getProductBySlug(slug)
      .then((p) => {
        setProduct(p);
        setActiveImage(0);
        setVariantId(null);
        setQty(1);
        setAdded(false);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-mesh-animated">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 py-12 animate-pulse">
          <div className="grid md:grid-cols-2 gap-10">
            <div className="aspect-square rounded-2xl bg-slate-200" />
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 rounded w-2/3" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-mesh-animated">
        <SiteHeader />
        <div className="text-center py-20">
          <p className="text-lg font-medium text-slate-600">Товар не знайдено</p>
          <Link to="/" className="text-violet-600 hover:underline mt-2 inline-block">
            Повернутися до каталогу
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images?.length
    ? product.images
    : [{ image_url: null, alt_text: product.name }];

  const hasDiscount =
    product.compare_at_price && Number(product.compare_at_price) > Number(product.price);

  const variants = product.variants || [];
  const selectedVariant = variants.find((v) => v.id === variantId) || null;
  const needsVariant = variants.length > 0 && !selectedVariant;
  const unitPrice = Number(product.price) + Number(selectedVariant?.price_modifier || 0);
  const inStock = product.stock_quantity > 0;

  const handleAddToCart = () => {
    if (needsVariant || !inStock) return;
    addItem(
      {
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        image: images[0]?.image_url || null,
        unit_price: unitPrice,
        variant_id: selectedVariant?.id || null,
        variant_label: selectedVariant
          ? `${selectedVariant.attribute_name}: ${selectedVariant.attribute_value}`
          : null,
        design_id: product.design_id || null,
        design_name: product.design_name || null,
      },
      qty
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  };

  const designerUrl = product.designer_type
    ? `${DESIGNER_URL}?type=${product.designer_type}${
        product.design_id ? `&designId=${product.design_id}` : ""
      }`
    : DESIGNER_URL;

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        <Link
          to="/"
          className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Назад до каталогу
        </Link>

        <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
          <div className="animate-fade-in-up">
            <div className="group aspect-square rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-soft transition-shadow hover:shadow-elevated">
              {images[activeImage]?.image_url ? (
                <img
                  src={images[activeImage].image_url}
                  alt={images[activeImage].alt_text || product.name}
                  className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-400">Без фото</div>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3">
                {images.map((img, i) => (
                  <button
                    key={img.id || i}
                    onClick={() => setActiveImage(i)}
                    className={`h-16 w-16 rounded-lg overflow-hidden border-2 transition-all duration-200 hover:scale-105 active:scale-95 ${
                      i === activeImage ? "border-violet-500" : "border-transparent"
                    }`}
                  >
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="muted">{product.category_name}</Badge>
              {product.is_featured ? (
                <Badge className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Рекомендовано
                </Badge>
              ) : null}
            </div>

            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>

            {product.short_description && (
              <p className="mt-3 text-lg text-slate-600">{product.short_description}</p>
            )}

            <div className="flex items-baseline gap-3 mt-6">
              <span className="text-3xl font-bold">{formatPrice(unitPrice)}</span>
              {hasDiscount && (
                <span className="text-lg text-slate-400 line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
              )}
            </div>

            {variants.length > 0 && (
              <div className="mt-6">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Оберіть варіант
                  {needsVariant && <span className="text-violet-600"> *</span>}
                </p>
                <div className="flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id === variantId ? null : v.id)}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition-all duration-200 active:scale-95 ${
                        v.id === variantId
                          ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm"
                          : "border-slate-200 bg-white hover:border-violet-300 hover:-translate-y-0.5"
                      }`}
                    >
                      {v.attribute_value}
                      {Number(v.price_modifier) > 0 && (
                        <span className="text-violet-600 ml-1">
                          +{formatPrice(v.price_modifier)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Кількість + у кошик */}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white h-12">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 h-full text-slate-500 hover:text-violet-600 disabled:opacity-40"
                  disabled={qty <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-medium">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="px-3 h-full text-slate-500 hover:text-violet-600"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <Button
                onClick={handleAddToCart}
                disabled={needsVariant || !inStock}
                className="flex-1 rounded-xl h-12 text-base shadow-glow"
              >
                {added ? (
                  <>
                    <Check className="h-5 w-5 animate-badge-pop" />
                    Додано до кошика
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-5 w-5" />
                    {inStock ? "Додати в кошик" : "Немає в наявності"}
                  </>
                )}
              </Button>
            </div>

            {needsVariant && (
              <p className="mt-2 text-sm text-violet-600">Спочатку оберіть варіант</p>
            )}
            {added && (
              <Link to="/cart" className="mt-2 inline-block text-sm text-violet-600 hover:underline">
                Перейти до кошика →
              </Link>
            )}

            <a href={designerUrl} className="mt-3">
              <Button variant="outline" className="w-full rounded-xl h-11">
                <Palette className="h-4 w-4" />
                Створити власний дизайн
              </Button>
            </a>

            {product.description && (
              <div className="mt-10 pt-8 border-t border-slate-200">
                <h2 className="font-semibold text-slate-900 mb-3">Опис</h2>
                <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            <p className="mt-4 text-sm text-slate-400">
              {product.stock_quantity > 0
                ? `В наявності: ${product.stock_quantity} шт.`
                : "Немає в наявності"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
