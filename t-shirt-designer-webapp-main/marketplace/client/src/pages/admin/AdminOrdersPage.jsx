import { useEffect, useState } from "react";
import { Loader2, ChevronDown, ChevronRight, Package, Trash2, CheckCircle2, Ban, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice, formatDateTime } from "@/lib/utils";
import { usePermissions } from "@/contexts/PermissionsContext";

const STATUSES = [
  { value: "pending", label: "Новий", variant: "default" },
  { value: "paid", label: "Оплачено", variant: "success" },
  { value: "shipped", label: "Відправлено", variant: "default" },
  { value: "completed", label: "Виконано", variant: "success" },
  { value: "cancelled", label: "Скасовано", variant: "danger" },
];

const statusMeta = (value) => STATUSES.find((s) => s.value === value) || STATUSES[0];

export default function AdminOrdersPage() {
  const { role } = usePermissions();
  const isSuperadmin = role === "superadmin";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail] = useState({});
  const [updating, setUpdating] = useState(null);
  const [selected, setSelected] = useState(() => new Set()); // id-и для масових дій
  const [bulk, setBulk] = useState(null); // {done,total,label} під час масової дії
  const [reasonModal, setReasonModal] = useState(null); // {ids:[...]} — причина скасування
  const [reasonText, setReasonText] = useState("");
  const [shipModal, setShipModal] = useState(null); // {id} — введення ТТН при «Відправлено»
  const [trackText, setTrackText] = useState("");

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
  // Скидаємо вибір при зміні фільтра — інакше можна діяти на невидимі замовлення.
  useEffect(() => setSelected(new Set()), [filter]);

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));
  const toggleSelectAll = () =>
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));

  // Масова дія: послідовно (щоб не перевантажити сервер) з прогресом, потім перезавантаження.
  const runBulk = async (ids, label, fn) => {
    setBulk({ done: 0, total: ids.length, label });
    let failed = 0;
    for (let i = 0; i < ids.length; i++) {
      try { await fn(ids[i]); } catch (e) { failed++; console.warn("bulk", label, ids[i], e?.message); }
      setBulk({ done: i + 1, total: ids.length, label });
    }
    setBulk(null);
    setSelected(new Set());
    loadOrders();
    if (failed) alert(`${label}: ${failed} з ${ids.length} не вдалося.`);
  };

  const bulkComplete = () =>
    runBulk([...selected], "Позначаю виконаними", (id) => api.updateOrderStatus(id, "completed"));
  const bulkDelete = () => {
    if (!confirm(`Видалити ${selected.size} замовлень? Це незворотньо. Листи клієнтам НЕ надсилаються.`)) return;
    runBulk([...selected], "Видаляю", (id) => api.deleteOrder(id));
  };
  // Скасування (масове чи одиничне) завжди через модалку причини.
  const askCancel = (ids) => { setReasonText(""); setReasonModal({ ids }); };
  const confirmCancel = async () => {
    const ids = reasonModal.ids;
    const reason = reasonText.trim();
    setReasonModal(null);
    await runBulk(ids, "Скасовую", (id) => api.updateOrderStatus(id, "cancelled", reason));
  };

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

  const triggerDownload = (href, filename) => {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadDesignJson = (designData, filename) => {
    let text = designData;
    try {
      text = JSON.stringify(JSON.parse(designData), null, 2);
    } catch {
      /* лишаємо як є, якщо це не валідний JSON */
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    triggerDownload(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadBookArchive = async (order) => {
    try {
      const blob = await api.downloadBookArchive(order.id);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `book-${order.order_number}.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      alert(err.message || "Не вдалося зібрати архів книги");
    }
  };

  const hasBook = (full) =>
    full?.items?.some((it) => {
      // d.book є лише у фотокниг; пачка фото має innerPhotos, але не book.
      try { return !!JSON.parse(it.design_data || "{}").book; } catch { return false; }
    });

  // Чи є у замовленні хоч один файл на диску (для кнопки «Скачати всі фото»).
  const hasPhotos = (full) =>
    full?.items?.some((it) => /\/uploads\//.test(`${it.design_data || ""} ${it.design_preview || ""}`));

  const downloadOrderPhotos = async (order) => {
    try {
      const blob = await api.downloadOrderPhotos(order.id);
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `order-${order.order_number}-photos.zip`);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      alert(err.message || "Не вдалося зібрати фото");
    }
  };

  // Друк замовлення: окреме вікно з деталями + прев'ю дизайнів → window.print().
  const printOrder = (full) => {
    const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const abs = (u) => (u && u.startsWith("/") ? window.location.origin + u : u);
    // Знижка на замовленні → у накладній окремим рядком (Підсумок / Знижка / До сплати).
    const discount = Number(full.discount) || 0;
    const subtotal = Number(full.subtotal ?? Number(full.total) + discount);
    const totalsHtml = discount > 0
      ? `<div class="t" style="font-weight:normal;font-size:13px">Підсумок: ${formatPrice(subtotal)}</div>
         <div class="t" style="font-weight:normal;font-size:13px;color:#15803d">Знижка: −${formatPrice(discount)}</div>
         <div class="t">До сплати: ${formatPrice(full.total)}</div>`
      : `<div class="t">Разом: ${formatPrice(full.total)}</div>`;
    const rows = (full.items || []).map((it) => {
      const prev = it.design_preview ? `<img src="${esc(abs(it.design_preview))}" />` : "";
      return `<tr><td class="p">${prev}</td><td>${esc(it.product_name)}${it.variant_label ? `<div class="m">${esc(it.variant_label)}</div>` : ""}</td><td class="n">${it.quantity}</td><td class="n">${formatPrice(it.line_total)}</td></tr>`;
    }).join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Замовлення ${esc(full.order_number)}</title><style>
      body{font-family:Arial,sans-serif;color:#111;margin:24px}h1{font-size:20px;margin:0 0 4px}.m{color:#666;font-size:12px}
      .h{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px}
      .c{margin:8px 0 16px;font-size:13px;line-height:1.5}table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border-bottom:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}
      td.n,th.n{text-align:right;white-space:nowrap}td.p{width:64px}td.p img{width:56px;height:72px;object-fit:cover;border:1px solid #ccc}
      .t{margin-top:12px;text-align:right;font-size:15px;font-weight:bold}@media print{button{display:none}}
    </style></head><body>
      <div class="h"><div><h1>Замовлення ${esc(full.order_number)}</h1><div class="m">${esc(formatDateTime(full.created_at))} · ${full.source === "designer" ? "Конструктор" : "Сайт"} · ${esc(statusMeta(full.status).label)}</div></div><div class="m">Memory Moments</div></div>
      <div class="c"><b>${esc(full.customer_name || "")}</b><br>${full.customer_phone ? esc(full.customer_phone) + "<br>" : ""}${full.customer_email ? esc(full.customer_email) + "<br>" : ""}${full.shipping_address ? "Доставка: " + esc(full.shipping_address) + "<br>" : ""}${full.notes ? "Коментар: " + esc(full.notes) : ""}</div>
      <table><thead><tr><th></th><th>Товар</th><th class="n">К-сть</th><th class="n">Сума</th></tr></thead><tbody>${rows}</tbody></table>
      ${totalsHtml}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Дозвольте спливаючі вікна, щоб друкувати"); return; }
    w.document.write(html);
    w.document.close();
  };

  const handleDelete = async (order) => {
    if (!confirm(`Видалити замовлення ${order.order_number}? Це незворотньо.`)) return;
    try {
      await api.deleteOrder(order.id);
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      if (expanded === order.id) setExpanded(null);
    } catch (err) {
      alert(err.message || "Не вдалося видалити замовлення");
    }
  };

  const changeStatus = async (orderId, status) => {
    // Скасування — через модалку причини (вона піде клієнту в листі).
    if (status === "cancelled") { askCancel([orderId]); return; }
    // Відправлено — через модалку ТТН (номер піде клієнту в листі з кнопкою відстеження).
    if (status === "shipped") {
      const cur = detail[orderId]?.tracking_number || "";
      setTrackText(cur);
      setShipModal({ id: orderId });
      return;
    }
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

  const confirmShip = async () => {
    const orderId = shipModal.id;
    const tracking = trackText.trim();
    setShipModal(null);
    setUpdating(orderId);
    try {
      const updated = await api.updateOrderStatus(orderId, "shipped", undefined, tracking);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "shipped" } : o)));
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

      {/* Панель масових дій — зʼявляється коли щось вибрано */}
      {!loading && orders.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
            {selected.size > 0 ? `Вибрано: ${selected.size}` : "Вибрати всі"}
          </label>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 sm:ml-2">
              <button onClick={bulkComplete} disabled={!!bulk}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> Виконано
              </button>
              <button onClick={() => askCancel([...selected])} disabled={!!bulk}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                <Ban className="h-4 w-4" /> Скасувати
              </button>
              {isSuperadmin && (
                <button onClick={bulkDelete} disabled={!!bulk}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Видалити
                </button>
              )}
              <button onClick={() => setSelected(new Set())} disabled={!!bulk}
                className="text-xs text-slate-400 hover:text-slate-600">Зняти вибір</button>
            </div>
          )}
          {bulk && (
            <span className="ml-auto flex items-center gap-2 text-xs font-medium text-violet-700">
              <Loader2 className="h-4 w-4 animate-spin" /> {bulk.label} {bulk.done}/{bulk.total}…
            </span>
          )}
        </div>
      )}

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
            const isSel = selected.has(order.id);
            return (
              <div key={order.id} className={`rounded-xl border bg-white overflow-hidden ${isSel ? "border-violet-300 ring-1 ring-violet-200" : "border-slate-200"}`}>
                <div className="flex items-start gap-2.5 p-3 sm:p-4 sm:items-center">
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggleSelect(order.id)}
                    className="h-4 w-4 mt-1 sm:mt-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500 shrink-0"
                    title="Вибрати для масової дії"
                  />
                  <button
                    onClick={() => toggleExpand(order)}
                    className="text-slate-400 hover:text-violet-600 shrink-0 mt-0.5 sm:mt-0"
                  >
                    {isOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>

                  {/* Контент: стек на мобільному, рядок на десктопі */}
                  <div className="flex-1 min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{order.order_number}</p>
                        <Badge variant={order.source === "designer" ? "default" : "muted"}>
                          {order.source === "designer" ? "Конструктор" : "Сайт"}
                        </Badge>
                        {/* Позначка «зі знижкою» — щоб такі замовлення було видно у списку одразу. */}
                        {Number(order.discount) > 0 && (
                          <span className="rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2 py-0.5 ring-1 ring-emerald-200 whitespace-nowrap">
                            Знижка −{formatPrice(order.discount)}
                          </span>
                        )}
                        {/* ціна — на мобільному праворуч у верхньому рядку */}
                        <p className="ml-auto font-bold text-slate-900 whitespace-nowrap sm:hidden">{formatPrice(order.total)}</p>
                      </div>
                      <p className="text-sm text-slate-500 truncate">
                        {order.customer_name}
                        {order.customer_email ? ` · ${order.customer_email}` : ""}
                        {order.customer_phone ? ` · ${order.customer_phone}` : ""}
                      </p>
                    </div>

                    <div className="hidden lg:block text-sm text-slate-400 shrink-0">
                      {order.item_count ?? order.items?.length ?? 0} поз.
                    </div>
                    <div className="shrink-0 sm:text-right">
                      <p className="hidden sm:block font-bold text-slate-900">{formatPrice(order.total)}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(order.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <select
                        value={order.status}
                        disabled={updating === order.id}
                        onChange={(e) => changeStatus(order.id, e.target.value)}
                        className="flex-1 sm:flex-none min-w-[130px] px-2 py-1.5 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                      {isSuperadmin && (
                        <button
                          onClick={() => handleDelete(order)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                          title="Видалити замовлення"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4 text-sm">
                    {!full ? (
                      <div className="text-slate-400 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> Завантаження...
                      </div>
                    ) : (
                      <>
                        {full.photo_delivery_status && (
                          <div className="mb-2"><DeliveryBadge status={full.photo_delivery_status} /></div>
                        )}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => printOrder(full)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            🖨 Друк
                          </button>
                          {hasPhotos(full) && (
                            <button
                              onClick={() => downloadOrderPhotos(full)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              ⬇ Скачати всі фото (ZIP)
                            </button>
                          )}
                          {hasBook(full) && (
                            <>
                              <button
                                onClick={() => downloadBookArchive(full)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                              >
                                {full.archive_url ? "⬇ Архів книги (ZIP)" : "⬇ Зібрати архів книги"}
                              </button>
                              {full.archive_status === "pending" && !full.archive_url && (
                                <span className="text-xs text-amber-600">архів готується…</span>
                              )}
                              {full.archive_status === "failed" && (
                                <span className="text-xs text-red-600">фон не вдався — зберемо на льоту</span>
                              )}
                            </>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                        <div>
                          <p className="font-medium text-slate-700 mb-2">Позиції</p>
                          <div className="space-y-2">
                            {full.items?.map((item) => (
                              <div key={item.id} className="border-b border-slate-200/70 pb-2 last:border-0">
                                <div className="flex justify-between gap-2">
                                  <span className="text-slate-600">
                                    {item.product_name}
                                    {item.variant_label ? ` (${item.variant_label})` : ""} × {item.quantity}
                                  </span>
                                  <span className="text-slate-700 shrink-0">{formatPrice(item.line_total)}</span>
                                </div>
                                {(item.design_preview || item.design_data) && (() => {
                                  let meta = null;
                                  try { meta = JSON.parse(item.design_data); } catch { /* */ }
                                  const isPhoto = meta?.type === "photo_print";
                                  const printFrontUrl = meta?.printFrontUrl || null;
                                  const printBackUrl = meta?.printBackUrl || null;
                                  const printFrontMirrorUrl = meta?.printFrontMirrorUrl || null;
                                  const rawFrontUrl = meta?.rawFrontUrl || null;
                                  const rawBackUrl = meta?.rawBackUrl || null;
                                  return (
                                    <div className="mt-2 flex items-start gap-3 flex-wrap">
                                      {item.design_preview && (
                                        <a
                                          href={item.design_preview}
                                          target="_blank"
                                          rel="noreferrer"
                                          title={isPhoto ? "Відкрити фото" : "Відкрити мокап"}
                                        >
                                          <img
                                            src={item.design_preview}
                                            alt={isPhoto ? "фото" : "мокап"}
                                            className="h-24 w-20 border border-slate-200 bg-white object-cover shrink-0"
                                          />
                                        </a>
                                      )}
                                      {rawFrontUrl && (
                                        <a
                                          href={rawFrontUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Фото клієнта (без рамки)"
                                        >
                                          <img
                                            src={rawFrontUrl}
                                            alt="фото клієнта"
                                            className="h-24 w-20 border border-slate-200 bg-white object-cover shrink-0"
                                          />
                                        </a>
                                      )}
                                      {rawBackUrl && (
                                        <a
                                          href={rawBackUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Фото клієнта — ззаду (без рамки)"
                                        >
                                          <img
                                            src={rawBackUrl}
                                            alt="фото клієнта ззаду"
                                            className="h-24 w-20 border border-slate-200 bg-white object-cover shrink-0"
                                          />
                                        </a>
                                      )}
                                      <div className="flex flex-col gap-1">
                                        {item.design_preview && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(item.design_preview, `${full.order_number}-${item.id}-preview.png`)
                                            }
                                            className="text-xs text-violet-600 hover:underline text-left"
                                          >
                                            ⬇ {isPhoto ? "Фото клієнта" : "Мокап (PNG)"}
                                          </button>
                                        )}
                                        {rawFrontUrl && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(rawFrontUrl, `${full.order_number}-${item.id}-raw-front.png`)
                                            }
                                            className="text-xs text-slate-500 hover:underline text-left"
                                          >
                                            ⬇ Фото клієнта (PNG)
                                          </button>
                                        )}
                                        {printFrontUrl && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(printFrontUrl, `${full.order_number}-${item.id}-print-front.png`)
                                            }
                                            className="text-xs text-emerald-700 hover:underline text-left font-medium"
                                          >
                                            ⬇ Друк — Спереду (PNG)
                                          </button>
                                        )}
                                        {printBackUrl && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(printBackUrl, `${full.order_number}-${item.id}-print-back.png`)
                                            }
                                            className="text-xs text-emerald-700 hover:underline text-left font-medium"
                                          >
                                            ⬇ Друк — Ззаду (PNG)
                                          </button>
                                        )}
                                        {printFrontMirrorUrl && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(printFrontMirrorUrl, `${full.order_number}-${item.id}-print-mirror.png`)
                                            }
                                            className="text-xs text-emerald-700 hover:underline text-left font-medium"
                                          >
                                            🪞 Друк — Дзеркальний (чашка, PNG)
                                          </button>
                                        )}
                                        {rawBackUrl && (
                                          <button
                                            onClick={() =>
                                              triggerDownload(rawBackUrl, `${full.order_number}-${item.id}-raw-back.png`)
                                            }
                                            className="text-xs text-slate-500 hover:underline text-left"
                                          >
                                            ⬇ Фото клієнта — ззаду (PNG)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            ))}
                            {Number(full.discount) > 0 ? (
                              <div className="border-t border-slate-200 pt-1.5 space-y-1">
                                <div className="flex justify-between text-slate-500">
                                  <span>Підсумок</span>
                                  <span>{formatPrice(full.subtotal ?? Number(full.total) + Number(full.discount))}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 font-medium">
                                  <span>Знижка</span>
                                  <span>−{formatPrice(full.discount)}</span>
                                </div>
                                <div className="flex justify-between font-semibold text-slate-900">
                                  <span>До сплати</span>
                                  <span>{formatPrice(full.total)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                                <span>Разом</span>
                                <span>{formatPrice(full.total)}</span>
                              </div>
                            )}
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
                            {full.cancel_reason && (
                              <div className="text-red-600"><dt className="inline text-red-400">Причина скасування: </dt>{full.cancel_reason}</div>
                            )}
                            {full.tracking_number && (
                              <div>
                                <dt className="inline text-slate-400">ТТН: </dt>
                                <a href={`https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(full.tracking_number)}`}
                                  target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-medium">
                                  {full.tracking_number}
                                </a>
                              </div>
                            )}
                          </dl>
                        </div>
                      </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Модалка причини скасування (одиничне і масове). Причина йде клієнту в листі. */}
      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setReasonModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">
                Скасувати {reasonModal.ids.length > 1 ? `${reasonModal.ids.length} замовлень` : "замовлення"}
              </h3>
              <button onClick={() => setReasonModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              Вкажіть причину — вона піде клієнту в листі (необовʼязково).
            </p>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Напр.: немає товару в наявності, клієнт скасував…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setReasonModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Назад
              </button>
              <button onClick={confirmCancel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                <Ban className="h-4 w-4" /> Скасувати замовлення
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модалка ТТН при «Відправлено». Номер + кнопка відстеження йдуть клієнту в листі. */}
      {shipModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setShipModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900">Відправити замовлення</h3>
              <button onClick={() => setShipModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-2">
              Номер ТТН (Нова Пошта) — клієнт отримає його в листі з кнопкою «Відстежити». Необовʼязково.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={trackText}
              onChange={(e) => setTrackText(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") confirmShip(); }}
              placeholder="напр.: 20450000000000"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShipModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                Назад
              </button>
              <button onClick={confirmShip}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                📦 Відправлено
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Статус доставки фото на ПК (SFTP). 'fallback' = ПК офлайн, лінк надіслано в Telegram.
function DeliveryBadge({ status }) {
  const map = {
    sent: ["bg-emerald-50 text-emerald-700", "✅ Фото доставлено на ПК"],
    pending: ["bg-amber-50 text-amber-700", "⏳ Фото в черзі на доставку на ПК"],
    fallback: ["bg-sky-50 text-sky-700", "📤 ПК офлайн — посилання надіслано в Telegram"],
  };
  const [cls, label] = map[status] || ["bg-slate-100 text-slate-500", status];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
