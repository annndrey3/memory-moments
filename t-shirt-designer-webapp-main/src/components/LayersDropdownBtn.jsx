import { useEffect, useState, useCallback } from "react";
import { useCanvas } from "@/hooks/useCanvas";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Layers, Eye, EyeOff, ArrowUp, ArrowDown, ArrowUpToLine, ArrowDownToLine,
  Trash2, Lock, Image as ImageIcon, Type, Minus, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed";

// Підпис + іконка шару за типом fabric-обʼєкта.
function layerMeta(obj) {
  if (obj.mmRole === "background") return { Icon: ImageIcon, label: "Фон" };
  const t = obj.type;
  if (t === "image") return { Icon: ImageIcon, label: "Зображення" };
  if (t === "i-text" || t === "text" || t === "textbox")
    return { Icon: Type, label: (obj.text || "Текст").trim().slice(0, 20) || "Текст" };
  if (t === "line") return { Icon: Minus, label: "Лінія" };
  if (t === "group" || t === "activeselection") return { Icon: Layers, label: "Група" };
  return { Icon: Square, label: "Фігура" };
}

let _idSeq = 1;
const layerId = (obj) => (obj.__mmLayerId ||= _idSeq++);

// Панель шарів: список усіх обʼєктів холста (зверху = передній план) з вибором,
// показ/сховати, переміщенням по z-порядку та видаленням. Зручніше за 4 кнопки.
export default function LayersDropdownBtn({ manualSync }) {
  const { activeCanvas, selectedObject, setSelectedObject } = useCanvas();
  const [open, setOpen] = useState(false);
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Перемальовуємо список, коли обʼєкти додають/видаляють/змінюють.
  useEffect(() => {
    if (!activeCanvas) return;
    const evs = ["object:added", "object:removed", "object:modified"];
    evs.forEach((e) => activeCanvas.on(e, bump));
    return () => evs.forEach((e) => activeCanvas.off(e, bump));
  }, [activeCanvas, bump]);

  const objects = activeCanvas?.getObjects?.() || [];
  const layers = [...objects].reverse(); // зверху список = передній план
  const count = objects.length;

  const select = (obj) => {
    if (!activeCanvas || obj.evented === false) return;
    activeCanvas.setActiveObject(obj);
    activeCanvas.requestRenderAll();
    setSelectedObject?.(obj);
  };
  const act = (fn, obj) => {
    if (!activeCanvas || typeof activeCanvas[fn] !== "function") return;
    activeCanvas[fn](obj);
    activeCanvas.requestRenderAll();
    bump();
    manualSync?.();
  };
  const toggleVisible = (obj) => {
    obj.visible = obj.visible === false;
    activeCanvas?.requestRenderAll();
    bump();
    manualSync?.();
  };
  const remove = (obj) => {
    if (!activeCanvas) return;
    activeCanvas.remove(obj);
    if (selectedObject === obj) setSelectedObject?.(null);
    activeCanvas.requestRenderAll();
    bump();
    manualSync?.();
  };

  return (
    <Popover open={open} onOpenChange={(v) => count > 0 && setOpen(v)}>
      <PopoverTrigger asChild>
        <button type="button" disabled={count === 0} title="Шари" className={RAIL_BTN}>
          <Layers className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Шари</span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" sideOffset={8} className="w-64 p-2">
        <div className="flex items-baseline justify-between px-1 pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Шари</p>
          <span className="text-[9px] text-muted-foreground/70">зверху = передній</span>
        </div>

        {/* Швидко: вибраний — на самий верх / низ */}
        {selectedObject && selectedObject.mmRole !== "background" && (
          <div className="mb-1.5 flex gap-1">
            <button type="button" onClick={() => act("bringObjectToFront", selectedObject)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border/60 py-1 text-[10px] font-medium hover:bg-muted">
              <ArrowUpToLine className="h-3.5 w-3.5 text-violet-600" /> На перед
            </button>
            <button type="button" onClick={() => act("sendObjectToBack", selectedObject)}
              className="flex flex-1 items-center justify-center gap-1 rounded-md border border-border/60 py-1 text-[10px] font-medium hover:bg-muted">
              <ArrowDownToLine className="h-3.5 w-3.5 text-violet-600" /> На зад
            </button>
          </div>
        )}

        <div className="max-h-[320px] overflow-y-auto space-y-0.5 pr-0.5">
          {layers.map((obj, i) => {
            const { Icon, label } = layerMeta(obj);
            const active = selectedObject === obj;
            const hidden = obj.visible === false;
            const locked = obj.mmRole === "background"; // фоном керує кнопка «Фон»
            const isTop = i === 0;
            const isBottom = i === layers.length - 1;
            return (
              <div
                key={layerId(obj)}
                onClick={() => !locked && select(obj)}
                className={cn(
                  "group flex items-center gap-1.5 rounded-lg px-2 py-1.5",
                  locked ? "opacity-60" : "cursor-pointer",
                  active ? "bg-violet-50 ring-1 ring-violet-300" : "hover:bg-muted"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-violet-600" : "text-muted-foreground")} />
                <span className={cn("flex-1 truncate text-xs", hidden && "line-through opacity-40")}>{label}</span>

                <button type="button" title={hidden ? "Показати" : "Сховати"}
                  onClick={(e) => { e.stopPropagation(); toggleVisible(obj); }}
                  className="text-muted-foreground hover:text-foreground p-0.5">
                  {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>

                {locked ? (
                  <Lock className="h-3.5 w-3.5 text-muted-foreground/60" />
                ) : (
                  <>
                    <button type="button" title="Вище" disabled={isTop}
                      onClick={(e) => { e.stopPropagation(); act("bringObjectForward", obj); }}
                      className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-25">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Нижче" disabled={isBottom}
                      onClick={(e) => { e.stopPropagation(); act("sendObjectBackwards", obj); }}
                      className="text-muted-foreground hover:text-foreground p-0.5 disabled:opacity-25">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" title="Видалити"
                      onClick={(e) => { e.stopPropagation(); remove(obj); }}
                      className="text-muted-foreground hover:text-destructive p-0.5">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
