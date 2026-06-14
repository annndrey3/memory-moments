import { getStorageKey } from "./canvasStorageManager";
import * as fabric from "fabric";

const MARKETPLACE_API = import.meta.env.VITE_MARKETPLACE_API || "http://localhost:3001/api";

// Надсилає замовлення з конструктора у маркетплейс-API.
// Сервер зберігає його в адмінці ТА надсилає сповіщення в Telegram
// (токен бота — лише на сервері). Прев'ю макетів передаємо в полі images.
export const sendOrderToMarketplace = async (cartItems, customerDetails) => {
  const images = [];
  for (const item of cartItems) {
    if (item.designTextureFront) {
      images.push({ data: item.designTextureFront, caption: `${item.productName} — Спереду` });
    }
    if (item.designTextureBack) {
      images.push({ data: item.designTextureBack, caption: `${item.productName} — Ззаду` });
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
      quantity: item.quantity,
      // Сам макет: fabric JSON (front+back) + прев'ю — сервер збереже в позицію заказу.
      design_data: JSON.stringify({ front: item.fabricFront || null, back: item.fabricBack || null }),
      design_preview: item.designTextureFront || null,
    })),
    images,
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

// canvasSyncManager.js
export const canvasSyncManager = {
  getCanvasTexture: (fabricCanvas) => {
    if (!fabricCanvas) return null;
    try {
      // Force a render before getting the texture
      fabricCanvas.renderAll();

      let options = {
        format: "png",
        quality: 1,
        multiplier: 1,
        enableRetinaScaling: true,
      };

      if (fabricCanvas.clipPath) {
        const bbox = fabricCanvas.clipPath.getBoundingRect();
        options = {
          ...options,
          left: bbox.left,
          top: bbox.top,
          width: Math.min(bbox.width, fabricCanvas.width - bbox.left),
          height: Math.min(bbox.height, fabricCanvas.height - bbox.top)
        };
      }

      // Use the upper canvas which contains the actual visible content
      const dataURL = fabricCanvas.toDataURL(options);

      return dataURL;
    } catch (error) {
      console.error("Error generating texture:", error);
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
