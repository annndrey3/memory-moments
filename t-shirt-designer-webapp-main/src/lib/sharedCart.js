// СПІЛЬНИЙ кошик конструктора + маркетплейсу.
//
// Конструктор і маркетплейс — на одному домені (memory-moments.online), тож
// IndexedDB у них СПІЛЬНИЙ. Зберігаємо кошик в одній БД/ключі з однаковою схемою,
// і обидві частини бачать ті самі позиції. localStorage не годиться — позиції
// містять великі base64 (мокапи, друк-файли, пачки фото) → переповнення квоти.
//
// Кожна позиція САМОДОСТАТНЯ для оформлення: несе готовий payload для /api/orders
// (через toOrderItem) + поля для показу (name/image/unit_price/variant_label/quantity).
// Тому оформити можна З БУДЬ-ДЕ: items.map(toOrderItem) → POST /api/orders
// (сервер уже приймає типи catalog / photo_print / design).
//
// ВАЖЛИВО: цей файл має бути ІДЕНТИЧНИЙ у конструкторі та в маркетплейсі.

const DB_NAME = "mm_shop";
const STORE = "kv";
const KEY = "cart";
const LEGACY_KEYS = ["mm_designer_cart"]; // старі localStorage-ключі → одноразова міграція

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readCart() {
  try {
    const db = await openDB();
    const items = await new Promise((res) => {
      const g = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      g.onsuccess = () => res(Array.isArray(g.result) ? g.result : null);
      g.onerror = () => res(null);
    });
    if (Array.isArray(items)) return items;
    // одноразова міграція зі старих localStorage-кошиків
    for (const lk of LEGACY_KEYS) {
      try {
        const raw = localStorage.getItem(lk);
        if (raw) {
          const arr = JSON.parse(raw);
          localStorage.removeItem(lk);
          if (Array.isArray(arr) && arr.length) { await writeCart(arr); return arr; }
        }
      } catch { /* ignore */ }
    }
    return [];
  } catch {
    return [];
  }
}

export async function writeCart(items) {
  try {
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(items, KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* IndexedDB недоступний — ігноруємо (кошик лишиться в памʼяті) */ }
}

// Позиція кошика → елемент items[] для POST /api/orders.
export function toOrderItem(i) {
  if (i.type === "photo_print") {
    return { type: "photo_print", photo_size: i.photo_size, photo_coating: i.photo_coating, photo_url: i.photo_url, quantity: i.quantity };
  }
  if (i.type === "design") {
    return {
      product_name: i.name,
      product_type: i.product_type,
      color: i.color || null,
      print_size: i.print_size || null,
      canvas_size: i.canvas_size || null,
      format: i.format || null,
      spreads: i.spreads || null,
      extra_spreads: i.extra_spreads || null,
      inner_photos: i.inner_photos || null,
      variant_label: i.variant_label || null,
      quantity: i.quantity,
      design_data: i.design_data || null,
      design_preview: i.design_preview || null,
      design_preview_back: i.design_preview_back || null,
      print_front: i.print_front || null,
      print_back: i.print_back || null,
      raw_front: i.raw_front || null,
      raw_back: i.raw_back || null,
    };
  }
  // catalog
  return { product_id: i.product_id, variant_id: i.variant_id || null, design_id: i.design_id || null, quantity: i.quantity };
}

// Скільки фото у позиції — для знижки за кількістю (photo_print + пачки фото з конструктора).
export function photoUnits(i) {
  if (i.type === "photo_print") return i.quantity || 0;
  if (i.type === "design" && i.is_photo_pack) return i.quantity || 0;
  return 0;
}
