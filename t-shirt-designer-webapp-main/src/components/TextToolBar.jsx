import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

import { FONT_OPTIONS } from "../constants/designConstants";
import { useCanvas } from "@/hooks/useCanvas";
import { Type } from "lucide-react";

const TextToolBar = ({ manualSync }) => {
  const { activeCanvas, selectedObject } = useCanvas();

  const [text, setText] = useState("");
  const [color, setColor] = useState("#000000");
  const [font, setFont] = useState("arial");
  const [fontSize, setFontSize] = useState(20);

  useEffect(() => {
    if (selectedObject && selectedObject.type === "textbox") {
      setText(selectedObject.text || "");
      setColor(selectedObject.fill || "#000000");
      setFont(selectedObject.fontFamily || "arial");
      setFontSize(selectedObject.fontSize || 20);
    }
  }, [selectedObject]);

  if (!selectedObject || selectedObject.type !== "textbox") {
    return null;
  }

  const handleColorChange = (e) => {
    if (!selectedObject || !activeCanvas) return;
    const newColor = e.target.value;
    setColor(newColor);
    selectedObject.set("fill", newColor);
    activeCanvas.renderAll();
    manualSync();
  };

  const handleTextChange = (e) => {
    if (!selectedObject || !activeCanvas) return;
    const newText = e.target.value;
    setText(newText);
    selectedObject.set("text", newText);
    activeCanvas.renderAll();
    manualSync();
  };

  const handleFontChange = (newFont) => {
    if (!selectedObject || !activeCanvas) return;
    setFont(newFont);
    selectedObject.set("fontFamily", newFont);
    activeCanvas.renderAll();
    manualSync();
  };

  const handleFontSizeChange = (e) => {
    if (!selectedObject || !activeCanvas) return;
    const newSize = parseInt(e.target.value, 10);
    if (isNaN(newSize) || newSize < 1) return;
    setFontSize(newSize);
    selectedObject.set("fontSize", newSize);
    activeCanvas.renderAll();
    manualSync();
  };

  const fieldClass = "bg-sidebar-accent/60 border-sidebar-border text-sidebar-foreground rounded-lg";

  return (
    <div className="panel-section mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Type className="h-3.5 w-3.5 text-violet-400" />
        <p className="text-xs font-semibold text-sidebar-foreground">Редагувати текст</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Текст</Label>
        <Input
          className={fieldClass}
          type="text"
          value={text}
          onChange={handleTextChange}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Шрифт</Label>
        <Select value={font} onValueChange={handleFontChange}>
          <SelectTrigger className={fieldClass}>
            <SelectValue placeholder="Оберіть шрифт" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {FONT_OPTIONS.map((font) => (
                <SelectItem key={font.value} value={font.value}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Розмір</Label>
          <Input
            type="number"
            value={fontSize}
            min="1"
            onChange={handleFontSizeChange}
            className={fieldClass}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50">Колір</Label>
          <Input
            type="color"
            value={color}
            onChange={handleColorChange}
            className={`${fieldClass} h-9 p-1 cursor-pointer`}
          />
        </div>
      </div>
    </div>
  );
};

export default TextToolBar;
