import { useEffect, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Minus } from "lucide-react";

import { RAIL_BTN } from "@/components/ui/railButton";

const LBL = "text-[10px] uppercase tracking-wider text-muted-foreground font-medium";
const FIELD = "h-8 text-sm rounded-lg";

// Властивості ЛІНІЇ. Текст редагується окремою плаваючою панеллю (TextEditPanel),
// що з'являється просто біля самого тексту — тож текст тут більше НЕ дублюємо
// (раніше були дві панелі шрифту з різними дефолтами — джерело плутанини).
export default function PropertiesBtn({ manualSync }) {
  const { activeCanvas, selectedObject } = useCanvas();
  const isLine = selectedObject?.type === "line";

  const [lineColor, setLineColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    if (selectedObject?.type === "line") {
      setLineColor(selectedObject.stroke || "#000000");
      setLineWidth(selectedObject.strokeWidth || 3);
    }
  }, [selectedObject]);

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
          disabled={!isLine}
          title={isLine ? "Налаштування лінії" : "Властивості лінії (оберіть лінію)"}
          className={RAIL_BTN}
        >
          {isLine ? <Minus className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
          <span className="text-[10px] font-medium leading-none">Лінія</span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="left" align="start" sideOffset={8} className="w-64 p-4 space-y-3">
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
      </PopoverContent>
    </Popover>
  );
}
