import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const STATUSES = [
  { value: "pending", label: "Новий", variant: "default" },
  { value: "paid", label: "Оплачено", variant: "success" },
  { value: "shipped", label: "Відправлено", variant: "default" },
  { value: "completed", label: "Виконано", variant: "success" },
  { value: "cancelled", label: "Скасовано", variant: "danger" },
];

const statusMeta = (value) => STATUSES.find((s) => s.value === value) || STATUSES[0];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});
  const [updating, setUpdating] = useState(null);

  const loadOrders = () => {
    setLoading(true);
    const params = { limit: 100 };
    if (filter) params.status = filter;
    api
      .getOrders(params)
      .then((res) => setOrders(res.items || []))
      .catch((err) => console.error("Помилка завантаження замовлень:", err))
      .finally(() => setLoading(false));
  };

  useEffect(loadOrders, [filter]);

  const toggleExpand = async (order) => {
    if (expanded === order.id) {
      setExpanded(null);
      return;
    }
    setExpanded(order.id);
    if (!detail[order.id]) {
      try {
        const full = await api.getOrder(order.id);
        setDetail((d) => ({ ...d, [order.id]: full }));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const changeStatus = async (orderId, status) => {
    setUpdating(orderId);
    try {
      const updated = await api.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      setDetail((d) => ({ ...d, [orderId]: updated }));
    } catch (err) {
      alert(err.message || "Не вдалося оновити статус");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Замовлення</h2>
          <p className="text-sm text-slate-500">Усього: {orders.length}</p>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        >
          <option value="">Усі статуси</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
          <Package className="h-8 w-8 mx-auto mb-3 text-slate-300" />
          Замовлень поки немає
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const meta = statusMeta(order.status);
            const full = detail[order.id];
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => toggleExpand(order)}
                    className="text-slate-400 hover:text-violet-600"
                  >
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{order.order_number}</p>
                      <Badge variant={order.source === "designer" ? "default" : "muted"}>
                        {order.source === "designer" ? "Конструктор" : "Сайт"}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 truncate">
                      {order.customer_name}
                      {order.customer_email ? ` · ${order.customer_email}` : ""}
                      {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                    </p>
                  </div>
                  <div className="hidden sm:block text-sm text-slate-400">
                    {order.item_count ?? order.items?.length ?? 0} поз.
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatPrice(order.total)}</p>
                    <p className="text-xs text-slate-400">{order.created_at?.slice(0, 16)}</p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  <select
                    value={order.status}
                    disabled={updating === order.id}
                    onChange={(e) => changeStatus(order.id, e.target.value)}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 text-sm">
                    {!full ? (
                      <div className="text-slate-400 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Завантаження...
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="font-medium text-slate-700 mb-2">Позиції</p>
                          <div className="space-y-1.5">
                            {full.items?.map((item) => (
                              <div key={item.id} className="flex justify-between">
                                <span className="text-slate-600">
                                  {item.product_name}
                                  {item.variant_label ? ` (${item.variant_label})` : ""} × {item.quantity}
                                </span>
                                <span className="text-slate-700">{formatPrice(item.line_total)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                              <span>Разом</span>
                              <span>{formatPrice(full.total)}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-slate-700 mb-2">Клієнт</p>
                          <dl className="space-y-1 text-slate-600">
                            <div><dt className="inline text-slate-400">Ім'я: </dt>{full.customer_name}</div>
                            <div><dt className="inline text-slate-400">Email: </dt>{full.customer_email}</div>
                            {full.customer_phone && (
                              <div><dt className="inline text-slate-400">Телефон: </dt>{full.customer_phone}</div>
                            )}
                            {full.shipping_address && (
                              <div><dt className="inline text-slate-400">Адреса: </dt>{full.shipping_address}</div>
                            )}
                            {full.notes && (
                              <div><dt className="inline text-slate-400">Коментар: </dt>{full.notes}</div>
                            )}
                          </dl>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
