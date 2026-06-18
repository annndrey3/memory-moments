import { useEffect, useState } from "react";
import { fetchDesignerPrices } from "@/utils/canvasSyncManager";

// Завантажує ціни конструктора один раз:
//   types  — designer_type → {price, compare_at_price, name} (чашка, фото…)
//   tshirt — футболка з ПРАЙСУ: { white:{A4,A3}, black:{A4,A3}, secondSide:{A4,A3} }
// Повертає priceFor(type) і tshirtPrice({color, printSize, bothSides}).
// Поки не завантажено / немає даних — null, тоді панель пише «розрахуємо при оформленні».
export function usePricing() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchDesignerPrices().then((d) => {
      if (alive) setData(d && d.types ? d : { types: {}, tshirt: {} });
    });
    return () => {
      alive = false;
    };
  }, []);

  const priceFor = (productType) => data?.types?.[productType] || null;

  // Ціна полотна за розміром ("30x40" → число) з прайсу.
  const canvasPrice = (size) => {
    const p = data?.canvas?.[size];
    return p != null ? Number(p) : null;
  };

  // Ціна футболки з прайсу: біла/чорна × А4/А3 + друга сторона (якщо обидві сторони).
  const tshirtPrice = ({ color, printSize, bothSides }) => {
    const t = data?.tshirt;
    if (!t) return null;
    const size = printSize === "A3" ? "A3" : "A4";
    const colorKey = String(color).toUpperCase() === "#FFFFFF" ? "white" : "black";
    const base = t[colorKey]?.[size];
    if (base == null) return null;
    const second = bothSides ? Number(t.secondSide?.[size] || 0) : 0;
    return { base: Number(base), second, total: Number(base) + second };
  };

  return { priceFor, tshirtPrice, canvasPrice, loaded: data !== null };
}
