import { createContext, useState, useContext } from "react";

const CanvasContext = createContext(null);

export const CanvasProvider = ({ children }) => {
  const [frontCanvas, setFrontCanvas] = useState(null);
  const [backCanvas, setBackCanvas] = useState(null);
  const [canvasesByKey, setCanvasesByKey] = useState({});
  const [activeCanvas, setActiveCanvas] = useState(null);
  const [selectedObject, setSelectedObject] = useState(null);

  const getCanvasKey = (productId, view) => `${productId}-${view}`;

  const registerCanvas = (productId, view, canvas) => {
    const key = getCanvasKey(productId, view);
    setCanvasesByKey((current) => ({
      ...current,
      [key]: canvas,
    }));
  };

  const unregisterCanvas = (productId, view, canvas) => {
    const key = getCanvasKey(productId, view);
    setCanvasesByKey((current) => {
      if (current[key] !== canvas) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const getCanvas = (productId, view) =>
    canvasesByKey[getCanvasKey(productId, view)] || null;

  return (
    <CanvasContext.Provider
      value={{
        frontCanvas,
        setFrontCanvas,
        backCanvas,
        setBackCanvas,
        activeCanvas,
        setActiveCanvas,
        selectedObject,
        setSelectedObject,
        registerCanvas,
        unregisterCanvas,
        getCanvas,
        canvasesByKey,
      }}
    >
      {children}
    </CanvasContext.Provider>
  );
};

export const useCanvas = () => useContext(CanvasContext);
