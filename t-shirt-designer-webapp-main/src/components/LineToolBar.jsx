import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Minus } from "lucide-react";

const LineToolBar = ({ manualSync }) => {
  const { selectedObject, activeCanvas } = useCanvas();
  const [color, setColor] = useState("#000000");
  const [strokeWidth, setStrokeWidth] = useState(3);

  useEffect(() => {
    if (selectedObject && selectedObject.type === "line") {
      setColor(selectedObject.stroke || "#000000");
      setStrokeWidth(selectedObject.strokeWidth || 3);
    }
  }, [selectedObject]);

  if (!selectedObject || selectedObject.type !== "line") {
    return null;
  }

  const handleColorChange = (e) => {
    if (!selectedObject || !activeCanvas) return;
    const newColor = e.target.value;
    setColor(newColor);
    selectedObject.set("stroke", newColor);
    activeCanvas.renderAll();
    manualSync();
  };

  const handleStrokeWidthChange = (e) => {
    if (!selectedObject || !activeCanvas) return;
    const newSize = parseInt(e.target.value, 10);
    if (isNaN(newSize) || newSize < 1) return;
    setStrokeWidth(newSize);
    selectedObject.set("strokeWidth", newSize);
    activeCanvas.renderAll();
    manualSync();
  };

  const fieldClass = "bg-sidebar-accent/60 border-sidebar-border text-sidebar-foreground rounded-lg";

  return (
    <div className="panel-section mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Minus className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-xs font-semibold text-sidebar-foreground">Редагувати лінію</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Колір</Label>
          <Input
            type="color"
            value={color}
            onChange={handleColorChange}
            className={`${fieldClass} h-9 p-1 cursor-pointer`}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Товщина</Label>
          <Input
            type="number"
            value={strokeWidth}
            min="1"
            onChange={handleStrokeWidthChange}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
};

export default LineToolBar;
