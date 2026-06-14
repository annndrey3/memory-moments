// Server-side Telegram notifications. Токен живе лише в .env сервера (секретний),
// у клієнтський бандл не потрапляє.
const TG_API = "https://api.telegram.org";

const token = () => process.env.TG_BOT_TOKEN;
const chatId = () => process.env.TG_CHAT_ID;

export const telegramEnabled = () => Boolean(token() && chatId());

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function dataUrlToBlob(dataUrl) {
  const m = /^data:(image\/[\w+.-]+);base64,(.+)$/s.exec(dataUrl || "");
  if (!m) return null;
  return { blob: new Blob([Buffer.from(m[2], "base64")], { type: m[1] }), ext: (m[1].split("/")[1] || "png").replace(/[^\w]/g, "") };
}

async function tgCall(method, body, isForm = false) {
  const res = await fetch(`${TG_API}/bot${token()}/${method}`,
    isForm
      ? { method: "POST", body }
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
  );
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Telegram ${method} ${res.status}: ${txt}`);
  }
  return res.json();
}

function buildText(order) {
  const src = order.source === "designer" ? "🎨 Конструктор" : "🛍️ Сайт";
  let t = `📦 <b>НОВЕ ЗАМОВЛЕННЯ</b> · ${src}\n`;
  t += `№ <code>${esc(order.order_number)}</code>\n\n`;
  t += `👤 <b>${esc(order.customer_name)}</b>\n`;
  if (order.customer_phone) t += `📞 ${esc(order.customer_phone)}\n`;
  if (order.customer_email) t += `✉️ ${esc(order.customer_email)}\n`;
  if (order.shipping_address) t += `📍 ${esc(order.shipping_address)}\n`;
  if (order.notes) t += `📝 ${esc(order.notes)}\n`;
  t += `\n🛒 <b>Позиції:</b>\n`;
  (order.items || []).forEach((it, i) => {
    t += `${i + 1}. ${esc(it.product_name)}${it.variant_label ? ` (${esc(it.variant_label)})` : ""} × ${it.quantity}`;
    if (it.line_total) t += ` — ${it.line_total}₴`;
    t += `\n`;
  });
  t += `\n💰 <b>Разом: ${order.total}₴</b>`;
  return t;
}

/**
 * Надсилає сповіщення про замовлення в Telegram.
 * @param order     повний об'єкт замовлення (з items)
 * @param images    масив { data: dataURL, caption? } — стиснені прев'ю (інлайн у чаті)
 * @param documents масив { data: dataURL, caption? } — друкарські макети у повній
 *                  роздільності; ідуть як document, тож Telegram НЕ перестискає їх.
 */
export async function sendOrderNotification(order, images = [], documents = []) {
  if (!telegramEnabled()) return false;

  // 1) Текст замовлення окремим повідомленням (без обмеження довжини підпису фото).
  await tgCall("sendMessage", { chat_id: chatId(), text: buildText(order), parse_mode: "HTML" });

  // 2) Прев'ю макетів (інлайн-перегляд у чаті; Telegram стискає фото — це ок для прев'ю).
  const photos = (Array.isArray(images) ? images : [])
    .map((img) => ({ ...dataUrlToBlob(img?.data), caption: img?.caption }))
    .filter((p) => p.blob)
    .slice(0, 10); // ліміт Telegram

  // Прев'ю стійко: збій фото (напр. Telegram відхилив зображення) НЕ має
  // блокувати відправку друкарських файлів-документів нижче.
  try {
    if (photos.length === 1) {
      const form = new FormData();
      form.append("chat_id", chatId());
      form.append("photo", photos[0].blob, `design.${photos[0].ext}`);
      if (photos[0].caption) form.append("caption", photos[0].caption);
      await tgCall("sendPhoto", form, true);
    } else if (photos.length >= 2) {
      const form = new FormData();
      const media = photos.map((p, i) => {
        const fn = `design${i}.${p.ext}`;
        form.append(fn, p.blob, fn);
        return { type: "photo", media: `attach://${fn}`, caption: p.caption || undefined };
      });
      form.append("chat_id", chatId());
      form.append("media", JSON.stringify(media));
      await tgCall("sendMediaGroup", form, true);
    }
  } catch (e) {
    console.warn("Telegram preview (photo) failed:", e.message);
  }

  // 3) Друкарські макети — як ДОКУМЕНТИ (без перестиску, повна якість для друку).
  const docs = (Array.isArray(documents) ? documents : [])
    .map((d) => ({ ...dataUrlToBlob(d?.data), caption: d?.caption }))
    .filter((p) => p.blob)
    .slice(0, 10);

  console.log(`Telegram: ${photos.length} прев'ю (фото), ${docs.length} макет(ів) (документ)`);

  // Кожен документ — окремо й стійко: збій одного не має блокувати решту.
  for (const [i, d] of docs.entries()) {
    try {
      const form = new FormData();
      form.append("chat_id", chatId());
      form.append("document", d.blob, `print-${i + 1}.${d.ext}`);
      if (d.caption) form.append("caption", d.caption);
      await tgCall("sendDocument", form, true);
    } catch (e) {
      console.warn(`Telegram sendDocument #${i + 1} failed:`, e.message);
    }
  }

  return true;
}
