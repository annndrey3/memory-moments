import { useEffect, useRef, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import * as fabric from "fabric";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Crop, Heart, Square, Circle, Crosshair, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RAIL_BTN } from "@/components/ui/railButton";

const OvalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="10" cy="10" rx="8" ry="5.5" />
  </svg>
);

const StarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polygon points="10,1 12.12,7.08 18.56,7.22 13.42,11.12 15.28,17.28 10,13.6 4.72,17.28 6.58,11.12 1.44,7.22 7.88,7.08" />
  </svg>
);

const SHAPES = [
  { id: "circle", label: "Коло",    Icon: Circle },
  { id: "oval",   label: "Овал",    Icon: OvalIcon },
  { id: "square", label: "Квадрат", Icon: Square },
  { id: "heart",  label: "Серце",   Icon: Heart },
  { id: "star",   label: "Зірка",   Icon: StarIcon },
];

export function createMaskClipPath(shapeType, width, height) {
  let clipPath = null;

  if (shapeType === "circle") {
    clipPath = new fabric.Circle({
      radius: Math.min(width, height) / 2,
      originX: "center", originY: "center",
    });
  } else if (shapeType === "oval") {
    clipPath = new fabric.Ellipse({
      rx: width / 2, ry: height / 2,
      originX: "center", originY: "center",
    });
  } else if (shapeType === "square") {
    const size = Math.min(width, height);
    clipPath = new fabric.Rect({
      width: size, height: size,
      originX: "center", originY: "center",
    });
  } else if (shapeType === "heart") {
    clipPath = new fabric.Path(
      "M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z",
      { originX: "center", originY: "center" }
    );
    const bbox = clipPath.getBoundingRect();
    const s = Math.min(width, height) / Math.max(bbox.width, bbox.height);
    clipPath.scaleX = s;
    clipPath.scaleY = s;
  } else if (shapeType === "star") {
    clipPath = new fabric.Path(
      "M 50,5 L 60.6,35.4 L 92.8,36.1 L 67.1,55.6 L 76.4,86.4 L 50,68 L 23.6,86.4 L 32.9,55.6 L 7.2,36.1 L 39.4,35.4 Z",
      { originX: "center", originY: "center" }
    );
    const bbox = clipPath.getBoundingRect();
    const s = Math.min(width, height) / Math.max(bbox.width, bbox.height);
    clipPath.scaleX = s;
    clipPath.scaleY = s;
  }

  if (clipPath) {
    // Базовий масштаб зберігаємо в самому об'єкті — ползунок відраховує від «100% = щойно накладена маска»
    clipPath._baseScaleX = clipPath.scaleX || 1;
    clipPath._baseScaleY = clipPath.scaleY || 1;
  }

  return clipPath;
}

const SHAPE_BTN =
  "flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-xl border border-border/60 bg-card hover:border-violet-400/60 hover:bg-violet-50/60 text-foreground/70 hover:text-violet-600 transition-all";

const SLIDER =
  "h-1.5 rounded-full appearance-none cursor-pointer bg-muted " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 " +
  "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500 [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-webkit-slider-thumb]:shadow-sm " +
  "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-violet-500";

const MaskDropdownBtn = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();
  const [open, setOpen] = useState(false);
  // moveMask: активний режим «перетягую фото → рухається маска».
  // Вмикається автоматично одразу після накладання форми.
  const [moveMask, setMoveMask] = useState(false);
  const [maskScale, setMaskScale] = useState(1);
  const baseScaleRef = useRef({ x: 1, y: 1 });

  const isImage = selectedObject?.type === "image";
  const hasMask = isImage && Boolean(selectedObject?.clipPath);

  // Зміна вибраного об'єкта (або втрата маски) — виходимо з режиму руху.
  useEffect(() => {
    if (!hasMask) { setMoveMask(false); return; }
    const cp = selectedObject.clipPath;
    baseScaleRef.current = { x: cp._baseScaleX ?? cp.scaleX ?? 1, y: cp._baseScaleY ?? cp.scaleY ?? 1 };
    setMaskScale(1);
  }, [selectedObject, hasMask]);

  // Перетягування маски мишею (логіка така ж, як було в панелі редагування).
  useEffect(() => {
    if (!moveMask || !activeCanvas || !isImage || !selectedObject?.clipPath) return;

    const img = selectedObject;
    const prev = { x: img.lockMovementX, y: img.lockMovementY };
    // Фіксуємо фото — тоді тягнеться маска, а не зображення.
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
    const onUp = () => { if (!dragging) return; dragging = false; manualSync?.(); };

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
  }, [moveMask, activeCanvas, selectedObject, isImage, manualSync]);

  // Esc — завершити режим руху маски.
  useEffect(() => {
    if (!moveMask) return;
    const onKey = (e) => { if (e.key === "Escape") setMoveMask(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moveMask]);

  const applyMask = (shapeType) => {
    if (!selectedObject || !activeCanvas) return;
    const clipPath = createMaskClipPath(shapeType, selectedObject.width, selectedObject.height);
    if (!clipPath) return;
    selectedObject.set({ clipPath });
    baseScaleRef.current = { x: clipPath._baseScaleX, y: clipPath._baseScaleY };
    setMaskScale(1);
    activeCanvas.renderAll();
    manualSync?.();
    setOpen(false);
    // Одразу даємо рухати маску по фото.
    setMoveMask(true);
  };

  const handleScale = (e) => {
    const val = parseFloat(e.target.value);
    setMaskScale(val);
    const cp = selectedObject?.clipPath;
    if (!cp || !activeCanvas) return;
    cp.scaleX = baseScaleRef.current.x * val;
    cp.scaleY = baseScaleRef.current.y * val;
    selectedObject.dirty = true;
    activeCanvas.requestRenderAll();
  };

  const centerMask = () => {
    const cp = selectedObject?.clipPath;
    if (!cp || !activeCanvas) return;
    cp.left = 0;
    cp.top = 0;
    selectedObject.dirty = true;
    activeCanvas.renderAll();
    manualSync?.();
  };

  const removeMask = () => {
    if (!selectedObject || !activeCanvas) return;
    setMoveMask(false);
    selectedObject.set({ clipPath: null });
    activeCanvas.renderAll();
    manualSync?.();
  };

  return (
    <>
      <Popover open={open} onOpenChange={(v) => isImage && setOpen(v)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={isImage ? "Маска фото" : "Оберіть фото для маски"}
            disabled={!isImage}
            className={RAIL_BTN}
          >
            <Crop className="h-3.5 w-3.5" />
            <span className="text-[10px] font-medium leading-none">Маска</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="w-auto p-3">
          <p className="text-[11px] text-muted-foreground mb-2.5 font-semibold uppercase tracking-wider">
            Форма маски
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {SHAPES.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => applyMask(id)} className={SHAPE_BTN}>
                <Icon className="h-5 w-5" />
                <span className="text-[9px] font-medium leading-none">{label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Плаваюча панель керування маскою — зʼявляється одразу після накладання */}
      {moveMask && hasMask && (
        <div className="fixed left-1/2 bottom-24 -translate-x-1/2 z-50 w-[92vw] max-w-md rounded-2xl border border-border/60 bg-white/95 backdrop-blur shadow-elevated px-4 py-3 animate-fade-in-up">
          <div className="flex items-center gap-2 mb-2.5">
            <Crop className="h-4 w-4 text-violet-500 shrink-0" />
            <p className="text-xs font-medium text-foreground/80">
              Перетягуйте фото — рухається маска. Повзунком міняйте розмір.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.01"
              value={maskScale}
              onChange={handleScale}
              onPointerUp={() => manualSync?.()}
              className={cn(SLIDER, "flex-1")}
            />
            <span className="text-[11px] tabular-nums font-medium text-muted-foreground w-9 text-right">
              {Math.round(maskScale * 100)}%
            </span>

            <button
              type="button"
              onClick={centerMask}
              title="Центрувати маску"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-border/70 text-foreground/70 hover:bg-muted transition-colors"
            >
              <Crosshair className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={removeMask}
              title="Зняти маску"
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMoveMask(false)}
              className="h-8 px-3 flex items-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors"
            >
              <Check className="h-4 w-4" />
              Готово
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default MaskDropdownBtn;
