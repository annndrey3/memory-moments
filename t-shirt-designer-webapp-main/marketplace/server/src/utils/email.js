import nodemailer from "nodemailer";
import { getSetting } from "./settings.js";

function formatPrice(amount) {
  return `${Number(amount).toFixed(0)} ₴`;
}

async function resolveSmtpConfig() {
  const [host, port, secure, user, pass] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_secure"),
    getSetting("smtp_user"),
    getSetting("smtp_pass"),
  ]);

  if (host && user && pass) {
    return { host, port: Number(port) || 587, secure: secure === "true", user, pass, source: "db" };
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      source: "env",
    };
  }

  return null;
}

async function createTransporter() {
  const cfg = await resolveSmtpConfig();
  if (!cfg) return null;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

function buildOrderEmailHtml(order) {
  const { order_number, customer_name, customer_email, customer_phone, shipping_address, notes, total, items = [] } = order;

  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1e293b;">
          ${it.product_name}${it.variant_label ? ` <span style="color:#94a3b8;font-size:12px;">(${it.variant_label})</span>` : ""}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#64748b;text-align:center;">
          ${it.quantity}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#1e293b;text-align:right;white-space:nowrap;">
          ${formatPrice(it.line_total)}
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Підтвердження замовлення ${order_number}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);padding:32px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Memory Moments</p>
              <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Дякуємо за замовлення!</h1>
              <p style="margin:12px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">Ваше замовлення прийнято та обробляється</p>
            </td>
          </tr>

          <!-- Order number badge -->
          <tr>
            <td style="padding:24px 40px 0;text-align:center;">
              <span style="display:inline-block;background:#f3f0ff;color:#7c3aed;font-weight:700;font-size:15px;padding:8px 20px;border-radius:32px;letter-spacing:0.5px;">
                Замовлення № ${order_number}
              </span>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
                Вітаємо, <strong>${customer_name}</strong>!<br/>
                Ми отримали ваше замовлення і вже беремося до роботи. Менеджер зв'яжеться з вами для підтвердження та оплати.
              </p>
            </td>
          </tr>

          <!-- Items table -->
          <tr>
            <td style="padding:24px 40px 0;">
              <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Склад замовлення</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                <thead>
                  <tr style="background:#f8fafc;">
                    <th style="padding:10px 12px;text-align:left;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Товар</th>
                    <th style="padding:10px 12px;text-align:center;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">К-ть</th>
                    <th style="padding:10px 12px;text-align:right;font-size:12px;color:#94a3b8;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Сума</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
                <tfoot>
                  <tr style="background:#f8fafc;">
                    <td colspan="2" style="padding:12px;font-size:14px;font-weight:700;color:#1e293b;">До сплати</td>
                    <td style="padding:12px;font-size:16px;font-weight:700;color:#7c3aed;text-align:right;">${formatPrice(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </td>
          </tr>

          <!-- Delivery info -->
          <tr>
            <td style="padding:20px 40px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;padding:16px;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Деталі замовлення</p>
                    ${shipping_address ? `<p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Доставка:</strong> ${shipping_address}</p>` : ""}
                    ${customer_phone ? `<p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Телефон:</strong> ${customer_phone}</p>` : ""}
                    ${customer_email ? `<p style="margin:4px 0;font-size:14px;color:#334155;"><strong>Email:</strong> ${customer_email}</p>` : ""}
                    ${notes ? `<p style="margin:8px 0 0;font-size:14px;color:#64748b;"><strong>Коментар:</strong> ${notes}</p>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:24px 40px 0;text-align:center;">
              <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">Питання? Ми завжди на зв'язку:</p>
              <table cellpadding="0" cellspacing="0" style="margin:10px auto 0;">
                <tr>
                  <td style="padding:0 8px;">
                    <a href="tel:+380685550564" style="display:inline-block;background:#f3f0ff;color:#7c3aed;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">
                      📞 +38(068) 555-05-64
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://instagram.com/memory_moments.od.ua" style="display:inline-block;background:#fff0f7;color:#e1306c;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">
                      Instagram
                    </a>
                  </td>
                  <td style="padding:0 8px;">
                    <a href="https://t.me/memory_moments_chern12" style="display:inline-block;background:#f0faff;color:#0088cc;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">
                      Telegram
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #f1f5f9;margin-top:24px;">
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                © Memory Moments · memory-moments.online<br/>
                Це автоматичний лист — не відповідайте на нього.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Текстовки листа на кожну зміну статусу. accent — колір шапки.
const STATUS_EMAIL = {
  paid: {
    subject: (n) => `Оплату отримано — замовлення ${n}`,
    accent: "#16a34a,#22c55e",
    heading: "Оплату отримано ✅",
    sub: "Дякуємо! Ми отримали оплату",
    body: "Ми отримали оплату вашого замовлення і вже беремося до роботи. Щойно воно буде готове — повідомимо вас.",
  },
  shipped: {
    subject: (n) => `Замовлення ${n} відправлено`,
    accent: "#2563eb,#3b82f6",
    heading: "Замовлення відправлено 📦",
    sub: "Ваше замовлення вже в дорозі",
    body: "Ваше замовлення відправлено. Очікуйте доставку найближчим часом. Дякуємо, що обрали Memory Moments!",
  },
  completed: {
    subject: (n) => `Замовлення ${n} готове 🎉`,
    accent: "#7c3aed,#a855f7",
    heading: "Замовлення готове! 🎉",
    sub: "Ваше замовлення виконано",
    body: "Ваше замовлення готове. Дуже дякуємо, що довірили нам свої спогади — будемо раді бачити вас знову!",
  },
  cancelled: {
    subject: (n) => `Замовлення ${n} скасовано`,
    accent: "#dc2626,#ef4444",
    heading: "Замовлення скасовано",
    sub: "На жаль, ваше замовлення скасовано",
    body: "На жаль, ваше замовлення було скасовано. Якщо це непорозуміння або у вас є питання — будь ласка, звʼяжіться з нами, ми все владнаємо.",
  },
};

function buildStatusEmailHtml(order, status, reason) {
  const t = STATUS_EMAIL[status];
  const { order_number, customer_name, total } = order;
  const reasonBlock =
    status === "cancelled" && reason
      ? `<tr><td style="padding:16px 40px 0;">
           <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;">
             <tr><td style="padding:14px 16px;">
               <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:0.6px;">Причина скасування</p>
               <p style="margin:0;font-size:14px;color:#7f1d1d;line-height:1.5;">${String(reason).replace(/</g, "&lt;")}</p>
             </td></tr>
           </table>
         </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${t.heading} — ${order_number}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;"><tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
      <tr><td style="background:linear-gradient(135deg,${t.accent});padding:32px 40px;text-align:center;">
        <p style="margin:0 0 4px;color:rgba(255,255,255,0.8);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Memory Moments</p>
        <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">${t.heading}</h1>
        <p style="margin:12px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${t.sub}</p>
      </td></tr>
      <tr><td style="padding:24px 40px 0;text-align:center;">
        <span style="display:inline-block;background:#f3f0ff;color:#7c3aed;font-weight:700;font-size:15px;padding:8px 20px;border-radius:32px;letter-spacing:0.5px;">Замовлення № ${order_number}</span>
      </td></tr>
      <tr><td style="padding:24px 40px 0;">
        <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">Вітаємо, <strong>${customer_name || "клієнте"}</strong>!<br/>${t.body}</p>
      </td></tr>
      ${reasonBlock}
      ${total != null && status !== "cancelled" ? `<tr><td style="padding:20px 40px 0;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;"><tr><td style="padding:14px 16px;font-size:14px;color:#1e293b;">Сума замовлення</td><td style="padding:14px 16px;font-size:16px;font-weight:700;color:#7c3aed;text-align:right;">${formatPrice(total)}</td></tr></table></td></tr>` : ""}
      <tr><td style="padding:24px 40px 0;text-align:center;">
        <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">Питання? Ми завжди на звʼязку:</p>
        <table cellpadding="0" cellspacing="0" style="margin:10px auto 0;"><tr>
          <td style="padding:0 8px;"><a href="tel:+380685550564" style="display:inline-block;background:#f3f0ff;color:#7c3aed;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">📞 +38(068) 555-05-64</a></td>
          <td style="padding:0 8px;"><a href="https://t.me/memory_moments_chern12" style="display:inline-block;background:#f0faff;color:#0088cc;text-decoration:none;font-size:13px;font-weight:600;padding:6px 14px;border-radius:20px;">Telegram</a></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;text-align:center;border-top:1px solid #f1f5f9;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">© Memory Moments · memory-moments.online<br/>Це автоматичний лист — не відповідайте на нього.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Лист клієнту при зміні статусу. Без email або без SMTP — тихо нічого не робимо.
export async function sendOrderStatusEmail(order, status, reason) {
  const t = STATUS_EMAIL[status];
  if (!t) return;
  const email = order.customer_email;
  if (!email) return;

  const transporter = await createTransporter();
  if (!transporter) return;

  const cfg = await resolveSmtpConfig();
  await transporter.sendMail({
    from: `"Memory Moments" <${cfg.user}>`,
    to: email,
    subject: t.subject(order.order_number),
    html: buildStatusEmailHtml(order, status, reason),
  });
}

export async function isSmtpConfigured() {
  const cfg = await resolveSmtpConfig();
  return Boolean(cfg);
}

export async function sendOrderConfirmation(order) {
  const email = order.customer_email;
  if (!email) return;

  const transporter = await createTransporter();
  if (!transporter) return;

  const cfg = await resolveSmtpConfig();
  await transporter.sendMail({
    from: `"Memory Moments" <${cfg.user}>`,
    to: email,
    subject: `Замовлення ${order.order_number} прийнято — Memory Moments`,
    html: buildOrderEmailHtml(order),
  });
}
