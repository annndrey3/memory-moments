import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { api } from "@/lib/api";
import DesignSelector from "./DesignSelector";

// Має відповідати PRODUCT_TYPES конструктора (src/constants/designConstants.js).
// Тип, обраний тут, передається у конструктор при «Створити власний дизайн».
const DESIGNER_TYPES = [
  { value: "", label: "— Без конструктора —" },
  { value: "crew-neck", label: "Футболка" },
  { value: "mug", label: "Чашка біла" },
  { value: "mug-giant", label: "Чашка велетень" },
  { value: "mug-magic", label: "Чашка Магічна (хамелеон)" },
  { value: "mug-color", label: "Чашка кольорова (всередині+ручка)" },
  { value: "mug-text-inside", label: "Чашка з написами всередині" },
  { value: "canvas", label: "Полотно (натяжка)" },
  { value: "polaroid", label: "Полароїд 10×12 верт." },
  { value: "polaroid-10x12-h", label: "Полароїд 10×12 гор." },
  { value: "polaroid-8x10-v", label: "Полароїд 8×10 верт." },
  { value: "polaroid-8x10-h", label: "Полароїд 8×10 гор." },
  { value: "instax-mini", label: "Instax Mini" },
  { value: "phone-case", label: "Під чохол" },
  { value: "photo-10x15", label: "Фото 10×15" },
  { value: "photo-15x10", label: "Фото 15×10" },
  { value: "photo-13x18", label: "Фото 13×18" },
  { value: "photo-18x13", label: "Фото 18×13" },
  { value: "photo-15x21", label: "Фото 15×21" },
  { value: "photo-21x15", label: "Фото 21×15" },
  { value: "photo-a4-p", label: "Фото A4 (верт.)" },
  { value: "photo-a4-l", label: "Фото A4 (гор.)" },
  { value: "photo-square", label: "Квадратне фото" },
];

const emptyForm = {
  category_id: "",
  name: "",
  slug: "",
  short_description: "",
  description: "",
  price: "",
  compare_at_price: "",
  sku: "",
  stock_quantity: "0",
  designer_type: "",
  design_id: null,
  is_active: true,
  is_featured: false,
  sort_order: "0",
  images: [{ image_url: "", alt_text: "", is_primary: true }],
  variants: [],
};

export default function AdminProductFormPage() {
  const { id } = useParams();
  // Маршрут "products/new" перекриває "products/:id", тож id тут undefined —
  // вважаємо товар новим і коли id відсутній, і коли він дорівнює "new".
  const isNew = !id || id === "new";
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(console.error);
  }, []);

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    api
      .getProduct(id)
      .then((p) => {
        setForm({
          category_id: String(p.category_id),
          name: p.name,
          slug: p.slug,
          short_description: p.short_description || "",
          description: p.description || "",
          price: String(p.price),
          compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
          sku: p.sku || "",
          stock_quantity: String(p.stock_quantity),
          designer_type: p.designer_type || "",
          design_id: p.design_id || null,
          is_active: Boolean(p.is_active),
          is_featured: Boolean(p.is_featured),
          sort_order: String(p.sort_order ?? 0),
          images: p.images?.length
            ? p.images.map((img) => ({
                image_url: img.image_url,
                alt_text: img.alt_text || "",
                is_primary: Boolean(img.is_primary),
              }))
            : [{ image_url: "", alt_text: "", is_primary: true }],
          variants: p.variants?.map((v) => ({
            attribute_name: v.attribute_name,
            attribute_value: v.attribute_value,
            price_modifier: String(v.price_modifier),
            stock_quantity: String(v.stock_quantity),
            sku: v.sku || "",
          })) || [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setImage = (index, key, value) => {
    setForm((f) => {
      const images = [...f.images];
      images[index] = { ...images[index], [key]: value };
      return { ...f, images };
    });
  };

  const addImage = () =>
    setForm((f) => ({
      ...f,
      images: [...f.images, { image_url: "", alt_text: "", is_primary: false }],
    }));

  const removeImage = (index) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));

  const addVariant = () =>
    setForm((f) => ({
      ...f,
      variants: [
        ...f.variants,
        { attribute_name: "size", attribute_value: "", price_modifier: "0", stock_quantity: "0", sku: "" },
      ],
    }));

  const setVariant = (index, key, value) => {
    setForm((f) => {
      const variants = [...f.variants];
      variants[index] = { ...variants[index], [key]: value };
      return { ...f, variants };
    });
  };

  const removeVariant = (index) =>
    setForm((f) => ({ ...f, variants: f.variants.filter((_, i) => i !== index) }));

  const handleUpload = async (index, file) => {
    setUploading(index);
    try {
      const { url } = await api.uploadImage(file);
      setImage(index, "image_url", url);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        category_id: Number(form.category_id),
        name: form.name,
        slug: form.slug || undefined,
        short_description: form.short_description,
        description: form.description,
        price: Number(form.price),
        compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
        sku: form.sku || null,
        stock_quantity: Number(form.stock_quantity),
        designer_type: form.designer_type || null,
        design_id: form.design_id || null,
        is_active: form.is_active,
        is_featured: form.is_featured,
        sort_order: Number(form.sort_order) || 0,
        images: form.images.filter((img) => img.image_url),
        variants: form.variants
          .filter((v) => v.attribute_value)
          .map((v) => ({
            ...v,
            price_modifier: Number(v.price_modifier),
            stock_quantity: Number(v.stock_quantity),
          })),
      };

      if (isNew) {
        await api.createProduct(payload);
      } else {
        await api.updateProduct(id, payload);
      }
      navigate("/admin/products");
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-slate-400 animate-pulse">Завантаження...</div>;
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate("/admin/products")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Назад до списку
      </button>

      <h2 className="text-xl font-bold text-slate-900 mb-6">
        {isNew ? "Новий товар" : "Редагування товару"}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-soft">
          <h3 className="font-semibold text-slate-800">Основна інформація</h3>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Назва *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto" className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Категорія *</Label>
              <select
                value={form.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                required
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="">Оберіть...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Короткий опис</Label>
              <Input value={form.short_description} onChange={(e) => set("short_description", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Повний опис</Label>
              <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} className="rounded-xl" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-soft">
          <h3 className="font-semibold text-slate-800">Ціна та наявність</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Ціна (UAH) *</Label>
              <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} required className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Стара ціна</Label>
              <Input type="number" step="0.01" value={form.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input value={form.sku} onChange={(e) => set("sku", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Кількість на складі</Label>
              <Input type="number" value={form.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Пріоритет відображення</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => set("sort_order", e.target.value)} className="rounded-xl" />
              <p className="text-xs text-slate-400">Більше число — вище у каталозі. 0 — звичайний порядок.</p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Тип конструктора</Label>
              <select
                value={form.designer_type}
                onChange={(e) => set("designer_type", e.target.value)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
              >
                {DESIGNER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {form.designer_type && (
              <div className="space-y-2 sm:col-span-2">
                <DesignSelector
                  value={form.design_id}
                  onChange={(id) => set("design_id", id)}
                  designerType={form.designer_type}
                />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
              Активний (видимий у каталозі)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
              Рекомендований
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Зображення</h3>
            <Button type="button" variant="outline" size="sm" onClick={addImage} className="rounded-lg">
              <Plus className="h-4 w-4" /> Додати
            </Button>
          </div>
          {form.images.map((img, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-slate-50">
              {img.image_url && (
                <img src={img.image_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 space-y-2">
                <Input
                  value={img.image_url}
                  onChange={(e) => setImage(i, "image_url", e.target.value)}
                  placeholder="URL зображення"
                  className="rounded-lg"
                />
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(i, e.target.files[0])}
                    />
                    <span className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                      <Upload className="h-3 w-3" />
                      {uploading === i ? "Завантаження..." : "Завантажити файл"}
                    </span>
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="radio"
                      name="primary"
                      checked={img.is_primary}
                      onChange={() =>
                        setForm((f) => ({
                          ...f,
                          images: f.images.map((im, j) => ({ ...im, is_primary: j === i })),
                        }))
                      }
                    />
                    Головне
                  </label>
                </div>
              </div>
              {form.images.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeImage(i)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-soft">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Варіанти (розмір, колір)</h3>
            <Button type="button" variant="outline" size="sm" onClick={addVariant} className="rounded-lg">
              <Plus className="h-4 w-4" /> Додати
            </Button>
          </div>
          {form.variants.length === 0 && (
            <p className="text-sm text-slate-400">Варіанти необов'язкові</p>
          )}
          {form.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end p-3 rounded-lg bg-slate-50">
              <div>
                <Label className="text-xs">Атрибут</Label>
                <Input value={v.attribute_name} onChange={(e) => setVariant(i, "attribute_name", e.target.value)} className="rounded-lg" />
              </div>
              <div>
                <Label className="text-xs">Значення</Label>
                <Input value={v.attribute_value} onChange={(e) => setVariant(i, "attribute_value", e.target.value)} className="rounded-lg" />
              </div>
              <div>
                <Label className="text-xs">+ до ціни</Label>
                <Input type="number" value={v.price_modifier} onChange={(e) => setVariant(i, "price_modifier", e.target.value)} className="rounded-lg" />
              </div>
              <div>
                <Label className="text-xs">Склад</Label>
                <Input type="number" value={v.stock_quantity} onChange={(e) => setVariant(i, "stock_quantity", e.target.value)} className="rounded-lg" />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => removeVariant(i)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </section>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving} className="rounded-xl px-8">
            {saving ? "Збереження..." : isNew ? "Створити" : "Зберегти"}
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => navigate("/admin/products")}>
            Скасувати
          </Button>
        </div>
      </form>
    </div>
  );
}
