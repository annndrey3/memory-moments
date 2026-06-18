import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Users, Search, X, Mail, Phone } from "lucide-react";
import { Button, Input, Badge } from "@/components/ui";
import { api } from "@/lib/api";
import { usePermissions } from "@/contexts/PermissionsContext";

const EMPTY_FORM = { name: "", email: "", phone: "", notes: "" };

function formatDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminCustomersPage() {
  const { can } = usePermissions();
  const canManage = can("orders.manage");

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = (s = search) => {
    setLoading(true);
    api
      .getCustomers({ search: s || undefined, limit: 200 })
      .then((res) => setCustomers(res.items || []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(""); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const handleClearSearch = () => {
    setSearch("");
    load("");
  };

  const handleFormChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Ім'я та email обов'язкові");
      return;
    }
    setSaving(true);
    try {
      await api.createCustomer(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message || "Помилка збереження");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (customer) => {
    if (!confirm(`Видалити клієнта ${customer.name}?`)) return;
    try {
      await api.deleteCustomer(customer.id);
      setCustomers((prev) => prev.filter((c) => c.id !== customer.id));
    } catch (err) {
      alert(err.message || "Помилка видалення");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-violet-600" />
          <div>
            <h2 className="text-xl font-bold text-slate-900">Клієнти</h2>
            <p className="text-sm text-slate-500">{customers.length} записів</p>
          </div>
        </div>
        {canManage && (
          <Button
            onClick={() => { setShowForm((v) => !v); setError(""); setForm(EMPTY_FORM); }}
            className="gap-2"
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? "Скасувати" : "Додати клієнта"}
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 mb-4">Новий клієнт</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Ім'я *</label>
              <Input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="Ім'я клієнта"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Email *</label>
              <Input
                name="email"
                type="email"
                value={form.email}
                onChange={handleFormChange}
                placeholder="client@example.com"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Телефон</label>
              <Input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleFormChange}
                placeholder="+38 (000) 000-00-00"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">Нотатки</label>
              <Input
                name="notes"
                value={form.notes}
                onChange={handleFormChange}
                placeholder="Будь-яка інформація"
              />
            </div>
            {error && (
              <p className="sm:col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="sm:col-span-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setShowForm(false); setError(""); }}
              >
                Скасувати
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Зберегти
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ім'я, email або телефон…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Знайти</Button>
        {search && (
          <Button type="button" variant="ghost" onClick={handleClearSearch}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Завантаження…
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm">Клієнтів не знайдено</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Ім'я</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Телефон</th>
                <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Нотатки</th>
                <th className="px-4 py-3 text-left font-medium hidden sm:table-cell">Джерело</th>
                <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Дата</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <a
                      href={`mailto:${c.email}`}
                      className="flex items-center gap-1.5 hover:text-violet-600 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {c.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {c.phone ? (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 hover:text-violet-600 transition-colors">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden lg:table-cell max-w-[200px] truncate">
                    {c.notes || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant={c.source === "manual" ? "default" : "success"}>
                      {c.source === "manual" ? "Вручну" : "Замовлення"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs hidden md:table-cell whitespace-nowrap">
                    {formatDate(c.created_at)}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(c)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1 rounded"
                        title="Видалити клієнта"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
