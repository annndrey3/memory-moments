// Mobile UX smoke test for the designer. Drives the installed Chrome at an
// iPhone viewport, mocks the price API, walks the order flow, screenshots each step.
import puppeteer from "puppeteer-core";
import fs from "fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = process.env.URL || "http://localhost:5175/";
const W = Number(process.env.W || 390);
const H = Number(process.env.H || 844);
const OUT = `mobile-shots/${W}x${H}`;
const IMG = "public/og-image.png";

const MOCK_PRICES = {
  types: {
    "crew-neck": { price: 570, compare_at_price: null, name: "Футболка Soft Style" },
    mug: { price: 220, compare_at_price: null, name: "Чашка" },
  },
  tshirt: {
    white: { A4: 570, A3: 670 },
    black: { A4: 650, A3: 770 },
    secondSide: { A4: 250, A3: 420 },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const log = (...a) => console.log("•", ...a);

// Click the first button/element whose visible text contains `text`.
async function clickByText(page, text) {
  const handle = await page.evaluateHandle((t) => {
    const els = [...document.querySelectorAll("button, [role=button], a")];
    return els.find((e) => e.offsetParent !== null && e.textContent.trim().includes(t)) || null;
  }, text);
  const el = handle.asElement();
  if (!el) throw new Error(`no clickable element with text "${text}"`);
  await el.click();
  return el;
}

async function cartCount(page) {
  // Кількість позицій у кошику = к-ть карток у Sheet (рахуємо h4 з назвою товару).
  return page.evaluate(() => {
    const cards = document.querySelectorAll('[role=dialog] h4, .sheet-content h4');
    return cards.length;
  });
}

const issues = [];
function check(cond, msg) {
  if (!cond) { issues.push(msg); log("  ❌", msg); }
  else log("  ✓", msg);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const page = await browser.newPage();
  const mobile = W < 1024;
  await page.emulate({
    viewport: { width: W, height: H, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile },
    userAgent: mobile
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/products/designer-prices")) {
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PRICES) });
    } else {
      req.continue();
    }
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  log("goto", URL);
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  // Пропускаємо онбординг-тур, щоб він не перекривав інтерфейс під час тесту.
  await page.evaluate(() => { try { localStorage.setItem("mm_designer_tour_v1", "1"); } catch {} });
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/01-initial.png` });

  // 1) Чи видно нижню панель «Замовити!» і чи не виходить контент за екран по ширині.
  const hasOrderBtn = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Замовити"))
  );
  check(hasOrderBtn, "OrderBar «Замовити!» видно на екрані");
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflowX <= 2, `немає горизонтального переповнення (overflowX=${overflowX}px)`);
  // Редактор футболки має вміщатись у мобільний екран БЕЗ вертикального скролу.
  const overflowY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  check(overflowY <= 4, `немає вертикального скролу на мобільному (overflowY=${overflowY}px)`);

  // 1.5) Інструменти видно одразу (без гамбургера): Фото / Текст / Лінія.
  const txt0 = await page.evaluate(() => document.body.innerText);
  check(/Фото/.test(txt0) && /Текст/.test(txt0) && /Лінія/.test(txt0),
    "інструменти Фото/Текст/Лінія видно по периметру (без гамбургера)");
  const noHamburger = await page.evaluate(() =>
    ![...document.querySelectorAll("button")].some((b) => /fixed/.test(b.className) && /left-4/.test(b.className)));
  check(noHamburger, "гамбургер-меню прибрано");

  // 1.6) Інструмент «Текст» (раніше був зламаний — fabric не імпортувався).
  try { await clickByText(page, "Текст"); await sleep(800); } catch (e) { issues.push("text tool: " + e.message); }
  await page.screenshot({ path: `${OUT}/07-text-tool.png` });
  const txtPanel = await page.evaluate(() => document.body.innerText);
  check(/пишіть одразу|оберіть шрифт/i.test(txtPanel), "інструмент «Текст» працює (зʼявилась панель тексту)");

  // 2) Завантажуємо фото на перед (клік по товару → input[type=file]).
  const input = await page.$('input[type=file]');
  check(!!input, "є input[type=file] для завантаження фото");
  if (input) {
    await input.uploadFile(IMG);
    await sleep(1800);
  }
  await page.screenshot({ path: `${OUT}/02-front-design.png` });

  // 3) Колір «Чорна» → ціна А4 має стати 650.
  try { await clickByText(page, "Чорна"); } catch (e) { issues.push("color: " + e.message); }
  await sleep(600);
  await page.screenshot({ path: `${OUT}/03-black.png` });
  const priceText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check(/650/.test(priceText), "ціна чорної А4 = 650 ₴ показана");

  // 4) Друга сторона: вкладка «Ззаду» + фото → ціна 650+250=900.
  try { await clickByText(page, "Ззаду"); await sleep(500); } catch (e) { issues.push("back tab: " + e.message); }
  const input2 = await page.$('input[type=file]');
  if (input2) { await input2.uploadFile(IMG); await sleep(1800); }
  await page.screenshot({ path: `${OUT}/04-back-design.png` });
  const priceText2 = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
  check(/900/.test(priceText2), "ціна з другою стороною = 900 ₴");
  check(/сторону|сторони/i.test(priceText2), "є підпис про другу сторону");

  // 5) «Замовити!» → кошик відкривається з 1 позицією (чекаємо рендер кошика —
  //    додавання асинхронне: будуються мокапи із завантаженням зображень).
  try {
    await clickByText(page, "Замовити");
    await page.waitForFunction(() => document.querySelectorAll("[role=dialog] h4").length >= 1, { timeout: 16000 });
  } catch (e) { issues.push("order: " + e.message); }
  await page.screenshot({ path: `${OUT}/05-cart.png` });
  const c1 = await cartCount(page);
  check(c1 === 1, `у кошику 1 позиція (фактично ${c1})`);

  // 6) Закрити кошик і знову «Замовити!» без змін → дублю НЕ має бути.
  await page.keyboard.press("Escape");
  await sleep(800);
  try {
    await clickByText(page, "Замовити");
    await page.waitForFunction(() => document.querySelectorAll("[role=dialog] h4").length >= 1, { timeout: 16000 });
  } catch (e) { issues.push("order2: " + e.message); }
  await sleep(400);
  await page.screenshot({ path: `${OUT}/06-cart-again.png` });
  const c2 = await cartCount(page);
  check(c2 === 1, `після повторного «Замовити!» все ще 1 позиція (фактично ${c2}) — без дублю`);

  // 7) Підсумок і кросс-селл у відкритому кошику.
  const cartTxt = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    return d ? d.innerText.replace(/\s+/g, " ") : "";
  });
  check(/Разом/.test(cartTxt) && /900/.test(cartTxt), "у кошику є підсумок «Разом 900 ₴»");
  check(/З цим замовляють/i.test(cartTxt), "є блок кросс-селлу «З цим замовляють»");
  check(/Футболка/.test(cartTxt) && /Чашка/.test(cartTxt) && /Фото/.test(cartTxt),
    "плитки кросс-селлу: Футболка / Чашка / Фото");
  await page.screenshot({ path: `${OUT}/08-cart-crosssell.png` });

  // 8) Тап по плитці «Чашка» → кошик закривається й конструктор перемикається на товар.
  try {
    await clickByText(page, "Чашка");
    await page.waitForFunction(() => !document.querySelector("[role=dialog]"), { timeout: 6000 });
  } catch (e) { issues.push("crosssell mug: " + e.message); }
  await sleep(500);
  const cartClosed = await page.evaluate(() => !document.querySelector("[role=dialog]"));
  check(cartClosed, "після тапу по кросс-селлу кошик закрився (перемкнулись на товар)");
  await page.screenshot({ path: `${OUT}/09-after-crosssell.png` });

  // 9) Управління шарами — ізольовано, на свіжій навігації (чистий стан Radix),
  //    щоб попап гарантовано відкрився; цей блок останній і нічого далі не ламає.
  //    Додаємо ЛІНІЮ (одразу вибрана, БЕЗ режиму редагування — на відміну від тексту,
  //    який входить у редагування й клік по «Шари» зняв би виділення) → «Шари»
  //    активна → попап з 4 діями z-порядку → reorder «На задній план» не падає.
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => { try { localStorage.setItem("mm_designer_tour_v1", "1"); } catch {} });
  await sleep(1000);
  try { await clickByText(page, "Лінія"); await sleep(800); } catch (e) { issues.push("layers line: " + e.message); }
  const layersHandle = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((b) => b.title === "Шари (порядок)") || null);
  const layersBtn = layersHandle.asElement();
  const layersEnabled = layersBtn ? !(await page.evaluate((b) => b.disabled, layersBtn)) : false;
  check(layersEnabled, "кнопка «Шари» активна при вибраному об'єкті");
  if (layersEnabled) {
    await layersBtn.click();
    await sleep(350);
    const layerTxt = await page.evaluate(() => document.body.innerText);
    check(/На передній план/.test(layerTxt) && /На задній план/.test(layerTxt),
      "попап «Шари»: дії «На передній план» / «На задній план»");
    await page.screenshot({ path: `${OUT}/10-layers.png` });
    try { await clickByText(page, "На задній план"); await sleep(250); }
    catch (e) { issues.push("layers reorder: " + e.message); }
  }

  check(pageErrors.length === 0, `немає JS-помилок на сторінці (${pageErrors.length})`);
  if (pageErrors.length) pageErrors.forEach((e) => log("  JSERR", e));

  console.log("\n===== RESULT =====");
  console.log(issues.length ? `ISSUES (${issues.length}):\n- ` + issues.join("\n- ") : "ALL CHECKS PASSED ✅");
} catch (e) {
  console.error("FATAL", e);
} finally {
  await browser.close();
}
