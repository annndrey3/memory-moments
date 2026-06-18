import { useEffect, useState } from "react";
import { Loader2, Layers, Plus, Trash2, Check, X, Image as ImageIcon } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [edits, setEdits] = useState({});
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newOrder, setNewOrder] = useState(0);
  const [adding, setAdding] = useState(false);

  const load = () => {
    setLoading(true);
    api
      .getCategoriesAdmin()
      .then(setCategories)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = (id, field, value) =>
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...categories.find((c) => c.id === id),
        ...prev[id],
        [field]: value,
      },
    }));

  const getEdit = (cat) => ({ ...cat, ...edits[cat.id] });

  const isDirty = (cat) => {
    const e = edits[cat.id];
    if (!e) return false;
    return (
      e.name !== cat.name ||
      (e.description || "") !== (cat.description || "") ||
      (e.image_url || "") !== (cat.image_url || "") ||
      Number(e.sort_order) !== Number(cat.sort_order) ||
      Number(e.is_active) !== Number(cat.is_active)
    );
  };

  // Завантаження іконки: вантажимо файл → одразу зберігаємо категорію (без
  // окремого кліку «✓»), щоб іконка точно застосувалась.
  const uploadIcon = async (cat, file) => {
    if (!file) return;
    setUploading(cat.id);
    try {
      const { url } = await api.uploadImage(file);
      const data = getEdit(cat);
      await api.updateCategory(cat.id, {
        name: data.name,
        description: data.description || null,
        image_url: url,
        sort_order: Number(data.sort_order ?? 0),
        is_active: Number(data.is_active) ? 1 : 0,
      });
      discard(cat.id);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setUploading(null);
    }
  };

  const save = async (cat) => {
    const data = getEdit(cat);
    setSaving(cat.id);
    try {
      await api.updateCategory(cat.id, {
        name: data.name,
        description: data.description || null,
        image_url: data.image_url || null,
        sort_order: Number(data.sort_order ?? 0),
        is_active: Number(data.is_active) ? 1 : 0,
      });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[cat.id];
        return next;
      });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(null);
    }
  };

  const discard = (id) =>
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const remove = async (cat) => {
    if (!confirm(`Видалити категорію "${cat.name}"?`)) return;
    setDeleting(cat.id);
    try {
      await api.deleteCategory(cat.id);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const addCategory = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createCategory({
        name: newName.trim(),
        description: newDesc.trim() || null,
        sort_order: Number(newOrder) || 0,
      });
      setNewName("");
      setNewDesc("");
      setNewOrder(0);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Категорії</h2>
        <p className="text-sm text-slate-500">Усього: {categories.length}</p>
      </div>

      {/* Add form */}
      <form
        onSubmit={addCategory}
        className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <p className="text-sm font-semibold text-slate-700 mb-3">Нова категорія</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[160px] space-y-1">
            <Label className="text-xs">Назва *</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Наприклад: Одяг"
              required
            />
          </div>
          <div className="flex-[2] min-w-[200px] space-y-1">
            <Label className="text-xs">Опис</Label>
            <Input
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Короткий опис категорії"
            />
          </div>
          <div className="w-24 space-y-1">
            <Label className="text-xs">Порядок</Label>
            <Input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              className="text-center"
            />
          </div>
          <Button type="submit" disabled={adding} className="rounded-xl shrink-0">
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Додати
          </Button>
        </div>
      </form>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-32">
                  Іконка
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Назва / Slug
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Опис
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">
                  Порядок
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-20">
                  Товарів
                </th>
                <th className="text-center px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">
                  Активна
                </th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categories.map((cat) => {
                const e = getEdit(cat);
                const dirty = isDirty(cat);
                return (
                  <tr key={cat.id} className="group hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center shrink-0">
                          {e.image_url ? (
                            <img src={e.image_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-slate-300" />
                          )}
                        </div>
                        <div className="flex flex-col items-start gap-0.5">
                          <label className="cursor-pointer text-xs font-medium text-violet-600 hover:underline">
                            {uploading === cat.id ? "…" : e.image_url ? "Змінити" : "Завантажити"}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(ev) => uploadIcon(cat, ev.target.files?.[0])}
                            />
                          </label>
                          {e.image_url && (
                            <button
                              type="button"
                              onClick={() => patch(cat.id, "image_url", "")}
                              className="text-[11px] text-slate-400 hover:text-red-500"
                            >
                              Прибрати
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={e.name}
                        onChange={(ev) => patch(cat.id, "name", ev.target.value)}
                        className="h-8 text-sm mb-1"
                      />
                      <p className="text-[11px] text-slate-400 pl-1">/{cat.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        value={e.description || ""}
                        onChange={(ev) => patch(cat.id, "description", ev.target.value)}
                        placeholder="—"
                        className="h-8 text-sm"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="number"
                        value={e.sort_order ?? 0}
                        onChange={(ev) =>
                          patch(cat.id, "sort_order", Number(ev.target.value))
                        }
                        className="w-16 h-8 rounded-lg border border-slate-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          cat.product_count > 0
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {cat.product_count}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => patch(cat.id, "is_active", e.is_active ? 0 : 1)}
                        className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${
                          e.is_active ? "bg-violet-600" : "bg-slate-300"
                        }`}
                        title={e.is_active ? "Приховати" : "Показати"}
                      >
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                            e.is_active ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {dirty && (
                          <>
                            <button
                              onClick={() => save(cat)}
                              disabled={saving === cat.id}
                              className="p-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                              title="Зберегти"
                            >
                              {saving === cat.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <button
                              onClick={() => discard(cat.id)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                              title="Скасувати"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => remove(cat)}
                          disabled={deleting === cat.id}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Видалити"
                        >
                          {deleting === cat.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <Layers className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Категорій поки немає
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
