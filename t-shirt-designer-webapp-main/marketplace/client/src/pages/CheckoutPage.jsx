import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";

const PICKUP_BRANCHES = [
  "просп. Князя Ярослава Мудрого, 14/4, Одеса",
  "вул. Академіка Корольова, 70/1, Одеса",
  "вул. Преображенська, 48, Одеса",
  "вул. Артура Савельєва, 12, Одеса",
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clear } = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [deliveryType, setDeliveryType] = useState("nova_poshta");
  const [pickupBranch, setPickupBranch] = useState(PICKUP_BRANCHES[0]);
  const [novaPoshtaAddress, setNovaPoshtaAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  useSeo({ title: "Оформлення замовлення" });

  if (items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  function buildShippingAddress() {
    if (deliveryType === "pickup") {
      return `Самовивіз: ${pickupBranch}`;
    }
    return novaPoshtaAddress.trim() || null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Вкажіть ім'я, email та телефон");
      return;
    }
    if (deliveryType === "nova_poshta" && !novaPoshtaAddress.trim()) {
      setError("Вкажіть адресу відділення Нової Пошти");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await api.createOrder({
        customer: {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          address: buildShippingAddress(),
          notes: form.notes.trim() || null,
        },
        items: items.map((i) => {
          if (i.type === "photo_print") {
            return {
              type: "photo_print",
              photo_size: i.photo_size,
              photo_coating: i.photo_coating,
              photo_url: i.photo_url,
              quantity: i.quantity,
            };
          }
          return {
            product_id: i.product_id,
            variant_id: i.variant_id || null,
            design_id: i.design_id || null,
            quantity: i.quantity,
          };
        }),
      });
      clear();
      navigate(`/order/${order.order_number}`);
    } catch (err) {
      setError(err.message || "Не вдалося оформити замовлення");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <Link
          to="/cart"
          className="group inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Назад до кошика
        </Link>

        <h1 className="text-2xl font-bold text-slate-900 mb-6 animate-fade-in-up">Оформлення замовлення</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4 animate-fade-in-up">
            {/* Contact info */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="font-semibold text-slate-800">Контактні дані</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Ім'я та прізвище *</Label>
                  <Input value={form.name} onChange={(e) => set("name", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Телефон *</Label>
                  <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
                </div>
              </div>
            </div>

            {/* Delivery */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <h2 className="font-semibold text-slate-800">Спосіб отримання</h2>

              {/* Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType("nova_poshta")}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    deliveryType === "nova_poshta"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Нова Пошта
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("pickup")}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                    deliveryType === "pickup"
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  Самовивіз
                </button>
              </div>

              {deliveryType === "nova_poshta" && (
                <div className="space-y-1.5">
                  <Label>Місто та відділення Нової Пошти *</Label>
                  <Input
                    value={novaPoshtaAddress}
                    onChange={(e) => setNovaPoshtaAddress(e.target.value)}
                    placeholder="Наприклад: Одеса, відділення № 5"
                  />
                </div>
              )}

              {deliveryType === "pickup" && (
                <div className="space-y-1.5">
                  <Label>Оберіть філіал</Label>
                  <select
                    value={pickupBranch}
                    onChange={(e) => setPickupBranch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {PICKUP_BRANCHES.map((addr) => (
                      <option key={addr} value={addr}>
                        {addr}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-1.5">
              <Label>Коментар до замовлення</Label>
              <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </form>

          {/* Summary */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sticky top-24 shadow-soft animate-fade-in-up" style={{ animationDelay: "0.12s" }}>
              <h2 className="font-semibold text-slate-900 mb-4">Ваше замовлення</h2>
              <div className="space-y-3 max-h-72 overflow-auto">
                {items.map((item) => (
                  <div key={item.key} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-slate-800 truncate">{item.name}</p>
                      <p className="text-slate-400">
                        {item.variant_label ? `${item.variant_label} · ` : ""}× {item.quantity}
                      </p>
                    </div>
                    <span className="shrink-0 text-slate-700">
                      {formatPrice(item.unit_price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-lg text-slate-900 border-t border-slate-100 pt-3 mt-4">
                <span>До сплати</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-xl h-12 mt-5 shadow-glow"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Оформлення...
                  </>
                ) : (
                  "Підтвердити замовлення"
                )}
              </Button>
              <p className="mt-3 text-xs text-slate-400 text-center">
                Менеджер зв'яжеться з вами для підтвердження та оплати.
              </p>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
