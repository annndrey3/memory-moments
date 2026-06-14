import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { Button, Badge, Input } from "@/components/ui";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = () => {
    setLoading(true);
    api
      .getProductsAdmin({ search: search || undefined, limit: 50 })
      .then((data) => setProducts(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id, name) => {
    if (!confirm(`Видалити товар «${name}»?`)) return;
    try {
      await api.deleteProduct(id);
      load();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Товари</h2>
          <p className="text-sm text-slate-500">{products.length} позицій</p>
        </div>
        <Link to="/admin/products/new">
          <Button className="rounded-xl">
            <Plus className="h-4 w-4" />
            Додати товар
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Пошук..."
          className="rounded-xl"
        />
        <Button type="submit" variant="outline" className="rounded-xl">
          Знайти
        </Button>
      </form>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Товар</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Категорія</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600">Ціна</th>
              <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Статус</th>
              <th className="text-right px-4 py-3 font-medium text-slate-600">Дії</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Завантаження...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                  Товарів немає
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.primary_image ? (
                        <img src={p.primary_image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-slate-100" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{p.category_name}</td>
                  <td className="px-4 py-3 font-medium">{formatPrice(p.price)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {p.is_active ? (
                      <Badge variant="success" className="gap-1">
                        <Eye className="h-3 w-3" /> Активний
                      </Badge>
                    ) : (
                      <Badge variant="muted" className="gap-1">
                        <EyeOff className="h-3 w-3" /> Прихований
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link to={`/admin/products/${p.id}`}>
                        <Button variant="ghost" size="icon" className="rounded-lg">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(p.id, p.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
