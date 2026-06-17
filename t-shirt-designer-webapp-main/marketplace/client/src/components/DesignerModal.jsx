import { useEffect, useRef, useState } from "react";
import { X, Save, Loader2, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5173";
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
  const [showFallback, setShowFallback] = useState(false);
  const [manualJson, setManualJson] = useState("");

  const iframeRef = useRef(null);
  const exportTimerRef = useRef(null);
  const savingRef = useRef(false);

  const iframeSrc = `${DESIGNER_URL}?embed=1&type=${encodeURIComponent(productType)}`;

  useEffect(() => {
    if (!isOpen) return;
    setDesignName(initialDesign?.name || "");
    setManualJson(
      initialDesign?.fabric_data ? JSON.stringify(initialDesign.fabric_data, null, 2) : ""
    );
    setError(null);
    setDesignerReady(false);
    setShowFallback(false);
  }, [isOpen, initialDesign]);

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

  useEffect(() => {
    if (!isOpen) return;
    const onMessage = (event) => {
      if (event.origin !== DESIGNER_ORIGIN) return;
      const data = event.data;
      if (!data || data.source !== "mm-designer") return;
      if (data.type === "ready") {
        setDesignerReady(true);
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

  const handleSave = () => {
    if (!designName.trim()) {
      setError("Введіть назву дизайну");
      return;
    }
    if (!iframeRef.current?.contentWindow) {
      setError("Конструктор недоступний");
      return;
    }
    setError(null);
    setSaving(true);
    savingRef.current = true;
    iframeRef.current.contentWindow.postMessage(
      { source: "mm-admin", type: "export" },
      DESIGNER_ORIGIN
    );
    exportTimerRef.current = setTimeout(() => {
      if (savingRef.current) {
        savingRef.current = false;
        setSaving(false);
        setError("Конструктор не відповів. Переконайтесь, що він запущений, або скористайтесь ручним JSON нижче.");
        setShowFallback(true);
      }
    }, EXPORT_TIMEOUT_MS);
  };

  const handleSaveManual = async () => {
    if (!designName.trim()) { setError("Введіть назву дизайну"); return; }
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
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Compact top toolbar */}
      <div className="flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 shadow-sm">
        <button
          onClick={onClose}
          disabled={saving}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
          title="Закрити"
        >
          <X className="h-5 w-5 text-slate-500" />
        </button>

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        <span className="text-sm font-medium text-slate-700 shrink-0">
          {initialDesign ? "Редагування" : "Новий дизайн"} ·{" "}
          <span className="text-slate-400 font-normal">
            {PRODUCT_TYPE_LABELS[productType] || productType}
          </span>
        </span>

        <div className="flex-1" />

        {/* Status indicator */}
        {designerReady ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            Готово
          </span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
            <Loader2 className="h-3 w-3 animate-spin" />
            Завантаження…
          </span>
        )}

        <div className="w-px h-5 bg-slate-200 shrink-0" />

        {/* Name input */}
        <input
          type="text"
          value={designName}
          onChange={(e) => { setDesignName(e.target.value); setError(null); }}
          disabled={saving}
          placeholder="Назва дизайну *"
          className="w-56 px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50"
        />

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={saving || !designerReady}
          className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white shrink-0 h-8 px-4 text-sm"
        >
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Збереження…
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5" />
              Зберегти
            </>
          )}
        </Button>

        <a
          href={iframeSrc}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          title="Відкрити в новій вкладці"
        >
          <ExternalLink className="h-4 w-4 text-slate-400" />
        </a>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 px-4 py-2 text-sm text-red-700 shrink-0">
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Designer iframe — fills all remaining space */}
      <div className="flex-1 relative overflow-hidden bg-slate-50">
        {!designerReady && (
          <div className="absolute inset-0 flex items-center justify-center text-slate-400 pointer-events-none z-10">
            <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200">
              <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
              <span className="text-sm">Завантаження конструктора…</span>
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

      {/* Fallback manual JSON — collapsible footer */}
      <div className="border-t border-slate-200 bg-slate-50 shrink-0">
        <button
          onClick={() => setShowFallback((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          <span>Резервний режим: ручний JSON</span>
          {showFallback ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {showFallback && (
          <div className="px-4 pb-3 space-y-2">
            <textarea
              value={manualJson}
              onChange={(e) => setManualJson(e.target.value)}
              disabled={saving}
              rows={4}
              placeholder='{ "version": "5.3.0", "objects": [] }'
              className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:bg-slate-50"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveManual}
              disabled={saving}
              className="rounded-lg"
            >
              Зберегти з JSON
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
