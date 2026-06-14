import { useEffect, useRef, useState } from "react";
import { X, Save, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5173";
// Origin конструктора (iframe завантажується звідси) — приймаємо/шлемо postMessage лише сюди.
const DESIGNER_ORIGIN = new URL(DESIGNER_URL).origin;
const EXPORT_TIMEOUT_MS = 10000;

const PRODUCT_TYPE_LABELS = {
  "crew-neck": "Футболка",
  mug: "Чашка",
  polaroid: "Полароїд",
  "instax-mini": "Instax Mini",
  "photo-10x15": "Фото 10×15",
  "photo-15x10": "Фото 15×10",
};

/**
 * DesignerModal — реальний конструктор у <iframe> з мостом postMessage.
 *
 * Потік збереження:
 *   1. користувач малює у вбудованому конструкторі;
 *   2. натискає «Зберегти дизайн» → ми просимо конструктор експортувати полотно;
 *   3. конструктор повертає { fabricData, previewImage } → зберігаємо через API.
 *
 * Якщо конструктор не запущено (порт 5173), доступний резервний ручний JSON.
 */
export default function DesignerModal({
  isOpen,
  onClose,
  onSave,
  productType,
  initialDesign = null,
}) {
  const [designName, setDesignName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [designerReady, setDesignerReady] = useState(false);
  const [manualJson, setManualJson] = useState("");

  const iframeRef = useRef(null);
  const exportTimerRef = useRef(null);
  const savingRef = useRef(false);

  const iframeSrc = `${DESIGNER_URL}?embed=1&type=${encodeURIComponent(productType)}`;

  // Синхронізувати поля при відкритті / зміні дизайну, що редагується.
  useEffect(() => {
    if (!isOpen) return;
    setDesignName(initialDesign?.name || "");
    setManualJson(
      initialDesign?.fabric_data
        ? JSON.stringify(initialDesign.fabric_data, null, 2)
        : ""
    );
    setError(null);
    setDesignerReady(false);
  }, [isOpen, initialDesign]);

  // Власне збереження дизайну через API.
  const persistDesign = async (fabricData, previewImage) => {
    try {
      const designData = {
        name: designName.trim(),
        description: `Дизайн для ${PRODUCT_TYPE_LABELS[productType] || productType}`,
        productType,
        fabricData,
        previewImage: previewImage ?? initialDesign?.preview_image ?? null,
        width: 450,
        height: 500,
      };

      const saved = initialDesign?.id
        ? await api.updateDesign(initialDesign.id, designData)
        : await api.createDesign(designData);

      onSave(saved);
    } catch (err) {
      setError(err.message || "Помилка при збереженні дизайну");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  // Повідомлення від конструктора (source: "mm-designer").
  useEffect(() => {
    if (!isOpen) return;

    const onMessage = (event) => {
      if (event.origin !== DESIGNER_ORIGIN) return;
      const data = event.data;
      if (!data || data.source !== "mm-designer") return;

      if (data.type === "ready") {
        setDesignerReady(true);
        // Завантажити існуючий дизайн на полотно конструктора.
        if (initialDesign?.fabric_data && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            { source: "mm-admin", type: "load", fabricData: initialDesign.fabric_data },
            DESIGNER_ORIGIN
          );
        }
      } else if (data.type === "design" && savingRef.current) {
        clearTimeout(exportTimerRef.current);
        persistDesign(data.payload?.fabricData, data.payload?.previewImage);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(exportTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialDesign, designName, productType]);

  // Зберегти: попросити конструктор експортувати дизайн.
  const handleSave = () => {
    if (!designName.trim()) {
      setError("Назва дизайну обов'язкова");
      return;
    }
    if (!iframeRef.current?.contentWindow) {
      setError("Конструктор недоступний");
      return;
    }

    setError(null);
    setSaving(true);
    savingRef.current = true;

    iframeRef.current.contentWindow.postMessage({ source: "mm-admin", type: "export" }, DESIGNER_ORIGIN);

    exportTimerRef.current = setTimeout(() => {
      if (savingRef.current) {
        savingRef.current = false;
        setSaving(false);
        setError(
          "Конструктор не відповів. Переконайтесь, що він запущений (порт 5173), або скористайтесь ручним JSON нижче."
        );
      }
    }, EXPORT_TIMEOUT_MS);
  };

  // Резервне збереження з ручного JSON (коли конструктор не запущено).
  const handleSaveManual = async () => {
    if (!designName.trim()) {
      setError("Назва дизайну обов'язкова");
      return;
    }
    let parsed;
    try {
      parsed = manualJson.trim() ? JSON.parse(manualJson) : { version: "5.3.0", objects: [] };
    } catch {
      setError("Некоректний JSON");
      return;
    }
    setError(null);
    setSaving(true);
    savingRef.current = true;
    await persistDesign(parsed, initialDesign?.preview_image ?? null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col max-w-6xl w-full max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {initialDesign ? "Редагування дизайну" : "Новий дизайн"}
            </h2>
            <p className="text-sm text-slate-500">
              {PRODUCT_TYPE_LABELS[productType] || productType}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={designName}
              onChange={(e) => setDesignName(e.target.value)}
              disabled={saving}
              placeholder="Назва дизайну *"
              className="w-64 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50"
            />
            <button
              onClick={onClose}
              disabled={saving}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Constructor iframe */}
        <div className="flex-1 overflow-hidden bg-slate-50 relative min-h-[55vh]">
          {!designerReady && (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Завантаження конструктора…
              </div>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            title="Конструктор дизайну"
            className="w-full h-full border-0"
            allow="clipboard-write"
          />
        </div>

        {/* Error + manual fallback */}
        <div className="px-5">
          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">
              ⚙️ Розширено: ручний JSON дизайну (резервний режим)
            </summary>
            <textarea
              value={manualJson}
              onChange={(e) => setManualJson(e.target.value)}
              disabled={saving}
              rows={5}
              placeholder='{ "version": "5.3.0", "objects": [] }'
              className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveManual}
              disabled={saving}
              className="mt-2 rounded-lg"
            >
              Зберегти з JSON
            </Button>
          </details>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-5 flex items-center justify-between gap-3">
          <a
            href={iframeSrc}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600"
          >
            <ExternalLink className="h-4 w-4" />
            Відкрити в окремій вкладці
          </a>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg"
            >
              Скасувати
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !designName.trim()}
              className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Збереження...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Зберегти дизайн
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
