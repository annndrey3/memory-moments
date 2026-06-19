import { useEffect, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Blend, FlipHorizontal, FlipVertical, Layers, ArrowUpToLine, ArrowUp, ArrowDown, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed";

const LAYER_ITEM =
  "flex items-center gap-2.5 w-full rounded-lg px-3 py-2 text-sm font-medium text-foreground/90 hover:bg-muted transition-colors";

// Дії над z-порядком (шарами) вибраного об'єкта — імена методів fabric v6.
const LAYER_ACTIONS = [
  { key: "front", label: "На передній план", Icon: ArrowUpToLine, fn: "bringObjectToFront" },
  { key: "forward", label: "Підняти вище", Icon: ArrowUp, fn: "bringObjectForward" },
  { key: "backward", label: "Опустити нижче", Icon: ArrowDown, fn: "sendObjectBackwards" },
  { key: "back", label: "На задній план", Icon: ArrowDownToLine, fn: "sendObjectToBack" },
];

const SLIDER =
  "flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-muted " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-500";

export default function ObjectControls({ manualSync }) {
  const { activeCanvas, selectedObject } = useCanvas();
  const [opacity, setOpacity] = useState(100);
  const [open, setOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);

  const has = Boolean(selectedObject);

  // Синхронізуємо значення ползунка з реальним opacity вибраного об'єкта
  useEffect(() => {
    setOpacity(Math.round((selectedObject?.opacity ?? 1) * 100));
    setOpen(false);
    setLayersOpen(false);
  }, [selectedObject]);

  // Змінити z-порядок (шар) вибраного об'єкта. Порядок об'єктів зберігається в
  // canvas.toJSON(), тож manualSync персистить його (і оновлює мокап/друк-файл).
  const reorder = (fn) => {
    if (!selectedObject || !activeCanvas || typeof activeCanvas[fn] !== "function") return;
    activeCanvas[fn](selectedObject);
    activeCanvas.renderAll();
    manualSync?.();
    setLayersOpen(false);
  };

  const handleOpacity = (e) => {
    const val = Number(e.target.value);
    setOpacity(val);
    if (!selectedObject || !activeCanvas) return;
    selectedObject.set("opacity", val / 100);
    activeCanvas.renderAll();
  };

  const flip = (axis) => {
    if (!selectedObject || !activeCanvas) return;
    const key = axis === "H" ? "flipX" : "flipY";
    selectedObject.set(key, !selectedObject[key]);
    activeCanvas.renderAll();
    manualSync?.();
  };

  return (
    <>
      {/* ── Прозорість ── */}
      <Popover open={open} onOpenChange={(v) => has && setOpen(v)}>
        <PopoverTrigger asChild>
          <button type="button" disabled={!has} title="Прозорість" className={RAIL_BTN}>
            <Blend className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">
              {has ? `${opacity}%` : "Прозор."}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="w-52 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Прозорість
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={opacity}
              onChange={handleOpacity}
              onPointerUp={() => manualSync?.()}
              className={SLIDER}
            />
            <span className="text-xs tabular-nums w-9 text-right font-medium text-foreground">
              {opacity}%
            </span>
          </div>
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground/60 select-none">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </PopoverContent>
      </Popover>

      {/* ── Шари (z-порядок) ── */}
      <Popover open={layersOpen} onOpenChange={(v) => has && setLayersOpen(v)}>
        <PopoverTrigger asChild>
          <button type="button" disabled={!has} title="Шари (порядок)" className={RAIL_BTN}>
            <Layers className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Шари</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="w-52 p-1.5">
          <p className="px-2 pt-1.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Порядок шарів
          </p>
          {LAYER_ACTIONS.map(({ key, label, Icon, fn }) => (
            <button key={key} type="button" onClick={() => reorder(fn)} className={LAYER_ITEM}>
              <Icon className="h-4 w-4 text-violet-600" />
              {label}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* ── Дзеркало горизонтально ── */}
      <button
        type="button"
        disabled={!has}
        title="Дзеркало горизонтально"
        onClick={() => flip("H")}
        className={RAIL_BTN}
      >
        <FlipHorizontal className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-none">Дзеркало</span>
      </button>

      {/* ── Дзеркало вертикально ── */}
      <button
        type="button"
        disabled={!has}
        title="Дзеркало вертикально"
        onClick={() => flip("V")}
        className={RAIL_BTN}
      >
        <FlipVertical className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-none">Верт.</span>
      </button>
    </>
  );
}
