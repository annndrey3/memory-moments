import { useEffect, useState } from "react";
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import DesignerModal from "@/components/DesignerModal";

const PRODUCT_TYPE_LABELS = {
  "crew-neck": "Футболка",
  mug: "Чашка",
  polaroid: "Полароїд",
  "instax-mini": "Instax Mini",
  "photo-10x15": "Фото 10×15",
  "photo-15x10": "Фото 15×10",
};

export default function AdminDesignsPage() {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingDesign, setEditingDesign] = useState(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadDesigns();
  }, []);

  const loadDesigns = async () => {
    setLoading(true);
    try {
      const res = await api.getDesigns({ limit: 100 });
      setDesigns(res.items || []);
    } catch (err) {
      console.error("Помилка при завантаженні дизайнів:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (designId) => {
    if (!window.confirm("Ви впевнені, що хочете видалити цей дизайн?")) return;

    setDeleting(designId);
    try {
      await api.deleteDesign(designId);
      setDesigns(designs.filter((d) => d.id !== designId));
    } catch (err) {
      alert(err.message || "Помилка при видаленні дизайну");
    } finally {
      setDeleting(null);
    }
  };

  const handleDesignSaved = (savedDesign) => {
    if (editingDesign) {
      setDesigns(designs.map((d) => (d.id === savedDesign.id ? savedDesign : d)));
    } else {
      setDesigns([...designs, savedDesign]);
    }
    setShowModal(false);
    setEditingDesign(null);
  };

  const handleOpenDesigner = (design = null) => {
    setEditingDesign(design);
    setShowModal(true);
  };

  const filteredDesigns = designs.filter((design) => {
    const matchesType = filter === "all" || design.product_type === filter;
    const matchesSearch =
      search === "" ||
      design.name.toLowerCase().includes(search.toLowerCase()) ||
      design.description?.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto mb-3" />
          <p className="text-slate-600">Завантаження дизайнів...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Дизайни</h2>
          <p className="text-sm text-slate-500">Управління дизайнами товарів</p>
        </div>
        <Button
          onClick={() => handleOpenDesigner()}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Новий дизайн
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Пошук
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Назва дизайну..."
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-slate-700 block mb-2">
            Тип товару
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="all">Усі типи</option>
            {Object.entries(PRODUCT_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Designs Grid */}
      {filteredDesigns.length === 0 ? (
        <div className="bg-white rounded-lg border border-dashed border-slate-300 p-12 text-center">
          <p className="text-slate-500 mb-4">
            {designs.length === 0 ? "Дизайни не знайдені" : "Ніхто не відповідає фільтрам"}
          </p>
          {designs.length === 0 && (
            <Button
              onClick={() => handleOpenDesigner()}
              className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Створити перший дизайн
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDesigns.map((design) => (
            <div
              key={design.id}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Preview Image */}
              <div className="relative h-40 bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center overflow-hidden">
                {design.preview_image ? (
                  <img
                    src={design.preview_image}
                    alt={design.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-4">
                    <p className="text-xs text-slate-400">Немає превью</p>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-900 truncate">
                    {design.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {PRODUCT_TYPE_LABELS[design.product_type] || design.product_type}
                  </p>
                </div>

                {design.description && (
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {design.description}
                  </p>
                )}

                <div className="text-xs text-slate-400">
                  <p>Розміри: {design.width}×{design.height}px</p>
                  <p>ID: {design.id}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDesigner(design)}
                    className="flex-1 rounded-lg"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Редагувати
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(design.id)}
                    disabled={deleting === design.id}
                    className="flex-1 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deleting === design.id ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Видалити
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Designer Modal */}
      <DesignerModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDesign(null);
        }}
        onSave={handleDesignSaved}
        productType={editingDesign?.product_type || "crew-neck"}
        initialDesign={editingDesign}
      />
    </div>
  );
}
