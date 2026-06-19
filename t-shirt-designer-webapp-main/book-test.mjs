// Mobile UX analysis for the photobook flow (Slim Book + Print Book). Drives the
// installed Chrome at an iPhone viewport, mocks the price API, walks the book
// order flow (cover → spreads → preview → cart) and screenshots each step.
// Runs both book types in one pass; prints a per-type ISSUES/checks report.
import puppeteer from "puppeteer-core";
import fs from "fs";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.URL || "http://localhost:5174/";
const W = Number(process.env.W || 390);
const H = Number(process.env.H || 844);
const IMG = "public/og-image.png";

// Прайс книг: slimBook[format]={s10,s15,extra}, printBook[format]={...} — як очікує
// usePricing.bookPrice. Решта (types/tshirt) — щоб панель не лишалась без даних.
const MOCK_PRICES = {
  types: { "crew-neck": { price: 570, compare_at_price: null, name: "Футболка" }, mug: { price: 220, name: "Чашка" } },
  tshirt: { white: { A4: 570, A3: 670 }, black: { A4: 650, A3: 770 }, secondSide: { A4: 250, A3: 420 } },
  slimBook: {
    "20x20": { s10: 850, s15: 1100, extra: 55 },
    "21x30": { s10: 950, s15: 1250, extra: 60 },
    "25x25": { s10: 1050, s15: 1350, extra: 70 },
  },
  printBook: {
    "20x20": { s10: 1000, s15: 1300, extra: 70 },
    "21x30": { s10: 1100, s15: 1450, extra: 75 },
    "25x25": { s10: 1200, s15: 1550, extra: 85 },
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Click the first visible button/link whose text contains `text`.
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

const bodyText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

// Ціни форматуються як «1 250» (toLocaleString uk-UA) — прибираємо всі пробіли,
// перш ніж шукати число, інакше «1250» не збігається з «1 250».
const norm = (s) => s.replace(/[\s  ]/g, "");
const hasPrice = (text, n) => norm(text).includes(String(n));

// Клік по кнопці з ТОЧНИМ текстом — для «10»/«15», щоб не зловити «10 розворотів».
async function clickExact(page, text) {
  const h = await page.evaluateHandle((t) =>
    [...document.querySelectorAll("button")].find((b) => b.offsetParent !== null && b.textContent.trim() === t) || null, text);
  const el = h.asElement();
  if (!el) throw new Error(`no button == "${text}"`);
  await el.click();
  return el;
}

// Кейс для одного типу книги. Повертає {label, issues[], passed, total}.
async function runBook(browser, type, label, unitWord, basePrice, s15Price) {
  const OUT = `book-shots/${type}`;
  fs.mkdirSync(OUT, { recursive: true });
  const issues = [];
  let passed = 0, total = 0;
  const log = (...a) => console.log("•", ...a);
  const check = (cond, msg) => {
    total++;
    if (cond) { passed++; log("  ✓", msg); } else { issues.push(msg); log("  ❌", msg); }
  };

  const page = await browser.newPage();
  await page.emulate({
    viewport: { width: W, height: H, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().includes("/api/products/designer-prices"))
      req.respond({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_PRICES) });
    else req.continue();
  });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  console.log(`\n===== ${label} (?type=${type}) =====`);
  const url = `${BASE}?type=${type}`;
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  await page.evaluate(() => { try { localStorage.setItem("mm_designer_tour_v1", "1"); } catch {} });
  await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
  await sleep(1400);
  await page.screenshot({ path: `${OUT}/01-initial.png` });

  // 1) Без горизонтального переповнення.
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflowX <= 2, `немає горизонтального переповнення (overflowX=${overflowX}px)`);

  // 2) Книжкові контроли (завжди видимі на мобільному): «Фото розворотів» + «Передперегляд».
  const t0 = await bodyText(page);
  check(/Фото розворотів/.test(t0), "кнопка «Фото розворотів» видима");
  check(/Передперегляд/.test(t0), "кнопка «Передперегляд» видима");

  // 3) Вкладки обкладинок (перед/зад).
  check(/Обкладинка \(перед\)/.test(t0) && /Обкладинка \(зад\)/.test(t0), "вкладки «Обкладинка (перед)» / «(зад)»");

  // 4) Ціна базового формату 21×30, 10 одиниць.
  check(hasPrice(t0, basePrice), `ціна базова (${unitWord} 10) = ${basePrice} ₴`);

  // 5) Завантажуємо фото на обкладинку (input без multiple — це обкладинка).
  const coverInput = await page.evaluateHandle(() =>
    [...document.querySelectorAll('input[type=file]')].find((i) => !i.multiple) || null);
  const cover = coverInput.asElement();
  check(!!cover, "є input для обкладинки");
  if (cover) { await cover.uploadFile(IMG); await sleep(1500); }
  await page.screenshot({ path: `${OUT}/02-cover.png` });

  // 6) Завантажуємо 2 фото розворотів (input з multiple — це «Фото розворотів»).
  const spreadInput = await page.evaluateHandle(() =>
    [...document.querySelectorAll('input[type=file]')].find((i) => i.multiple) || null);
  const spread = spreadInput.asElement();
  check(!!spread, "є input «Фото розворотів» (multiple)");
  if (spread) {
    await spread.uploadFile(IMG, IMG);
    // Чекаємо появу вкладки «Розворот 1» (асинхронне стиснення фото).
    try { await page.waitForFunction(() => /Розворот 1/.test(document.body.innerText), { timeout: 12000 }); }
    catch (e) { issues.push("spread tabs: " + e.message); }
  }
  await sleep(600);
  const t1 = await bodyText(page);
  check(/Розворот 1/.test(t1) && /Розворот 2/.test(t1), "зʼявились редаговані вкладки «Розворот 1/2»");
  await page.screenshot({ path: `${OUT}/03-spreads.png` });

  // 7) Перемикаємось на вкладку «Розворот 1» — має бути редагований холст + інструменти.
  try { await clickByText(page, "Розворот 1"); await sleep(700); } catch (e) { issues.push("open spread: " + e.message); }
  const t2 = await bodyText(page);
  check(/Фото/.test(t2) && /Текст/.test(t2), "на розвороті доступні інструменти (Фото/Текст)");
  await page.screenshot({ path: `${OUT}/04-spread-edit.png` });

  // 8) Передперегляд книги.
  try { await clickByText(page, "Передперегляд"); await sleep(1200); } catch (e) { issues.push("preview: " + e.message); }
  const t3 = await bodyText(page);
  check(/Передперегляд книги/.test(t3), "відкрився передперегляд книги (фліпбук)");
  await page.screenshot({ path: `${OUT}/05-preview.png` });
  // Закрити передперегляд.
  await page.keyboard.press("Escape"); await sleep(400);
  const closed = await page.evaluate(() => !/Передперегляд книги/.test(document.body.innerText));
  if (!closed) { try { const b = await page.$('button[title="Закрити"]'); if (b) await b.click(); } catch {} await sleep(400); }

  // 9) Кіл-ть розворотів 10 → 15: ціна має змінитись на s15.
  try { await clickExact(page, "15"); await sleep(500); } catch (e) { issues.push("spreads 15: " + e.message); }
  const t4 = await bodyText(page);
  check(hasPrice(t4, s15Price), `ціна за 15 ${unitWord} = ${s15Price} ₴`);
  // Повертаємо 10, щоб підсумок кошика був передбачуваним.
  try { await clickExact(page, "10"); await sleep(400); } catch {}

  // 10) Замовлення → кошик з 1 позицією-книгою + підсумок.
  try {
    await clickByText(page, "Замовити");
    await page.waitForFunction(() => document.querySelectorAll("[role=dialog] h4").length >= 1, { timeout: 16000 });
  } catch (e) { issues.push("order: " + e.message); }
  await sleep(500);
  const cartTxt = await page.evaluate(() => {
    const d = document.querySelector("[role=dialog]");
    return d ? d.innerText.replace(/\s+/g, " ") : "";
  });
  const cartCount = await page.evaluate(() => document.querySelectorAll("[role=dialog] h4").length);
  check(cartCount === 1, `у кошику 1 позиція-книга (фактично ${cartCount})`);
  check(/фотокниг/i.test(cartTxt), "у кошику назва книги");
  check(/Разом/.test(cartTxt) && hasPrice(cartTxt, basePrice), `у кошику підсумок = ${basePrice} ₴`);
  await page.screenshot({ path: `${OUT}/06-cart.png` });

  check(pageErrors.length === 0, `немає JS-помилок (${pageErrors.length})`);
  if (pageErrors.length) pageErrors.forEach((e) => console.log("    JSERR", e));

  await page.close();
  return { label, issues, passed, total };
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const results = [];
try {
  results.push(await runBook(browser, "slim-book", "Slim Book", "розворотів", 950, 1250));
  results.push(await runBook(browser, "print-book", "Print Book", "листів", 1100, 1450));
} catch (e) {
  console.error("FATAL", e);
} finally {
  await browser.close();
}

console.log("\n===== ПІДСУМОК =====");
for (const r of results) {
  console.log(`${r.label}: ${r.passed}/${r.total} ✓` + (r.issues.length ? `\n  ISSUES:\n   - ${r.issues.join("\n   - ")}` : "  — всі перевірки пройдено ✅"));
}
