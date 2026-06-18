import { Router } from "express";
import rateLimit from "express-rate-limit";
import fs from "fs";
import path from "path";
import { query, transaction } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requirePermission, requireSuperadmin } from "../middleware/requirePermission.js";
import { sendOrderNotification } from "../utils/telegram.js";
import { tshirtPriceFromServices, canvasPriceFromServices, servicePriceFor } from "../utils/designerPricing.js";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";

function savePrintImage(dataUrl, filename) {
  if (!dataUrl || !dataUrl.startsWith("data:image")) return null;
  try {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), Buffer.from(base64, "base64"));
    return `/uploads/${filename}`;
  } catch (e) {
    console.error("savePrintImage failed:", e.message);
    return null;
  }
}

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

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `MM-${ts}-${rand}`;
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

    const orderNumber = generateOrderNumber();

    // Прайс-лист один раз на замовлення — джерело цін для всіх позицій конструктора.
    const servicesRows = await query("SELECT code, format, price FROM services WHERE is_active = 1");

    // Resolve each line. Items with product_id come from the catalog (prices from
    // the DB); items without — custom designs from the constructor.
    const resolved = [];
    for (const item of items) {
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
        const variantLabel =
          item.variant_label || (item.color ? `Колір: ${item.color}` : null);

        // Зберігаємо друкарські макети на диск (base64 → PNG-файл),
        // щоб уникнути зберігання великих blob у SQLite.
        const ts = Date.now();
        const printFrontUrl = item.print_front
          ? savePrintImage(item.print_front, `print_${orderNumber}_${ts}_front.png`)
          : null;
        const printBackUrl = item.print_back
          ? savePrintImage(item.print_back, `print_${orderNumber}_${ts}_back.png`)
          : null;
        // Сирий кроп зони друку (фото клієнта без рамки шаблону) — для прев'ю в адмінці.
        const rawFrontUrl = item.raw_front
          ? savePrintImage(item.raw_front, `raw_${orderNumber}_${ts}_front.png`)
          : null;
        const rawBackUrl = item.raw_back
          ? savePrintImage(item.raw_back, `raw_${orderNumber}_${ts}_back.png`)
          : null;
        // Зберігаємо мокап-прев'ю на диск (JPEG) замість blob у SQLite.
        const previewUrl = item.design_preview?.startsWith("data:image")
          ? savePrintImage(item.design_preview, `preview_${orderNumber}_${ts}.jpg`)
          : (item.design_preview || null);

        // Вбудовуємо URL друкарських файлів у design_data поряд з fabric JSON.
        let fabricData = {};
        try { fabricData = JSON.parse(item.design_data || "{}"); } catch { /* */ }
        const designDataFull = JSON.stringify({
          ...fabricData,
          ...(printFrontUrl ? { printFrontUrl } : {}),
          ...(printBackUrl ? { printBackUrl } : {}),
          ...(rawFrontUrl ? { rawFrontUrl } : {}),
          ...(rawBackUrl ? { rawBackUrl } : {}),
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
    const total = subtotal; // доставка/податки можна додати тут пізніше

    // Уся вставка замовлення + списання складу — в одній транзакції.
    const orderId = await transaction(async (tx) => {
      const { insertId } = await tx.run(
        `INSERT INTO orders
         (order_number, customer_name, customer_email, customer_phone, shipping_address, notes, status, source, subtotal, total)
         VALUES (:order_number, :name, :email, :phone, :address, :notes, 'pending', :source, :subtotal, :total)`,
        {
          order_number: orderNumber,
          name,
          email: email || "",
          phone: phone || null,
          address: address || null,
          notes: notes || null,
          source: orderSource,
          subtotal,
          total,
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

    // Сповіщення в Telegram (best-effort — не валимо замовлення, якщо TG недоступний).
    // images — стиснені прев'ю (інлайн), documents — друкарські макети (без перестиску).
    try {
      await sendOrderNotification(order, req.body.images, req.body.documents);
    } catch (e) {
      console.warn("Telegram notify failed:", e.message);
    }

    res.status(201).json(order);
  } catch (err) {
    // Нестача складу — очікувана помилка валідації, повертаємо 409 з повідомленням.
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error("Error creating order:", err);
    res.status(500).json({ error: "Не вдалося оформити замовлення" });
  }
});

// GET /api/orders/track/:number — public order lookup for the confirmation page.
router.get("/track/:number", async (req, res) => {
  try {
    const orders = await query("SELECT * FROM orders WHERE order_number = :n", {
      n: req.params.number,
    });
    if (!orders.length) return res.status(404).json({ error: "Замовлення не знайдено" });
    const order = await getOrderWithItems(orders[0].id);
    res.json(order);
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

// PATCH /api/orders/:id/status — admin status update.
// Склад вважаємо «зайнятим», поки замовлення не cancelled. Тому на переході
// у cancelled повертаємо залишок, а при знятті скасування — знову списуємо.
router.patch("/:id/status", authMiddleware, requirePermission("orders.manage"), async (req, res) => {
  try {
    const { status } = req.body;
    if (!ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Недопустимий статус. Дозволені: ${ORDER_STATUSES.join(", ")}` });
    }
    const existing = await query("SELECT id, status FROM orders WHERE id = :id", { id: req.params.id });
    if (!existing.length) return res.status(404).json({ error: "Order not found" });

    const wasCancelled = existing[0].status === "cancelled";
    const willCancel = status === "cancelled";
    const items = await query(
      "SELECT product_id, variant_id, quantity, product_name, variant_label FROM order_items WHERE order_id = :id",
      { id: req.params.id }
    );

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
        "UPDATE orders SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id",
        { status, id: req.params.id }
      );
    });

    const order = await getOrderWithItems(req.params.id);
    res.json(order);
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// Видалення замовлення — тільки суперадмін.
// Разом із замовленням видаляються print-файли з uploads/.
router.delete("/:id", authMiddleware, requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const [order] = await query("SELECT id FROM orders WHERE id = :id", { id });
    if (!order) return res.status(404).json({ error: "Замовлення не знайдено" });

    // Збираємо print-файли та preview перед видаленням з БД
    const items = await query(
      "SELECT design_data, design_preview FROM order_items WHERE order_id = :id", { id }
    );
    const filesToDelete = [];
    for (const { design_data, design_preview } of items) {
      try {
        const d = JSON.parse(design_data || "{}");
        [d.printFrontUrl, d.printBackUrl, d.rawFrontUrl, d.rawBackUrl].forEach((u) => {
          if (u) filesToDelete.push(path.join(UPLOAD_DIR, path.basename(u)));
        });
      } catch { /* */ }
      if (design_preview?.startsWith("/uploads/")) {
        filesToDelete.push(path.join(UPLOAD_DIR, path.basename(design_preview)));
      }
    }

    await query("DELETE FROM orders WHERE id = :id", { id });

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
