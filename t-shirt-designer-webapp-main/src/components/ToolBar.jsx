import { useDispatch, useSelector } from "react-redux";
import * as fabric from "fabric";
import { Button } from "@/components/ui/button";
import { ImagePlus, Palette, Slash, Trash, Trash2, Type } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  CANVAS_CONFIG,
  DEFAULT_TEXT_CONFIG,
  PRODUCT_TYPES,
  TSHIRT_COLOR_CODES,
  TSHIRT_SIZES,
  PAPER_TYPES,
  productHasSize,
  productHasPaper,
} from "../constants/designConstants";

import { setSelectedType, setTshirtColor, setSize, setPaperType } from "../features/tshirtSlice";
import { useRef } from "react";
import SaveDesign from "./SaveDesign";
import { useCanvas } from "@/hooks/useCanvas";
import canvasStorageManager from "@/utils/canvasStorageManager";

import { useToast } from "@/hooks/use-toast";
import { DESIGNER_CONFIG } from "../config/designer.config";
import { cn } from "@/lib/utils";

const toolBtnClass =
  "w-full justify-start gap-2.5 rounded-lg h-9 text-sidebar-foreground/90 bg-sidebar-accent/50 border border-sidebar-border/50 hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-sidebar-primary/30 transition-all";

const ToolBar = ({ manualSync }) => {
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const size = useSelector((state) => state.tshirt.size);
  const paperType = useSelector((state) => state.tshirt.paperType);
  const { activeCanvas, selectedObject } = useCanvas();
  const { toast } = useToast();

  const handleTypeChange = (value) => {
    dispatch(setSelectedType(value));
  };

  const handleColorChange = (color) => {
    dispatch(setTshirtColor(color));
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getPrintableArea = () =>
    activeCanvas?.printArea || {
      left: 0,
      top: 0,
      width: CANVAS_CONFIG.width,
      height: CANVAS_CONFIG.height,
    };

  const handleAddImage = (e) => {
    if (!activeCanvas || !e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target.result;

      imgObj.onload = () => {
        if (
          imgObj.width < DESIGNER_CONFIG.minWidthPx ||
          imgObj.height < DESIGNER_CONFIG.minHeightPx
        ) {
          toast({
            variant: "destructive",
            title: "Низкое качество (DPI)",
            description: `Разрешение загруженного файла ${imgObj.width}x${imgObj.height} px. Рекомендуется минимум ${DESIGNER_CONFIG.minWidthPx}x${DESIGNER_CONFIG.minHeightPx} px для качественной печати.`,
          });
        }

        const image = new fabric.Image(imgObj);

        const printArea = getPrintableArea();
        const maxWidth = printArea.width;
        const maxHeight = printArea.height;

        if (image.width > maxWidth || image.height > maxHeight) {
          const scale = Math.min(
            maxWidth / image.width,
            maxHeight / image.height
          );
          image.scale(scale);
        }

        image.set({
          left: printArea.left + (printArea.width - image.getScaledWidth()) / 2,
          top: printArea.top + (printArea.height - image.getScaledHeight()) / 2,
        });

        activeCanvas.add(image);
        activeCanvas.setActiveObject(image);
        activeCanvas.renderAll();
      };
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleAddText = () => {
    if (!activeCanvas) return;
    const printArea = getPrintableArea();

    const text = new fabric.Textbox("Додайте свій текст тут...", {
      ...DEFAULT_TEXT_CONFIG,
      left: printArea.left + printArea.width / 2,
      top: printArea.top + printArea.height / 2,
      width: Math.min(220, printArea.width * 0.8),
      editable: false,
    });

    activeCanvas.add(text);
    activeCanvas.setActiveObject(text);
    activeCanvas.renderAll();
  };

  const handleAddLine = () => {
    if (!activeCanvas) return;
    const printArea = getPrintableArea();

    const lineY = printArea.top + printArea.height / 2;
    const line = new fabric.Line(
      [
        printArea.left + printArea.width * 0.25,
        lineY,
        printArea.left + printArea.width * 0.75,
        lineY,
      ],
      {
        stroke: "black",
        strokeWidth: 3,
        selectable: true,
        hasControls: true,
        strokeLineCap: "round",
      }
    );

    activeCanvas.add(line);
    activeCanvas.setActiveObject(line);
    activeCanvas.renderAll();
  };

  const handleDelete = () => {
    if (!activeCanvas || !selectedObject) return;

    activeCanvas.remove(selectedObject);
    activeCanvas.discardActiveObject();
    activeCanvas.renderAll();
    manualSync();
  };

  const handleClearAll = () => {
    if (!activeCanvas) return;

    activeCanvas.clear();
    canvasStorageManager.clearCanvasStorage(selectedView, selectedType);
    activeCanvas.renderAll();
    manualSync();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Product selector */}
      <div className="panel-section space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Продукт
        </p>
        <Select value={selectedType} onValueChange={handleTypeChange}>
          <SelectTrigger className="w-full bg-sidebar-accent/60 border-sidebar-border text-sidebar-foreground rounded-lg h-9">
            <SelectValue placeholder="Оберіть продукт" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(PRODUCT_TYPES).map(([value, { name }]) => (
                <SelectItem key={value} value={value}>
                  {name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Розмір — лише для футболки */}
      {productHasSize(selectedType) && (
        <div className="panel-section space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Розмір
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TSHIRT_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => dispatch(setSize(s))}
                className={cn(
                  "h-9 min-w-9 px-2.5 rounded-lg text-sm font-medium border transition-all",
                  size === s
                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-glow"
                    : "bg-sidebar-accent/50 text-sidebar-foreground/90 border-sidebar-border/50 hover:bg-sidebar-accent hover:border-sidebar-primary/30"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Тип паперу — для фотоформатів */}
      {productHasPaper(selectedType) && (
        <div className="panel-section space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
            Тип паперу
          </p>
          <Select value={paperType} onValueChange={(v) => dispatch(setPaperType(v))}>
            <SelectTrigger className="w-full bg-sidebar-accent/60 border-sidebar-border text-sidebar-foreground rounded-lg h-9">
              <SelectValue placeholder="Оберіть папір" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PAPER_TYPES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Tools */}
      <div className="panel-section space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Додати
        </p>
        <div className="flex flex-col gap-1.5">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleAddImage}
            className="hidden"
          />
          <Button onClick={triggerFileInput} variant="ghost" className={toolBtnClass}>
            <ImagePlus className="h-4 w-4 text-violet-400" />
            <span>Зображення</span>
          </Button>
          <Button onClick={handleAddText} variant="ghost" className={toolBtnClass}>
            <Type className="h-4 w-4 text-violet-400" />
            <span>Текст</span>
          </Button>
          <Button onClick={handleAddLine} variant="ghost" className={toolBtnClass}>
            <Slash className="h-4 w-4 text-violet-400" />
            <span>Лінія</span>
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={toolBtnClass}>
                <Palette className="h-4 w-4 text-violet-400" />
                <span>Колір</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 rounded-xl" side="right" align="start">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-sm">Оберіть колір</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Базовий колір макета
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {TSHIRT_COLOR_CODES.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={cn(
                        "w-8 h-8 rounded-full border-2 border-white shadow-sm",
                        "hover:scale-110 hover:shadow-md transition-transform ring-1 ring-border/50"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Actions */}
      <div className="panel-section space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          Дії
        </p>
        <div className="flex flex-col gap-1.5">
          <Button
            onClick={handleDelete}
            variant="ghost"
            className="w-full justify-start gap-2.5 rounded-lg h-9 text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash className="h-4 w-4" />
            <span>Видалити</span>
          </Button>
          <Button
            onClick={handleClearAll}
            variant="ghost"
            className="w-full justify-start gap-2.5 rounded-lg h-9 text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
            <span>Очистити все</span>
          </Button>
        </div>
      </div>

      <SaveDesign />
    </div>
  );
};

export default ToolBar;
