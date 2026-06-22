import * as fabric from "fabric";
import { useEffect } from "react";
import { POLAROID_FRAME_IDS, polaroidCaptionZone } from "@/constants/frames";
import { DEFAULT_TEXT_CONFIG, PRODUCT_TYPES } from "@/constants/designConstants";

// Товари-шаблони з білою смугою для підпису (полароїд/інстакс). У них рамка — це
// templateOverlay (PNG під холстом), а не fabric-група, тож зону підпису рахуємо
// з геометрії: біла смуга = область ПІД зоною друку (printArea) до низу полотна.
const TEMPLATE_CAPTION_SHAPES = ["polaroid", "instax"];

const templateCaptionZone = (canvas) => {
  const prod = PRODUCT_TYPES[canvas.productId];
  if (!prod || !TEMPLATE_CAPTION_SHAPES.includes(prod.previewShape)) return null;
  if (!canvas.isTemplate || !canvas.printArea) return null;
  const pa = canvas.printArea;
  const top = pa.top + pa.height;
  const height = canvas.height - top;
  if (height < 24) return null; // немає смуги
  return { left: pa.left, top, width: pa.width, height };
};

// Зона підпису поточного полотна: спершу fabric-рамка полароїд/вінтаж, інакше —
// товар-шаблон полароїд/інстакс. null, якщо підпис тут не передбачено.
const captionZoneFor = (canvas) => {
  const frame = canvas
    .getObjects()
    .find((o) => o.mmRole === "frame" && POLAROID_FRAME_IDS.includes(o.mmFrameId));
  if (frame) return polaroidCaptionZone(frame);
  return templateCaptionZone(canvas);
};

// «Додати текст на полароїд/інстакс кліком по білій смузі»: працює і для fabric-рамки
// «Полароїд»/«Вінтаж», і для товарів-шаблонів полароїд/інстакс. Клік по нижній смузі
// створює там редагований підпис (повторний клік по наявному — редагує). Перетяг по
// смузі не створює підпис (це переміщення фото під смугою).
export function usePolaroidCaption({ activeCanvas, manualSync }) {
  useEffect(() => {
    const canvas = activeCanvas;
    if (!canvas) return;

    let downX = 0;
    let downY = 0;

    const inZone = (z, x, y) =>
      x >= z.left && x <= z.left + z.width && y >= z.top && y <= z.top + z.height;

    const onDown = (opt) => {
      const p = canvas.getPointer(opt.e);
      downX = p.x;
      downY = p.y;
    };

    const editCaption = (text) => {
      canvas.setActiveObject(text);
      try {
        text.enterEditing();
        text.selectAll();
      } catch {
        /* полотно ще не готове */
      }
      canvas.requestRenderAll();
    };

    const onUp = (opt) => {
      const p = canvas.getPointer(opt.e);
      if (Math.hypot(p.x - downX, p.y - downY) > 5) return; // перетяг, не клік

      const zone = captionZoneFor(canvas);
      if (!zone || !inZone(zone, p.x, p.y)) return;

      // клік по наявному підпису → редагуємо його
      if (opt.target && opt.target.mmRole === "caption") {
        editCaption(opt.target);
        return;
      }
      // підпис уже існує в цій смузі → редагуємо
      const existing = canvas.getObjects().find((o) => {
        if (o.mmRole !== "caption") return false;
        const c = o.getCenterPoint();
        return inZone(zone, c.x, c.y);
      });
      if (existing) {
        editCaption(existing);
        manualSync?.();
        return;
      }

      // створюємо новий підпис у нижній смузі (розмір — від смуги, але не завеликий)
      const fontSize = Math.max(14, Math.round(Math.min(zone.height * 0.5, zone.width * 0.11)));
      const text = new fabric.Textbox("Підпис", {
        ...DEFAULT_TEXT_CONFIG,
        left: zone.left + zone.width / 2,
        top: zone.top + zone.height / 2,
        originX: "center",
        originY: "center",
        width: zone.width * 0.92,
        fontSize,
        textAlign: "center",
        fill: "#2b2b2b",
        editable: true,
      });
      text.mmRole = "caption";
      canvas.add(text);
      canvas.bringObjectToFront(text); // поверх білої смуги рамки
      editCaption(text);
      // Рукописний шрифт (Caveat) міг не встигнути завантажитись — підтягуємо
      // кир./лат. гліфи й перемальовуємо, інакше підпис блимне запасним шрифтом.
      if (document.fonts?.load) {
        document.fonts
          .load(`${text.fontSize}px "${text.fontFamily}"`, "AaЯяІіЇїҐґЄє")
          .then(() => {
            canvas.requestRenderAll();
            manualSync?.();
          })
          .catch(() => {});
      }
      manualSync?.();
    };

    canvas.on("mouse:down", onDown);
    canvas.on("mouse:up", onUp);
    return () => {
      canvas.off("mouse:down", onDown);
      canvas.off("mouse:up", onUp);
    };
  }, [activeCanvas, manualSync]);
}
