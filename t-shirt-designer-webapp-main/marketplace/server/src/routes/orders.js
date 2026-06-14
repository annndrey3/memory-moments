import { Router } from "express";
import rateLimit from "express-rate-limit";
import { query, transaction } from "../config/db.js";
import { authMiddleware } from "../middleware/auth.js";
import { sendOrderNotification } from "../utils/telegram.js";

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
function holdStock(tx, { product_id, variant_id, quantity, product_name, variant_label }) {
  if (!product_id) return; // кастомні позиції з конструктора — без складу
  if (variant_id) {
    const vr = tx.run(
      "UPDATE product_variants SET stock_quantity = stock_quantity - :q WHERE id = :id AND stock_quantity >= :q",
      { q: quantity, id: variant_id }
    );
    if (!vr.affectedRows) {
      const e = new Error(`Недостатньо на складі: ${product_name}${variant_label ? ` (${variant_label})` : ""}`);
      e.status = 409;
      throw e;
    }
  }
  const pr = tx.run(
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
function releaseStock(tx, { product_id, variant_id, quantity }) {
  if (!product_id) return;
  if (variant_id) {
    tx.run(
      "UPDATE product_variants SET stock_quantity = stock_quantity + :q WHERE id = :id",
      { q: quantity, id: variant_id }
    );
  }
  tx.run(
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
          product_name: product.name,
          variant_label: variantLabel,
          unit_price: unitPrice,
          quantity,
          line_total: unitPrice * quantity,
        });
      } else {
        // Custom design from the constructor: no catalog product_id.
        // ЦІНА ЗАВЖДИ рахується на сервері за designer_type з каталогу —
        // клієнтський item.unit_price НІКОЛИ не приймаємо (захист від підміни ціни).
        const productName = item.product_name || item.productName || "Власний дизайн";
        if (!item.product_type) {
          return res.status(400).json({ error: "Не вказано тип товару для кастомного дизайну" });
        }
        const match = await query(
          "SELECT price FROM products WHERE designer_type = :pt AND is_active = 1 ORDER BY is_featured DESC, id LIMIT 1",
          { pt: item.product_type }
        );
        if (!match[0]) {
          return res.status(400).json({ error: `Немає доступного товару для типу «${item.product_type}»` });
        }
        const unitPrice = Number(match[0].price);
        const variantLabel =
          item.variant_label || (item.color ? `Колір: ${item.color}` : null);

        resolved.push({
          product_id: null,
          variant_id: null,
          design_id: item.design_id || null,
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

    const orderNumber = generateOrderNumber();

    // Уся вставка замовлення + списання складу — в одній синхронній транзакції.
    const orderId = transaction((tx) => {
      const { insertId } = tx.run(
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
        holdStock(tx, r);
        tx.run(
          `INSERT INTO order_items
           (order_id, product_id, variant_id, design_id, product_name, variant_label, unit_price, quantity, line_total)
           VALUES (:order_id, :product_id, :variant_id, :design_id, :product_name, :variant_label, :unit_price, :quantity, :line_total)`,
          { order_id: insertId, ...r }
        );
      }

      return insertId;
    });

    const order = await getOrderWithItems(orderId);

    // Сповіщення в Telegram (best-effort — не валимо замовлення, якщо TG недоступний).
    try {
      await sendOrderNotification(order, req.body.images);
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
router.get("/", authMiddleware, async (req, res) => {
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
router.get("/:id", authMiddleware, async (req, res) => {
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
router.patch("/:id/status", authMiddleware, async (req, res) => {
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

    // Корекція складу + зміна статусу — атомарно в одній синхронній транзакції.
    transaction((tx) => {
      if (!wasCancelled && willCancel) {
        // Скасування: повертаємо склад.
        for (const it of items) releaseStock(tx, it);
      } else if (wasCancelled && !willCancel) {
        // Зняття скасування: знову списуємо склад (з перевіркою наявності).
        for (const it of items) holdStock(tx, it);
      }
      tx.run(
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

export default router;
