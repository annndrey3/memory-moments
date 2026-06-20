// Збереження кошика конструктора.
//
// Кошик містить ВЕЛИКІ дані: мокапи-прев'ю, друкарські файли, пачки фото (base64).
// localStorage (~5 МБ) для цього замалий — при великому кошику setItem кидає
// QuotaExceededError, кошик мовчки НЕ зберігається й губиться при переході/оновленні.
// Тому зберігаємо в IndexedDB (ліміт — десятки/сотні МБ). API асинхронний.

const DB_NAME = "mm_designer";
const STORE = "kv";
const KEY = "cart";
const LEGACY_KEY = "mm_designer_cart"; // старий localStorage-ключ → одноразова міграція

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

function idbGet(db, key) {
  return new Promise((resolve) => {
    const r = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve(undefined);
  });
}

function idbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Завантажити кошик. Якщо в IndexedDB порожньо — підхопити (і перенести) старий
// localStorage-кошик. Якщо IndexedDB недоступний — фолбек на localStorage.
export async function loadCart() {
  try {
    const db = await openDB();
    const items = await idbGet(db, KEY);
    if (Array.isArray(items) && items.length) return items;

    // одноразова міграція зі старого localStorage
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        localStorage.removeItem(LEGACY_KEY);
        if (Array.isArray(arr) && arr.length) {
          await idbPut(db, KEY, arr).catch(() => {});
          return arr;
        }
      }
    } catch { /* ignore */ }
    return [];
  } catch {
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]"); } catch { return []; }
  }
}

// Зберегти кошик. IndexedDB тримає великі дані; як крайній фолбек — localStorage
// (для невеликих кошиків, якщо IndexedDB раптом недоступний).
export async function saveCart(items) {
  try {
    const db = await openDB();
    await idbPut(db, KEY, items);
  } catch {
    try { localStorage.setItem(LEGACY_KEY, JSON.stringify(items)); } catch { /* quota — ігноруємо */ }
  }
}
