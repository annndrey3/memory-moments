import { useEffect, useRef, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Type, Italic, Bold, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/constants/designConstants";

// Плаваюча панель редагування тексту. З'являється автоматично щойно вибрано/додано
// текст і спливає красивою анімацією поряд з робочою зоною (як панель маски/рамки).
const TextEditPanel = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();
  const isText = selectedObject?.type === "textbox";

  const [text, setText] = useState("");
  const [font, setFont] = useState("Pacifico");
  const [fontSize, setFontSize] = useState(28);
  const [color, setColor] = useState("#000000");
  const [italic, setItalic] = useState(false);
  const [bold, setBold] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Синхронізація стану панелі з вибраним текстом (та скидання «закрито»).
  useEffect(() => {
    if (!isText) return;
    setText(selectedObject.text || "");
    setFont(selectedObject.fontFamily || "Pacifico");
    setFontSize(selectedObject.fontSize || 28);
    setColor(selectedObject.fill || "#000000");
    setItalic(selectedObject.fontStyle === "italic");
    setBold(selectedObject.fontWeight === "bold" || selectedObject.fontWeight === 700);
    setDismissed(false);
  }, [selectedObject, isText]);

  // Друк прямо на полотні (enterEditing) — підхоплюємо зміни в поле вводу панелі.
  useEffect(() => {
    if (!activeCanvas) return;
    const onChanged = () => {
      const o = activeCanvas.getActiveObject();
      if (o?.type === "textbox") setText(o.text || "");
    };
    activeCanvas.on("text:changed", onChanged);
    return () => activeCanvas.off("text:changed", onChanged);
  }, [activeCanvas]);

  if (!isText || dismissed) return null;

  const sync = () => { activeCanvas.renderAll(); manualSync?.(); };

  const applyText = (v) => { setText(v); selectedObject.set("text", v); sync(); };
  const applyFontSize = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!v || v < 1) return;
    setFontSize(v); selectedObject.set("fontSize", v); sync();
  };
  const applyColor = (e) => { setColor(e.target.value); selectedObject.set("fill", e.target.value); sync(); };

  const applyFont = (v) => {
    setFont(v);
    selectedObject.set("fontFamily", v);
    sync();
    // Веб-шрифт міг ще не завантажитись — дочекаємось і перемалюємо.
    document.fonts?.load?.(`${selectedObject.fontSize || 28}px "${v}"`)
      .then(sync).catch(() => {});
  };

  const toggleItalic = () => {
    const v = selectedObject.fontStyle === "italic" ? "normal" : "italic";
    setItalic(v === "italic"); selectedObject.set("fontStyle", v); sync();
  };
  const toggleBold = () => {
    const isBold = selectedObject.fontWeight === "bold" || selectedObject.fontWeight === 700;
    const v = isBold ? "normal" : "bold";
    setBold(!isBold); selectedObject.set("fontWeight", v); sync();
  };

  const done = () => {
    if (selectedObject.isEditing) selectedObject.exitEditing?.();
    setDismissed(true);
  };

  const TGL =
    "h-9 w-9 flex items-center justify-center rounded-lg border transition-colors shrink-0";

  return (
    <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-50 w-[94vw] max-w-2xl rounded-2xl border border-border/60 bg-white/95 backdrop-blur shadow-elevated px-4 py-3 animate-fade-in-up">
      <div className="flex items-center gap-2 mb-2.5">
        <Type className="h-4 w-4 text-violet-500 shrink-0" />
        <p className="text-xs font-semibold text-foreground/80">Текст — пишіть одразу, оберіть шрифт і стиль</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={text}
          onChange={(e) => applyText(e.target.value)}
          placeholder="Ваш текст…"
          className="h-9 flex-1 min-w-[160px] rounded-lg"
        />

        <Select value={font} onValueChange={applyFont}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg" style={{ fontFamily: font }}>
            <SelectValue placeholder="Шрифт" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectGroup>
              {FONT_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Input
          type="number"
          min="1"
          value={fontSize}
          onChange={applyFontSize}
          title="Розмір"
          className="h-9 w-16 rounded-lg"
        />

        <input
          type="color"
          value={color}
          onChange={applyColor}
          title="Колір"
          className="h-9 w-9 rounded-lg border border-border cursor-pointer p-0.5 shrink-0"
        />

        <button
          type="button"
          onClick={toggleItalic}
          title="Курсив"
          className={cn(TGL, italic
            ? "border-violet-500 bg-violet-500 text-white"
            : "border-border text-foreground/70 hover:bg-muted")}
        >
          <Italic className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleBold}
          title="Жирний"
          className={cn(TGL, bold
            ? "border-violet-500 bg-violet-500 text-white"
            : "border-border text-foreground/70 hover:bg-muted")}
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={done}
          className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors shrink-0"
        >
          <Check className="h-4 w-4" />
          Готово
        </button>
      </div>
    </div>
  );
};

export default TextEditPanel;
