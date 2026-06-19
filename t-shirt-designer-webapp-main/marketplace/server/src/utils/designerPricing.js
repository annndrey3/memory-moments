// ── Єдине джерело цін конструктора: прайс-лист (таблиця services). ──
// Кожен designer_type прив'язаний до рядка прайсу за стабільним кодом (+формат).
// Правка ціни в адмінці (прайс) одразу діє і в живій ціні конструктора, і при
// оформленні. Використовується і products.js (жива ціна), і orders.js (чек-аут).
//
// Формати в прайсі — кирилична «х» (10х15). Тут порівнюємо нормалізовано
// (х→x, нижній регістр, без пробілів) через includes, щоб уникнути пастки кодування.

// Футболка Soft Style: біла(985)/чорна(986) × А4/А3 + друга сторона(1353).
const TSHIRT_CODES = { white: "985", black: "986", secondSide: "1353" };
// Полотно (натяжка): «Широкоформатний друк (полотно+натяжка)» — код 44, формат = розмір.
const CANVAS_CODE = "44";

// Решта позицій → один рядок прайсу. fmt — токен розміру (нормалізований).
// Позиції без точного аналога позначені // ~прибл. (фолбек на каталог, якщо рядка нема).
export const DESIGNER_SERVICE_MAP = {
  mug: { code: "217" },                          // Чашка біла — 220
  "mug-giant": { code: "268" },                  // Чашка велетень — 270
  "mug-magic": { code: "265" },                  // Чашка Магічна (хамелеон) — 300
  "mug-color": { code: "220" },                  // Чашка кольорова всередині та ручка — 250
  "mug-text-inside": { code: "256" },            // Чашка з написами всередині — 270
  polaroid: { code: "110", fmt: "10x12" },       // Друк фото, полароїд 10х12
  "polaroid-10x12-h": { code: "110", fmt: "10x12" },
  "polaroid-8x10-v": { code: "110", fmt: "10x12" },
  "polaroid-8x10-h": { code: "110", fmt: "10x12" },
  "instax-mini": { code: "110", fmt: "10x12" },  // ~прибл. (в прайсі немає Instax)
  "photo-10x15": { code: "110", fmt: "10x15" },
  "photo-15x10": { code: "110", fmt: "10x15" },
  "photo-13x18": { code: "110", fmt: "13x18" },
  "photo-18x13": { code: "110", fmt: "13x18" },
  "photo-15x21": { code: "110", fmt: "15x20" },  // ~прибл. (15×21 ≈ 15×20)
  "photo-21x15": { code: "110", fmt: "15x20" },  // ~прибл.
  "photo-a4-p": { code: "110", fmt: "21x30" },   // A4 ≈ 21×30
  "photo-a4-l": { code: "110", fmt: "21x30" },
  "photo-square": { code: "110", fmt: "15x20" }, // ~прибл. (квадрат)
  // "phone-case": немає аналога в прайсі → фолбек на каталог (products.designer_type)
};

const norm = (s) =>
  String(s ?? "").toLowerCase().replace(/\s+/g, "").replace(/х/g, "x"); // кир. х → лат. x

const sizeKeyOf = (f) => (String(f).includes("3") ? "A3" : String(f).includes("4") ? "A4" : null);

// Матриця цін футболки з рядків services: { white:{A4,A3}, black:{A4,A3}, secondSide:{A4,A3} }.
export function buildTshirtMatrix(services) {
  const tshirt = { white: {}, black: {}, secondSide: {} };
  for (const r of services || []) {
    const code = String(r.code);
    const bucket =
      code === TSHIRT_CODES.white ? "white" : code === TSHIRT_CODES.black ? "black" : code === TSHIRT_CODES.secondSide ? "secondSide" : null;
    if (!bucket) continue;
    const k = sizeKeyOf(r.format);
    if (!k) continue;
    tshirt[bucket][k] = Number(r.price);
  }
  return tshirt;
}

// Ціна футболки: колір + формат (+ друга сторона). null, якщо в прайсі нема рядка.
export function tshirtPriceFromServices(services, { color, printSize, bothSides }) {
  const m = buildTshirtMatrix(services);
  const size = printSize === "A3" ? "A3" : "A4";
  const colorKey = String(color).toUpperCase() === "#FFFFFF" ? "white" : "black";
  const base = m[colorKey]?.[size];
  if (base == null) return null;
  const second = bothSides ? Number(m.secondSide?.[size] || 0) : 0;
  return base + second;
}

// Матриця цін полотна з прайсу: { "30x40": 660, "40x50": 960, ... }.
export function buildCanvasMatrix(services) {
  const canvas = {};
  for (const r of services || []) {
    if (String(r.code) !== CANVAS_CODE) continue;
    const key = norm(r.format);
    if (key) canvas[key] = Number(r.price);
  }
  return canvas;
}

// Ціна полотна за обраним розміром (напр. "30x40"). null, якщо нема рядка в прайсі.
export function canvasPriceFromServices(services, sizeStr) {
  const m = buildCanvasMatrix(services);
  const key = norm(sizeStr);
  return m[key] != null ? m[key] : null;
}

// ── Фотокниги: база 10/15 + доплата за одиницю понад базу. Коди за типом. ──
//  slim-book:  10→1136, 15→1137, дод.→1138 (розворотами)
//  print-book: 10→1135, 15→1132, дод.→1133 (листами; 10 листів = 20 сторінок)
export const BOOK_CODES = {
  "slim-book": { s10: "1136", s15: "1137", extra: "1138" },
  "print-book": { s10: "1135", s15: "1132", extra: "1133" },
};

// Матриця для типу книги: { "20x20": { s10, s15, extra }, "21x30": {...}, ... }.
export function buildBookMatrix(services, type) {
  const codes = BOOK_CODES[type];
  if (!codes) return {};
  const out = {};
  for (const r of services || []) {
    const code = String(r.code);
    const bucket = code === codes.s10 ? "s10" : code === codes.s15 ? "s15" : code === codes.extra ? "extra" : null;
    if (!bucket) continue;
    const fmt = norm(r.format);
    if (!fmt) continue;
    (out[fmt] ||= {})[bucket] = Number(r.price);
  }
  return out;
}

// Ціна книги: база (10 або 15) за форматом + доплата за кожну одиницю понад базу.
// null, якщо типу/формату немає в прайсі.
export function bookPriceFromServices(services, type, { format, spreads, extra }) {
  const row = buildBookMatrix(services, type)[norm(format)];
  if (!row) return null;
  const base = Number(spreads) === 15 ? row.s15 : row.s10;
  if (base == null) return null;
  const extraN = Math.max(0, Number(extra) || 0);
  const extraPrice = row.extra != null ? extraN * row.extra : 0;
  return base + extraPrice;
}

// ── Знижка на друк фото за кількістю (усі формати). Поріг → відсоток. ──
export const PHOTO_DISCOUNT_TIERS = [
  { min: 400, pct: 30 }, { min: 300, pct: 25 }, { min: 200, pct: 20 },
  { min: 150, pct: 15 }, { min: 100, pct: 10 }, { min: 50, pct: 5 },
];
export function photoDiscountPct(count) {
  for (const t of PHOTO_DISCOUNT_TIERS) if (Number(count) >= t.min) return t.pct;
  return 0;
}

// Ціна звичайної позиції (чашка/фото/полароїд) з прайсу за мапою. null, якщо
// типу немає в мапі або відповідного рядка прайсу (тоді — фолбек на каталог).
export function servicePriceFor(designerType, services) {
  const mp = DESIGNER_SERVICE_MAP[designerType];
  if (!mp) return null;
  const fmt = mp.fmt;
  const row = (services || []).find(
    (s) => String(s.code) === mp.code && (!fmt || norm(s.format).includes(fmt))
  );
  return row && row.price != null ? Number(row.price) : null;
}
