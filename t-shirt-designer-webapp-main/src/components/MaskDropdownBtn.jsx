import { useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import * as fabric from "fabric";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Crop, Heart, Square, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

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
    // Зберігаємо базовий масштаб прямо в об'єкті — ImageMaskToolBar зчитає його
    // щоб ползунок завжди відраховував від «100% = щойно накладена маска»
    clipPath._baseScaleX = clipPath.scaleX || 1;
    clipPath._baseScaleY = clipPath.scaleY || 1;
  }

  return clipPath;
}

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed";

const SHAPE_BTN =
  "flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-xl border border-border/60 bg-card hover:border-violet-400/60 hover:bg-violet-50/60 text-foreground/70 hover:text-violet-600 transition-all";

const MaskDropdownBtn = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();
  const [open, setOpen] = useState(false);

  const isImage = selectedObject?.type === "image";

  const applyMask = (shapeType) => {
    if (!selectedObject || !activeCanvas) return;
    const clipPath = createMaskClipPath(shapeType, selectedObject.width, selectedObject.height);
    if (!clipPath) return;
    selectedObject.set({ clipPath });
    activeCanvas.renderAll();
    manualSync?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(v) => isImage && setOpen(v)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={isImage ? "Маска фото" : "Оберіть фото для маски"}
          disabled={!isImage}
          className={RAIL_BTN}
        >
          <Crop className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Маска</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-auto p-3">
        <p className="text-[11px] text-muted-foreground mb-2.5 font-semibold uppercase tracking-wider">
          Форма маски
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => applyMask(id)}
              className={SHAPE_BTN}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[9px] font-medium leading-none">{label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default MaskDropdownBtn;
