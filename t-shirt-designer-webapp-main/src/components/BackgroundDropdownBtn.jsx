import { useEffect, useState } from "react";
import * as fabric from "fabric";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ImageIcon, Ban, Loader2 } from "lucide-react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { fetchBackgrounds } from "@/utils/canvasSyncManager";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed";

// Абсолютний URL картинки фону: у проді /api → той самий домен; у деві → localhost:3001.
const API_ORIGIN = (import.meta.env.VITE_MARKETPLACE_API || "http://localhost:3001/api").replace(/\/api\/?$/, "");
const bgSrc = (url) => (!url ? "" : /^https?:\/\//.test(url) ? url : `${API_ORIGIN}${url}`);

// Готовий фон для альбому: лягає НИЖНІМ шаром на весь формат (cover), фіксований.
const BackgroundDropdownBtn = ({ manualSync }) => {
  const { activeCanvas } = useCanvas();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null); // null = ще не вантажили

  useEffect(() => {
    if (open && items === null) fetchBackgrounds().then((r) => setItems(r || [])).catch(() => setItems([]));
  }, [open, items]);

  const getArea = () =>
    activeCanvas?.printArea || {
      left: 0, top: 0,
      width: activeCanvas?.getWidth?.() || CANVAS_CONFIG.width,
      height: activeCanvas?.getHeight?.() || CANVAS_CONFIG.height,
    };

  // Фон завжди має лишатись позаду інших обʼєктів (навіть якщо фото додали пізніше).
  useEffect(() => {
    if (!activeCanvas) return;
    const toBack = (e) => {
      const bg = activeCanvas.getObjects().find((o) => o.mmRole === "background");
      if (bg && e?.target !== bg) activeCanvas.sendObjectToBack?.(bg);
    };
    activeCanvas.on("object:added", toBack);
    return () => activeCanvas.off("object:added", toBack);
  }, [activeCanvas]);

  const removeBackground = (canvas) =>
    canvas.getObjects().filter((o) => o.mmRole === "background").forEach((o) => canvas.remove(o));

  const apply = (bg) => {
    if (!activeCanvas) return;
    setOpen(false);
    removeBackground(activeCanvas);
    if (!bg) { // «Без фону»
      activeCanvas.requestRenderAll();
      manualSync?.();
      return;
    }
    const area = getArea();
    const imgEl = new Image();
    imgEl.crossOrigin = "anonymous";
    imgEl.onload = () => {
      const img = new fabric.Image(imgEl);
      const scale = Math.max(area.width / img.width, area.height / img.height); // cover на весь формат
      img.scale(scale);
      img.set({
        left: area.left + (area.width - img.getScaledWidth()) / 2,
        top: area.top + (area.height - img.getScaledHeight()) / 2,
        selectable: false, evented: false, objectCaching: false,
      });
      img.clipPath = new fabric.Rect({
        left: area.left, top: area.top, width: area.width, height: area.height, absolutePositioned: true,
      });
      img.mmRole = "background";
      activeCanvas.add(img);
      activeCanvas.sendObjectToBack?.(img);
      activeCanvas.discardActiveObject?.();
      activeCanvas.requestRenderAll();
      manualSync?.();
    };
    imgEl.onerror = () => {};
    imgEl.src = bgSrc(bg.image_url);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Фон" className={RAIL_BTN}>
          <ImageIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Фон</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[296px] p-3">
        <p className="text-[11px] text-muted-foreground mb-2.5 font-semibold uppercase tracking-wider">Фон альбому</p>
        {items === null ? (
          <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5">
            <button
              type="button"
              onClick={() => apply(null)}
              title="Без фону"
              className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card p-1 hover:border-violet-400/70 hover:bg-violet-50/50 transition-all"
            >
              <span className="w-full aspect-square rounded-md bg-white ring-1 ring-border/40 flex items-center justify-center">
                <Ban className="h-5 w-5 text-muted-foreground" />
              </span>
              <span className="text-[8px] leading-none text-muted-foreground text-center">Без фону</span>
            </button>
            {items.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => apply(b)}
                title={b.name || "Фон"}
                className="group rounded-lg border border-border/60 bg-card p-1 hover:border-violet-400/70 hover:bg-violet-50/50 transition-all"
              >
                <span className="block w-full aspect-square rounded-md overflow-hidden bg-white ring-1 ring-border/40">
                  <img src={bgSrc(b.image_url)} alt={b.name || ""} className="w-full h-full object-cover" />
                </span>
              </button>
            ))}
          </div>
        )}
        {items && items.length === 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">Фонів ще немає — додайте їх в адмінці (розділ «Фони»).</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default BackgroundDropdownBtn;
