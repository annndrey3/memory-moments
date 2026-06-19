import * as fabric from "fabric";

// ─────────────────────────────────────────────────────────────────────────────
// Рамки конструктора. 20 рамок будуються програмно (без растрових ассетів):
// одна специфікація → і прев'ю (SVG для пікера), і точні fabric-обʼєкти (для друку).
// Розміри задані у частках від меншої сторони зони друку, тож рамка масштабується
// під будь-який формат і будь-яке співвідношення сторін без втрати якості.
//
// Пікер легко розширити растровими PNG-рамками: додайте у FRAMES запис
// { id, label, png: "/uploads/frame-x.png" } і обробіть гілку в FrameDropdownBtn.
// ─────────────────────────────────────────────────────────────────────────────

const DARK = "#2b2b2b";
const WHITE = "#ffffff";
const CREAM = "#f4ecd8";
const GOLD = "#b8902f";

// Зберігаємо службові прапорці (mmRole/mmSlot) у JSON, щоб рамки та комірки
// колажу коректно відновлювалися зі сховища й не дублювалися. Ідемпотентно.
if (!fabric.Object.prototype.__mmPatched) {
  const _toObject = fabric.Object.prototype.toObject;
  fabric.Object.prototype.toObject = function (props = []) {
    return _toObject.call(this, [...props, "mmRole", "mmSlot"]);
  };
  fabric.Object.prototype.__mmPatched = true;
}

// Шар-рамка (прямокутна обводка): inset — відступ від краю, sw — товщина.
const L = (inset, sw, extra = {}) => ({ inset, sw, color: DARK, ...extra });

export const FRAMES = [
  { id: "none", label: "Без рамки" },

  { id: "line-thin",   label: "Тонка",       spec: { layers: [L(0.03, 0.006)] } },
  { id: "line-bold",   label: "Жирна",       spec: { layers: [L(0.045, 0.02)] } },
  { id: "double",      label: "Подвійна",    spec: { layers: [L(0.03, 0.006), L(0.06, 0.006)] } },
  { id: "double-bold", label: "Контраст",    spec: { layers: [L(0.03, 0.018), L(0.078, 0.005)] } },
  { id: "triple",      label: "Потрійна",    spec: { layers: [L(0.03, 0.005), L(0.052, 0.005), L(0.074, 0.005)] } },
  { id: "dashed",      label: "Пунктир",     spec: { layers: [L(0.04, 0.009, { dash: [0.022, 0.015] })] } },
  { id: "dotted",      label: "Крапки",      spec: { layers: [L(0.04, 0.012, { dash: [0.0008, 0.026], cap: "round" })] } },
  { id: "rounded",     label: "Скруглена",   spec: { layers: [L(0.04, 0.011, { rx: 0.07 })] } },
  { id: "rounded-2",   label: "Скр. подв.",  spec: { layers: [L(0.035, 0.007, { rx: 0.085 }), L(0.062, 0.007, { rx: 0.055 })] } },
  { id: "mat",         label: "Паспарту",    spec: { mat: { t: 0.07, r: 0.07, b: 0.07, l: 0.07, color: WHITE }, layers: [L(0.084, 0.005)] } },
  { id: "polaroid",    label: "Полароїд",    spec: { mat: { t: 0.05, r: 0.05, b: 0.17, l: 0.05, color: WHITE } } },
  { id: "vintage",     label: "Вінтаж",      spec: { mat: { t: 0.05, r: 0.05, b: 0.17, l: 0.05, color: CREAM } } },
  { id: "corners-l",   label: "Кути",        spec: { corners: { inset: 0.04, len: 0.16, sw: 0.012, color: DARK } } },
  { id: "corners-gold",label: "Кути золото", spec: { corners: { inset: 0.05, len: 0.16, sw: 0.012, color: GOLD }, layers: [L(0.068, 0.004, { color: GOLD })] } },
  { id: "corner-dots", label: "Кут. крапки", spec: { layers: [L(0.055, 0.005)], dots: { inset: 0.055, r: 0.02, color: DARK } } },
  { id: "film",        label: "Плівка",      spec: { film: { band: 0.075, color: DARK, holes: 7 } } },
  { id: "gold-double", label: "Золота",      spec: { layers: [L(0.034, 0.013, { color: GOLD }), L(0.072, 0.005, { color: GOLD })] } },
  { id: "dash-dot",    label: "Тире-крапка", spec: { layers: [L(0.042, 0.009, { dash: [0.022, 0.011, 0.002, 0.011], cap: "round" })] } },
  { id: "ticket",      label: "Квиток",      spec: { layers: [L(0.042, 0.009, { rx: 0.05, dash: [0.016, 0.012] })] } },
  { id: "arcs-gold",   label: "Вензель",     spec: { layers: [L(0.07, 0.004, { color: GOLD })], arcs: { inset: 0.045, r: 0.1, sw: 0.01, color: GOLD } } },
];

// ── spec → абстрактні фігури в абсолютних координатах box={x,y,w,h} ──
function specToShapes(spec, box) {
  const { x, y, w, h } = box;
  const S = Math.min(w, h);
  const out = [];

  // Мат (паспарту / полароїд) — суцільна рамка-заливка з 4 смуг
  if (spec.mat) {
    const m = spec.mat;
    const t = m.t * S, r = m.r * S, b = m.b * S, l = m.l * S;
    const band = (bx, by, bw, bh) => out.push({ t: "rect", x: bx, y: by, w: bw, h: bh, fill: m.color });
    band(x, y, w, t);
    band(x, y + h - b, w, b);
    band(x, y, l, h);
    band(x + w - r, y, r, h);
  }

  // Плівка — чорні смуги по боках з білими перфораціями
  if (spec.film) {
    const f = spec.film;
    const bw = f.band * S;
    out.push({ t: "rect", x, y, w: bw, h, fill: f.color });
    out.push({ t: "rect", x: x + w - bw, y, w: bw, h, fill: f.color });
    const n = f.holes, hw = bw * 0.5, hh = (h / n) * 0.55;
    for (let i = 0; i < n; i++) {
      const cy = y + (h / n) * (i + 0.5) - hh / 2;
      out.push({ t: "rect", x: x + (bw - hw) / 2, y: cy, w: hw, h: hh, fill: WHITE, rx: hw * 0.25 });
      out.push({ t: "rect", x: x + w - bw + (bw - hw) / 2, y: cy, w: hw, h: hh, fill: WHITE, rx: hw * 0.25 });
    }
  }

  // Рамки-лінії
  (spec.layers || []).forEach((ly) => {
    const i = ly.inset * S;
    out.push({
      t: "rect",
      x: x + i, y: y + i, w: w - 2 * i, h: h - 2 * i,
      stroke: ly.color || DARK, sw: ly.sw * S,
      dash: ly.dash ? ly.dash.map((d) => d * S) : null,
      rx: ly.rx ? ly.rx * S : 0,
      cap: ly.cap,
    });
  });

  // Кутові мітки (L-подібні)
  if (spec.corners) {
    const c = spec.corners;
    const i = c.inset * S, len = c.len * S, sw = c.sw * S, col = c.color || DARK;
    const seg = (x1, y1, x2, y2) => out.push({ t: "line", x1, y1, x2, y2, stroke: col, sw, cap: "round" });
    seg(x + i, y + i, x + i + len, y + i);             seg(x + i, y + i, x + i, y + i + len);
    seg(x + w - i, y + i, x + w - i - len, y + i);     seg(x + w - i, y + i, x + w - i, y + i + len);
    seg(x + i, y + h - i, x + i + len, y + h - i);     seg(x + i, y + h - i, x + i, y + h - i - len);
    seg(x + w - i, y + h - i, x + w - i - len, y + h - i); seg(x + w - i, y + h - i, x + w - i, y + h - i - len);
  }

  // Кутові крапки
  if (spec.dots) {
    const d = spec.dots, i = d.inset * S, r = d.r * S, col = d.color || DARK;
    [[x + i, y + i], [x + w - i, y + i], [x + i, y + h - i], [x + w - i, y + h - i]].forEach(([cx, cy]) =>
      out.push({ t: "circle", cx, cy, r, fill: col })
    );
  }

  // Кутові дуги (вензель) — чверть-кола в кутах
  if (spec.arcs) {
    const a = spec.arcs, i = a.inset * S, r = a.r * S, sw = a.sw * S, col = a.color || GOLD;
    const arc = (x1, y1, x2, y2, sweep) =>
      out.push({ t: "path", d: `M ${x1} ${y1} A ${r} ${r} 0 0 ${sweep} ${x2} ${y2}`, stroke: col, sw });
    arc(x + i, y + i + r, x + i + r, y + i, 1);
    arc(x + w - i - r, y + i, x + w - i, y + i + r, 1);
    arc(x + i + r, y + h - i, x + i, y + h - i - r, 1);
    arc(x + w - i, y + h - i - r, x + w - i - r, y + h - i, 1);
  }

  return out;
}

const LOCK = { selectable: false, evented: false, objectCaching: false, strokeUniform: true, hoverCursor: "default" };

function shapeToFabric(s) {
  if (s.t === "rect")
    return new fabric.Rect({
      ...LOCK, left: s.x, top: s.y, width: s.w, height: s.h,
      fill: s.fill || "transparent", stroke: s.stroke || null, strokeWidth: s.sw || 0,
      strokeDashArray: s.dash || null, strokeLineCap: s.cap || "butt", rx: s.rx || 0, ry: s.rx || 0,
    });
  if (s.t === "circle")
    return new fabric.Circle({ ...LOCK, left: s.cx - s.r, top: s.cy - s.r, radius: s.r, fill: s.fill || DARK });
  if (s.t === "line")
    return new fabric.Line([s.x1, s.y1, s.x2, s.y2], { ...LOCK, stroke: s.stroke, strokeWidth: s.sw, strokeLineCap: s.cap || "butt" });
  if (s.t === "path")
    return new fabric.Path(s.d, { ...LOCK, fill: "", stroke: s.stroke, strokeWidth: s.sw, strokeLineCap: "round" });
  return null;
}

// Готова рамка як єдина (заблокована) група fabric поверх зони друку.
export function buildFrameObjects(spec, area) {
  const shapes = specToShapes(spec, { x: area.left, y: area.top, w: area.width, h: area.height });
  const objs = shapes.map(shapeToFabric).filter(Boolean);
  const group = new fabric.Group(objs, { ...LOCK, excludeFromExport: false });
  group.mmRole = "frame";
  return group;
}

// ── spec → SVG-прев'ю для пікера ──
function shapeToSvg(s) {
  if (s.t === "rect")
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx || 0}" fill="${s.fill || "none"}"${
      s.stroke ? ` stroke="${s.stroke}" stroke-width="${Math.max(s.sw, 0.7)}"` : ""
    }${s.dash ? ` stroke-dasharray="${s.dash.map((d) => Math.max(d, 0.5)).join(" ")}"` : ""}${
      s.cap ? ` stroke-linecap="${s.cap}"` : ""
    }/>`;
  if (s.t === "circle") return `<circle cx="${s.cx}" cy="${s.cy}" r="${Math.max(s.r, 0.8)}" fill="${s.fill || "#000"}"/>`;
  if (s.t === "line")
    return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${s.stroke}" stroke-width="${Math.max(s.sw, 0.8)}" stroke-linecap="${s.cap || "butt"}"/>`;
  if (s.t === "path") return `<path d="${s.d}" fill="none" stroke="${s.stroke}" stroke-width="${Math.max(s.sw, 0.8)}" stroke-linecap="round"/>`;
  return "";
}

export function frameThumbSvg(spec, size = 60) {
  const pad = 4;
  const box = { x: pad, y: pad, w: size - 2 * pad, h: size - 2 * pad };
  const inner = specToShapes(spec, box).map(shapeToSvg).join("");
  return `<svg viewBox="0 0 ${size} ${size}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><rect x="${pad}" y="${pad}" width="${box.w}" height="${box.h}" fill="#fbf7ff"/>${inner}</svg>`;
}
