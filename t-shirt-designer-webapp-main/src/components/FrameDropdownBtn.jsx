import { useEffect, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Frame, Ban } from "lucide-react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { FRAMES, buildFrameObjects, frameThumbSvg } from "@/constants/frames";

import { RAIL_BTN } from "@/components/ui/railButton";

const FrameDropdownBtn = ({ manualSync }) => {
  const { activeCanvas } = useCanvas();
  const [open, setOpen] = useState(false);

  const getArea = () =>
    activeCanvas?.printArea || {
      left: 0, top: 0,
      width: activeCanvas?.getWidth?.() || CANVAS_CONFIG.width,
      height: activeCanvas?.getHeight?.() || CANVAS_CONFIG.height,
    };

  // Рамка завжди має лишатися поверх інших обʼєктів — навіть якщо фото додали пізніше.
  // Підписи полароїда тримаємо ще вище — інакше біла смуга рамки сховала б їх.
  useEffect(() => {
    if (!activeCanvas) return;
    const toFront = (e) => {
      const objs = activeCanvas.getObjects();
      const frame = objs.find((o) => o.mmRole === "frame");
      if (frame && e?.target !== frame) {
        activeCanvas.bringObjectToFront?.(frame);
        objs.filter((o) => o.mmRole === "caption").forEach((c) => activeCanvas.bringObjectToFront?.(c));
      }
    };
    activeCanvas.on("object:added", toFront);
    return () => activeCanvas.off("object:added", toFront);
  }, [activeCanvas]);

  const removeFrame = (canvas) => {
    canvas.getObjects().filter((o) => o.mmRole === "frame").forEach((o) => canvas.remove(o));
  };

  const apply = (frame) => {
    if (!activeCanvas) return;
    removeFrame(activeCanvas);
    if (frame.id !== "none" && frame.spec) {
      const group = buildFrameObjects(frame.spec, getArea(), frame.id);
      activeCanvas.add(group);
      activeCanvas.bringObjectToFront?.(group);
      // підписи (полароїд) лишаються поверх щойно доданої рамки
      activeCanvas.getObjects().filter((o) => o.mmRole === "caption").forEach((c) => activeCanvas.bringObjectToFront?.(c));
    }
    activeCanvas.discardActiveObject?.();
    activeCanvas.requestRenderAll?.();
    manualSync?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Рамка" className={RAIL_BTN}>
          <Frame className="h-3.5 w-3.5" />
          <span className="text-[10px] font-medium leading-none">Рамка</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-[296px] p-3">
        <p className="text-[11px] text-muted-foreground mb-2.5 font-semibold uppercase tracking-wider">
          Рамка
        </p>
        <div className="grid grid-cols-4 gap-1.5 max-h-[340px] overflow-y-auto pr-0.5">
          {FRAMES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => apply(f)}
              title={f.label}
              className="group flex flex-col items-center gap-1 rounded-lg border border-border/60 bg-card p-1 hover:border-violet-400/70 hover:bg-violet-50/50 transition-all"
            >
              <span className="w-full aspect-square rounded-md overflow-hidden bg-white ring-1 ring-border/40 flex items-center justify-center">
                {f.id === "none" ? (
                  <Ban className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <span
                    className="block w-full h-full"
                    dangerouslySetInnerHTML={{ __html: frameThumbSvg(f.spec) }}
                  />
                )}
              </span>
              <span className="text-[8px] leading-none text-muted-foreground group-hover:text-violet-600 text-center truncate w-full">
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FrameDropdownBtn;
