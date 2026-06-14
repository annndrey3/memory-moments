import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Loader2, Save, X, Check } from "lucide-react";
import { Button, Input, Label, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

const emptyService = {
  id: null,
  code: "",
  name: "",
  format: "",
  price: "",
  price_insta: "",
  is_active: true,
};

function ServiceModal({ open, categoryId, initial, onClose, onSaved }) {
  const [form, setForm] = useState(emptyService);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...emptyService, ...initial, code: initial.code || "", format: initial.format || "", price: initial.price ?? "", price_insta: initial.price_insta ?? "", is_active: !!initial.is_active } : emptyService);
      setError(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return setError("Назва обов'язкова");
    setSaving(true);
    setError(null);
    const payload = {
      category_id: categoryId,
      code: form.code.trim() || null,
      name: form.name.trim(),
      format: form.format.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      price_insta: form.price_insta === "" ? null : Number(form.price_insta),
      is_active: form.is_active,
    };
    try {
      const saved = form.id
        ? await api.updateService(form.id, payload)
        : await api.createService(payload);
      onSaved(saved, !!form.id);
    } catch (err) {
      setError(err.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h3 className="font-bold text-slate-900">{form.id ? "Редагувати послугу" : "Нова послуга"}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Код</Label>
              <Input value={form.code} onChange={(e) => set("code", e.target.value)} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Формат</Label>
              <Input value={form.format} onChange={(e) => set("format", e.target.value)} placeholder="10х15, А4…" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Назва *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ціна роздріб (₴)</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ціна Instagram (₴)</Label>
              <Input type="number" step="0.01" value={form.price_insta} onChange={(e) => set("price_insta", e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Активна (показувати в прайсі)
          </label>
          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        </div>
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-lg">Скасувати</Button>
          <Button onClick={save} disabled={saving} className="rounded-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Зберегти
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AdminServicesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState(null); // {id, name}
  const [modal, setModal] = useState({ open: false, categoryId: null, initial: null });

  const load = () => {
    setLoading(true);
    api
      .getServicesAdmin()
      .then((data) => setCategories(data.categories || []))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const addCategory = async () => {
    if (!newCat.trim()) return;
    try {
      await api.createServiceCategory({ name: newCat.trim(), sort_order: categories.length });
      setNewCat("");
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const saveCategory = async () => {
    try {
      await api.updateServiceCategory(editingCat.id, { name: editingCat.name });
      setEditingCat(null);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleCategoryActive = async (cat) => {
    try {
      await api.updateServiceCategory(cat.id, { is_active: !cat.is_active });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteCategory = async (cat) => {
    if (!window.confirm(`Видалити категорію «${cat.name}» з усіма послугами (${cat.services.length})?`)) return;
    try {
      await api.deleteServiceCategory(cat.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const deleteService = async (s) => {
    if (!window.confirm(`Видалити послугу «${s.name}»?`)) return;
    try {
      await api.deleteService(s.id);
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const toggleServiceActive = async (s) => {
    try {
      await api.updateService(s.id, { is_active: !s.is_active });
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const onSaved = () => {
    setModal({ open: false, categoryId: null, initial: null });
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Прайс / Послуги</h2>
          <p className="text-sm text-slate-500">
            {categories.length} категорій · {categories.reduce((n, c) => n + c.services.length, 0)} послуг
          </p>
        </div>
      </div>

      {/* Add category */}
      <div className="flex gap-2 mb-6 max-w-md">
        <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Нова категорія…" className="rounded-lg" />
        <Button onClick={addCategory} className="rounded-lg shrink-0">
          <Plus className="h-4 w-4" /> Категорія
        </Button>
      </div>

      <div className="space-y-5">
        {categories.map((cat) => (
          <div key={cat.id} className={`rounded-xl border bg-white overflow-hidden ${cat.is_active ? "border-slate-200" : "border-slate-200 opacity-70"}`}>
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
              {editingCat?.id === cat.id ? (
                <>
                  <Input
                    value={editingCat.name}
                    onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                    className="rounded-lg h-9 max-w-sm"
                  />
                  <Button size="sm" onClick={saveCategory} className="rounded-lg">
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingCat(null)} className="rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-slate-900 flex-1">{cat.name}</h3>
                  {!cat.is_active && <Badge variant="muted">Прихована</Badge>}
                  <Button size="sm" variant="outline" onClick={() => setModal({ open: true, categoryId: cat.id, initial: null })} className="rounded-lg">
                    <Plus className="h-4 w-4" /> Послуга
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingCat({ id: cat.id, name: cat.name })} title="Перейменувати">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleCategoryActive(cat)} title={cat.is_active ? "Сховати" : "Показати"}>
                    {cat.is_active ? "Сховати" : "Показати"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteCategory(cat)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>

            {cat.services.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">Немає послуг</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Назва</th>
                    <th className="text-left font-medium px-2 py-2 hidden sm:table-cell">Формат</th>
                    <th className="text-right font-medium px-2 py-2">Роздріб</th>
                    <th className="text-right font-medium px-2 py-2 hidden sm:table-cell">Instagram</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.services.map((s) => (
                    <tr key={s.id} className={`border-b border-slate-50 last:border-0 hover:bg-slate-50/50 ${s.is_active ? "" : "opacity-50"}`}>
                      <td className="px-4 py-2 text-slate-800">
                        {s.code && <span className="text-xs text-slate-400 mr-1">[{s.code}]</span>}
                        {s.name}
                      </td>
                      <td className="px-2 py-2 text-slate-500 hidden sm:table-cell">{s.format || "—"}</td>
                      <td className="px-2 py-2 text-right font-medium">{s.price != null ? formatPrice(s.price) : "—"}</td>
                      <td className="px-2 py-2 text-right text-violet-600 hidden sm:table-cell">{s.price_insta != null ? formatPrice(s.price_insta) : "—"}</td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-0.5">
                          <Button size="icon" variant="ghost" onClick={() => toggleServiceActive(s)} title={s.is_active ? "Сховати" : "Показати"} className="h-8 w-8">
                            {s.is_active ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-slate-400" />}
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setModal({ open: true, categoryId: cat.id, initial: s })} className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteService(s)} className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <ServiceModal
        open={modal.open}
        categoryId={modal.categoryId}
        initial={modal.initial}
        onClose={() => setModal({ open: false, categoryId: null, initial: null })}
        onSaved={onSaved}
      />
    </div>
  );
}
