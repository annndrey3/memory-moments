export const STORAGE_KEYS = {
  FRONT_CANVAS: "tshirt-designer-front",
  BACK_CANVAS: "tshirt-designer-back",
};

export const getStorageKey = (view, productId = "crew-neck") =>
  `memory-moments-${productId}-${view}`;

const canvasStorageManager = {
  // Save canvas objects
  saveCanvasObjects: (view, canvas, productId) => {
    if (!canvas) return;
    try {
      const storageKey = getStorageKey(view, productId);

      // Clear existing design for this view before saving
      localStorage.removeItem(storageKey);
      // Get and save new objects
      const objects = canvas.getObjects().map((obj) => obj.toJSON());

      localStorage.setItem(
        storageKey,
        JSON.stringify(objects)
      );
    } catch (error) {
      console.error("Error saving canvas objects:", error);
    }
  },

  // Load canvas objects
  loadCanvasObjects: (view, productId) => {
    try {
      const stored = localStorage.getItem(getStorageKey(view, productId));

      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error("Error loading canvas objects:", error);
      return null;
    }
  },

  // Clear stored objects for a specific view
  clearCanvasStorage: (view, productId) => {
    if (view === "all") {
      Object.keys(localStorage)
        .filter((key) => key.startsWith("memory-moments-"))
        .forEach((key) => localStorage.removeItem(key));
    } else {
      localStorage.removeItem(getStorageKey(view, productId));
    }
  },

  // Setup canvas event listeners for auto-saving
  // setupCanvasAutoSave: (canvas, view) => {
  //   if (!canvas) return;

  //   const events = [
  //     "object:modified",
  //     "object:added",
  //     "object:removed",
  //     "path:created",
  //   ];

  //   events.forEach((eventType) => {
  //     canvas.on(eventType, () => {
  //       canvasStorageManager.saveCanvasObjects(view, canvas);
  //     });
  //   });
  // },
};

export default canvasStorageManager;
