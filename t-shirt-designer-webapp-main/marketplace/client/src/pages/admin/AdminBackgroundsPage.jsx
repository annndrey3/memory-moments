import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Image as ImageIcon } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

// Готові фони для альбомів (фотокниг): завантаж картинку → вона зʼявиться в
// конструкторі (кнопка «Фон» на обкладинці/розвороті, на весь формат).
export default function AdminBackgroundsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [neu, setNeu] = useState({ image_url: "", name: "", sort_order: 0 });

  const load = () => {
    setLoading(true);
    api.getBackgroundsAdmin().then(setItems).catch((e) => alert(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await api.uploadImage(file);
      setNeu((n) => ({ ...n, image_url: url }));
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!neu.image_url) { alert("Спершу завантажте зображення фону."); return; }
    setAdding(true);
    try {
      await api.createBackground({ ...neu, sort_order: Number(neu.sort_order) || 0, is_active: 1 });
      setNeu({ image_url: "", name: "", sort_order: 0 });
      load();
    } catch (e) { alert(e.message); } finally { setAdding(false); }
  };

  const toggle = async (b) => {
    try { await api.updateBackground(b.id, { name: b.name, sort_order: b.sort_order, is_active: b.is_active ? 0 : 1 }); load(); }
    catch (e) { alert(e.message); }
  };

  const remove = async (b) => {
    if (!confirm("Видалити фон?")) return;
    setDeletingId(b.id);
    try { await api.deleteBackground(b.id); load(); } catch (e) { alert(e.message); } finally { setDeletingId(null); }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <ImageIcon className="h-5 w-5 text-violet-600" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Фони для альбомів</h2>
          <p className="text-sm text-slate-500">Усього: {items.length} · показуються в конструкторі (кнопка «Фон»)</p>
        </div>
      </div>

      {/* Новий фон */}
      <form onSubmit={add} className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="w-24 h-24 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center shrink-0">
          {busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            : neu.image_url ? <img src={neu.image_url} alt="" className="w-full h-full object-cover" />
            : <ImageIcon className="h-7 w-7 text-slate-300" />}
        </div>
        <div className="flex-1 min-w-[180px] grid gap-2">
          <Input placeholder="Назва (необовʼязково)" value={neu.name} onChange={(e) => setNeu({ ...neu, name: e.target.value })} />
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">
              <ImageIcon className="h-4 w-4" /> Завантажити фон
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs">Порядок</Label>
              <Input type="number" className="w-20 text-center" value={neu.sort_order} onChange={(e) => setNeu({ ...neu, sort_order: e.target.value })} />
            </div>
          </div>
        </div>
        <Button type="submit" disabled={adding} className="rounded-xl">
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Додати
        </Button>
      </form>

      {/* Список */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-xl border border-slate-200 bg-white text-slate-500">
          Фонів ще немає. Завантажте перший — і він зʼявиться в конструкторі альбомів.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {items.map((b) => (
            <div key={b.id} className={`relative rounded-xl border bg-white p-2 shadow-sm ${b.is_active ? "border-slate-200" : "border-slate-200 opacity-50"}`}>
              <div className="aspect-square rounded-lg overflow-hidden bg-slate-100">
                <img src={b.image_url} alt={b.name || ""} className="w-full h-full object-cover" />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-1">
                <span className="text-xs text-slate-600 truncate" title={b.name || ""}>{b.name || `#${b.id}`}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => toggle(b)} title={b.is_active ? "Сховати" : "Показати"}
                    className={`w-4 h-4 rounded-full ${b.is_active ? "bg-violet-600" : "bg-slate-300"}`} />
                  <button type="button" onClick={() => remove(b)} disabled={deletingId === b.id}
                    className="p-1 rounded text-slate-400 hover:bg-red-50 hover:text-red-500" title="Видалити">
                    {deletingId === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
