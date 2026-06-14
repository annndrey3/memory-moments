import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCanvas } from "@/hooks/useCanvas";
import * as fabric from "fabric";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const maskBtnClass =
  "rounded-lg h-8 text-xs bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground/90 hover:bg-sidebar-accent hover:border-sidebar-primary/30";

const ImageMaskToolBar = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();

  if (!selectedObject || selectedObject.type !== "image") {
    return null;
  }

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

  const removeMask = () => {
    if (!selectedObject || !activeCanvas) return;
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
