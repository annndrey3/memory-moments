// Розкладки колажів. Кожен слот — прямокутник у частках від зони друку
// { x, y, w, h } (0..1). Між слотами автоматично віднімається проміжок (gutter).
// Фото, вставлене у слот, кадрується по ньому (clipPath) і вільно рухається/масштабується.
//
// ВАЖЛИВО: слоти кожної розкладки ТОЧНО викладають квадрат без перекриття
// (сума площ = 1, межі співпадають) — тож фото в сусідніх комірках не налазять одне
// на одне. Сітки будуються хелпером grid(), решта — задані явно і також не перетинаються.

// Рівномірна сітка cols×rows (зліва-направо, зверху-вниз).
const grid = (cols, rows) => {
  const s = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      s.push({ x: i / cols, y: j / rows, w: 1 / cols, h: 1 / rows });
  return s;
};
const T = 1 / 3;
const Q = 1 / 4;

export const COLLAGE_LAYOUTS = [
  // ── 2 фото ──
  { id: "2v", label: "2 поруч", cols: 2,
    slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  { id: "2h", label: "2 в стовпчик", cols: 1,
    slots: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }] },
  { id: "2v-asym", label: "Вузька + широка", cols: 2,
    slots: [{ x: 0, y: 0, w: T, h: 1 }, { x: T, y: 0, w: 2 * T, h: 1 }] },
  { id: "2h-asym", label: "Смужка + велике", cols: 1,
    slots: [{ x: 0, y: 0, w: 1, h: T }, { x: 0, y: T, w: 1, h: 2 * T }] },

  // ── 3 фото ──
  { id: "3v", label: "3 в ряд", cols: 3, slots: grid(3, 1) },
  { id: "3h", label: "3 в стовпчик", cols: 1, slots: grid(1, 3) },
  { id: "1+2", label: "1 + 2", cols: 2,
    slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  { id: "2+1", label: "2 + 1", cols: 2,
    slots: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 1 }] },
  { id: "1-2", label: "1 зверху, 2 знизу", cols: 2,
    slots: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },
  { id: "2-1", label: "2 зверху, 1 знизу", cols: 2,
    slots: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }] },
  { id: "3v-center", label: "Широке в центрі", cols: 3,
    slots: [{ x: 0, y: 0, w: Q, h: 1 }, { x: Q, y: 0, w: 0.5, h: 1 }, { x: 0.75, y: 0, w: Q, h: 1 }] },

  // ── 4 фото ──
  { id: "4grid", label: "Сітка 2×2", cols: 2, slots: grid(2, 2) },
  { id: "4v", label: "4 в ряд", cols: 4, slots: grid(4, 1) },
  { id: "4h", label: "4 в стовпчик", cols: 1, slots: grid(1, 4) },
  { id: "1+3", label: "1 + 3 (зверху)", cols: 3,
    slots: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: T, h: 0.4 }, { x: T, y: 0.6, w: T, h: 0.4 }, { x: 2 * T, y: 0.6, w: T, h: 0.4 }] },
  { id: "3+1", label: "3 + 1 (знизу)", cols: 3,
    slots: [{ x: 0, y: 0, w: T, h: 0.4 }, { x: T, y: 0, w: T, h: 0.4 }, { x: 2 * T, y: 0, w: T, h: 0.4 }, { x: 0, y: 0.4, w: 1, h: 0.6 }] },
  { id: "3+1big", label: "Велике + 3 (збоку)", cols: 2,
    slots: [{ x: 0, y: 0, w: 2 * T, h: 1 }, { x: 2 * T, y: 0, w: T, h: T }, { x: 2 * T, y: T, w: T, h: T }, { x: 2 * T, y: 2 * T, w: T, h: T }] },
  { id: "1L+3R", label: "Велике зліва + 3", cols: 2,
    slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: T }, { x: 0.5, y: T, w: 0.5, h: T }, { x: 0.5, y: 2 * T, w: 0.5, h: T }] },

  // ── 5 фото ──
  { id: "5v", label: "5 в ряд", cols: 5, slots: grid(5, 1) },
  { id: "1+4grid", label: "Велике + сітка", cols: 3,
    slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: Q, h: 0.5 }, { x: 0.75, y: 0, w: Q, h: 0.5 }, { x: 0.5, y: 0.5, w: Q, h: 0.5 }, { x: 0.75, y: 0.5, w: Q, h: 0.5 }] },
  { id: "1+4row", label: "1 зверху + 4", cols: 4,
    slots: [{ x: 0, y: 0, w: 1, h: 0.6 }, { x: 0, y: 0.6, w: Q, h: 0.4 }, { x: Q, y: 0.6, w: Q, h: 0.4 }, { x: 0.5, y: 0.6, w: Q, h: 0.4 }, { x: 0.75, y: 0.6, w: Q, h: 0.4 }] },
  { id: "2+3", label: "2 + 3", cols: 3,
    slots: [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: T, h: 0.5 }, { x: T, y: 0.5, w: T, h: 0.5 }, { x: 2 * T, y: 0.5, w: T, h: 0.5 }] },
  { id: "3+2", label: "3 + 2", cols: 3,
    slots: [{ x: 0, y: 0, w: T, h: 0.5 }, { x: T, y: 0, w: T, h: 0.5 }, { x: 2 * T, y: 0, w: T, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }] },

  // ── 6 фото ──
  { id: "6grid", label: "Сітка 3×2", cols: 3, slots: grid(3, 2) },
  { id: "6grid-v", label: "Сітка 2×3", cols: 2, slots: grid(2, 3) },
  { id: "1+5L", label: "Велике + 5 (кутом)", cols: 3,
    slots: [
      { x: 0, y: 0, w: 2 * T, h: 2 * T },
      { x: 2 * T, y: 0, w: T, h: T }, { x: 2 * T, y: T, w: T, h: T },
      { x: 0, y: 2 * T, w: T, h: T }, { x: T, y: 2 * T, w: T, h: T }, { x: 2 * T, y: 2 * T, w: T, h: T },
    ] },
  { id: "6v", label: "6 в ряд", cols: 6, slots: grid(6, 1) },

  // ── 8 / 9 / 12 фото ──
  { id: "8grid", label: "Сітка 4×2", cols: 4, slots: grid(4, 2) },
  { id: "9grid", label: "Сітка 3×3", cols: 3, slots: grid(3, 3) },
  { id: "12grid", label: "Сітка 4×3", cols: 4, slots: grid(4, 3) },
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
