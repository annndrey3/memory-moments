import { useEffect, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, Type, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { FONT_OPTIONS } from "@/constants/designConstants";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed";

const LBL = "text-[10px] uppercase tracking-wider text-muted-foreground font-medium";
const FIELD = "h-8 text-sm rounded-lg";

export default function PropertiesBtn({ manualSync }) {
  const { activeCanvas, selectedObject } = useCanvas();

  const isText = selectedObject?.type === "textbox";
  const isLine = selectedObject?.type === "line";
  const active = isText || isLine;

  // ── Text state ──
  const [text,     setText]     = useState("");
  const [font,     setFont]     = useState("arial");
  const [fontSize, setFontSize] = useState(20);
  const [color,    setColor]    = useState("#000000");

  // ── Line state ──
  const [lineColor,  setLineColor]  = useState("#000000");
  const [lineWidth,  setLineWidth]  = useState(3);

  useEffect(() => {
    if (!selectedObject) return;
    if (selectedObject.type === "textbox") {
      setText(selectedObject.text || "");
      setFont(selectedObject.fontFamily || "arial");
      setFontSize(selectedObject.fontSize || 20);
      setColor(selectedObject.fill || "#000000");
    }
    if (selectedObject.type === "line") {
      setLineColor(selectedObject.stroke || "#000000");
      setLineWidth(selectedObject.strokeWidth || 3);
    }
  }, [selectedObject]);

  // ── Text handlers ──
  const applyText = (val) => {
    setText(val);
    selectedObject.set("text", val);
    activeCanvas.renderAll(); manualSync?.();
  };
  const applyFont = (val) => {
    setFont(val);
    selectedObject.set("fontFamily", val);
    activeCanvas.renderAll(); manualSync?.();
    document.fonts?.load(`${selectedObject.fontSize}px "${val}"`)
      .then(() => { activeCanvas.renderAll(); manualSync?.(); }).catch(() => {});
  };
  const applyFontSize = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!v || v < 1) return;
    setFontSize(v);
    selectedObject.set("fontSize", v);
    activeCanvas.renderAll(); manualSync?.();
  };
  const applyColor = (e) => {
    setColor(e.target.value);
    selectedObject.set("fill", e.target.value);
    activeCanvas.renderAll(); manualSync?.();
  };

  // ── Line handlers ──
  const applyLineColor = (e) => {
    setLineColor(e.target.value);
    selectedObject.set("stroke", e.target.value);
    activeCanvas.renderAll(); manualSync?.();
  };
  const applyLineWidth = (e) => {
    const v = parseInt(e.target.value, 10);
    if (!v || v < 1) return;
    setLineWidth(v);
    selectedObject.set("strokeWidth", v);
    activeCanvas.renderAll(); manualSync?.();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!active}
          title={isText ? "Налаштування тексту" : isLine ? "Налаштування лінії" : "Властивості"}
          className={RAIL_BTN}
        >
          {isText ? <Type className="h-5 w-5" /> : isLine ? <Minus className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
          <span className="text-[10px] font-medium leading-none">
            {isText ? "Шрифт" : isLine ? "Лінія" : "Стиль"}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="left" align="start" sideOffset={8} className="w-64 p-4 space-y-3">

        {/* ── TEXT ── */}
        {isText && (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Type className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs font-semibold text-foreground">Редагувати текст</p>
            </div>

            <div className="space-y-1">
              <label className={LBL}>Текст</label>
              <Input className={FIELD} value={text} onChange={(e) => applyText(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className={LBL}>Шрифт</label>
              <Select value={font} onValueChange={applyFont}>
                <SelectTrigger className={FIELD}>
                  <SelectValue placeholder="Шрифт" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={LBL}>Розмір</label>
                <Input type="number" min="1" className={FIELD} value={fontSize} onChange={applyFontSize} />
              </div>
              <div className="space-y-1">
                <label className={LBL}>Колір</label>
                <input type="color" value={color} onChange={applyColor}
                  className="w-full h-8 rounded-lg border border-border cursor-pointer p-0.5" />
              </div>
            </div>
          </>
        )}

        {/* ── LINE ── */}
        {isLine && (
          <>
            <div className="flex items-center gap-1.5 mb-1">
              <Minus className="h-3.5 w-3.5 text-violet-500" />
              <p className="text-xs font-semibold text-foreground">Редагувати лінію</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={LBL}>Колір</label>
                <input type="color" value={lineColor} onChange={applyLineColor}
                  className="w-full h-8 rounded-lg border border-border cursor-pointer p-0.5" />
              </div>
              <div className="space-y-1">
                <label className={LBL}>Товщина</label>
                <Input type="number" min="1" className={FIELD} value={lineWidth} onChange={applyLineWidth} />
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
