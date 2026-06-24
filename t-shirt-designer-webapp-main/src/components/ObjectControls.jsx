import { useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Blend, FlipHorizontal, FlipVertical, RotateCw, Scan } from "lucide-react";
import LayersDropdownBtn from "./LayersDropdownBtn";

import { RAIL_BTN } from "@/components/ui/railButton";

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

  const has = Boolean(selectedObject);

  // Синхронізуємо значення ползунка з реальним opacity вибраного об'єкта
  useEffect(() => {
    setOpacity(Math.round((selectedObject?.opacity ?? 1) * 100));
    setOpen(false);
  }, [selectedObject]);

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

  // Поворот на 90° навколо ЦЕНТРУ об'єкта (а не кута) — позиція центру не «стрибає».
  const rotate90 = () => {
    const o = selectedObject;
    if (!o || !activeCanvas) return;
    const c = o.getCenterPoint();
    o.angle = Math.round(((o.angle || 0) + 90) % 360);
    o.setPositionByOrigin(c, "center", "center");
    o.setCoords();
    activeCanvas.renderAll();
    manualSync?.();
  };

  // «Вмістити»: повертає фото в його зону (комірку колажу / маску / зону друку) —
  // скидає кут і дзеркало, масштабує «cover» і центрує. Рятує, коли фото з'їхало/змалилось.
  const fitToZone = () => {
    const o = selectedObject;
    if (!o || !activeCanvas) return;
    const cp = o.clipPath;
    const r = cp && cp.absolutePositioned
      ? { left: cp.left, top: cp.top, width: cp.width * (cp.scaleX || 1), height: cp.height * (cp.scaleY || 1) }
      : (activeCanvas.printArea || { left: 0, top: 0, width: activeCanvas.getWidth(), height: activeCanvas.getHeight() });
    o.set({ angle: 0, flipX: false, flipY: false });
    if (o.type === "image") {
      const scale = Math.max(r.width / o.width, r.height / o.height); // cover
      o.scale(scale);
      o.set({
        left: r.left + (r.width - o.getScaledWidth()) / 2,
        top: r.top + (r.height - o.getScaledHeight()) / 2,
      });
    } else {
      o.setPositionByOrigin(new fabric.Point(r.left + r.width / 2, r.top + r.height / 2), "center", "center");
    }
    o.setCoords();
    activeCanvas.renderAll();
    manualSync?.();
  };

  return (
    <>
      {/* ── Прозорість ── */}
      <Popover open={open} onOpenChange={(v) => has && setOpen(v)}>
        <PopoverTrigger asChild>
          <button type="button" disabled={!has} title="Прозорість" className={RAIL_BTN}>
            <Blend className="h-3.5 w-3.5" />
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

      {/* ── Шари (повна панель: список обʼєктів, вибір, показ/сховати, порядок, видалення) ── */}
      <LayersDropdownBtn manualSync={manualSync} />

      {/* ── Дзеркало горизонтально ── */}
      <button
        type="button"
        disabled={!has}
        title="Дзеркало горизонтально"
        onClick={() => flip("H")}
        className={RAIL_BTN}
      >
        <FlipHorizontal className="h-3.5 w-3.5" />
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
        <FlipVertical className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium leading-none">Верт.</span>
      </button>

      {/* ── Повернути на 90° ── */}
      <button
        type="button"
        disabled={!has}
        title="Повернути на 90°"
        onClick={rotate90}
        className={RAIL_BTN}
      >
        <RotateCw className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium leading-none">Поворот</span>
      </button>

      {/* ── Вмістити фото в зону (скинути зсув/масштаб) ── */}
      <button
        type="button"
        disabled={!has}
        title="Вмістити в зону (скинути зсув і масштаб)"
        onClick={fitToZone}
        className={RAIL_BTN}
      >
        <Scan className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium leading-none">Вмістити</span>
      </button>
    </>
  );
}
