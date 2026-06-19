// Розкладки колажів. Кожен слот — прямокутник у частках від зони друку
// { x, y, w, h } (0..1). Між слотами автоматично віднімається проміжок (gutter).
// Фото, вставлене у слот, кадрується по ньому (clipPath) і вільно рухається/масштабується.

export const COLLAGE_LAYOUTS = [
  {
    id: "2v", label: "2 вертикально", cols: 2,
    slots: [ { x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 } ],
  },
  {
    id: "2h", label: "2 горизонтально", cols: 2,
    slots: [ { x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 } ],
  },
  {
    id: "3v", label: "3 в ряд", cols: 3,
    slots: [
      { x: 0, y: 0, w: 1 / 3, h: 1 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 1 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ],
  },
  {
    id: "1+2", label: "1 + 2", cols: 2,
    slots: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "2+1", label: "2 + 1", cols: 2,
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "4grid", label: "Сітка 2×2", cols: 2,
    slots: [
      { x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "1+3", label: "1 + 3", cols: 3,
    slots: [
      { x: 0, y: 0, w: 1, h: 0.6 },
      { x: 0, y: 0.6, w: 1 / 3, h: 0.4 }, { x: 1 / 3, y: 0.6, w: 1 / 3, h: 0.4 }, { x: 2 / 3, y: 0.6, w: 1 / 3, h: 0.4 },
    ],
  },
  {
    id: "3+1big", label: "Велике + 3", cols: 2,
    slots: [
      { x: 0, y: 0, w: 2 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 1 / 3, w: 1 / 3, h: 1 / 3 }, { x: 2 / 3, y: 2 / 3, w: 1 / 3, h: 1 / 3 },
    ],
  },
  {
    id: "6grid", label: "Сітка 3×2", cols: 3,
    slots: [
      { x: 0, y: 0, w: 1 / 3, h: 0.5 }, { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 }, { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
];

// Абсолютний прямокутник слоту в координатах полотна з урахуванням проміжку.
export function slotRect(slot, area, gutterFrac = 0.012) {
  const g = Math.min(area.width, area.height) * gutterFrac;
  return {
    left: area.left + slot.x * area.width + g / 2,
    top: area.top + slot.y * area.height + g / 2,
    width: slot.w * area.width - g,
    height: slot.h * area.height - g,
  };
}
