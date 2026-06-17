import { getStorageKey } from "./canvasStorageManager";
import * as fabric from "fabric";

const MARKETPLACE_API = import.meta.env.VITE_MARKETPLACE_API || "http://localhost:3001/api";

// Надсилає замовлення з конструктора у маркетплейс-API.
// Сервер зберігає його в адмінці ТА надсилає сповіщення в Telegram
// (токен бота — лише на сервері). Прев'ю макетів передаємо в полі images.
export const sendOrderToMarketplace = async (cartItems, customerDetails) => {
  // images — стиснені прев'ю (інлайн у чаті); documents — друкарські макети
  // у повній роздільності (Telegram надсилає їх без перестиску → готові до друку).
  const images = [];
  const documents = [];
  for (const item of cartItems) {
    if (item.designTextureFront) {
      images.push({ data: item.designTextureFront, caption: `${item.productName} — Спереду` });
    }
    if (item.designTextureBack) {
      images.push({ data: item.designTextureBack, caption: `${item.productName} — Ззаду` });
    }
    if (item.printFront) {
      documents.push({ data: item.printFront, caption: `🖨 ${item.productName} — Спереду (друк)` });
    }
    if (item.printBack) {
      documents.push({ data: item.printBack, caption: `🖨 ${item.productName} — Ззаду (друк)` });
    }
  }

  const payload = {
    source: "designer",
    customer: {
      name: customerDetails.name,
      phone: customerDetails.phone,
      notes: customerDetails.comment || null,
    },
    items: cartItems.map((item) => ({
      product_name: item.productName,
      product_type: item.productType,
      color: item.color || null,
      // Розмір/папір/колір одним підписом → сервер збереже як variant_label.
      variant_label: item.variantLabel || null,
      quantity: item.quantity,
      // Сам макет: fabric JSON (front+back) + прев'ю — сервер збереже в позицію заказу.
      design_data: JSON.stringify({ front: item.fabricFront || null, back: item.fabricBack || null }),
      design_preview: item.designTextureFront || null,
      // Друкарські макети у повній роздільності — сервер збереже на диск для адмінки.
      print_front: item.printFront || null,
      print_back: item.printBack || null,
      raw_front: item.rawDesignFront || null,
      raw_back: item.rawDesignBack || null,
    })),
    images,
    documents,
  };

  const res = await fetch(`${MARKETPLACE_API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Marketplace API error: ${res.status}`);
  }
  return res.json();
};

// Прямокутник зони друку (clipPath) у логічних координатах полотна.
// Використовуємо canvas.printArea (задається в useTshirtCanvas) напряму.
const printRegion = (fabricCanvas) => {
  if (fabricCanvas?.printArea) {
    const { left, top, width, height } = fabricCanvas.printArea;
    return {
      left,
      top,
      width: Math.min(width, fabricCanvas.width - left),
      height: Math.min(height, fabricCanvas.height - top),
    };
  }
  return { left: 0, top: 0, width: fabricCanvas.width, height: fabricCanvas.height };
};

// Обрізання регіону полотна з підтримкою високої роздільності для друку.
//
// Коли multiplier > 1 (тобто завжди при генерації print-файлу): Fabric.js
// перерендерює ВСІ об'єкти (текст, фото, форми) через toCanvasElement(multiplier),
// використовуючи оригінальні пікселі зображення, а не екранний растр.
// Це усуває розмиття від двократного масштабування (render-down → scale-up).
//
// Коли multiplier ≤ 1 (UI-прев'ю, ескізи): читаємо з lowerCanvasEl — дешево і
// достатньо. lowerCanvasEl зберігається у фізичних пікселях (width = logical * DPR),
// тому враховуємо DPR при розрахунку координат зрізу.
const cropCanvasToRegion = (fabricCanvas, region, multiplier = 1) => {
  const src = fabricCanvas.lowerCanvasEl;
  if (!src) return null;
  const dstW = Math.round(region.width * multiplier);
  const dstH = Math.round(region.height * multiplier);
  if (!dstW || !dstH) return null;
  const off = document.createElement("canvas");
  off.width = dstW;
  off.height = dstH;
  const ctx = off.getContext("2d");

  if (multiplier > 1) {
    // Fabric re-renders all objects at target scale → original image resolution used.
    // toDataURL({left,top,…}) з enableRetinaScaling нестабільний у Fabric v6,
    // тому рендеримо повний canvas і вручну кропаємо зону друку.
    const hiRes = fabricCanvas.toCanvasElement(multiplier);
    ctx.drawImage(
      hiRes,
      Math.round(region.left  * multiplier),
      Math.round(region.top   * multiplier),
      dstW, dstH,
      0, 0, dstW, dstH,
    );
  } else {
    // Preview path: read from lowerCanvasEl (screen-res, cheap).
    const dpr = src.width / (fabricCanvas.width || 1);
    ctx.drawImage(
      src,
      Math.round(region.left  * dpr),
      Math.round(region.top   * dpr),
      Math.round(region.width  * dpr),
      Math.round(region.height * dpr),
      0, 0, dstW, dstH,
    );
  }

  return off.toDataURL("image/png");
};

// Composite helper for template formats (polaroid, instax, phone-case).
// Canvas pixels are clipped to the print zone (destination-in), templateImg is an
// HTML Image stored on the canvas instance. We draw: white → frame → design.
const compositeTemplate = (fabricCanvas) => {
  const templateImg = fabricCanvas.templateImg;
  if (!templateImg || !templateImg.complete || !templateImg.naturalWidth) return null;
  const w = fabricCanvas.width;
  const h = fabricCanvas.height;
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(templateImg, 0, 0, w, h);
  // Явно вказуємо w/h: Fabric у режимі DPR>1 зберігає lowerCanvasEl у фізичних
  // пікселях (width = w * dpr), без розмірів drawImage малює canvas занадто великим.
  ctx.drawImage(fabricCanvas.lowerCanvasEl, 0, 0, w, h);
  return off.toDataURL("image/png");
};

// canvasSyncManager.js
export const canvasSyncManager = {
  // Прев'ю для UI.
  // Для template-форматів (templateImg є) повертає ПОВНЕ полотно — Fabric clipPath
  // вже забезпечує прозорість поза зоною друку, тому ProductPreview просто накладає
  // текстуру на рамку шаблону через inset-0 без CSS-зміщень.
  // Для інших форматів повертає лише вміст зони друку.
  getCanvasTexture: (fabricCanvas, { multiplier = 1 } = {}) => {
    if (!fabricCanvas) return null;
    try {
      fabricCanvas.renderAll();
      // isTemplate встановлюється синхронно в useTshirtCanvas при наявності templateOverlay,
      // навіть до того як templateImg завантажиться.
      const region = fabricCanvas.isTemplate
        ? { left: 0, top: 0, width: fabricCanvas.width, height: fabricCanvas.height }
        : printRegion(fabricCanvas);
      return cropCanvasToRegion(fabricCanvas, region, multiplier);
    } catch (error) {
      console.error("Error generating texture:", error);
      return null;
    }
  },

  // Сирий кроп зони друку — без рамки шаблону, без мокапу.
  // Для template-форматів: тільки фото клієнта (не повне полотно, не рамка).
  // Для всіх інших: те саме, що і кроп printRegion.
  getRawDesignTexture: (fabricCanvas, { multiplier = 1 } = {}) => {
    if (!fabricCanvas) return null;
    try {
      fabricCanvas.renderAll();
      const region = printRegion(fabricCanvas);
      return cropCanvasToRegion(fabricCanvas, region, multiplier);
    } catch (error) {
      console.error("Error generating raw texture:", error);
      return null;
    }
  },

  // Друкарський макет: лише зона друку, у максимальній роздільності.
  // Для template-форматів полотно вже у повній друкарській роздільності (300 DPI),
  // тому просто компонуємо: білий папір → рамка шаблону → дизайн замовника.
  getPrintTexture: (fabricCanvas, { targetLongSide = 2400, maxMultiplier = 12 } = {}) => {
    if (!fabricCanvas) return null;
    try {
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();

      // Template formats: canvas is already at 300 DPI — composite and return as-is.
      if (fabricCanvas.templateImg) {
        return compositeTemplate(fabricCanvas) ?? fabricCanvas.toDataURL({ format: "png", quality: 1 });
      }

      const region = printRegion(fabricCanvas);
      const longest = Math.max(region.width, region.height) || 1;
      const multiplier = Math.max(1, Math.min(maxMultiplier, targetLongSide / longest));
      return cropCanvasToRegion(fabricCanvas, region, multiplier);
    } catch (error) {
      console.error("Error generating print texture:", error);
      return null;
    }
  },

  // Мокап «дизайн на товарі»: малює силует (Path2D) обраного кольору + дизайн
  // у зоні друку → PNG data URL. Для прев'ю в кошику/Telegram (а не голий принт).
  // Для template-форматів (templateOverlay є, path — ні): компонує білий фон + рамку + дизайн,
  // щоб прев'ю в адмінці показувало готовий виріб, а не голий прозорий холст.
  buildMockup: ({ path, viewBox = "0 0 810 810", printZone, color = "#ffffff", design, bg = "#f1f5f9", templateOverlay }) =>
    new Promise((resolve) => {
      try {
        if (!path) {
          if (templateOverlay && design) {
            const [, , vbW, vbH] = String(viewBox).split(/\s+/).map(Number);
            const w = vbW || 810;
            const h = vbH || 810;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, w, h);
            const overlay = new Image();
            overlay.onload = () => {
              ctx.drawImage(overlay, 0, 0, w, h);
              const designImg = new Image();
              designImg.onload = () => {
                ctx.drawImage(designImg, 0, 0, w, h);
                resolve(canvas.toDataURL("image/jpeg", 0.85));
              };
              designImg.onerror = () => resolve(design);
              designImg.src = design;
            };
            overlay.onerror = () => resolve(design);
            overlay.src = templateOverlay;
            return;
          }
          return resolve(design || null);
        }
        const [, , vbW, vbH] = String(viewBox).split(/\s+/).map(Number);
        const w = vbW || 810;
        const h = vbH || 810;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const silhouette = new Path2D(path);
        ctx.fillStyle = color;
        ctx.fill(silhouette);
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#111827";
        ctx.lineJoin = "round";
        ctx.stroke(silhouette);

        const finish = () => resolve(canvas.toDataURL("image/jpeg", 0.85));

        if (design && printZone) {
          const dimg = new Image();
          dimg.onload = () => {
            const pz = printZone;
            const ar = dimg.width / dimg.height || 1;
            const pzar = pz.width / pz.height;
            // вписуємо дизайн у зону друку зі збереженням пропорцій (contain)
            let dw, dh;
            if (ar > pzar) {
              dw = pz.width;
              dh = pz.width / ar;
            } else {
              dh = pz.height;
              dw = pz.height * ar;
            }
            ctx.drawImage(dimg, pz.x + (pz.width - dw) / 2, pz.y + (pz.height - dh) / 2, dw, dh);
            finish();
          };
          dimg.onerror = finish;
          dimg.src = design;
        } else {
          finish();
        }
      } catch (error) {
        console.error("buildMockup error", error);
        resolve(design || null);
      }
    }),

  getCanvasTextureFromStorage: (view, productId) => {
    return new Promise((resolve, reject) => {
      try {
        const storageKey = getStorageKey(view, productId);

        const storedObjects = localStorage.getItem(storageKey);
        if (!storedObjects) {
          resolve(null);
          return;
        }

        // Parse the stored JSON objects
        const parsedObjects = JSON.parse(storedObjects);

        // Create a temporary canvas
        const tempCanvas = new fabric.Canvas(null, {
          width: 450, // Set appropriate width
          height: 500, // Set appropriate height
        });

        // Use fabric.util.enlivenObjects to recreate canvas objects
        fabric.util.enlivenObjects(
          parsedObjects,
          (objects) => {
            // Add recreated objects to the canvas
            objects.forEach((obj) => {
              tempCanvas.add(obj);
            });

            // Generate texture
            let options = {
              format: "png",
              quality: 1,
              multiplier: 1,
              enableRetinaScaling: true,
            };

            if (tempCanvas.clipPath) {
              const bbox = tempCanvas.clipPath.getBoundingRect();
              options = {
                ...options,
                left: bbox.left,
                top: bbox.top,
                width: Math.min(bbox.width, tempCanvas.width - bbox.left),
                height: Math.min(bbox.height, tempCanvas.height - bbox.top)
              };
            }

            const dataURL = tempCanvas.toDataURL(options);

            resolve(dataURL);
          },
          (error) => {
            console.error("Error enlivening objects:", error);
            resolve(null);
          }
        );
      } catch (error) {
        console.error("Error retrieving canvas texture from storage:", error);
        reject(error);
      }
    });
  },

  // utility function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
};
