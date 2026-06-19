import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import * as fabric from "fabric";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_TYPES, DEFAULT_TEXT_CONFIG, CANVAS_CONFIG, buildCanvasView, buildSlimBookView, isBookType } from "../constants/designConstants";
import ProductCanvas from "./ProductCanvas";
import ProductControls from "./ProductControls";
import SaveDesign from "./SaveDesign";
import TextToolBar from "./TextToolBar";
import LineToolBar from "./LineToolBar";
import MaskDropdownBtn from "./MaskDropdownBtn";
import ObjectControls from "./ObjectControls";
import FillDropdownBtn from "./FillDropdownBtn";
import PropertiesBtn from "./PropertiesBtn";
import { setSelectedView } from "../features/tshirtSlice";
import { useCanvas } from "@/hooks/useCanvas";
import { useAddImage } from "@/hooks/useAddImage";
import canvasStorageManager from "@/utils/canvasStorageManager";
import { cn } from "@/lib/utils";
import { ImagePlus, Type, Slash, Trash, Trash2 } from "lucide-react";

// Кнопка інструмента по периметру редактора (іконка + підпис). На ПК — вертикальні
// ряди зліва/справа, на мобільному ряди стають горизонтальними над/під холстом.
const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all";
const RAIL_BTN_DANGER =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed";

const ToolBtn = ({ icon: Icon, label, onClick, danger, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={label}
    className={danger ? RAIL_BTN_DANGER : RAIL_BTN}
  >
    <Icon className="h-5 w-5" />
    <span className="text-[10px] font-medium leading-none">{label}</span>
  </button>
);

const DesignArea = ({ manualSync }) => {
  const dispatch = useDispatch();
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const canvasSize = useSelector((state) => state.tshirt.canvasSize);
  const slimBookFormat = useSelector((state) => state.tshirt.slimBookFormat);
  const { activeCanvas, selectedObject, setSelectedObject } = useCanvas();
  const { addImageFile } = useAddImage();
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  const views = Object.entries(product.views);
  // Полотно/Slim Book: зона друку залежить від обраного розміру/формату (пропорції).
  const dynamicView = useMemo(
    () =>
      selectedType === "canvas"
        ? buildCanvasView(canvasSize)
        : isBookType(selectedType)
        ? buildSlimBookView(slimBookFormat)
        : null,
    [selectedType, canvasSize, slimBookFormat]
  );
  const [dragOver, setDragOver] = useState(false);
  const [hasObjects, setHasObjects] = useState(false);
  const fileInputRef = useRef(null);

  // Поки на активному полотні порожньо — показуємо підказку «натисніть, щоб додати фото».
  useEffect(() => {
    const c = activeCanvas;
    if (!c) { setHasObjects(false); return; }
    const update = () => setHasObjects((c.getObjects?.().length || 0) > 0);
    update();
    c.on("object:added", update);
    c.on("object:removed", update);
    return () => {
      c.off("object:added", update);
      c.off("object:removed", update);
    };
  }, [activeCanvas]);

  // Delete / Backspace — видалення вибраного; стрілки — переміщення (Shift × 10px)
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (!activeCanvas) return;
      const obj = activeCanvas.getActiveObject();
      if (!obj) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        activeCanvas.remove(obj);
        activeCanvas.discardActiveObject();
        activeCanvas.renderAll();
        manualSync?.();
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        e.preventDefault();
        const [dx, dy] = moves[e.key];
        obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
        obj.setCoords();
        activeCanvas.renderAll();
        manualSync?.();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeCanvas, manualSync]);

  const getPrintableArea = () =>
    activeCanvas?.printArea || { left: 0, top: 0, width: CANVAS_CONFIG.width, height: CANVAS_CONFIG.height };

  const triggerFileInput = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) addImageFile(file);
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
      { stroke: "black", strokeWidth: 3, selectable: true, hasControls: true, strokeLineCap: "round" }
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
    manualSync?.();
  };

  const handleClearAll = () => {
    if (!activeCanvas) return;
    activeCanvas.clear();
    canvasStorageManager.clearCanvasStorage(selectedView, selectedType);
    activeCanvas.renderAll();
    manualSync?.();
  };

  const handleViewChange = (view) => {
    if (view !== selectedView) {
      if (activeCanvas) {
        activeCanvas.discardActiveObject();
        activeCanvas.renderAll();
      }
      setSelectedObject(null);
      dispatch(setSelectedView(view));
    }
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith("image/"))
      .forEach((f) => addImageFile(f));
  }, [addImageFile]);

  return (
    <div className="flex flex-col items-center w-full">
      <Card className="w-full border-border/60 shadow-soft rounded-2xl overflow-hidden">
        {/* ── Верх: товар + опції + сторони ── */}
        <div className="px-3 py-3 md:px-5 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50 border-b border-border/50 flex flex-wrap items-center justify-between gap-3">
          <ProductControls />
          {views.length > 1 && (
            <div className="flex gap-1.5 p-1 bg-white/70 rounded-xl">
              {views.map(([view, viewConfig]) => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={cn(
                    "rounded-lg h-8 px-4 text-xs font-medium transition-all",
                    selectedView === view
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-glow"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {viewConfig.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <CardContent className="p-3 md:p-5 bg-gradient-to-b from-card to-muted/20">
          {/* ── Периметр: зліва — додати, в центрі — холст, справа — дії ── */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-3">
            {/* ADD (ряд на мобільному / стовпчик зліва на ПК) */}
            <div className="flex flex-row lg:flex-col gap-1.5 justify-center lg:justify-start">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <ToolBtn icon={ImagePlus} label="Фото" onClick={triggerFileInput} />
              <ToolBtn icon={Type} label="Текст" onClick={handleAddText} />
              <ToolBtn icon={Slash} label="Лінія" onClick={handleAddLine} />
              <MaskDropdownBtn manualSync={manualSync} />
              <FillDropdownBtn manualSync={manualSync} />
            </div>

            {/* CANVAS + контекстне редагування */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-3">
              <div
                className="relative rounded-xl ring-1 ring-border/40 shadow-elevated overflow-hidden"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {views.map(([view, viewConfig]) => (
                  <div key={`${selectedType}-${view}`} className={view === selectedView ? "block" : "hidden"}>
                    <ProductCanvas view={view} viewConfig={dynamicView || viewConfig} />
                  </div>
                ))}
                {!hasObjects && !dragOver && (
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-white/30 hover:bg-violet-50/40 backdrop-blur-[1px] transition-colors cursor-pointer group"
                  >
                    <span className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-violet-400/80 bg-white/80 px-6 py-5 shadow-soft group-hover:border-violet-500 group-hover:shadow-elevated transition-all">
                      <ImagePlus className="h-9 w-9 text-violet-500" />
                      <span className="text-sm font-semibold text-violet-700">Натисніть, щоб додати фото</span>
                      <span className="text-[11px] text-muted-foreground">або перетягніть зображення сюди</span>
                      <span className="mt-1 max-w-[230px] text-center text-[10px] leading-snug text-amber-600">
                        Важливо: завантажуйте оригінал фото у високій якості — від цього залежить чіткість друку
                      </span>
                    </span>
                  </button>
                )}
                {dragOver && (
                  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-violet-600/20 backdrop-blur-[2px] border-2 border-dashed border-violet-500 pointer-events-none">
                    <ImagePlus className="h-10 w-10 text-violet-600 drop-shadow" />
                    <p className="text-sm font-semibold text-violet-700">Відпустіть фото тут</p>
                  </div>
                )}
              </div>

            </div>

            {/* ACTIONS (ряд на мобільному / стовпчик справа на ПК) */}
            <div className="flex flex-row lg:flex-col gap-1.5 justify-center lg:justify-start">
              <PropertiesBtn manualSync={manualSync} />
              <ObjectControls manualSync={manualSync} />
              <ToolBtn icon={Trash} label="Видалити" onClick={handleDelete} danger disabled={!selectedObject} />
              <ToolBtn icon={Trash2} label="Очистити" onClick={handleClearAll} danger />
              <SaveDesign className={RAIL_BTN} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DesignArea;
