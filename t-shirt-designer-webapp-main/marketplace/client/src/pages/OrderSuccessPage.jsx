import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";

export default function OrderSuccessPage() {
  const { number } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  useSeo({ title: "Замовлення прийнято" });

  useEffect(() => {
    api
      .trackOrder(number)
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [number]);

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-soft animate-fade-in-up">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 animate-pulse-glow">
              <CheckCircle2 className="h-9 w-9 text-emerald-600 animate-badge-pop" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Дякуємо за замовлення!</h1>
            <p className="mt-2 text-slate-600">
              Замовлення{" "}
              <span className="font-semibold text-violet-700">{number}</span> прийнято.
              Ми зв'яжемося з вами найближчим часом.
            </p>

            {order && (
              <div className="mt-6 text-left">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  {order.items?.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-slate-700">
                        {item.product_name}
                        {item.variant_label ? ` (${item.variant_label})` : ""} × {item.quantity}
                      </span>
                      <span className="text-slate-600">{formatPrice(item.line_total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
                    <span>Разом</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </div>
            )}

            <Link to="/" className="mt-6 inline-block">
              <Button className="rounded-xl">Повернутися до каталогу</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
