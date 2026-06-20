import { Router } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { query, transaction } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission, requireSuperadmin } from "../middleware/requirePermission.js";
import { sendOrderNotification } from "../utils/telegram.js";
import { sendOrderConfirmation, sendOrderStatusEmail } from "../utils/email.js";
import { sendPushToOwner } from "../utils/push.js";
import { upsertCustomerFromContact } from "../utils/customers.js";
import { tshirtPriceFromServices, canvasPriceFromServices, servicePriceFor, bookPriceFromServices, photoDiscountPct } from "../utils/designerPricing.js";
import { streamBookArchive, buildBookArchiveToDisk, streamOrderPhotos } from "../utils/bookArchive.js";
import { getPhotoDiscountTiers } from "../utils/siteConfig.js";
import { markOrderForDelivery, tryDeliverOrder } from "../utils/photoDelivery.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

const router = Router();

export const ORDER_STATUSES = ["pending", "paid", "shipped", "completed", "cancelled"];

// Публічне оформлення замовлення — обмежуємо, щоб не спамили заявками.
const createOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато замовлень. Спробуйте за хвилину." },
});

// Публічний перегляд замовлення (сторінка підтвердження) — окремий ліміт, щоб
// послідовні номери (K0001…) не можна було швидко перебрати в пошуках клієнтів.
const trackOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Забагато запитів. Спробуйте за хвилину." },
});

// Атомарний лічильник у таблиці settings. Виконується всередині транзакції,
// щоб номер і вставка замовлення були нерозривними.
async function generateOrderNumber(tx, source) {
  const prefix = source === "designer" ? "K" : "S";
  const seqKey = `order_seq_${prefix}`;
  await tx.run(
    `INSERT INTO settings (key, value) VALUES (:key, '1')
     ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(settings.value AS INTEGER) + 1 AS TEXT), updated_at = CURRENT_TIMESTAMP`,
    { key: seqKey }
  );
  const row = await tx.get("SELECT value FROM settings WHERE key = :key", { key: seqKey });
  const n = String(row?.value ?? 1).padStart(4, "0");
  return `${prefix}${n}`;
}

// Атомарне списання складу позиції: спершу обраний варіант (розмір/колір),
// потім товар у цілому. Умова stock_quantity >= :q прямо у WHERE захищає від
// гонки (два одночасні замовлення не уведуть залишок у мінус).
// Кидає помилку зі .status = 409, якщо залишку не вистачає.
async function holdStock(tx, { product_id, variant_id, quantity, product_name, variant_label }) {
  if (!product_id) return; // кастомні позиції з конструктора — без складу
  if (variant_id) {
    const vr = await tx.run(
      "UPDATE product_variants SET stock_quantity = stock_quantity - :q WHERE id = :id AND stock_quantity >= :q",
      { q: quantity, id: variant_id }
    );
    if (!vr.affectedRows) {
      const e = new Error(`Недостатньо на складі: ${product_name}${variant_label ? ` (${variant_label})` : ""}`);
      e.status = 409;
      throw e;
    }
  }
  const pr = await tx.run(
    "UPDATE products SET stock_quantity = stock_quantity - :q WHERE id = :id AND stock_quantity >= :q",
    { q: quantity, id: product_id }
  );
  if (!pr.affectedRows) {
    const e = new Error(`Недостатньо на складі: ${product_name}`);
    e.status = 409;
    throw e;
  }
}

// Повернення складу позиції (наприклад, при скасуванні замовлення).
async function releaseStock(tx, { product_id, variant_id, quantity }) {
  if (!product_id) return;
  if (variant_id) {
    await tx.run(
      "UPDATE product_variants SET stock_quantity = stock_quantity + :q WHERE id = :id",
      { q: quantity, id: variant_id }
    );
  }
  await tx.run(
    "UPDATE products SET stock_quantity = stock_quantity + :q WHERE id = :id",
    { q: quantity, id: product_id }
  );
}

async function getOrderWithItems(id) {
  const orders = await query("SELECT * FROM orders WHERE id = :id", { id });
  if (!orders.length) return null;
  const items = await query(
    "SELECT * FROM order_items WHERE order_id = :id ORDER BY id",
    { id }
  );
  return { ...orders[0], items };
}

// POST /api/orders — create an order (public checkout).
// Prices are recomputed server-side from the DB, never trusted from the client.
// Ціни конструктора рахуються з ПРАЙСУ (services) через спільний модуль
// designerPricing — і футболка, і решта позицій (чашка/фото/полароїд тощо).
router.post("/", createOrderLimiter, async (req, res) => {
  // Оголошуємо тут, щоб ключ був видимий і в catch (обробка гонки повторів).
  let idempotencyKey = null;
  try {
    const { customer = {}, items = [], source = "marketplace" } = req.body;
    const { name, email, phone, address, notes } = customer;
    // Замовлення з конструктора приходять без email, але з телефоном.
    const orderSource = source === "designer" ? "designer" : "marketplace";

    if (!name || (!email && !phone)) {
      return res.status(400).json({ error: "Вкажіть ім'я та email або телефон" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Кошик порожній" });
    }
    // Обмеження кількості позицій — захист від обʼємного запиту, що тримав би
    // довгу транзакцію та десятки тисяч запитів у БД (event-loop/DoS).
    if (items.length > 50) {
      return res.status(400).json({ error: "Забагато позицій у замовленні (макс. 50)" });
    }

    // Ідемпотентність: повтор запиту з тим самим ключем (напр. після таймауту)
    // повертає вже створене замовлення, а не дубль. Ключ — з заголовка
    // Idempotency-Key або з тіла. Без ключа поведінка не змінюється.
    idempotencyKey =
      (req.get("Idempotency-Key") || req.body.idempotency_key || "").trim() || null;
    if (idempotencyKey) {
      const dup = await query("SELECT id FROM orders WHERE idempotency_key = :k", { k: idempotencyKey });
      if (dup.length) {
        return res.status(200).json(await getOrderWithItems(dup[0].id));
      }
    }

    // Унікальний ключ для файлів друку — не залежить від номера замовлення.
    const fileKey = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    // Друкарські файли збираємо тут і пишемо на диск ЛИШЕ після успішного коміту
    // (success-path): інакше відкіт транзакції (напр. 409 нестача складу) лишав би
    // orphan-файли. { dataUrl, filename }.
    const fileJobs = [];

    // Прайс-лист один раз на замовлення — джерело цін для всіх позицій конструктора.
    const servicesRows = await query("SELECT code, format, price FROM services WHERE is_active = 1");

    // Resolve each line. Items with product_id come from the catalog (prices from
    // the DB); items without — custom designs from the constructor.
    const resolved = [];
    let photoCount = 0; // сумарна кіл-ть фото (photo_print) — для знижки за кількістю
    let photoSubtotal = 0;
    let hasBookItem = false; // є фотокнига з фото → фонова збірка ZIP-архіву
    // Вкладення для Telegram збираємо з base64 у items[]. Клієнт БІЛЬШЕ НЕ шле
    // окремі images/documents — це дублювало кожне фото в тілі й давало 413 на
    // фотокнигах (десятки розворотів × двічі). innerPhotoCount → коли слати лінк.
    const tgImages = [];
    const tgDocuments = [];
    let innerPhotoCount = 0;
    for (const [itemIndex, item] of items.entries()) {
      const quantity = Math.max(1, Number(item.quantity) || 1);

      if (item.product_id) {
        const products = await query(
          "SELECT id, name, price, is_active FROM products WHERE id = :id",
          { id: item.product_id }
        );
        const product = products[0];
        if (!product || !product.is_active) {
          return res.status(400).json({ error: `Товар недоступний (id ${item.product_id})` });
        }

        let unitPrice = Number(product.price);
        let variantLabel = null;
        if (item.variant_id) {
          const variants = await query(
            "SELECT * FROM product_variants WHERE id = :id AND product_id = :pid",
            { id: item.variant_id, pid: product.id }
          );
          const variant = variants[0];
          if (!variant) {
            return res.status(400).json({ error: `Варіант недоступний (id ${item.variant_id})` });
          }
          unitPrice += Number(variant.price_modifier || 0);
          variantLabel = `${variant.attribute_name}: ${variant.attribute_value}`;
        }

        if (!Number.isFinite(unitPrice)) {
          return res.status(400).json({ error: `Некоректна ціна товару (id ${item.product_id})` });
        }

        resolved.push({
          product_id: product.id,
          variant_id: item.variant_id || null,
          design_id: item.design_id || null,
          design_data: null,
          design_preview: null,
          product_name: product.name,
          variant_label: variantLabel,
          unit_price: unitPrice,
          quantity,
          line_total: unitPrice * quantity,
        });
      } else if (item.type === "photo_print") {
        // Замовлення друку клієнтських фото — ціна береться зі серверного списку,
        // НЕ з клієнта, щоб унеможливити підміну ціни.
        const PHOTO_PRICES = {
          "10x15": 15, "13x18": 25, "15x21": 35, "20x30": 65, "30x40": 120,
        };
        const unitPrice = PHOTO_PRICES[item.photo_size];
        if (!unitPrice) {
          return res.status(400).json({ error: `Непідтримуваний розмір фото: ${item.photo_size}` });
        }
        if (!item.photo_url) {
          return res.status(400).json({ error: "Відсутнє посилання на фото" });
        }
        const COATING_LABELS = { matte: "Матове", gloss: "Глянцеве" };
        const sizeLabel = item.photo_size.replace("x", "×") + " см";
        const coatingLabel = COATING_LABELS[item.photo_coating] || item.photo_coating || "";

        resolved.push({
          product_id: null,
          variant_id: null,
          design_id: null,
          design_data: JSON.stringify({ type: "photo_print", size: item.photo_size, coating: item.photo_coating }),
          design_preview: item.photo_url,
          product_name: `Друк фото ${sizeLabel}`,
          variant_label: coatingLabel ? `${coatingLabel} покриття` : null,
          unit_price: unitPrice,
          quantity,
          line_total: unitPrice * quantity,
        });
        photoCount += quantity;
        photoSubtotal += unitPrice * quantity;
      } else {
        // Custom design from the constructor: no catalog product_id.
        // ЦІНА ЗАВЖДИ рахується на сервері з ПРАЙСУ (services) за типом товару —
        // клієнтський item.unit_price НІКОЛИ не приймаємо (захист від підміни ціни).
        const productName = item.product_name || item.productName || "Власний дизайн";
        if (!item.product_type) {
          return res.status(400).json({ error: "Не вказано тип товару для кастомного дизайну" });
        }
        let unitPrice;
        if (item.product_type === "crew-neck") {
          // Футболка: ціна з прайсу (колір + формат + друга сторона).
          // Друга сторона друку = коли є обидва макети (перед і спина).
          unitPrice = tshirtPriceFromServices(servicesRows, {
            color: item.color,
            printSize: item.print_size,
            bothSides: Boolean(item.print_front) && Boolean(item.print_back),
          });
        } else if (item.product_type === "canvas") {
          // Полотно: ціна з прайсу за обраним розміром.
          unitPrice = canvasPriceFromServices(servicesRows, item.canvas_size);
        } else if (item.product_type === "slim-book" || item.product_type === "print-book") {
          // Фотокниги: база (10/15) за форматом + доплата за одиницю понад базу.
          // GUARD: рахуємо КОЖНЕ завантажене фото понад базу, навіть якщо клієнт
          // прислав занижений extra_spreads (захист від недонарахування ціни).
          const baseSpreads = Number(item.spreads) === 15 ? 15 : 10;
          const photoN = Array.isArray(item.inner_photos) ? item.inner_photos.length : 0;
          const effExtra = Math.max(Number(item.extra_spreads) || 0, photoN - baseSpreads);
          unitPrice = bookPriceFromServices(servicesRows, item.product_type, {
            format: item.format || item.canvas_size,
            spreads: item.spreads,
            extra: effExtra,
          });
        } else {
          // Решта позицій (чашка/фото/полароїд тощо) — з прайсу за мапою.
          unitPrice = servicePriceFor(item.product_type, servicesRows);
        }
        // Фолбек: якщо в прайсі немає рядка — беремо ціну з каталогу за designer_type.
        if (unitPrice == null) {
          const match = await query(
            "SELECT price FROM products WHERE designer_type = :pt AND is_active = 1 ORDER BY is_featured DESC, id LIMIT 1",
            { pt: item.product_type }
          );
          if (!match[0]) {
            return res.status(400).json({ error: `Немає ціни для типу «${item.product_type}» (прайс і каталог порожні)` });
          }
          unitPrice = Number(match[0].price);
        }
        if (!Number.isFinite(Number(unitPrice))) {
          return res.status(400).json({ error: `Некоректна ціна для типу «${item.product_type}»` });
        }
        const variantLabel =
          item.variant_label || (item.color ? `Колір: ${item.color}` : null);

        // Плануємо запис друкарських макетів на диск, але НЕ пишемо до коміту.
        // Індекс позиції (itemIndex) у ключі унеможливлює перезапис файлів між
        // позиціями одного замовлення (інакше другий дизайн затирав би перший).
        const idxKey = `${fileKey}_${itemIndex}`;
        const scheduleImage = (dataUrl, filename) => {
          if (!dataUrl || !dataUrl.startsWith("data:image")) return null;
          fileJobs.push({ dataUrl, filename });
          return `/uploads/${filename}`;
        };
        const printFrontUrl = scheduleImage(item.print_front, `print_${idxKey}_front.png`);
        const printBackUrl = scheduleImage(item.print_back, `print_${idxKey}_back.png`);
        // Сирий кроп зони друку (фото клієнта без рамки шаблону) — для прев'ю в адмінці.
        const rawFrontUrl = scheduleImage(item.raw_front, `raw_${idxKey}_front.png`);
        const rawBackUrl = scheduleImage(item.raw_back, `raw_${idxKey}_back.png`);
        // Мокап-прев'ю (JPEG): або зберігаємо base64 на диск, або лишаємо готовий URL.
        const previewUrl = item.design_preview?.startsWith("data:image")
          ? scheduleImage(item.design_preview, `preview_${idxKey}.jpg`)
          : (item.design_preview || null);

        // Slim Book: фото для внутрішніх розворотів — кожне окремим файлом на диск,
        // студія розкладає по макету. URL-и зберігаємо в design_data.innerPhotos.
        const innerPhotoUrls = [];
        if (Array.isArray(item.inner_photos)) {
          item.inner_photos.forEach((dataUrl, i) => {
            const u = scheduleImage(dataUrl, `book_${idxKey}_${i + 1}.jpg`);
            if (u) innerPhotoUrls.push(u);
          });
        }
        // inner_photos несуть і книги (розвороти), і пачка фото (multi-photo). ZIP-архів
        // книги збираємо ЛИШЕ для справжніх книг (інакше пачку фото оброблятимемо як книгу).
        const isBookPhotos = item.product_type === "slim-book" || item.product_type === "print-book";
        if (innerPhotoUrls.length && isBookPhotos) hasBookItem = true;

        // Вкладення для Telegram — з тих самих base64, що прийшли в items[]
        // (без дубля в тілі запиту). Прев'ю → images; друк + розвороти → documents.
        const isData = (s) => typeof s === "string" && s.startsWith("data:image");
        if (isData(item.design_preview)) tgImages.push({ data: item.design_preview, caption: `${productName} — Спереду` });
        if (isData(item.design_preview_back)) tgImages.push({ data: item.design_preview_back, caption: `${productName} — Ззаду` });
        if (isData(item.print_front)) tgDocuments.push({ data: item.print_front, caption: `🖨 ${productName} — Спереду (друк)` });
        if (isData(item.print_back)) tgDocuments.push({ data: item.print_back, caption: `🖨 ${productName} — Ззаду (друк)` });
        if (Array.isArray(item.inner_photos)) {
          const unitWord = isBookPhotos ? "розворот" : "фото";
          item.inner_photos.forEach((d, i) => { if (isData(d)) tgDocuments.push({ data: d, caption: `📖 ${productName} — ${unitWord} ${i + 1}` }); });
        }
        innerPhotoCount += innerPhotoUrls.length;

        // Вбудовуємо URL друкарських файлів у design_data поряд з fabric JSON.
        let fabricData = {};
        try { fabricData = JSON.parse(item.design_data || "{}"); } catch { /* */ }
        const isBook = item.product_type === "slim-book" || item.product_type === "print-book";
        const designDataFull = JSON.stringify({
          ...fabricData,
          ...(printFrontUrl ? { printFrontUrl } : {}),
          ...(printBackUrl ? { printBackUrl } : {}),
          ...(rawFrontUrl ? { rawFrontUrl } : {}),
          ...(rawBackUrl ? { rawBackUrl } : {}),
          ...(innerPhotoUrls.length ? { innerPhotos: innerPhotoUrls } : {}),
          ...(isBook ? { book: { type: item.product_type, format: item.format || item.canvas_size || null, spreads: item.spreads || null, extra: item.extra_spreads || null } } : {}),
        });

        resolved.push({
          product_id: null,
          variant_id: null,
          design_id: item.design_id || null,
          design_data: designDataFull,
          design_preview: previewUrl,
          product_name: productName,
          variant_label: variantLabel,
          unit_price: unitPrice,
          quantity,
          line_total: unitPrice * quantity,
        });
      }
    }

    const subtotal = resolved.reduce((sum, r) => sum + r.line_total, 0);
    // Знижка на друк фото за кількістю (усі формати) — лише позиції photo_print.
    // Пороги беремо з налаштувань сайту (адмінка), фолбек — дефолтні тіри.
    const discountTiers = await getPhotoDiscountTiers();
    const discount = Math.round((photoSubtotal * photoDiscountPct(photoCount, discountTiers)) / 100);
    const total = Math.max(0, subtotal - discount);

    // Уся вставка замовлення + списання складу — в одній транзакції.
    // Номер замовлення генерується тут же, щоб лічильник і INSERT були атомарними.
    const orderId = await transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx, orderSource);
      const { insertId } = await tx.run(
        `INSERT INTO orders
         (order_number, customer_name, customer_email, customer_phone, shipping_address, notes, status, source, subtotal, discount, total, idempotency_key, archive_status)
         VALUES (:order_number, :name, :email, :phone, :address, :notes, 'pending', :source, :subtotal, :discount, :total, :idempotency_key, :archive_status)`,
        {
          order_number: orderNumber,
          name,
          email: email || "",
          phone: phone || null,
          address: address || null,
          notes: notes || null,
          source: orderSource,
          subtotal,
          discount,
          total,
          idempotency_key: idempotencyKey,
          archive_status: hasBookItem ? "pending" : null,
        }
      );

      for (const r of resolved) {
        // Списуємо склад ДО вставки позиції — нестача відкотить усю транзакцію.
        await holdStock(tx, r);
        await tx.run(
          `INSERT INTO order_items
           (order_id, product_id, variant_id, design_id, design_data, design_preview, product_name, variant_label, unit_price, quantity, line_total)
           VALUES (:order_id, :product_id, :variant_id, :design_id, :design_data, :design_preview, :product_name, :variant_label, :unit_price, :quantity, :line_total)`,
          { order_id: insertId, ...r }
        );
      }

      return insertId;
    });

    const order = await getOrderWithItems(orderId);

    // Відповідаємо клієнту ОДРАЗУ після збереження в БД. Запис файлів на диск,
    // Telegram/email та SFTP винесені ЗА відповідь — інакше замовлення з багатьма
    // фото (200 шт ≈ десятки МБ) тримало б HTTP-зʼєднання на час запису всіх
    // файлів (клієнт «висить» на 100%, а сервер зайнятий і гальмує адмінку).
    res.status(201).json(order);

    // Друкарські файли пишемо ПІСЛЯ відповіді (best-effort). Робимо це ПЕРШИМ
    // побічним ефектом, бо SFTP-доставка та ZIP-архів читають їх з диска.
    for (const job of fileJobs) {
      try {
        const base64 = job.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        await fs.promises.writeFile(path.join(UPLOAD_DIR, job.filename), Buffer.from(base64, "base64"));
      } catch (e) {
        console.error(`order ${order.order_number}: write ${job.filename} failed:`, e.message);
      }
    }

    // Best-effort побічні ефекти — поза відповіддю клієнту (помилки лише логуємо).
    try {
      await upsertCustomerFromContact({ name, email, phone, source });
    } catch (e) {
      console.warn("Customer upsert failed:", e.message);
    }
    // Якщо фото більше 3 шт — у Telegram йде лише посилання, а не купа файлів
    // (повна якість лишається на сервері й доставляється у сховище дизайнера).
    // Вкладення зібрані з items[] під час циклу (без дубля в тілі). Лінк замість
    // файлів — коли фото багато (фотокнига/багато позицій), щоб не спамити TG.
    const attachmentCount = tgImages.length + tgDocuments.length;
    const manyPhotos = tgImages.length > 3 || photoCount > 3 || innerPhotoCount > 3;
    const publicBase = process.env.PUBLIC_URL || "";
    let notifyStatus = "sent";
    try {
      await sendOrderNotification(order, tgImages, tgDocuments, {
        attachmentsAsLink: manyPhotos,
        attachmentCount: Math.max(attachmentCount, photoCount),
        downloadUrl: publicBase ? `${publicBase}/admin/orders` : "",
      });
    } catch (e) {
      notifyStatus = "failed";
      console.warn("Telegram notify failed:", e.message);
    }
    try {
      await sendOrderConfirmation(order);
    } catch (e) {
      console.warn("Email confirmation failed:", e.message);
    }
    // Фіксуємо статус сповіщення власника: 'failed' видно в адмінці/логах —
    // заказ не губиться тихо, його можна доставити повторно (POST /:id/notify).
    try {
      await query(
        "UPDATE orders SET notify_status = :s, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
        { s: notifyStatus, id: orderId }
      );
    } catch (e) {
      console.warn("notify_status update failed:", e.message);
    }

    // Web-push власнику (нове замовлення) — навіть коли адмінка/браузер закриті.
    try {
      const n = order.items?.length || 1;
      await sendPushToOwner({
        title: `🛒 Нове замовлення ${order.order_number}`,
        body: `${order.customer_name || "Клієнт"} · ${Math.round(order.total)} ₴ · ${n} поз.`,
        url: "/admin/orders",
        tag: `order-${order.order_number}`,
      });
    } catch (e) {
      console.warn("Push notify failed:", e.message);
    }

    // Доставка фото/макетів у сховище дизайнера (SFTP), якщо у замовленні є файли.
    // VPS лишається копією. Якщо сховище не налаштоване або ПК офлайн — замовлення
    // стає 'pending' і фонова черга достукається пізніше (напр. вранці о 9:00).
    if (fileJobs.length > 0 || photoCount > 0 || orderSource === "designer") {
      markOrderForDelivery(orderId)
        .then(() => tryDeliverOrder(orderId))
        .catch((e) => console.warn("photo delivery enqueue failed:", e.message));
    }

    // Фонова збірка ZIP-архіву книги (поза відповіддю клієнту) — щоб великі книги
    // збиралися без ризику HTTP-таймауту. Готовий архів зʼявиться в адмінці.
    if (hasBookItem) {
      buildBookArchiveToDisk(order)
        .then((url) => url && query(
          "UPDATE orders SET archive_url = :u, archive_status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = :id",
          { u: url, id: orderId }
        ))
        .catch((e) => {
          console.error(`order ${order.order_number}: book archive failed:`, e.message);
          query("UPDATE orders SET archive_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = :id", { id: orderId }).catch(() => {});
        });
    }
  } catch (err) {
    // Відповідь могла вже піти (помилка у побічному ефекті після res.json) —
    // тоді просто логуємо, без повторної відправки заголовків.
    if (res.headersSent) {
      console.error("Order post-response error:", err?.message);
      return;
    }
    // Гонка ідемпотентності: паралельний запит із тим самим ключем уже створив
    // замовлення (unique-індекс відхилив наш INSERT) — повертаємо існуюче.
    if (idempotencyKey && (err.code === "ER_DUP_ENTRY" || err.code === "23505")) {
      try {
        const dup = await query("SELECT id FROM orders WHERE idempotency_key = :k", { k: idempotencyKey });
        if (dup.length) return res.status(200).json(await getOrderWithItems(dup[0].id));
      } catch { /* провалюємось у звичайну обробку помилки */ }
    }
    // Нестача складу — очікувана помилка валідації, повертаємо 409 з повідомленням.
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Не вдалося оформити замовлення" });
  }
});

// Публічна проєкція замовлення: лише статус, позиції та суми — БЕЗ PII
// (імʼя/email/телефон/адреса/нотатки). Інакше перебір послідовних номерів
// дозволяв би зібрати контакти всіх клієнтів.
function publicOrderView(order) {
  return {
    order_number: order.order_number,
    status: order.status,
    source: order.source,
    subtotal: order.subtotal,
    total: order.total,
    created_at: order.created_at,
    items: (order.items || []).map((it) => ({
      id: it.id,
      product_name: it.product_name,
      variant_label: it.variant_label,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_total: it.line_total,
    })),
  };
}

// GET /api/orders/track/:number — public order lookup for the confirmation page.
router.get("/track/:number", trackOrderLimiter, async (req, res) => {
  try {
    const orders = await query("SELECT * FROM orders WHERE order_number = :n", {
      n: req.params.number,
    });
    if (!orders.length) return res.status(404).json({ error: "Замовлення не знайдено" });
    const order = await getOrderWithItems(orders[0].id);
    res.json(publicOrderView(order));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders — admin list with optional status filter.
router.get("/", authMiddleware, requirePermission("orders.view"), async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = { limit: Number(limit), offset: Number(offset) };

    let where = "";
    if (status && ORDER_STATUSES.includes(status)) {
      where = "WHERE status = :status";
      params.status = status;
    }

    const items = await query(
      `SELECT o.*, (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       ${where}
       ORDER BY o.created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    const countParams = { ...params };
    delete countParams.limit;
    delete countParams.offset;
    const [{ total }] = await query(`SELECT COUNT(*) AS total FROM orders ${where}`, countParams);

    res.json({ items, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:id — admin order detail.
router.get("/:id", authMiddleware, requirePermission("orders.view"), async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders/:id/book-archive — ZIP фотокниги: обкладинки (перед/зад) +
// розгортки, розкладені на готові друкарські сторінки (300 dpi, поля, R/L).
router.get("/:id/book-archive", authMiddleware, requirePermission("orders.view"), async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    // Готовий архів (зібраний фоном) — віддаємо файл одразу, без перезбірки.
    if (order.archive_url) {
      const p = path.join(UPLOAD_DIR, path.basename(order.archive_url));
      if (fs.existsSync(p)) return res.download(p, `book-${order.order_number}.zip`);
    }
    // Фолбек: зібрати на льоту (старі/невдалі замовлення).
    const ok = await streamBookArchive(order, res);
    if (!ok && !res.headersSent) res.status(400).json({ error: "У замовленні немає фотокниги" });
  } catch (err) {
    console.error("book-archive error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Не вдалося зібрати архів" });
  }
});

// GET /api/orders/:id/photos-archive — ZIP усіх файлів замовлення (принти, прев'ю,
// сирі фото, розвороти) як є з диска. Для кнопки «Скачати всі фото» в адмінці.
router.get("/:id/photos-archive", authMiddleware, requirePermission("orders.view"), async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    const ok = await streamOrderPhotos(order, res);
    if (!ok && !res.headersSent) res.status(400).json({ error: "У замовленні немає фото" });
  } catch (err) {
    console.error("photos-archive error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Не вдалося зібрати фото" });
  }
});

// PATCH /api/orders/:id/status — admin status update.
// Склад вважаємо «зайнятим», поки замовлення не cancelled. Тому на переході
// у cancelled повертаємо залишок, а при знятті скасування — знову списуємо.
router.patch("/:id/status", authMiddleware, requirePermission("orders.manage"), async (req, res) => {
  try {
    const { status } = req.body;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимий статус. Дозволені: ${ORDER_STATUSES.join(", ")}` });
    }
    const existing = await query("SELECT id, status FROM orders WHERE id = :id", { id: req.params.id });
    if (!existing.length) return res.status(404).json({ error: "Order not found" });

    const prevStatus = existing[0].status;
    const wasCancelled = prevStatus === "cancelled";
    const willCancel = status === "cancelled";
    const items = await query(
      "SELECT product_id, variant_id, quantity, product_name, variant_label FROM order_items WHERE order_id = :id",
      { id: req.params.id }
    );

    // Причину пишемо лише при скасуванні; при іншому статусі — очищаємо.
    const cancelReason = willCancel ? (reason || null) : null;

    // Корекція складу + зміна статусу — атомарно в одній транзакції.
    await transaction(async (tx) => {
      if (!wasCancelled && willCancel) {
        // Скасування: повертаємо склад.
        for (const it of items) await releaseStock(tx, it);
      } else if (wasCancelled && !willCancel) {
        // Зняття скасування: знову списуємо склад (з перевіркою наявності).
        for (const it of items) await holdStock(tx, it);
      }
      await tx.run(
        "UPDATE orders SET status = :status, cancel_reason = :reason, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
        { status, reason: cancelReason, id: req.params.id }
      );
    });

    const order = await getOrderWithItems(req.params.id);

    // Лист клієнту про зміну статусу (fire-and-forget; видалення листів не шле).
    // Шлемо лише коли статус справді змінився, щоб не дублювати при повторному виборі.
    if (status !== prevStatus) {
      sendOrderStatusEmail(order, status, cancelReason).catch((e) =>
        console.warn(`Status email (${status}) failed for ${order.order_number}:`, e.message)
      );
    }
    res.json(order);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// POST /api/orders/:id/notify — повторно надіслати власнику сповіщення в Telegram
// (напр. якщо перша спроба впала: notify_status='failed'). Текстове резюме без
// важких вкладень — оригінальні base64-прев'ю у запиті вже не зберігаються.
router.post("/:id/notify", authMiddleware, requirePermission("orders.manage"), async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    let notifyStatus = "sent";
    try {
      await sendOrderNotification(order, [], []);
    } catch (e) {
      notifyStatus = "failed";
      console.warn("Telegram resend failed:", e.message);
    }
    await query(
      "UPDATE orders SET notify_status = :s, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
      { s: notifyStatus, id: req.params.id }
    );
    res.json({ ok: notifyStatus === "sent", notify_status: notifyStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to resend notification" });
  }
});

// Видалення замовлення — тільки суперадмін.
// Разом із замовленням видаляються print-файли з uploads/.
router.delete("/:id", authMiddleware, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [order] = await query("SELECT id, status, archive_url FROM orders WHERE id = :id", { id });
    if (!order) return res.status(404).json({ error: "Замовлення не знайдено" });

    // Збираємо print-файли та preview + дані для повернення складу перед видаленням.
    const items = await query(
      "SELECT product_id, variant_id, quantity, design_data, design_preview FROM order_items WHERE order_id = :id",
      { id }
    );
    const filesToDelete = [];
    for (const { design_data, design_preview } of items) {
      try {
        const d = JSON.parse(design_data || "{}");
        [d.printFrontUrl, d.printBackUrl, d.rawFrontUrl, d.rawBackUrl, ...(Array.isArray(d.innerPhotos) ? d.innerPhotos : [])].forEach((u) => {
          if (u) filesToDelete.push(path.join(UPLOAD_DIR, path.basename(u)));
        });
      } catch { /* */ }
      if (design_preview?.startsWith("/uploads/")) {
        filesToDelete.push(path.join(UPLOAD_DIR, path.basename(design_preview)));
      }
    }
    if (order.archive_url) filesToDelete.push(path.join(UPLOAD_DIR, path.basename(order.archive_url)));

    // Повернення складу + видалення — атомарно. Якщо замовлення не було
    // скасоване, склад досі «зайнятий» цим замовленням, тож повертаємо його
    // (інакше видалення pending/paid-замовлення назавжди губило б залишок).
    await transaction(async (tx) => {
      if (order.status !== "cancelled") {
        for (const it of items) await releaseStock(tx, it);
      }
      await tx.run("DELETE FROM orders WHERE id = :id", { id });
    });

    // Видаляємо файли після успішного DELETE з БД
    for (const f of filesToDelete) {
      try { fs.unlinkSync(f); } catch { /* файл міг бути вже прибраний */ }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

export default router;
