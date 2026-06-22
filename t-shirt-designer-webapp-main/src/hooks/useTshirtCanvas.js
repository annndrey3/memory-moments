import { useCallback, useEffect, useRef } from "react";
import * as fabric from "fabric";
import { CANVAS_CONFIG } from "../constants/designConstants";
import { useDispatch, useSelector } from "react-redux";
import { useCanvas } from "@/hooks/useCanvas";
import canvasStorageManager from "@/utils/canvasStorageManager";
import { canvasSyncManager } from "@/utils/canvasSyncManager";
import { markDesignDirty } from "@/features/tshirtSlice";
import { lockToActive, unlockAll } from "@/utils/layerLock";

export const useTshirtCanvas = ({
  svgPath,
  viewBox = "0 0 810 810",
  printZone,
  view,
  canvasSize,
  templateOverlay,
  onDesignUpdate,
  seedImage,
}) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const seededRef = useRef(false);   // фото розвороту засіяне (один раз)
  const hadSavedRef = useRef(false); // на холсті вже були збережені обʼєкти
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const dispatch = useDispatch();

  const {
    setActiveCanvas,
    setSelectedObject,
    setFrontCanvas,
    setBackCanvas,
    registerCanvas,
    unregisterCanvas,
  } = useCanvas();

  // Function to save canvas objects
  const saveCanvas = () => {
    if (fabricCanvasRef.current) {
      canvasStorageManager.saveCanvasObjects(
        view,
        fabricCanvasRef.current,
        selectedType
      );
    }
  };

  // Function to notify design changes
  const notifyDesignChange = useCallback(() => {
    if (fabricCanvasRef.current && onDesignUpdate) {
      const textureDataUrl = canvasSyncManager.getCanvasTexture(
        fabricCanvasRef.current
      );
      onDesignUpdate(textureDataUrl);
    }
  }, [onDesignUpdate]);

  // Initialize Fabric.js Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const effectiveSize = canvasSize ?? CANVAS_CONFIG;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: effectiveSize.width,
      height: effectiveSize.height,
      backgroundColor: "transparent",
      preserveObjectStacking: true,
    });

    if (templateOverlay) {
      // Preload template as plain HTML Image and store on canvas for export compositing.
      // NOT set as Fabric backgroundImage — destination-in clip would erase it.
      canvas.isTemplate = true; // set synchronously so getCanvasTexture knows immediately
      const htmlImg = new window.Image();
      htmlImg.onload = () => {
        const c = fabricCanvasRef.current;
        if (!c) return;
        c.templateImg = htmlImg;
      };
      htmlImg.src = templateOverlay;
    }

    fabricCanvasRef.current = canvas;
    canvas.productId = selectedType;
    canvas.viewId = view;

    registerCanvas(selectedType, view, canvas);
    if (view === "front") setFrontCanvas(canvas);
    if (view === "back") setBackCanvas(canvas);

    if (selectedView === view) {
      setActiveCanvas(canvas);
    }

    // Save canvas data when the page is about to unload (refresh/close)
    window.addEventListener("beforeunload", saveCanvas);

    // Load saved objects
    const savedObjects = canvasStorageManager.loadCanvasObjects(
      view,
      selectedType
    );
    hadSavedRef.current = Boolean(savedObjects && savedObjects.length);
    if (savedObjects) {
      savedObjects.forEach((obj) => addFabricObject(canvas, obj));
      canvas.renderAll();
    }

    // Handle Object Selection. Керувати на макеті можна лише активним шаром:
    // при виборі блокуємо інші обʼєкти, при знятті виділення — розблоковуємо всі.
    canvas.on("selection:created", (e) => {
      setSelectedObject(e.selected[0]);
      lockToActive(canvas);
    });

    canvas.on("selection:updated", (e) => {
      setSelectedObject(e.selected[0]);
      lockToActive(canvas);
    });

    canvas.on("selection:cleared", () => {
      setSelectedObject(null);
      unlockAll(canvas);
    });

    // Listen for any changes on the canvas. Будь-яка зміна макета означає, що
    // поточний дизайн відрізняється від доданого в кошик → позначаємо «брудним».
    const onCanvasChange = () => {
      notifyDesignChange();
      dispatch(markDesignDirty());
    };
    canvas.on("object:modified", onCanvasChange);
    canvas.on("object:added", onCanvasChange);
    canvas.on("object:removed", onCanvasChange);

    // Template-формати (полароїд/інстакс): кліп полотна навмисно ширший за вікно
    // друку (щоб дозволити підпис у нижній білій смузі). Тож кожне ФОТО клипуємо
    // окремо до ВІКНА друку (printArea) — інакше воно вилазить за зону друку в смугу.
    const clipImageToWindow = (e) => {
      const o = e?.target;
      const c = fabricCanvasRef.current;
      if (!o || o.type !== "image" || !c?.isTemplate || !c.printArea || o.clipPath) return;
      const pa = c.printArea;
      o.clipPath = new fabric.Rect({
        left: pa.left, top: pa.top, width: pa.width, height: pa.height, absolutePositioned: true,
      });
      // Без кешу: інакше fabric лишає растровий кеш фото, відрендерений ДО кліпу,
      // і на екрані фото «вилазить» за зону друку (хоча у файл друку йде обрізаним).
      o.objectCaching = false;
      o.set("dirty", true);
      c.requestRenderAll();
    };
    canvas.on("object:added", clipImageToWindow);

    // Cleanup
    return () => {
      saveCanvas();
      window.removeEventListener("beforeunload", saveCanvas);
      canvas.off("object:modified", onCanvasChange);
      canvas.off("object:added", onCanvasChange);
      canvas.off("object:removed", onCanvasChange);
      canvas.off("object:added", clipImageToWindow);
      canvas.dispose();
      fabricCanvasRef.current = null;
      unregisterCanvas(selectedType, view, canvas);
      if (view === "front") setFrontCanvas(null);
      if (view === "back") setBackCanvas(null);
      if (selectedView === view) {
        setActiveCanvas(null);
      }
      setSelectedObject(null);
    };
  }, [dispatch, view, selectedType]); // Runs on mount

  // Switch Active Canvas When View Changes
  useEffect(() => {
    if (selectedView === view && fabricCanvasRef.current) {
      setActiveCanvas(fabricCanvasRef.current);
    }
  }, [selectedView, dispatch, view]);

  // Load ClipPath (print area) & printArea
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const effectiveSize = canvasSize ?? CANVAS_CONFIG;
    const [, , viewBoxWidth, viewBoxHeight] = viewBox.split(/\s+/).map(Number);
    const scale = Math.min(
      effectiveSize.width / viewBoxWidth,
      effectiveSize.height / viewBoxHeight
    );

    // Centering offsets (matching svg preserveAspectRatio="xMidYMid meet").
    const offsetX = (effectiveSize.width - viewBoxWidth * scale) / 2;
    const offsetY = (effectiveSize.height - viewBoxHeight * scale) / 2;

    let clipPath;
    let printArea;

    if (printZone) {
      // Реальна прямокутна зона друку (футболка): дизайн обрізається саме по ній.
      printArea = {
        left: printZone.x * scale + offsetX,
        top: printZone.y * scale + offsetY,
        width: printZone.width * scale,
        height: printZone.height * scale,
      };
      clipPath = new fabric.Rect({
        left: printArea.left,
        top: printArea.top,
        width: printArea.width,
        // Шаблонні формати (полароїд/інстакс): подовжуємо кліп донизу до краю
        // полотна, щоб у нижній білій смузі можна було робити підпис. Фото
        // лишається у вікні друку (printArea), L/R-поля рамки захищені шириною кліпа.
        height: templateOverlay ? Math.max(printArea.height, effectiveSize.height - printArea.top) : printArea.height,
        originX: "left",
        originY: "top",
        absolutePositioned: true,
      });
    } else if (svgPath) {
      // Інші товари (фото/чашка): зоною друку є сам контур-прямокутник макета.
      clipPath = new fabric.Path(svgPath);
      printArea = {
        left: clipPath.left * scale + offsetX,
        top: clipPath.top * scale + offsetY,
        width: clipPath.width * scale,
        height: clipPath.height * scale,
      };
      clipPath.set({
        scaleX: scale,
        scaleY: scale,
        left: printArea.left,
        top: printArea.top,
        originX: "left",
        originY: "top",
        absolutePositioned: true,
      });
    } else {
      return;
    }

    canvas.clipPath = clipPath;
    canvas.printArea = printArea;
    canvas.renderAll();

    // Засів холста розвороту книги завантаженим фото — один раз, лише якщо холст
    // порожній (немає збережених обʼєктів). Фото заповнює зону друку (cover),
    // далі його можна рухати/масштабувати й накладати колаж/рамку/текст.
    if (seedImage && !seededRef.current && !hadSavedRef.current && canvas.getObjects().length === 0) {
      seededRef.current = true;
      const imgEl = new window.Image();
      imgEl.onload = () => {
        const c = fabricCanvasRef.current;
        if (!c || !c.printArea) return;
        const pa = c.printArea;
        const fImg = new fabric.Image(imgEl);
        const s = Math.max(pa.width / fImg.width, pa.height / fImg.height); // cover
        fImg.scale(s);
        fImg.set({
          left: pa.left + (pa.width - fImg.getScaledWidth()) / 2,
          top: pa.top + (pa.height - fImg.getScaledHeight()) / 2,
        });
        c.add(fImg);
        c.renderAll();
      };
      imgEl.src = seedImage;
    }
  }, [svgPath, viewBox, printZone, canvasSize?.width, canvasSize?.height, seedImage]);

  return { canvasRef, fabricCanvasRef, tshirtColor };
};

// Helper function to add objects to canvas
// Helper function to add objects to canvas
const addFabricObject = (canvas, objectData) => {
  switch (objectData.type) {
    case "Line":
      canvas.add(
        new fabric.Line(
          [objectData.x1, objectData.y1, objectData.x2, objectData.y2],
          {
            left: objectData.left || 0,
            top: objectData.top || 0,
            stroke: objectData.stroke || "black",
            strokeWidth: objectData.strokeWidth || 2,
            strokeLineCap: objectData.strokeLineCap || "round",
            strokeLineJoin: objectData.strokeLineJoin || "miter",
            opacity: objectData.opacity || 1,
            angle: objectData.angle || 0,
            scaleX: objectData.scaleX || 1,
            scaleY: objectData.scaleY || 1,
          }
        )
      );
      break;
    case "Textbox":
      const textbox = new fabric.Textbox(objectData.text, {
        left: objectData.left,
        top: objectData.top,
        width: objectData.width,
        fontSize: objectData.fontSize,
        fontFamily: objectData.fontFamily,
        textAlign: objectData.textAlign,
        fill: objectData.fill,
        scaleX: objectData.scaleX,
        scaleY: objectData.scaleY,
        angle: objectData.angle,
        opacity: objectData.opacity,
      });

      // Force text re-rendering and positioning
      textbox.initDimensions();
      textbox.set({
        width: textbox.width,
        height: textbox.height,
      });

      canvas.add(textbox);

      // Ensure proper rendering after a short delay

      canvas.renderAll();
      break;
    case "Image":
      if (!objectData.src.startsWith("data:image")) return;
      const imgElement = new Image();
      imgElement.src = objectData.src;
      imgElement.onload = () => {
        const fabricImg = new fabric.Image(imgElement, {
          left: objectData.left || 0,
          top: objectData.top || 0,
          scaleX: objectData.scaleX || 1,
          scaleY: objectData.scaleY || 1,
          angle: objectData.angle || 0,
          opacity: objectData.opacity || 1,
        });
        canvas.add(fabricImg);
        canvas.renderAll();
      };
      break;
  }
};
