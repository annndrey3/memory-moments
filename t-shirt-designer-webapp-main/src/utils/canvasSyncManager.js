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

// Прямокутник зони друку (clipPath) у координатах полотна — куди обрізати експорт.
const printRegion = (fabricCanvas) => {
  if (!fabricCanvas?.clipPath) {
    return { left: 0, top: 0, width: fabricCanvas.width, height: fabricCanvas.height };
  }
  const b = fabricCanvas.clipPath.getBoundingRect();
  return {
    left: b.left,
    top: b.top,
    width: Math.min(b.width, fabricCanvas.width - b.left),
    height: Math.min(b.height, fabricCanvas.height - b.top),
  };
};

// canvasSyncManager.js
export const canvasSyncManager = {
  // Прев'ю для UI/3D — швидке, у роздільності полотна (multiplier 1 за замовч.).
  getCanvasTexture: (fabricCanvas, { multiplier = 1 } = {}) => {
    if (!fabricCanvas) return null;
    try {
      // Force a render before getting the texture
      fabricCanvas.renderAll();

      const dataURL = fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier,
        enableRetinaScaling: true,
        ...printRegion(fabricCanvas),
      });

      return dataURL;
    } catch (error) {
      console.error("Error generating texture:", error);
      return null;
    }
  },

  // Друкарський макет: лише зона друку, у максимальній роздільності.
  // Множник підбираємо так, щоб довша сторона зони сягнула targetLongSide
  // (≈300 DPI для типового розміру). Fabric ре-рендерить ОРИГІНАЛЬНІ зображення
  // (вони зберігаються в повній якості й лише масштабуються), тож ми отримуємо
  // фактично вихідну якість, обрізану по зоні друку. Множник обмежений, щоб
  // не з'їсти забагато пам'яті на слабких пристроях.
  getPrintTexture: (fabricCanvas, { targetLongSide = 2400, maxMultiplier = 12 } = {}) => {
    if (!fabricCanvas) return null;
    try {
      fabricCanvas.discardActiveObject(); // прибрати рамку виділення з експорту
      fabricCanvas.renderAll();

      const region = printRegion(fabricCanvas);
      const longest = Math.max(region.width, region.height) || 1;
      const multiplier = Math.max(1, Math.min(maxMultiplier, targetLongSide / longest));

      return fabricCanvas.toDataURL({
        format: "png",
        quality: 1,
        multiplier,
        enableRetinaScaling: false, // точний множник без подвоєння на retina
        ...region,
      });
    } catch (error) {
      console.error("Error generating print texture:", error);
      return null;
    }
  },

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
