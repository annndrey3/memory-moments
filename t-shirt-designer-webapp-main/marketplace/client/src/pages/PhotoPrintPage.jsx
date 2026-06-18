import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, Trash2, Camera, Loader2, Info } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useSeo } from "@/lib/seo";

const COATINGS = [
  { value: "matte", label: "Матове" },
  { value: "gloss", label: "Глянцеве" },
];

// Ціни мають відповідати PHOTO_PRICES в orders.js на сервері
const SIZES = [
  { value: "10x15", label: "10×15 см", price: 15 },
  { value: "13x18", label: "13×18 см", price: 25 },
  { value: "15x21", label: "15×21 см", price: 35 },
  { value: "20x30", label: "20×30 см", price: 65 },
  { value: "30x40", label: "30×40 см", price: 120 },
];

let _cnt = 0;
const uid = () => `p${++_cnt}_${Date.now()}`;

export default function PhotoPrintPage() {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const fileRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [bulkCoating, setBulkCoating] = useState("");
  const [bulkSize, setBulkSize] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);

  useSeo({ title: "Друк фото" });

  const addFiles = useCallback((files) => {
    const next = Array.from(files)
      .filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type))
      .map((file) => ({
        id: uid(),
        file,
        preview: URL.createObjectURL(file),
        coating: "",
        size: "",
        qty: 1,
      }));
    if (next.length) setPhotos((prev) => [...prev, ...next]);
  }, []);

  const update = (id, patch) =>
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const remove = (id) => {
    setPhotos((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  const applyBulk = () => {
    setPhotos((prev) =>
      prev.map((p) => ({
        ...p,
        ...(bulkCoating ? { coating: bulkCoating } : {}),
        ...(bulkSize ? { size: bulkSize } : {}),
      }))
    );
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const totalQty = photos.reduce((s, p) => s + p.qty, 0);
  const totalPrice = photos.reduce((s, p) => {
    const sz = SIZES.find((x) => x.value === p.size);
    return s + (sz ? sz.price * p.qty : 0);
  }, 0);
  const allConfigured = photos.length > 0 && photos.every((p) => p.coating && p.size);

  const handleAddToCart = async () => {
    if (!allConfigured) {
      setError("Вкажіть покриття та розмір для кожного фото");
      return;
    }
    setError(null);
    setUploading(true);
    setUploadDone(0);
    try {
      for (const photo of photos) {
        const { url } = await api.uploadPhoto(photo.file);
        const sz = SIZES.find((x) => x.value === photo.size);
        const coatingLabel = COATINGS.find((c) => c.value === photo.coating)?.label;
        addItem(
          {
            product_id: `photo_print_${photo.id}`,
            type: "photo_print",
            name: `Друк фото ${sz.label}`,
            variant_label: `${coatingLabel} покриття`,
            unit_price: sz.price,
            image: url,
            photo_url: url,
            photo_size: photo.size,
            photo_coating: photo.coating,
            slug: null,
          },
          photo.qty
        );
        setUploadDone((n) => n + 1);
      }
      photos.forEach((p) => URL.revokeObjectURL(p.preview));
      navigate("/cart");
    } catch (err) {
      setError("Помилка завантаження: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const selectClass = (invalid) =>
    `rounded-lg border px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 ${
      invalid ? "border-red-300" : "border-slate-200"
    }`;

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8 pb-32">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2 animate-fade-in-up">
          <Camera className="h-6 w-6 text-violet-600" />
          Замовити друк фото
        </h1>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`mb-6 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all animate-fade-in-up ${
            dragOver
              ? "border-violet-500 bg-violet-50"
              : "border-slate-300 bg-white hover:border-violet-400 hover:bg-slate-50"
          }`}
        >
          <Upload className="mx-auto h-10 w-10 text-slate-400 mb-3" />
          <p className="font-medium text-slate-700">
            Перетягніть фото сюди або{" "}
            <span className="text-violet-600 underline underline-offset-2">оберіть файли</span>
          </p>
          <p className="mt-1 text-sm text-slate-400">JPEG, PNG, WebP — до 20 МБ кожне</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* Нагадування про якість оригіналів */}
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 animate-fade-in-up">
          <Info className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="text-sm leading-relaxed text-amber-900/90">
            <p className="font-semibold mb-0.5">Важливо: якість оригіналів фото</p>
            <p>
              Завантажуйте фото у максимальній якості — чим більша роздільна здатність,
              тим чіткіший друк. Знімки, надіслані через Viber, Telegram чи Instagram,
              сильно стискаються й можуть вийти розмитими. Краще беріть оригінали з галереї
              телефону або камери.
            </p>
          </div>
        </div>

        {photos.length > 0 && (
          <>
            {/* Bulk actions */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4 animate-fade-in-up">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Масові дії
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[150px] space-y-1">
                  <label className="text-xs text-slate-500">Виберіть покриття</label>
                  <select
                    value={bulkCoating}
                    onChange={(e) => setBulkCoating(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">Виберіть покриття</option>
                    {COATINGS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[150px] space-y-1">
                  <label className="text-xs text-slate-500">Виберіть розмір</label>
                  <select
                    value={bulkSize}
                    onChange={(e) => setBulkSize(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    <option value="">Виберіть розмір</option>
                    {SIZES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={applyBulk}
                  disabled={!bulkCoating && !bulkSize}
                  variant="outline"
                  className="rounded-xl shrink-0"
                >
                  Застосувати до всіх
                </Button>
              </div>
            </div>

            {/* Photo rows */}
            <div className="space-y-3">
              {photos.map((photo, i) => {
                const showInvalid = Boolean(error);
                const sz = SIZES.find((x) => x.value === photo.size);
                return (
                  <div
                    key={photo.id}
                    className={`flex items-center gap-3 rounded-2xl border bg-white p-3 animate-fade-in-up transition-all ${
                      showInvalid && (!photo.coating || !photo.size)
                        ? "border-red-300"
                        : "border-slate-200"
                    }`}
                    style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                  >
                    <img
                      src={photo.preview}
                      alt={photo.file.name}
                      className="h-16 w-16 shrink-0 rounded-xl object-cover bg-slate-100"
                    />

                    <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
                      <select
                        value={photo.coating}
                        onChange={(e) => update(photo.id, { coating: e.target.value })}
                        className={selectClass(showInvalid && !photo.coating)}
                      >
                        <option value="">Покриття</option>
                        {COATINGS.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>

                      <select
                        value={photo.size}
                        onChange={(e) => update(photo.id, { size: e.target.value })}
                        className={selectClass(showInvalid && !photo.size)}
                      >
                        <option value="">Розмір</option>
                        {SIZES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label} — {formatPrice(s.price)}
                          </option>
                        ))}
                      </select>

                      <select
                        value={photo.qty}
                        onChange={(e) => update(photo.id, { qty: Number(e.target.value) })}
                        className={selectClass(false)}
                      >
                        {Array.from({ length: 20 }, (_, k) => k + 1).map((n) => (
                          <option key={n} value={n}>{n} шт.</option>
                        ))}
                      </select>

                      {sz && (
                        <span className="text-sm font-medium text-slate-600">
                          {formatPrice(sz.price * photo.qty)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => remove(photo.id)}
                      className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Видалити"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add more */}
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-3 text-sm text-violet-600 hover:text-violet-800 underline underline-offset-2"
            >
              + Додати ще фото
            </button>
          </>
        )}
      </main>

      {/* Sticky bottom bar */}
      {photos.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 shadow-elevated">
          <div className="mx-auto max-w-4xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-slate-900">{totalQty} фото</span>
              {totalPrice > 0 && (
                <span className="ml-2 text-slate-500">{formatPrice(totalPrice)}</span>
              )}
              {error && <p className="text-xs text-red-600 mt-0.5">{error}</p>}
            </div>
            <Button
              onClick={handleAddToCart}
              disabled={uploading}
              className="rounded-xl shadow-glow"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Завантаження {uploadDone}/{photos.length}...
                </>
              ) : (
                "Переглянути і додати в кошик"
              )}
            </Button>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
