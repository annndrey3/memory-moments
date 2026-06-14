import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Minus, Plus, Trash2, ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { useSeo } from "@/lib/seo";

export default function CartPage() {
  const navigate = useNavigate();
  const { items, updateQty, removeItem, subtotal } = useCart();
  useSeo({ title: "Кошик" });

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <Link
          to="/"
          className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Продовжити покупки
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-violet-600" />
          Кошик
        </h1>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center animate-fade-in-up">
            <p className="text-slate-500 mb-4">Ваш кошик порожній</p>
            <Link to="/">
              <Button className="rounded-xl">До каталогу</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item, i) => (
                <div
                  key={item.key}
                  className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft animate-fade-in-up transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5"
                  style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-400">
                        Без фото
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <Link
                      to={`/product/${item.slug}`}
                      className="font-semibold text-slate-900 hover:text-violet-700"
                    >
                      {item.name}
                    </Link>
                    {item.variant_label && (
                      <p className="text-sm text-slate-500">{item.variant_label}</p>
                    )}
                    {item.design_name && (
                      <p className="text-xs text-violet-600">Дизайн: {item.design_name}</p>
                    )}
                    <p className="mt-1 text-sm text-slate-500">{formatPrice(item.unit_price)} / шт.</p>

                    <div className="mt-auto flex items-center gap-3 pt-2">
                      <div className="flex items-center rounded-lg border border-slate-200">
                        <button
                          onClick={() => updateQty(item.key, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          className="px-2 py-1 text-slate-500 hover:text-violet-600 disabled:opacity-40"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.key, item.quantity + 1)}
                          className="px-2 py-1 text-slate-500 hover:text-violet-600"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.key)}
                        className="text-slate-400 hover:text-red-500"
                        title="Видалити"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right font-semibold text-slate-900">
                    {formatPrice(item.unit_price * item.quantity)}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sticky top-24 shadow-soft animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                <h2 className="font-semibold text-slate-900 mb-4">Разом</h2>
                <div className="flex justify-between text-sm text-slate-600 mb-2">
                  <span>Сума</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg text-slate-900 border-t border-slate-100 pt-3 mt-3">
                  <span>До сплати</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                <Button
                  onClick={() => navigate("/checkout")}
                  className="w-full rounded-xl h-12 mt-5 shadow-glow"
                >
                  Оформити замовлення
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
