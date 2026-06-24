import { useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { useCanvas } from "@/hooks/useCanvas";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LayoutGrid, ImagePlus } from "lucide-react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { COLLAGE_LAYOUTS, slotRect } from "@/constants/collageLayouts";

import { RAIL_BTN } from "@/components/ui/railButton";

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
  const multiInputRef = useRef(null); // «Заповнити всі» — кілька фото одразу
  const pendingRef = useRef(null); // { rect, placeholder }

  const getArea = () =>
    activeCanvas?.printArea || {
      left: 0, top: 0,
      width: activeCanvas?.getWidth?.() || CANVAS_CONFIG.width,
      height: activeCanvas?.getHeight?.() || CANVAS_CONFIG.height,
    };

  // Клік по порожній комірці → вибір файлу для саме цієї комірки.
  // Діалог відкриваємо на mouse:UP і лише якщо вказівник майже не зрушив (це КЛІК,
  // а не перетяг/тач-скрол) — інакше випадковий рух по комірці відкривав би OS-діалог.
  // GLITCH-FIX: OS-діалог вибору файлу перехоплює mouseup → fabric лишається в стані
  // «кнопку затиснуто». Тому коли вікно знову отримує фокус (діалог закрито — і при
  // виборі, і при «Скасувати»), примусово завершуємо будь-яку завислу взаємодію fabric.
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
    let downSlot = null, downX = 0, downY = 0;
    const onDown = (opt) => {
      const tgt = opt.target;
      if (!tgt || tgt.mmRole !== "slot") { downSlot = null; return; }
      downSlot = tgt;
      downX = opt.e?.clientX ?? 0;
      downY = opt.e?.clientY ?? 0;
    };
    const onUp = (opt) => {
      const slot = downSlot;
      downSlot = null;
      if (!slot || opt.target !== slot) return; // відпустили не над тією ж коміркою
      const moved = Math.hypot((opt.e?.clientX ?? 0) - downX, (opt.e?.clientY ?? 0) - downY);
      if (moved > 6) return; // був перетяг/скрол, а не клік
      const br = slot.getBoundingRect();
      pendingRef.current = {
        rect: { left: br.left, top: br.top, width: br.width, height: br.height },
        placeholder: slot,
      };
      fileInputRef.current?.click();
      window.addEventListener("focus", heal, { once: true });
    };
    activeCanvas.on("mouse:down", onDown);
    activeCanvas.on("mouse:up", onUp);
    return () => {
      activeCanvas.off("mouse:down", onDown);
      activeCanvas.off("mouse:up", onUp);
    };
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

  // Замінити/прибрати фото в комірці: коли видаляють фото колажу, повертаємо порожню
  // комірку (плейсхолдер) на те саме місце — щоб одразу можна було додати інше фото.
  // НЕ спрацьовує під час «Очистити весь макет» (там виставлено прапорець suppress).
  useEffect(() => {
    if (!activeCanvas) return;
    const onRemoved = (e) => {
      const o = e?.target;
      if (!o || o.mmRole !== "photo" || !o.mmSlotRect) return;
      if (activeCanvas._mmSuppressSlotRestore) return;
      if (activeCanvas.getObjects().some((x) => x.mmRole === "slot" && x.mmSlot === o.mmSlot)) return;
      activeCanvas.add(buildPlaceholder(o.mmSlotRect, o.mmSlot));
      const frame = activeCanvas.getObjects().find((x) => x.mmRole === "frame");
      if (frame) activeCanvas.bringObjectToFront(frame);
      activeCanvas.requestRenderAll();
    };
    activeCanvas.on("object:removed", onRemoved);
    return () => activeCanvas.off("object:removed", onRemoved);
  }, [activeCanvas]);

  // Вставляє одне фото у комірку (rect) і повертає Promise. Спільне для одиночного
  // кліку та масового «Заповнити всі». Тегуємо фото номером комірки + її прямокутником,
  // щоб уміти відновити порожню комірку при видаленні фото (заміна/прибирання).
  const placeImage = (file, r, slotIndex, { activate = true } = {}) =>
    new Promise((resolve) => {
      if (!file || !activeCanvas) return resolve(null);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const imgEl = new Image();
        imgEl.onload = () => {
          const img = new fabric.Image(imgEl);
          const scale = Math.max(r.width / img.width, r.height / img.height); // cover
          img.scale(scale);
          img.set({
            left: r.left + (r.width - img.getScaledWidth()) / 2,
            top: r.top + (r.height - img.getScaledHeight()) / 2,
            // Без растрового кешу: absolutePositioned-кліп перемальовується наживо
            // при перетягуванні, а perPixelTargetFind перевіряє видиму (обрізану) частину.
            objectCaching: false,
          });
          // Кадрування по комірці — фіксоване «вікно» в координатах полотна.
          img.clipPath = new fabric.Rect({
            left: r.left, top: r.top, width: r.width, height: r.height, absolutePositioned: true,
          });
          // perPixelTargetFind: фото «cover» вилазить за комірку й накриває сусідні —
          // хіт-детект по видимому пікселю не дає вхопити чуже фото.
          img.perPixelTargetFind = true;
          img.mmRole = "photo";
          img.mmSlot = slotIndex;
          img.mmSlotRect = { left: r.left, top: r.top, width: r.width, height: r.height };
          // прибрати плейсхолдер цієї комірки (за номером — надійніше)
          const ph = activeCanvas.getObjects().find((o) => o.mmRole === "slot" && o.mmSlot === slotIndex);
          if (ph) activeCanvas.remove(ph);
          activeCanvas.add(img);
          const frame = activeCanvas.getObjects().find((o) => o.mmRole === "frame");
          if (frame) activeCanvas.bringObjectToFront(frame);
          if (activate) activeCanvas.setActiveObject(img);
          activeCanvas.requestRenderAll();
          resolve(img);
        };
        imgEl.onerror = () => resolve(null);
        imgEl.src = ev.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  // Клік по одній комірці → одне фото саме в неї.
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const pend = pendingRef.current;
    pendingRef.current = null;
    if (!file || !pend || !activeCanvas) return;
    placeImage(file, pend.rect, pend.placeholder?.mmSlot ?? null).then(() => manualSync?.());
  };

  // «Заповнити всі»: обрати кілька фото → розкласти по ПОРОЖНІХ комірках за порядком.
  const handleFillAll = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length || !activeCanvas) return;
    const slots = activeCanvas.getObjects()
      .filter((o) => o.mmRole === "slot")
      .sort((a, b) => (a.mmSlot ?? 0) - (b.mmSlot ?? 0));
    if (!slots.length) {
      toast({ title: "Спершу оберіть розкладку", description: "Виберіть сітку колажу, тоді заповнюйте комірки.", duration: 4000 });
      return;
    }
    const n = Math.min(files.length, slots.length);
    for (let i = 0; i < n; i++) {
      const br = slots[i].getBoundingRect();
      await placeImage(files[i], { left: br.left, top: br.top, width: br.width, height: br.height }, slots[i].mmSlot, { activate: false });
    }
    activeCanvas.discardActiveObject();
    activeCanvas.requestRenderAll();
    manualSync?.();
    setOpen(false);
    toast({
      title: "Комірки заповнено",
      description: files.length > slots.length
        ? `Розкладено ${n} фото; зайвих фото: ${files.length - n}.`
        : `Розкладено ${n} фото. Кожне можна рухати й масштабувати.`,
      duration: 4000,
    });
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
      <input type="file" accept="image/*" multiple ref={multiInputRef} onChange={handleFillAll} className="hidden" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" title="Колаж" className={RAIL_BTN}>
            <LayoutGrid className="h-3.5 w-3.5" />
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
          <div className="grid grid-cols-3 gap-2 max-h-[320px] overflow-y-auto pr-1 -mr-1">
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
          <button
            type="button"
            onClick={() => multiInputRef.current?.click()}
            className="mt-2.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold h-9 transition-colors"
          >
            <ImagePlus className="h-4 w-4" /> Заповнити всі комірки…
          </button>
          <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
            Оберіть розкладку → «Заповнити всі» (кілька фото одразу) або тисніть на комірку (+).
            Фото можна рухати/масштабувати; видалите фото — комірка повернеться.
          </p>
        </PopoverContent>
      </Popover>
    </>
  );
};

export default CollageDropdownBtn;
