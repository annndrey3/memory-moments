import { useState } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import * as fabric from "fabric";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PaintBucket } from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all";

const TAB_ACTIVE = "flex-1 py-1.5 text-xs font-semibold rounded-lg bg-white text-violet-700 shadow-sm transition-all";
const TAB_IDLE   = "flex-1 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground transition-all";

const ADD_BTN =
  "w-full mt-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold transition-colors";

const GRAD_DIRS = [
  { id: "h",  label: "↔ Горизонт.", coords: { x1: 0, y1: 0, x2: 1, y2: 0 } },
  { id: "v",  label: "↕ Вертикал.", coords: { x1: 0, y1: 0, x2: 0, y2: 1 } },
  { id: "d",  label: "↗ Діагональ", coords: { x1: 0, y1: 0, x2: 1, y2: 1 } },
];

export default function FillDropdownBtn({ manualSync }) {
  const { activeCanvas } = useCanvas();
  const [open, setOpen] = useState(false);
  const [tab, setTab]   = useState("solid"); // "solid" | "gradient"

  // Solid state
  const [solidColor, setSolidColor] = useState("#7c3aed");

  // Gradient state
  const [gradColor1, setGradColor1] = useState("#7c3aed");
  const [gradColor2, setGradColor2] = useState("#ec4899");
  const [gradDir,    setGradDir]    = useState("h");

  const getPrintArea = () =>
    activeCanvas?.printArea || { left: 0, top: 0, width: 450, height: 500 };

  const addSolid = () => {
    if (!activeCanvas) return;
    const pa = getPrintArea();
    const rect = new fabric.Rect({
      left: pa.left, top: pa.top,
      width: pa.width, height: pa.height,
      fill: solidColor,
      selectable: true, hasControls: true,
      originX: "left", originY: "top",
    });
    activeCanvas.add(rect);
    activeCanvas.setActiveObject(rect);
    activeCanvas.renderAll();
    manualSync?.();
    setOpen(false);
  };

  const addGradient = () => {
    if (!activeCanvas) return;
    const pa = getPrintArea();
    const dir = GRAD_DIRS.find((d) => d.id === gradDir) || GRAD_DIRS[0];
    const gradient = new fabric.Gradient({
      type: "linear",
      gradientUnits: "percentage",
      coords: dir.coords,
      colorStops: [
        { offset: 0, color: gradColor1 },
        { offset: 1, color: gradColor2 },
      ],
    });
    const rect = new fabric.Rect({
      left: pa.left, top: pa.top,
      width: pa.width, height: pa.height,
      fill: gradient,
      selectable: true, hasControls: true,
      originX: "left", originY: "top",
    });
    activeCanvas.add(rect);
    activeCanvas.setActiveObject(rect);
    activeCanvas.renderAll();
    manualSync?.();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" title="Заливка / Градієнт" className={RAIL_BTN}>
          <PaintBucket className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Заливка</span>
        </button>
      </PopoverTrigger>

      <PopoverContent side="right" align="start" sideOffset={8} className="w-56 p-3">
        {/* Tabs */}
        <div className="flex gap-1 bg-muted/60 rounded-xl p-1 mb-3">
          <button type="button" onClick={() => setTab("solid")}    className={tab === "solid"    ? TAB_ACTIVE : TAB_IDLE}>Колір</button>
          <button type="button" onClick={() => setTab("gradient")} className={tab === "gradient" ? TAB_ACTIVE : TAB_IDLE}>Градієнт</button>
        </div>

        {tab === "solid" ? (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Колір заливки</p>
            <input
              type="color"
              value={solidColor}
              onChange={(e) => setSolidColor(e.target.value)}
              className="w-full h-10 rounded-lg border border-border cursor-pointer"
            />
            <button type="button" onClick={addSolid} className={ADD_BTN}>
              Додати заливку
            </button>
          </>
        ) : (
          <>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">Кольори</p>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <span className="text-[9px] text-muted-foreground">Початок</span>
                <input
                  type="color"
                  value={gradColor1}
                  onChange={(e) => setGradColor1(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border cursor-pointer"
                />
              </div>
              <div className="flex-1 space-y-1">
                <span className="text-[9px] text-muted-foreground">Кінець</span>
                <input
                  type="color"
                  value={gradColor2}
                  onChange={(e) => setGradColor2(e.target.value)}
                  className="w-full h-8 rounded-lg border border-border cursor-pointer"
                />
              </div>
            </div>

            {/* Preview */}
            <div
              className="mt-2 h-6 w-full rounded-md border border-border/50"
              style={{
                background: gradDir === "h"
                  ? `linear-gradient(to right, ${gradColor1}, ${gradColor2})`
                  : gradDir === "v"
                  ? `linear-gradient(to bottom, ${gradColor1}, ${gradColor2})`
                  : `linear-gradient(135deg, ${gradColor1}, ${gradColor2})`,
              }}
            />

            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-3 mb-1.5 font-semibold">Напрямок</p>
            <div className="flex gap-1">
              {GRAD_DIRS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setGradDir(d.id)}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-medium rounded-lg border transition-all",
                    gradDir === d.id
                      ? "border-violet-400/60 bg-violet-50 text-violet-700"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <button type="button" onClick={addGradient} className={ADD_BTN}>
              Додати градієнт
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
