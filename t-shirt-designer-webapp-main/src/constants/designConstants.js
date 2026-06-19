// Базовий шлях для public-ассетів (у проді конструктор під /designer/).
const PUBLIC_BASE = import.meta.env.BASE_URL;

export const CANVAS_CONFIG = {
  width: 450,
  height: 500,
  backgroundColor: "transparent",
};

const CREW_NECK_FRONT_PATH =
  "M 403.492188 739.769531 C 387.246094 739.769531 254.289062 739.105469 183.003906 728.164062 C 183.003906 728.164062 187.3125 587.5625 188.640625 535.828125 C 189.636719 483.765625 192.949219 330.5625 192.949219 330.5625 L 128.296875 381.964844 C 128.296875 381.964844 57.671875 329.238281 8.933594 244.015625 C 8.933594 244.015625 144.875 129.941406 174.050781 113.359375 C 204.886719 95.785156 300.375 70.25 300.375 70.25 C 300.375 70.25 341.160156 95.121094 405.152344 95.121094 L 406.808594 95.121094 C 470.136719 94.789062 509.925781 70.25 509.925781 70.25 C 509.925781 70.25 605.414062 95.785156 636.25 113.359375 C 665.425781 129.941406 801.367188 244.015625 801.367188 244.015625 C 752.628906 329.238281 682.003906 381.964844 682.003906 381.964844 L 617.351562 330.5625 C 617.351562 330.5625 620.667969 483.765625 621.992188 535.828125 C 623.320312 587.890625 627.628906 728.164062 627.628906 728.164062 C 551.371094 739.769531 405.480469 739.769531 405.480469 739.769531 Z M 403.492188 739.769531";

const CREW_NECK_BACK_PATH =
  "M 403.492188 739.769531 C 387.246094 739.769531 254.289062 739.105469 183.003906 728.164062 C 183.003906 728.164062 187.3125 587.5625 188.640625 535.828125 C 189.636719 483.765625 192.949219 330.5625 192.949219 330.5625 L 128.296875 381.964844 C 128.296875 381.964844 57.671875 329.238281 8.933594 244.015625 C 8.933594 244.015625 144.875 129.941406 174.050781 113.359375 C 204.886719 95.785156 300.375 70.25 300.375 70.25 C 300.375 70.25 354.160156 85.121094 405.152344 85.121094 L 406.808594 85.121094 C 457.136719 85.121094 509.925781 70.25 509.925781 70.25 C 509.925781 70.25 605.414062 95.785156 636.25 113.359375 C 665.425781 129.941406 801.367188 244.015625 801.367188 244.015625 C 752.628906 329.238281 682.003906 381.964844 682.003906 381.964844 L 617.351562 330.5625 C 617.351562 330.5625 620.667969 483.765625 621.992188 535.828125 C 623.320312 587.890625 627.628906 728.164062 627.628906 728.164062 C 551.371094 739.769531 405.480469 739.769531 405.480469 739.769531 Z M 403.492188 739.769531";

const RECTANGLE_PATHS = {
  portrait_2x3: "M 165 45 H 645 V 765 H 165 Z",
  landscape_3x2: "M 45 165 H 765 V 645 H 45 Z",
  portrait_5x7: "M 155 55 H 655 V 755 H 155 Z",
  landscape_7x5: "M 55 155 H 755 V 655 H 55 Z",
  portrait_3x4: "M 135 45 H 675 V 765 H 135 Z",
  landscape_4x3: "M 45 135 H 765 V 675 H 45 Z",
  a4_portrait: "M 150 45 H 660 V 765 H 150 Z",
  a4_landscape: "M 45 150 H 765 V 660 H 45 Z",
  instax_inner: "M 175 95 H 635 V 715 H 175 Z",
  square: "M 105 105 H 705 V 705 H 105 Z",
  mug: "M 165 220 C 165 130 645 130 645 220 L 610 650 C 600 730 210 730 200 650 Z M 645 300 C 760 300 770 570 625 570 L 638 505 C 705 500 705 370 640 365 Z",
  // Розгортка друку чашки: широкий прямокутник (обвід чашки мінус зазор під
  // ручкою). Співвідношення довжина:висота ≈ 2.45:1 — як у 3D-моделі (MugModel).
  mug_wrap: "M 45 258 H 765 V 552 H 45 Z",
};

export const PRODUCT_TYPES = {
  "crew-neck": {
    name: "Футболка",
    description: "Передня та задня сторона",
    previewMode: "3d",
    previewShape: "tshirt", // плаский превʼю (коли 3D вимкнено для футболки)
    // printZone — реальна прямокутна зона друку (DTG) на грудях, у координатах
    // viewBox. ВАЖЛИВО: пропорція зони має дорівнювати пропорції 3D-декалі
    // (TShirtModel: scale=[0.52, 0.7] → 0.52/0.7 ≈ 0.743), інакше макет у превʼю
    // спотворюється і зона не відповідає тому, що видно на моделі.
    // 312/420 = 0.743 ✓. Розмір/позицію можна коригувати, але зберігати пропорцію.
    views: {
      front: {
        label: "Спереду",
        path: CREW_NECK_FRONT_PATH,
        viewBox: "0 0 810 810",
        printZone: { x: 249, y: 205, width: 312, height: 420 },
      },
      back: {
        label: "Ззаду",
        path: CREW_NECK_BACK_PATH,
        viewBox: "0 0 810 810",
        printZone: { x: 249, y: 205, width: 312, height: 420 },
      },
    },
  },
  mug: {
    name: "Чашка біла",
    description: "Друк навколо чашки — макет це розгортка (обгортає чашку)",
    previewMode: "3d",
    previewShape: "mug",
    // Редактор чашки = РОЗГОРТКА друку: широкий прямокутник зі співвідношенням
    // ≈2.45:1 (обвід мінус зазор під ручкою — як у 3D-моделі). Дизайн обгортає
    // чашку, краї прямокутника сходяться біля ручки. surfaceColor білий, бо
    // друкують по білому боку (колір чашки — це внутрішня частина/ручка у 3D).
    views: {
      front: {
        label: "Розгортка",
        path: RECTANGLE_PATHS.mug_wrap,
        viewBox: "0 0 810 810",
        printZone: { x: 60, y: 264, width: 690, height: 282 },
        surfaceColor: "#ffffff",
        seamHint: true,
      },
    },
  },
  // Варіанти чашок із прайсу — той самий редактор-розгортка та 3D-превʼю.
  "mug-giant": {
    name: "Чашка велетень",
    description: "Збільшена чашка — друк навколо (розгортка)",
    previewMode: "3d",
    previewShape: "mug",
    views: {
      front: {
        label: "Розгортка",
        path: RECTANGLE_PATHS.mug_wrap,
        viewBox: "0 0 810 810",
        printZone: { x: 60, y: 264, width: 690, height: 282 },
        surfaceColor: "#ffffff",
        seamHint: true,
      },
    },
  },
  "mug-magic": {
    name: "Чашка Магічна (хамелеон)",
    description: "Чорна чашка, що проявляє малюнок від гарячого",
    previewMode: "3d",
    previewShape: "mug",
    views: {
      front: {
        label: "Розгортка",
        path: RECTANGLE_PATHS.mug_wrap,
        viewBox: "0 0 810 810",
        printZone: { x: 60, y: 264, width: 690, height: 282 },
        surfaceColor: "#ffffff",
        seamHint: true,
      },
    },
  },
  "mug-color": {
    name: "Чашка кольорова (всередині+ручка)",
    description: "Кольорова всередині та ручка — друк навколо (розгортка)",
    previewMode: "3d",
    previewShape: "mug",
    views: {
      front: {
        label: "Розгортка",
        path: RECTANGLE_PATHS.mug_wrap,
        viewBox: "0 0 810 810",
        printZone: { x: 60, y: 264, width: 690, height: 282 },
        surfaceColor: "#ffffff",
        seamHint: true,
      },
    },
  },
  "mug-text-inside": {
    name: "Чашка з написами всередині",
    description: "З написами всередині — друк навколо (розгортка)",
    previewMode: "3d",
    previewShape: "mug",
    views: {
      front: {
        label: "Розгортка",
        path: RECTANGLE_PATHS.mug_wrap,
        viewBox: "0 0 810 810",
        printZone: { x: 60, y: 264, width: 690, height: 282 },
        surfaceColor: "#ffffff",
        seamHint: true,
      },
    },
  },
  // ── Шаблонні формати (canvasSize = розміри друку 300dpi, templateOverlay = PNG рамка) ──
  polaroid: {
    name: "Полароїд 10×12 верт.",
    description: "Формат 10×12 см, вертикальний",
    previewMode: "flat",
    previewShape: "polaroid",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 1181 1417",
        canvasSize: { width: 1181, height: 1417 },
        templateOverlay: PUBLIC_BASE + "templates/polaroid-10x12-vert.png",
        printZone: { x: 71, y: 62, width: 1039, height: 1037 },
      },
    },
  },
  "polaroid-10x12-h": {
    name: "Полароїд 10×12 гор.",
    description: "Формат 10×12 см, горизонтальний",
    previewMode: "flat",
    previewShape: "polaroid",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 1417 1181",
        canvasSize: { width: 1417, height: 1181 },
        templateOverlay: PUBLIC_BASE + "templates/polaroid-10x12-hor.png",
        printZone: { x: 85, y: 52, width: 1247, height: 864 },
      },
    },
  },
  "polaroid-8x10-v": {
    name: "Полароїд 8×10 верт.",
    description: "Формат 8×10 см, вертикальний",
    previewMode: "flat",
    previewShape: "polaroid",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 945 1181",
        canvasSize: { width: 945, height: 1181 },
        templateOverlay: PUBLIC_BASE + "templates/polaroid-8x10-vert.png",
        printZone: { x: 56, y: 52, width: 833, height: 864 },
      },
    },
  },
  "polaroid-8x10-h": {
    name: "Полароїд 8×10 гор.",
    description: "Формат 8×10 см, горизонтальний",
    previewMode: "flat",
    previewShape: "polaroid",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 1181 945",
        canvasSize: { width: 1181, height: 945 },
        templateOverlay: PUBLIC_BASE + "templates/polaroid-8x10-hor.png",
        printZone: { x: 71, y: 41, width: 1040, height: 692 },
      },
    },
  },
  "instax-mini": {
    name: "Instax Mini 5.4×8.6",
    description: "Формат миттєвого фото Instax Mini",
    previewMode: "flat",
    previewShape: "instax",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 638 1016",
        canvasSize: { width: 638, height: 1016 },
        templateOverlay: PUBLIC_BASE + "templates/instax-mini.png",
        printZone: { x: 46, y: 72, width: 545, height: 729 },
      },
    },
  },
  "phone-case": {
    name: "Під чохол 5.4×8.5",
    description: "Макет для друку під чохол",
    previewMode: "flat",
    previewShape: "phone",
    views: {
      front: {
        label: "Фото",
        viewBox: "0 0 638 1004",
        canvasSize: { width: 638, height: 1004 },
        templateOverlay: PUBLIC_BASE + "templates/phone-case.png",
        printZone: { x: 5, y: 5, width: 628, height: 994 },
      },
    },
  },
  "photo-10x15": {
    name: "Фото 10x15",
    description: "Класичний портретний формат",
    previewMode: "flat",
    previewShape: "portrait_2x3",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_2x3, viewBox: "0 0 810 810", printZone: { x: 165, y: 45, width: 480, height: 720 } },
    },
  },
  "photo-15x10": {
    name: "Фото 15x10",
    description: "Горизонтальний формат",
    previewMode: "flat",
    previewShape: "landscape_3x2",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_3x2, viewBox: "0 0 810 810", printZone: { x: 45, y: 165, width: 720, height: 480 } },
    },
  },
  "photo-13x18": {
    name: "Фото 13x18",
    description: "Портретний формат 5x7",
    previewMode: "flat",
    previewShape: "portrait_5x7",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_5x7, viewBox: "0 0 810 810", printZone: { x: 155, y: 55, width: 500, height: 700 } },
    },
  },
  "photo-18x13": {
    name: "Фото 18x13",
    description: "Горизонтальний формат 7x5",
    previewMode: "flat",
    previewShape: "landscape_7x5",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_7x5, viewBox: "0 0 810 810", printZone: { x: 55, y: 155, width: 700, height: 500 } },
    },
  },
  "photo-15x21": {
    name: "Фото 15x21",
    description: "Формат А5 (портрет)",
    previewMode: "flat",
    previewShape: "portrait_3x4",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_3x4, viewBox: "0 0 810 810", printZone: { x: 135, y: 45, width: 540, height: 720 } },
    },
  },
  "photo-21x15": {
    name: "Фото 21x15",
    description: "Формат А5 (пейзаж)",
    previewMode: "flat",
    previewShape: "landscape_4x3",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_4x3, viewBox: "0 0 810 810", printZone: { x: 45, y: 135, width: 720, height: 540 } },
    },
  },
  "photo-a4-p": {
    name: "Фото A4",
    description: "Великий портретний формат",
    previewMode: "flat",
    previewShape: "a4_portrait",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.a4_portrait, viewBox: "0 0 810 810", printZone: { x: 150, y: 45, width: 510, height: 720 } },
    },
  },
  "photo-a4-l": {
    name: "Фото A4 (гориз.)",
    description: "Великий альбомний формат",
    previewMode: "flat",
    previewShape: "a4_landscape",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.a4_landscape, viewBox: "0 0 810 810", printZone: { x: 45, y: 150, width: 720, height: 510 } },
    },
  },
  "photo-square": {
    name: "Квадратне фото",
    description: "Формат 1:1",
    previewMode: "flat",
    previewShape: "square",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810", printZone: { x: 105, y: 105, width: 600, height: 600 } },
    },
  },
  // Полотно на підрамнику (широкоформатний друк). Розмір обирається в редакторі —
  // він задає і ціну (з прайсу), і пропорції зони друку (див. buildCanvasView).
  canvas: {
    name: "Полотно (натяжка)",
    description: "Широкоформатний друк на полотні з натяжкою на підрамник",
    previewMode: "flat",
    previewShape: "portrait_3x4",
    sized: true, // має селектор розміру (canvasSize)
    views: {
      front: { label: "Полотно", path: RECTANGLE_PATHS.portrait_3x4, viewBox: "0 0 810 810", printZone: { x: 135, y: 45, width: 540, height: 720 } },
    },
  },
  // Slim Book (фотокнига): дизайн ОБКЛАДИНКИ + фото для розворотів (студія
  // розкладає по макету). Формат (20×20/21×30/25×25) задає і ціну (прайс), і
  // пропорції обкладинки (buildSlimBookView). Кіл-ть розворотів — у панелі замовлення.
  "slim-book": {
    name: "Slim Book (фотокнига)",
    description: "Обкладинка (перед/зад) + фото для розворотів",
    previewMode: "flat",
    previewShape: "square",
    slimBook: true,
    views: {
      front: { label: "Обкладинка (перед)", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810", printZone: { x: 105, y: 105, width: 600, height: 600 } },
      back: { label: "Обкладинка (зад)", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810", printZone: { x: 105, y: 105, width: 600, height: 600 } },
    },
  },
  // Print Book — та сама механіка, інші коди прайсу (1135/1132/1133), рахунок у листах.
  "print-book": {
    name: "Print Book (фотокнига)",
    description: "Обкладинка (перед/зад) + фото для сторінок",
    previewMode: "flat",
    previewShape: "square",
    slimBook: true,
    views: {
      front: { label: "Обкладинка (перед)", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810", printZone: { x: 105, y: 105, width: 600, height: 600 } },
      back: { label: "Обкладинка (зад)", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810", printZone: { x: 105, y: 105, width: 600, height: 600 } },
    },
  },
};

// Розміри полотна — беруться з прайсу (код 44 «Широкоформатний друк полотно+натяжка»).
export const CANVAS_SIZES = [
  "30x40", "40x50", "40x60", "50x60", "50x70", "60x70", "60x80", "60x90", "60x100", "70x100",
];
export const canvasSizeLabel = (s) => `${String(s).replace("x", "×")} см`;

// Динамічна зона друку полотна за обраним розміром — портрет із пропорцією W:H,
// щоб у редакторі було видно реальні пропорції обраного формату.
export function buildCanvasView(sizeStr) {
  const [w, h] = String(sizeStr || "30x40").split("x").map(Number);
  const ratio = w && h ? w / h : 0.75;
  const H = 760;
  const W = Math.round(H * ratio);
  const x = Math.round((810 - W) / 2);
  const y = Math.round((810 - H) / 2);
  return {
    label: "Полотно",
    path: `M ${x} ${y} H ${x + W} V ${y + H} H ${x} Z`,
    viewBox: "0 0 810 810",
    printZone: { x, y, width: W, height: H },
  };
}

// ── Slim Book (фотокнига) ──
export const SLIMBOOK_FORMATS = ["20x20", "21x30", "25x25"];
export const SLIMBOOK_SPREADS = [10, 15];
export const slimBookFormatLabel = (f) => `${String(f).replace("x", "×")} см`;

// Динамічна зона друку обкладинки за форматом (пропорції W:H) — як buildCanvasView.
export function buildSlimBookView(format) {
  const [w, h] = String(format || "21x30").split("x").map(Number);
  const ratio = w && h ? w / h : 0.7;
  const H = 700;
  const W = Math.round(H * ratio);
  const x = Math.round((810 - W) / 2);
  const y = Math.round((810 - H) / 2);
  return {
    label: "Обкладинка",
    path: `M ${x} ${y} H ${x + W} V ${y + H} H ${x} Z`,
    viewBox: "0 0 810 810",
    printZone: { x, y, width: W, height: H },
  };
}

// Книжкові типи (slim/print) — спільний UI/стан; різниця лише в кодах і одиниці.
export const isBookType = (type) => type === "slim-book" || type === "print-book";
export const bookUnit = (type) => (type === "print-book" ? "листів" : "розворотів");

export const TSHIRT_TYPES = PRODUCT_TYPES;

export const DEFAULT_TEXT_CONFIG = {
  fontSize: 20,
  fontFamily: "arial",
  originX: "center",
  originY: "center",
  fill: "black",
};

export const TSHIRT_COLOR_CODES = [
  "#FF0000",
  "#0000FF",
  "#00FF00",
  "#FFFF00",
  "#000000",
  "#808080",
  "#FFFFFF",
  "#FFFFDD",
  "#00FFDD",
];

// Футболка Soft Style буває лише білою та чорною (інші кольори не друкуємо).
// Жіночий рід підпису — узгоджено з товаром «футболка» (як у прайсі: біла/чорна).
export const TSHIRT_COLORS = [
  { hex: "#FFFFFF", label: "Біла" },
  { hex: "#000000", label: "Чорна" },
];

// Колір ВСЕРЕДИНІ звичайної білої чашки — лише ці варіанти є в наявності.
export const MUG_INNER_COLORS = [
  { hex: "#FFD400", label: "Жовтий" },
  { hex: "#8BC34A", label: "Салатовий" },
  { hex: "#1A1A1A", label: "Чорна" },
  { hex: "#8E24AA", label: "Фіолетова" },
  { hex: "#1B5E20", label: "Темнозелена" },
  { hex: "#1976D2", label: "Синя" },
  { hex: "#EC407A", label: "Рожева" },
  { hex: "#FB8C00", label: "Помаранчева" },
  { hex: "#E53935", label: "Червона" },
  { hex: "#0047AB", label: "Кобальт" },
  { hex: "#4FC3F7", label: "Блакитна" },
  { hex: "#800020", label: "Бордова" },
];
export const mugColorName = (hex) =>
  MUG_INNER_COLORS.find((c) => c.hex.toUpperCase() === String(hex).toUpperCase())?.label || hex;

export const FONT_OPTIONS = [
  // Системні
  { value: "arial", label: "Arial" },
  { value: "calibri", label: "Calibri" },
  { value: "times-new-roman", label: "Times New Roman" },
  { value: "georgia", label: "Georgia" },
  { value: "helvetica", label: "Helvetica" },
  { value: "courier-new", label: "Courier New" },
  { value: "verdana", label: "Verdana" },
  { value: "tahoma", label: "Tahoma" },
  { value: "trebuchet-ms", label: "Trebuchet MS" },
  { value: "impact", label: "Impact" },
  // Google Fonts (value = точна назва сімейства; підключені в index.html)
  { value: "Playfair Display", label: "Playfair Display" },
  { value: "PT Serif", label: "PT Serif" },
  { value: "Cinzel", label: "Cinzel" },
  { value: "Lora", label: "Lora" },
  { value: "Bodoni Moda", label: "Bodoni Moda" },
  { value: "Montserrat", label: "Montserrat" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Inter", label: "Inter" },
  { value: "Oswald", label: "Oswald" },
  { value: "Roboto", label: "Roboto" },
  { value: "Pacifico", label: "Pacifico" },
  { value: "Caveat", label: "Caveat" },
  { value: "Satisfy", label: "Satisfy" },
  { value: "Great Vibes", label: "Great Vibes" },
  { value: "Shadows Into Light", label: "Shadows Into Light" },
];

// ── Опції товару: розмір футболки та тип паперу для фотодруку ────────────────
export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const PAPER_TYPES = [
  { value: "matte", label: "Матовий" },
  { value: "melange", label: "Меланж" },
  { value: "glossy", label: "Глянцевий" },
];

// Назви базових кольорів палітри — щоб у замовленні було «Білий», а не «#FFFFFF».
export const COLOR_NAMES = {
  "#FF0000": "Червоний",
  "#0000FF": "Синій",
  "#00FF00": "Зелений",
  "#FFFF00": "Жовтий",
  "#000000": "Чорний",
  "#808080": "Сірий",
  "#FFFFFF": "Білий",
  "#FFFFDD": "Кремовий",
  "#00FFDD": "Бірюзовий",
};

// Будь-який тип-чашка (звичайна, велетень, магічна) — за формою превʼю.
export const isMugType = (type) => PRODUCT_TYPES[type]?.previewShape === "mug";

// Розмір — лише для футболки; тип паперу — для всіх пласких фотоформатів.
export const productHasSize = (type) => type === "crew-neck";
// Тип паперу — для пласких фотоформатів, але НЕ для полотна (друк по полотну).
export const productHasPaper = (type) =>
  PRODUCT_TYPES[type]?.previewMode === "flat" && type !== "canvas";
export const paperLabel = (value) =>
  PAPER_TYPES.find((p) => p.value === value)?.label || value;
const colorName = (hex) => (hex ? COLOR_NAMES[hex.toUpperCase?.()] || hex : null);

// Людиночитний підпис обраних опцій — для кошика та позиції замовлення
// (саме він іде на сервер як variant_label → в адмінку й Telegram).
export function buildOptionsLabel({ productType, size, paperType, color, printSize, bothSides, canvasSize, slimBookFormat, slimBookSpreads, slimBookExtra }) {
  const parts = [];
  if (productHasSize(productType) && size) parts.push(`Розмір: ${size}`);
  if (productType === "canvas" && canvasSize) parts.push(`Розмір: ${canvasSizeLabel(canvasSize)}`);
  if (isBookType(productType)) {
    const total = (Number(slimBookSpreads) || 10) + (Number(slimBookExtra) || 0);
    parts.push(`Формат: ${slimBookFormatLabel(slimBookFormat || "21x30")}`);
    parts.push(`${total} ${bookUnit(productType)}`);
  }
  if (productType === "crew-neck" && printSize) {
    parts.push(`Друк: ${printSize === "A3" ? "А3" : "А4"}${bothSides ? " · 2 сторони" : ""}`);
  }
  if (productHasPaper(productType) && paperType) parts.push(`Папір: ${paperLabel(paperType)}`);
  if (productType === "crew-neck" && color) {
    parts.push(`Колір: ${colorName(color)}`);
  } else if (productType === "mug-color" && color && color.toUpperCase?.() !== "#FFFFFF") {
    parts.push(`Колір всередині: ${mugColorName(color)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
