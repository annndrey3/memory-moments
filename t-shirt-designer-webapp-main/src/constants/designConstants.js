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
    // printZone — реальна прямокутна зона друку (DTG) на грудях, у координатах
    // viewBox. Дизайн обрізається саме по ній (а не по силуету), і саме її
    // віддаємо у друк. Координати можна підкоригувати під реальний трафарет.
    views: {
      front: {
        label: "Спереду",
        path: CREW_NECK_FRONT_PATH,
        viewBox: "0 0 810 810",
        printZone: { x: 235, y: 210, width: 340, height: 410 },
      },
      back: {
        label: "Ззаду",
        path: CREW_NECK_BACK_PATH,
        viewBox: "0 0 810 810",
        printZone: { x: 235, y: 210, width: 340, height: 410 },
      },
    },
  },
  mug: {
    name: "Чашка",
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
  polaroid: {
    name: "Полароїд",
    description: "Квадратне фото з підписом",
    previewMode: "flat",
    previewShape: "polaroid",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810" },
    },
  },
  "instax-mini": {
    name: "Instax Mini",
    description: "Формат миттєвого фото",
    previewMode: "flat",
    previewShape: "instax",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.instax_inner, viewBox: "0 0 810 810" },
    },
  },
  "photo-10x15": {
    name: "Фото 10x15",
    description: "Класичний портретний формат",
    previewMode: "flat",
    previewShape: "portrait_2x3",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_2x3, viewBox: "0 0 810 810" },
    },
  },
  "photo-15x10": {
    name: "Фото 15x10",
    description: "Горизонтальний формат",
    previewMode: "flat",
    previewShape: "landscape_3x2",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_3x2, viewBox: "0 0 810 810" },
    },
  },
  "photo-13x18": {
    name: "Фото 13x18",
    description: "Портретний формат 5x7",
    previewMode: "flat",
    previewShape: "portrait_5x7",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_5x7, viewBox: "0 0 810 810" },
    },
  },
  "photo-18x13": {
    name: "Фото 18x13",
    description: "Горизонтальний формат 7x5",
    previewMode: "flat",
    previewShape: "landscape_7x5",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_7x5, viewBox: "0 0 810 810" },
    },
  },
  "photo-15x21": {
    name: "Фото 15x21",
    description: "Формат А5 (портрет)",
    previewMode: "flat",
    previewShape: "portrait_3x4",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.portrait_3x4, viewBox: "0 0 810 810" },
    },
  },
  "photo-21x15": {
    name: "Фото 21x15",
    description: "Формат А5 (пейзаж)",
    previewMode: "flat",
    previewShape: "landscape_4x3",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.landscape_4x3, viewBox: "0 0 810 810" },
    },
  },
  "photo-a4-p": {
    name: "Фото A4",
    description: "Великий портретний формат",
    previewMode: "flat",
    previewShape: "a4_portrait",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.a4_portrait, viewBox: "0 0 810 810" },
    },
  },
  "photo-a4-l": {
    name: "Фото A4 (гориз.)",
    description: "Великий альбомний формат",
    previewMode: "flat",
    previewShape: "a4_landscape",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.a4_landscape, viewBox: "0 0 810 810" },
    },
  },
  "photo-square": {
    name: "Квадратне фото",
    description: "Формат 1:1",
    previewMode: "flat",
    previewShape: "square",
    views: {
      front: { label: "Фото", path: RECTANGLE_PATHS.square, viewBox: "0 0 810 810" },
    },
  },
};

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

// Розмір — лише для футболки; тип паперу — для всіх пласких фотоформатів.
export const productHasSize = (type) => type === "crew-neck";
export const productHasPaper = (type) => PRODUCT_TYPES[type]?.previewMode === "flat";
export const paperLabel = (value) =>
  PAPER_TYPES.find((p) => p.value === value)?.label || value;
const colorName = (hex) => (hex ? COLOR_NAMES[hex.toUpperCase?.()] || hex : null);

// Людиночитний підпис обраних опцій — для кошика та позиції замовлення
// (саме він іде на сервер як variant_label → в адмінку й Telegram).
export function buildOptionsLabel({ productType, size, paperType, color }) {
  const parts = [];
  if (productHasSize(productType) && size) parts.push(`Розмір: ${size}`);
  if (productHasPaper(productType) && paperType) parts.push(`Папір: ${paperLabel(paperType)}`);
  if ((productType === "crew-neck" || productType === "mug") && color) {
    parts.push(`Колір: ${colorName(color)}`);
  }
  return parts.length ? parts.join(" · ") : null;
}
