import { useEffect, useRef, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { ImageIcon, Move, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all";
const RAIL_BTN_ACTIVE =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 shrink-0 rounded-xl border border-violet-400/60 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 transition-all";

const ImageMaskToolBar = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();
  const [moveMask, setMoveMask] = useState(false);
  const [maskScale, setMaskScale] = useState(1);
  const baseScaleRef = useRef({ x: 1, y: 1 });

  // Скидаємо стан при зміні вибраного об'єкта
  useEffect(() => {
    setMoveMask(false);
    setMaskScale(1);
  }, [selectedObject]);

  // Коли змінюється сам clipPath (нова маска з дропдауна або зміна форми) —
  // підхоплюємо базовий масштаб, збережений у _baseScaleX/_baseScaleY,
  // і скидаємо ползунок на 100%
  useEffect(() => {
    const cp = selectedObject?.clipPath;
    if (cp) {
      baseScaleRef.current = {
        x: cp._baseScaleX ?? cp.scaleX ?? 1,
        y: cp._baseScaleY ?? cp.scaleY ?? 1,
      };
      setMaskScale(1);
    }
  }, [selectedObject?.clipPath]);

  // Перетягування маски мишею
  useEffect(() => {
    if (!moveMask || !activeCanvas || !selectedObject || selectedObject.type !== "image" || !selectedObject.clipPath) return;

    const img = selectedObject;
    const prev = { x: img.lockMovementX, y: img.lockMovementY };
    img.lockMovementX = true;
    img.lockMovementY = true;

    let dragging = false;
    let last = null;

    const point = (e) =>
      activeCanvas.getScenePoint ? activeCanvas.getScenePoint(e) : activeCanvas.getPointer(e);

    const toLocal = (dx, dy) => {
      const sx = img.scaleX || 1;
      const sy = img.scaleY || 1;
      const rad = -((img.angle || 0) * Math.PI) / 180;
      return {
        x: (dx * Math.cos(rad) - dy * Math.sin(rad)) / sx,
        y: (dx * Math.sin(rad) + dy * Math.cos(rad)) / sy,
      };
    };

    const onDown = (opt) => { if (opt.target !== img) return; dragging = true; last = point(opt.e); };
    const onMove = (opt) => {
      if (!dragging || !img.clipPath) return;
      const p = point(opt.e);
      const d = toLocal(p.x - last.x, p.y - last.y);
      last = p;
      img.clipPath.left = (img.clipPath.left || 0) + d.x;
      img.clipPath.top  = (img.clipPath.top  || 0) + d.y;
      img.dirty = true;
      activeCanvas.requestRenderAll();
    };
    const onUp = () => { if (!dragging) return; dragging = false; manualSync(); };

    activeCanvas.on("mouse:down", onDown);
    activeCanvas.on("mouse:move", onMove);
    activeCanvas.on("mouse:up", onUp);
    return () => {
      activeCanvas.off("mouse:down", onDown);
      activeCanvas.off("mouse:move", onMove);
      activeCanvas.off("mouse:up", onUp);
      img.lockMovementX = prev.x;
      img.lockMovementY = prev.y;
    };
  }, [moveMask, activeCanvas, selectedObject, manualSync]);

  if (!selectedObject || selectedObject.type !== "image" || !selectedObject.clipPath) return null;

  const handleMaskScale = (e) => {
    const val = parseFloat(e.target.value);
    setMaskScale(val);
    if (!selectedObject?.clipPath || !activeCanvas) return;
    selectedObject.clipPath.scaleX = baseScaleRef.current.x * val;
    selectedObject.clipPath.scaleY = baseScaleRef.current.y * val;
    selectedObject.dirty = true;
    activeCanvas.requestRenderAll();
  };

  const centerMask = () => {
    if (!selectedObject?.clipPath || !activeCanvas) return;
    selectedObject.clipPath.left = 0;
    selectedObject.clipPath.top  = 0;
    selectedObject.dirty = true;
    activeCanvas.renderAll();
    manualSync();
  };

  const removeMask = () => {
    if (!selectedObject || !activeCanvas) return;
    setMoveMask(false);
    setMaskScale(1);
    selectedObject.set({ clipPath: null });
    activeCanvas.renderAll();
    manualSync();
  };

  return (
    <div className="panel-section mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-xs font-semibold text-sidebar-foreground">Маска зображення</p>
      </div>

      {/* Масштаб маски */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">
            Розмір маски
          </span>
          <span className="text-[10px] font-medium tabular-nums text-sidebar-foreground/70">
            {Math.round(maskScale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.1"
          max="2"
          step="0.01"
          value={maskScale}
          onChange={handleMaskScale}
          onPointerUp={() => manualSync()}
          className={cn(
            "w-full h-1.5 rounded-full appearance-none cursor-pointer",
            "bg-sidebar-accent/60",
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-violet-500",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:shadow-sm",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/20",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4",
            "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0",
            "[&::-moz-range-thumb]:bg-violet-500 [&::-moz-range-thumb]:cursor-pointer"
          )}
        />
        <div className="flex justify-between text-[9px] text-sidebar-foreground/30 select-none">
          <span>10%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Дії з маскою */}
      <div className="flex gap-1.5">
        <button
          type="button"
          title={moveMask ? "Готово" : "Рухати маску"}
          onClick={() => setMoveMask((v) => !v)}
          className={moveMask ? RAIL_BTN_ACTIVE : RAIL_BTN}
        >
          <Move className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">
            {moveMask ? "Готово" : "Рухати"}
          </span>
        </button>
        <button
          type="button"
          title="Центрувати маску"
          onClick={centerMask}
          className={RAIL_BTN}
        >
          <Crosshair className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Центр</span>
        </button>
        <button
          type="button"
          title="Зняти маску"
          onClick={removeMask}
          className="flex flex-col items-center justify-center gap-1 h-14 w-14 shrink-0 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all"
        >
          <ImageIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Зняти</span>
        </button>
      </div>

      {moveMask && (
        <p className="text-[11px] leading-snug text-sidebar-foreground/60">
          Перетягуйте фото мишею — рухатиметься маска відносно зображення.
        </p>
      )}
    </div>
  );
};

export default ImageMaskToolBar;
