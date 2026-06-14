import { useEffect, useState } from "react";
import { Plus, Trash2, Eye } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import DesignerModal from "@/components/DesignerModal";

export default function DesignSelector({ value, onChange, designerType }) {
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [showDesignerModal, setShowDesignerModal] = useState(false);
  const [editingDesign, setEditingDesign] = useState(null);

  useEffect(() => {
    if (!designerType) {
      setDesigns([]);
      return;
    }

    setLoading(true);
    api
      .getDesigns({ productType: designerType })
      .then((res) => setDesigns(res.items || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [designerType]);

  useEffect(() => {
    if (value) {
      const design = designs.find((d) => d.id === Number(value));
      setSelectedDesign(design);
    }
  }, [value, designs]);

  const handleSelect = (designId) => {
    onChange(designId);
    setSelectedDesign(designs.find((d) => d.id === designId));
  };

  const handleDesignSaved = (savedDesign) => {
    // Обновить список дизайнов
    if (editingDesign) {
      setDesigns(designs.map(d => d.id === savedDesign.id ? savedDesign : d));
    } else {
      setDesigns([...designs, savedDesign]);
    }
    // Выбрать новый дизайн
    handleSelect(savedDesign.id);
    setShowDesignerModal(false);
    setEditingDesign(null);
  };

  const handleOpenDesigner = (design = null) => {
    setEditingDesign(design);
    setShowDesignerModal(true);
  };

  if (!designerType) {
    return (
      <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200">
        <p className="text-sm text-slate-500">Оберіть тип конструктора для роботи з дизайнами</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Дизайн товару</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleOpenDesigner()}
          className="rounded-lg"
        >
          <Plus className="h-4 w-4" /> Новий дизайн
        </Button>
      </div>

      <DesignerModal
        isOpen={showDesignerModal}
        onClose={() => {
          setShowDesignerModal(false);
          setEditingDesign(null);
        }}
        onSave={handleDesignSaved}
        productType={designerType}
        initialDesign={editingDesign}
      />

      {selectedDesign && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 flex items-start gap-4">
          {selectedDesign.preview_image && (
            <img
              src={selectedDesign.preview_image}
              alt={selectedDesign.name}
              className="h-20 w-20 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-slate-900">{selectedDesign.name}</h4>
            {selectedDesign.description && (
              <p className="text-sm text-slate-600 mt-1">{selectedDesign.description}</p>
            )}
            <p className="text-xs text-slate-500 mt-2">ID: {selectedDesign.id}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              onChange(null);
              setSelectedDesign(null);
            }}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      )}

      {loading && (
        <div className="text-sm text-slate-500 animate-pulse">Завантаження дизайнів...</div>
      )}

      {!loading && designs.length === 0 && (
        <div className="p-4 rounded-lg bg-slate-50 border border-dashed border-slate-200">
          <p className="text-sm text-slate-500">Немає дизайнів для типу "{designerType}"</p>
        </div>
      )}

      {!loading && designs.length > 0 && !selectedDesign && (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">Доступні дизайни:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {designs.map((design) => (
              <button
                key={design.id}
                type="button"
                onClick={() => handleSelect(design.id)}
                className="relative p-3 rounded-lg border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition text-left group"
              >
                {design.preview_image && (
                  <img
                    src={design.preview_image}
                    alt={design.name}
                    className="w-full h-20 rounded object-cover mb-2"
                  />
                )}
                <p className="text-xs font-medium text-slate-900 truncate">{design.name}</p>
                <p className="text-xs text-slate-500">ID: {design.id}</p>
                <Eye className="h-4 w-4 absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-violet-600 transition" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
