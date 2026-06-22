import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import * as fabric from "fabric";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_TYPES, DEFAULT_TEXT_CONFIG, CANVAS_CONFIG, buildCanvasView, buildSlimBookView, buildSpreadView, isBookType, isMultiPhoto, tshirtSizeScale, tshirtPrintZone } from "../constants/designConstants";
import ProductCanvas from "./ProductCanvas";
import ProductControls from "./ProductControls";
import SaveDesign from "./SaveDesign";
import TextEditPanel from "./TextEditPanel";
import MaskDropdownBtn from "./MaskDropdownBtn";
import FrameDropdownBtn from "./FrameDropdownBtn";
import CollageDropdownBtn from "./CollageDropdownBtn";
import ObjectControls from "./ObjectControls";
import FillDropdownBtn from "./FillDropdownBtn";
import BackgroundDropdownBtn from "./BackgroundDropdownBtn";
import PropertiesBtn from "./PropertiesBtn";
import { setSelectedView, reorderSlimBookPhotos, addSlimBookPhotos } from "../features/tshirtSlice";
import { useCanvas } from "@/hooks/useCanvas";
import { useAddImage } from "@/hooks/useAddImage";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import { usePolaroidCaption } from "@/hooks/usePolaroidCaption";
import canvasStorageManager from "@/utils/canvasStorageManager";
import { cn } from "@/lib/utils";
import { ImagePlus, Type, Slash, Trash, Trash2, Undo2 } from "lucide-react";

// Кнопка інструмента по периметру редактора (іконка + підпис). На ПК — вертикальні
// ряди зліва/справа, на мобільному ряди стають горизонтальними над/під холстом.
const RAIL_BTN =
  "flex flex-col items-center justify-center gap-1 h-14 w-14 lg:w-16 shrink-0 rounded-xl border border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:bg-card";
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
  const size = useSelector((state) => state.tshirt.size);
  const printSize = useSelector((state) => state.tshirt.printSize);
  const canvasSize = useSelector((state) => state.tshirt.canvasSize);
  const slimBookFormat = useSelector((state) => state.tshirt.slimBookFormat);
  const slimBookPhotos = useSelector((state) => state.tshirt.slimBookPhotos);
  const { activeCanvas, selectedObject, setSelectedObject } = useCanvas();
  const { addImageFile } = useAddImage();
  const { undo, canUndo } = useCanvasHistory({ activeCanvas, manualSync });
  // Підпис на нижній смузі полароїда — додається кліком по ній.
  usePolaroidCaption({ activeCanvas, manualSync });
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  // Кожен вид несе свою геометрію (пропорції зони друку), щоб ProductCanvas
  // отримував стабільний viewConfig (без перестворення на кожен рендер):
  //  • Полотно — усі види за обраним розміром;
  //  • Книга — обкладинки портретні (сторінка), розвороти двосторінкові (ландшафт,
  //    лінія згину + Ліва/Права); кожне фото розвороту = окрема редагована вкладка.
  const views = useMemo(() => {
    const base = Object.entries(product.views);
    if (selectedType === "canvas") {
      return base.map(([v, c]) => [v, { ...c, ...buildCanvasView(canvasSize) }]);
    }
    if (isBookType(selectedType)) {
      // label ПІСЛЯ геометрії: build*View повертає свій label, який інакше
      // перетер би «Обкладинка (перед)»/«Розворот N».
      const covers = base.map(([v, c]) => [v, { ...buildSlimBookView(slimBookFormat), label: c.label }]);
      const spreads = (slimBookPhotos || []).map((_, i) => [
        `spread-${i}`,
        { ...buildSpreadView(slimBookFormat), label: `Розворот ${i + 1}` },
      ]);
      return [...covers, ...spreads];
    }
    // Пачка фото: кожне завантажене фото — окрема редагована сторінка (spread-N)
    // з геометрією обраного фото-формату (переисп. інфраструктуру розворотів).
    if (isMultiPhoto(selectedType) && (slimBookPhotos?.length || 0) > 0) {
      const front = product.views.front;
      return (slimBookPhotos || []).map((_, i) => [`spread-${i}`, { ...front, label: `Фото ${i + 1}` }]);
    }
    // Футболка: зона друку залежить від формату (А4/А3) — щоб було видно різницю.
    if (selectedType === "crew-neck") {
      const pz = tshirtPrintZone(printSize);
      return base.map(([v, c]) => [v, { ...c, printZone: pz }]);
    }
    return base;
  }, [product, selectedType, slimBookPhotos, slimBookFormat, canvasSize, printSize]);
  const [dragOver, setDragOver] = useState(false);
  const [hasObjects, setHasObjects] = useState(false);
  const fileInputRef = useRef(null);

  // Пачка фото (полароїд/інстакс/фотодрук) не має виду «front» — лише розвороти
  // spread-N. Після завантаження фото selectedView лишався б «front» (його немає
  // у списку видів) → холст ховався, екран білів. Тримаємо активним валідний розворот.
  useEffect(() => {
    if (!isMultiPhoto(selectedType)) return;
    const n = slimBookPhotos?.length || 0;
    if (n === 0) return;
    const idx = selectedView.startsWith("spread-") ? Number(selectedView.slice(7)) : -1;
    if (idx < 0 || idx >= n) dispatch(setSelectedView(`spread-${Math.min(Math.max(idx, 0), n - 1)}`));
  }, [selectedType, slimBookPhotos, selectedView, dispatch]);

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

      // Ctrl/Cmd+Z — скасувати останню дію (працює і без вибраного шару).
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z" || e.key === "я" || e.key === "Я")) {
        e.preventDefault();
        undo();
        return;
      }

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
  }, [activeCanvas, manualSync, undo]);

  const getPrintableArea = () =>
    activeCanvas?.printArea || { left: 0, top: 0, width: CANVAS_CONFIG.width, height: CANVAS_CONFIG.height };

  const triggerFileInput = () => fileInputRef.current?.click();

  // Стиснення фото для пачки (як у OrderBar): даунскейл 2400px, JPEG 0.88.
  const compressPhoto = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 2400;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.88));
        };
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    // Пачка фото: усі завантажені фото йдуть у батч (кожне = окрема сторінка).
    if (isMultiPhoto(selectedType)) {
      for (const f of files) {
        const url = await compressPhoto(f);
        if (url) dispatch(addSlimBookPhotos([url]));
      }
      return;
    }
    addImageFile(files[0]); // решта товарів — одне фото на активний холст
  };

  const handleAddText = () => {
    if (!activeCanvas) return;
    const printArea = getPrintableArea();
    const text = new fabric.Textbox("Ваш текст", {
      ...DEFAULT_TEXT_CONFIG,
      left: printArea.left + printArea.width / 2,
      top: printArea.top + printArea.height / 2,
      width: Math.min(260, printArea.width * 0.85),
      editable: true,
    });
    activeCanvas.add(text);
    activeCanvas.setActiveObject(text);
    activeCanvas.renderAll();
    // Одразу даємо друкувати: вмикаємо редагування й виділяємо текст-заготовку,
    // щоб перший символ його замінив.
    try { text.enterEditing(); text.selectAll(); } catch { /* canvas ще не готовий */ }
    // Шрифт за замовчуванням (Caveat) міг не встигнути завантажитись — підтягнемо
    // кириличні гліфи на зразку лат.+кир. і перемалюємо.
    if (document.fonts?.load) {
      document.fonts
        .load(`${text.fontSize}px "${text.fontFamily}"`, "AaЯяІіЇїҐґЄє")
        .then(() => { activeCanvas.renderAll(); manualSync?.(); })
        .catch(() => {});
    }
    manualSync?.();
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

  // ── Перетягування мініатюр розворотів у каруселі (миша + тач) ──
  // Тач: перетяг вмикається довгим натисканням (200мс), щоб швидкий свайп лишався
  // прокруткою каруселі. Миша: перетяг після руху >6px. Реордер — reorderSlimBookPhotos.
  const dragRef = useRef({ from: null, active: false, timer: null, startX: 0, type: "", over: null, didDrag: false });
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const spreadIdxAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const tile = el?.closest?.("[data-spread-idx]");
    return tile ? Number(tile.getAttribute("data-spread-idx")) : null;
  };
  const resetDrag = () => {
    if (dragRef.current.timer) clearTimeout(dragRef.current.timer);
    dragRef.current = { from: null, active: false, timer: null, startX: 0, type: "", over: null, didDrag: dragRef.current.didDrag };
    setDragIdx(null);
    setOverIdx(null);
  };
  const onThumbPointerDown = (e, idx) => {
    dragRef.current = { from: idx, active: false, timer: null, startX: e.clientX, type: e.pointerType, over: null, didDrag: false };
    if (e.pointerType !== "mouse") {
      dragRef.current.timer = setTimeout(() => { dragRef.current.active = true; setDragIdx(idx); }, 200);
    }
  };
  const onThumbsPointerMove = (e) => {
    const d = dragRef.current;
    if (d.from == null) return;
    if (!d.active) {
      if (d.type === "mouse") {
        if (Math.abs(e.clientX - d.startX) > 6) { d.active = true; setDragIdx(d.from); }
      } else if (d.timer && Math.abs(e.clientX - d.startX) > 8) {
        // рух до спрацювання таймера = прокрутка → скасовуємо перетяг
        clearTimeout(d.timer); d.timer = null; d.from = null; return;
      }
      if (!d.active) return;
    }
    e.preventDefault();
    const over = spreadIdxAt(e.clientX, e.clientY);
    if (over != null && over !== d.over) { d.over = over; setOverIdx(over); }
  };
  const onThumbsPointerUp = () => {
    const d = dragRef.current;
    if (d.active && d.from != null && d.over != null && d.over !== d.from) {
      dispatch(reorderSlimBookPhotos({ from: d.from, to: d.over }));
      d.didDrag = true; // придушити наступний click (щоб не перемикав вид)
    }
    resetDrag();
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
        <div className="px-3 py-2 md:px-5 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
          <ProductControls />
          {/* Книга та пачка фото мають навігацію мініатюрами-каруселлю ПІД холстом
              — тут текстові вкладки не показуємо (для решти товарів лишаються зверху). */}
          {views.length > 1 && !isBookType(selectedType) && !isMultiPhoto(selectedType) && (
            <div className="flex gap-1.5 p-1 bg-white/70 rounded-xl max-w-full flex-nowrap overflow-x-auto">
              {views.map(([view, viewConfig]) => (
                <button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  className={cn(
                    "rounded-lg h-8 px-4 text-xs font-medium transition-all shrink-0 whitespace-nowrap",
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

        <CardContent className="p-2 md:p-5 bg-gradient-to-b from-card to-muted/20">
          {/* ── Периметр: зліва — додати, в центрі — холст, справа — дії ── */}
          <div className="flex flex-col lg:flex-row lg:items-start gap-2 lg:gap-3">
            {/* ADD (ряд на мобільному / стовпчик зліва на ПК). На мобільному —
                горизонтальна тач-прокрутка, щоб усі інструменти були доступні. */}
            <div className="flex flex-row lg:flex-col flex-nowrap gap-1.5 justify-start overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 [-webkit-overflow-scrolling:touch]" data-tour="add">
              <input type="file" accept="image/*" multiple={isMultiPhoto(selectedType)} ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <ToolBtn icon={ImagePlus} label="Фото" onClick={triggerFileInput} />
              <ToolBtn icon={Type} label="Текст" onClick={handleAddText} />
              <ToolBtn icon={Slash} label="Лінія" onClick={handleAddLine} />
              <MaskDropdownBtn manualSync={manualSync} />
              <CollageDropdownBtn manualSync={manualSync} />
              <FrameDropdownBtn manualSync={manualSync} />
              <FillDropdownBtn manualSync={manualSync} />
              {/* Готові фони — для будь-якого товару (на весь формат, нижній шар) */}
              <BackgroundDropdownBtn manualSync={manualSync} />
            </div>

            {/* CANVAS + контекстне редагування */}
            <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
              {/* Холст, а ПІД ним — акуратний віджет редагування тексту (у потоці).
                  Раніше панель висіла оверлеєм над верхом холста й перекривала дизайн
                  та перехоплювала кліки — тепер вона нижче й нічому не заважає. */}
              <div className="relative w-full flex flex-col items-center gap-2">
              {/* Кнопка «Скасувати» (undo) — НАД фото/холстом. */}
              <button
                type="button"
                data-tour="undo"
                onClick={undo}
                disabled={!canUndo}
                title="Скасувати останню дію (Ctrl+Z)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 h-9 text-xs font-medium text-foreground/80 hover:border-primary/40 hover:bg-muted transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:bg-card"
              >
                <Undo2 className="h-4 w-4" /> Скасувати
              </button>
              <div
                className="relative rounded-xl ring-1 ring-border/40 shadow-elevated overflow-hidden"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {views.map(([view, viewConfig]) => (
                  <div key={`${selectedType}-${view}`} className={view === selectedView ? "block" : "hidden"}>
                    <ProductCanvas
                      view={view}
                      viewConfig={viewConfig}
                      seedImage={view.startsWith("spread-") ? slimBookPhotos[Number(view.slice(7))] : undefined}
                      shirtScale={selectedType === "crew-neck" ? tshirtSizeScale(size) : null}
                    />
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
                {/* Віджет редагування тексту — акуратний оверлей ВНИЗУ холста.
                    Показується лише коли вибрано текст (інакше TextEditPanel = null);
                    лягає на нижній (порожній) край полотна під зоною друку, тож не
                    штовхає макет і не перекриває дизайн. Рівень wrapper (повна ширина,
                    випадайки шрифтів не обрізаються overflow-hidden холста). */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center p-2">
                  <div className="pointer-events-auto w-full max-w-2xl">
                    <TextEditPanel manualSync={manualSync} />
                  </div>
                </div>
              </div>

              {/* Книга: окремий блок «Обкладинки» з кнопками Перед / Зад
                  (обкладинки редагуються тут, а не в каруселі розворотів). */}
              {isBookType(selectedType) && (
                <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Обкладинки
                  </span>
                  {["front", "back"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleViewChange(v)}
                      className={cn(
                        "rounded-lg h-8 px-5 text-xs font-medium transition-all border",
                        selectedView === v
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-glow"
                          : "bg-white/70 text-muted-foreground border-border/60 hover:text-foreground hover:border-primary/40"
                      )}
                    >
                      {v === "front" ? "Перед" : "Зад"}
                    </button>
                  ))}
                </div>
              )}

              {/* Карусель мініатюр розворотів/фото (для книги — лише розвороти,
                  обкладинки — кнопками вище). Клік перемикає редагування. */}
              {(isBookType(selectedType) || isMultiPhoto(selectedType)) && (() => {
                const list = isMultiPhoto(selectedType)
                  ? views
                  : views.filter(([v]) => v.startsWith("spread-"));
                if (list.length < 1) return null;
                return (
                <div
                  className="mx-auto w-fit max-w-full flex gap-1.5 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]"
                  style={{ touchAction: dragIdx != null ? "none" : "pan-x" }}
                  onPointerMove={onThumbsPointerMove}
                  onPointerUp={onThumbsPointerUp}
                  onPointerLeave={onThumbsPointerUp}
                >
                  {list.map(([view, viewConfig]) => {
                    const spreadIdx = view.startsWith("spread-") ? Number(view.slice(7)) : -1;
                    const isSpread = spreadIdx >= 0;
                    const thumb = isSpread ? slimBookPhotos[spreadIdx] : null;
                    const active = selectedView === view;
                    return (
                      <button
                        key={view}
                        type="button"
                        data-spread-idx={isSpread ? spreadIdx : undefined}
                        onPointerDown={isSpread ? (e) => onThumbPointerDown(e, spreadIdx) : undefined}
                        onClick={() => {
                          if (dragRef.current.didDrag) { dragRef.current.didDrag = false; return; }
                          handleViewChange(view);
                        }}
                        title={isSpread ? `${viewConfig.label} — перетягніть, щоб змінити порядок` : viewConfig.label}
                        className={cn(
                          "shrink-0 w-12 rounded-md border-2 overflow-hidden bg-card transition-all select-none",
                          active
                            ? "border-primary ring-2 ring-primary/30 shadow-glow"
                            : "border-border/60 hover:border-primary/40",
                          isSpread && "cursor-grab",
                          isSpread && dragIdx === spreadIdx && "opacity-40",
                          isSpread && overIdx === spreadIdx && dragIdx !== spreadIdx && "border-violet-500 ring-2 ring-violet-400"
                        )}
                      >
                        <div className="h-8 w-full bg-muted flex items-center justify-center overflow-hidden pointer-events-none">
                          {thumb ? (
                            <img src={thumb} alt={viewConfig.label} draggable={false} className="h-full w-full object-cover" />
                          ) : (
                            <ImagePlus className="h-4 w-4 text-muted-foreground/50" />
                          )}
                        </div>
                        <div className="text-[8px] font-medium leading-none py-0.5 px-0.5 truncate text-center pointer-events-none">
                          {viewConfig.label}
                        </div>
                      </button>
                    );
                  })}
                </div>
                );
              })()}

            </div>

            {/* ACTIONS (ряд на мобільному / стовпчик справа на ПК). На мобільному —
                горизонтальна тач-прокрутка. */}
            <div className="flex flex-row lg:flex-col flex-nowrap gap-1.5 justify-start overflow-x-auto lg:overflow-x-visible pb-1 lg:pb-0 [-webkit-overflow-scrolling:touch]">
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
