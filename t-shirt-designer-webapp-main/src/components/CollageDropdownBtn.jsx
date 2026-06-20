import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { useCanvas } from "@/hooks/useCanvas";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutGrid } from "lucide-react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { COLLAGE_LAYOUTS, slotRect } from "@/constants/collageLayouts";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all";

// Маленьке прев'ю розкладки для пікера.
function layoutThumb(layout, size = 54) {
  const pad = 3, w = size - 2 * pad, h = size - 2 * pad, g = 2;
  const rects = layout.slots
    .map(
      (s) =>
        `<rect x="${(pad + s.x * w + g / 2).toFixed(1)}" y="${(pad + s.y * h + g / 2).toFixed(1)}" width="${(s.w * w - g).toFixed(1)}" height="${(s.h * h - g).toFixed(1)}" rx="2" fill="#ede9fe" stroke="#a78bfa" stroke-width="0.8"/>`
    )
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}

const CollageDropdownBtn = ({ manualSync }) => {
  const { activeCanvas } = useCanvas();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef(null);
  const pendingRef = useRef(null); // { rect, placeholder }

  const getArea = () =>
    activeCanvas?.printArea || {
      left: 0, top: 0,
      width: activeCanvas?.getWidth?.() || CANVAS_CONFIG.width,
      height: activeCanvas?.getHeight?.() || CANVAS_CONFIG.height,
    };

  // Клік по порожній комірці → вибір файлу для саме цієї комірки.
  // GLITCH-FIX: OS-діалог вибору файлу перехоплює mouseup → fabric лишається в
  // стані «кнопку затиснуто» (залипле виділення/перетягування). Тому коли вікно
  // знову отримує фокус (діалог закрито — і при виборі, і при «Скасувати»),
  // примусово завершуємо будь-яку завислу взаємодію fabric.
  useEffect(() => {
    if (!activeCanvas) return;
    const heal = () => {
      try {
        activeCanvas._currentTransform = null;
        activeCanvas._groupSelector = null;
        activeCanvas._isClick = false;
        activeCanvas.setCursor?.("default");
        activeCanvas.requestRenderAll();
      } catch { /* internals можуть змінитися — не критично */ }
    };
    const onDown = (opt) => {
      const tgt = opt.target;
      if (!tgt || tgt.mmRole !== "slot") return;
      const br = tgt.getBoundingRect();
      pendingRef.current = {
        rect: { left: br.left, top: br.top, width: br.width, height: br.height },
        placeholder: tgt,
      };
      fileInputRef.current?.click();
      window.addEventListener("focus", heal, { once: true });
    };
    activeCanvas.on("mouse:down", onDown);
    return () => activeCanvas.off("mouse:down", onDown);
  }, [activeCanvas]);

  const buildPlaceholder = (r, index) => {
    const rect = new fabric.Rect({
      left: r.left, top: r.top, width: r.width, height: r.height,
      fill: "rgba(139,92,246,0.06)", stroke: "#a78bfa", strokeWidth: 1.5,
      strokeDashArray: [6, 5], rx: 6, ry: 6,
      selectable: false, evented: false, objectCaching: false, strokeUniform: true,
    });
    const plus = new fabric.Text("+", {
      fontSize: Math.min(r.width, r.height) * 0.32, fill: "#a78bfa",
      originX: "center", originY: "center",
      left: r.left + r.width / 2, top: r.top + r.height / 2,
      selectable: false, evented: false, objectCaching: false,
    });
    const ph = new fabric.Group([rect, plus], {
      selectable: false, evented: true, hoverCursor: "pointer", objectCaching: false,
    });
    ph.mmRole = "slot";
    ph.mmSlot = index;
    return ph;
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const pend = pendingRef.current;
    pendingRef.current = null;
    if (!file || !pend || !activeCanvas) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const imgEl = new Image();
      imgEl.src = ev.target.result;
      imgEl.onload = () => {
        const img = new fabric.Image(imgEl);
        const r = pend.rect;
        const scale = Math.max(r.width / img.width, r.height / img.height); // cover
        img.scale(scale);
        img.set({
          left: r.left + (r.width - img.getScaledWidth()) / 2,
          top: r.top + (r.height - img.getScaledHeight()) / 2,
        });
        // Кадрування по комірці — фіксоване «вікно» в координатах полотна.
        img.clipPath = new fabric.Rect({
          left: r.left, top: r.top, width: r.width, height: r.height, absolutePositioned: true,
        });
        img.mmRole = "photo";
        if (pend.placeholder) activeCanvas.remove(pend.placeholder);
        activeCanvas.add(img);
        // рамка (якщо є) лишається поверх
        const frame = activeCanvas.getObjects().find((o) => o.mmRole === "frame");
        if (frame) activeCanvas.bringObjectToFront(frame);
        activeCanvas.setActiveObject(img);
        activeCanvas.requestRenderAll();
        manualSync?.();
      };
    };
    reader.readAsDataURL(file);
  };

  const apply = (layout) => {
    if (!activeCanvas) return;
    activeCanvas.getObjects().filter((o) => o.mmRole === "slot").forEach((o) => activeCanvas.remove(o));
    const area = getArea();
    layout.slots.forEach((slot, i) => activeCanvas.add(buildPlaceholder(slotRect(slot, area), i)));
    const frame = activeCanvas.getObjects().find((o) => o.mmRole === "frame");
    if (frame) activeCanvas.bringObjectToFront(frame);
    activeCanvas.discardActiveObject?.();
    activeCanvas.requestRenderAll();
    manualSync?.();
    setOpen(false);
    toast({
      title: "Колаж готовий",
      description: "Натисніть на комірку (+), щоб додати фото. Потім фото можна рухати й масштабувати.",
      duration: 5000,
    });
  };

  const clearSlots = () => {
    if (!activeCanvas) return;
    activeCanvas.getObjects().filter((o) => o.mmRole === "slot").forEach((o) => activeCanvas.remove(o));
    activeCanvas.requestRenderAll();
    manualSync?.();
    setOpen(false);
  };

  return (
    <>
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFile} className="hidden" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" title="Колаж" className={RAIL_BTN}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Колаж</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={8} className="w-[262px] p-3">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">Колаж</p>
            <button
              type="button"
              onClick={clearSlots}
              className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors"
            >
              Прибрати комірки
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {COLLAGE_LAYOUTS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => apply(l)}
                title={l.label}
                className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card p-1.5 hover:border-violet-400/70 hover:bg-violet-50/50 transition-all"
              >
                <span
                  className="block w-full aspect-square"
                  dangerouslySetInnerHTML={{ __html: layoutThumb(l) }}
                />
                <span className="text-[8px] leading-none text-muted-foreground group-hover:text-violet-600 text-center truncate w-full">
                  {l.label}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground">
            Порада: спершу оберіть розкладку, тоді заповніть комірки фото. До колажу можна додати рамку.
          </p>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default CollageDropdownBtn;
