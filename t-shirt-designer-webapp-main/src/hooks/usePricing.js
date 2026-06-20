import { useEffect, useState } from "react";
import { fetchDesignerPrices } from "@/utils/canvasSyncManager";
import { isBookType } from "@/constants/designConstants";

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

  // Ціна фотокниги (slim/print) за типом: база (10/15) + доплата за одиницю понад базу.
  const bookPrice = ({ type, format, spreads, extra }) => {
    const matrix = type === "print-book" ? data?.printBook : data?.slimBook;
    const row = matrix?.[format];
    if (!row) return null;
    const base = Number(spreads) === 15 ? row.s15 : row.s10;
    if (base == null) return null;
    const extraN = Math.max(0, Number(extra) || 0);
    const extraPrice = row.extra != null ? extraN * Number(row.extra) : 0;
    return Number(base) + extraPrice;
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

  // Ціна вже доданої позиції кошика (одиниця, без кількості) — та сама логіка,
  // що в OrderBar, але з полів позиції. Повертає число або null (ще не завантажено
  // / немає коду в прайсі), null → у кошику покажемо «уточнимо при оформленні».
  const cartItemPrice = (item) => {
    if (!item) return null;
    const type = item.productType;
    if (type === "crew-neck") {
      const bothSides = Boolean(item.printFront) && Boolean(item.printBack);
      const tp = tshirtPrice({ color: item.color, printSize: item.printSize, bothSides });
      return tp ? tp.total : null;
    }
    if (type === "canvas") return canvasPrice(item.canvasSize);
    if (isBookType(type)) {
      return bookPrice({ type, format: item.slimBookFormat, spreads: item.slimBookSpreads, extra: item.slimBookExtra });
    }
    const p = priceFor(type);
    return p ? Number(p.price) : null;
  };

  // Стартова («від») ціна товару без дизайну — для плиток кросс-селлу в кошику.
  const productStartingPrice = (type) => {
    if (type === "crew-neck") {
      const tp = tshirtPrice({ color: "#FFFFFF", printSize: "A4", bothSides: false });
      return tp ? tp.base : null;
    }
    if (type === "canvas") return canvasPrice("30x40");
    if (isBookType(type)) return bookPrice({ type, format: "21x30", spreads: 10, extra: 0 });
    const p = priceFor(type);
    return p ? Number(p.price) : null;
  };

  // Відсоток знижки за кількістю фото (пороги з адмінки або дефолт). Та сама
  // система знижок, що на сайті/в прайсі — застосовується й до пачки фото.
  const photoDiscountPct = (count) => {
    const tiers = (Array.isArray(data?.discountTiers) && data.discountTiers.length ? data.discountTiers : DEFAULT_TIERS)
      .map((t) => ({ min: Number(t.min), pct: Number(t.pct) }))
      .filter((t) => t.min > 0)
      .sort((a, b) => b.min - a.min);
    for (const t of tiers) if (count >= t.min) return t.pct;
    return 0;
  };

  return { priceFor, tshirtPrice, canvasPrice, bookPrice, cartItemPrice, productStartingPrice, photoDiscountPct, loaded: data !== null };
}

// Фолбек-пороги (якщо адмінка не повернула) — збігаються з дефолтами сервера.
const DEFAULT_TIERS = [
  { min: 400, pct: 30 }, { min: 300, pct: 25 }, { min: 200, pct: 20 },
  { min: 150, pct: 15 }, { min: 100, pct: 10 }, { min: 50, pct: 5 },
];
