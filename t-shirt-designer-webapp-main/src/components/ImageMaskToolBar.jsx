import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCanvas } from "@/hooks/useCanvas";
import * as fabric from "fabric";
import { ImageIcon, Move, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

const maskBtnClass =
  "rounded-lg h-8 text-xs bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground/90 hover:bg-sidebar-accent hover:border-sidebar-primary/30";

const ImageMaskToolBar = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();
  // Режим «рухати маску»: тягнемо мишею — зміщується clipPath відносно фото.
  const [moveMask, setMoveMask] = useState(false);

  // Зміна вибраного об'єкта скидає режим руху маски.
  useEffect(() => {
    setMoveMask(false);
  }, [selectedObject]);

  // Прив'язка перетягування, поки активний режим руху маски.
  useEffect(() => {
    if (
      !moveMask ||
      !activeCanvas ||
      !selectedObject ||
      selectedObject.type !== "image" ||
      !selectedObject.clipPath
    ) {
      return;
    }

    const img = selectedObject;
    // Фіксуємо саме зображення, щоб тягнулась маска, а не фото.
    const prev = { x: img.lockMovementX, y: img.lockMovementY };
    img.lockMovementX = true;
    img.lockMovementY = true;

    let dragging = false;
    let last = null;

    const point = (e) =>
      activeCanvas.getScenePoint ? activeCanvas.getScenePoint(e) : activeCanvas.getPointer(e);

    // Канвасні пікселі → локальні пікселі зображення (з урахуванням масштабу й кута).
    const toLocal = (dx, dy) => {
      const sx = img.scaleX || 1;
      const sy = img.scaleY || 1;
      const rad = -((img.angle || 0) * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return { x: (dx * cos - dy * sin) / sx, y: (dx * sin + dy * cos) / sy };
    };

    const onDown = (opt) => {
      if (opt.target !== img) return;
      dragging = true;
      last = point(opt.e);
    };
    const onMove = (opt) => {
      if (!dragging || !img.clipPath) return;
      const p = point(opt.e);
      const d = toLocal(p.x - last.x, p.y - last.y);
      last = p;
      img.clipPath.left = (img.clipPath.left || 0) + d.x;
      img.clipPath.top = (img.clipPath.top || 0) + d.y;
      img.dirty = true; // скинути кеш промальовки, інакше маска не зрушиться
      activeCanvas.requestRenderAll();
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      manualSync();
    };

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

  if (!selectedObject || selectedObject.type !== "image") {
    return null;
  }

  const hasMask = Boolean(selectedObject.clipPath);

  const applyMask = (shapeType) => {
    if (!selectedObject || !activeCanvas) return;

    const width = selectedObject.width;
    const height = selectedObject.height;

    let clipPath = null;

    if (shapeType === "circle") {
      const radius = Math.min(width, height) / 2;
      clipPath = new fabric.Circle({
        radius: radius,
        originX: "center",
        originY: "center",
      });
    } else if (shapeType === "oval") {
      clipPath = new fabric.Ellipse({
        rx: width / 2,
        ry: height / 2,
        originX: "center",
        originY: "center",
      });
    } else if (shapeType === "square") {
      const size = Math.min(width, height);
      clipPath = new fabric.Rect({
        width: size,
        height: size,
        originX: "center",
        originY: "center",
      });
    } else if (shapeType === "heart") {
      const size = Math.min(width, height);
      const path = "M 10,30 A 20,20 0,0,1 50,30 A 20,20 0,0,1 90,30 Q 90,60 50,90 Q 10,60 10,30 z";

      clipPath = new fabric.Path(path, {
        originX: "center",
        originY: "center",
      });

      const bbox = clipPath.getBoundingRect();
      const scale = size / Math.max(bbox.width, bbox.height);
      clipPath.scaleX = scale;
      clipPath.scaleY = scale;
    }

    selectedObject.set({ clipPath: clipPath });
    activeCanvas.renderAll();
    manualSync();
  };

  const centerMask = () => {
    if (!selectedObject?.clipPath || !activeCanvas) return;
    selectedObject.clipPath.left = 0;
    selectedObject.clipPath.top = 0;
    selectedObject.dirty = true;
    activeCanvas.renderAll();
    manualSync();
  };

  const removeMask = () => {
    if (!selectedObject || !activeCanvas) return;
    setMoveMask(false);
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

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { id: "circle", label: "Коло" },
          { id: "oval", label: "Овал" },
          { id: "square", label: "Квадрат" },
          { id: "heart", label: "Серце" },
        ].map(({ id, label }) => (
          <Button
            key={id}
            size="sm"
            variant="outline"
            className={maskBtnClass}
            onClick={() => applyMask(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {hasMask && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMoveMask((v) => !v)}
              className={cn(
                maskBtnClass,
                moveMask &&
                  "bg-violet-500/20 border-violet-400/50 text-violet-200 hover:bg-violet-500/30"
              )}
            >
              <Move className="h-3.5 w-3.5" />
              {moveMask ? "Готово" : "Рухати маску"}
            </Button>
            <Button size="sm" variant="outline" className={maskBtnClass} onClick={centerMask}>
              <Crosshair className="h-3.5 w-3.5" />
              Центрувати
            </Button>
          </div>
          {moveMask && (
            <p className="text-[11px] leading-snug text-sidebar-foreground/60">
              Перетягуйте фото мишею — рухатиметься маска відносно зображення.
            </p>
          )}
        </>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={removeMask}
        className={cn(maskBtnClass, "w-full text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:text-red-300")}
      >
        Зняти маску
      </Button>
    </div>
  );
};

export default ImageMaskToolBar;
