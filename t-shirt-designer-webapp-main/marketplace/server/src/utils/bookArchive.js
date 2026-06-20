import fs from "fs";
import path from "path";
import { createRequire } from "module";

// jszip/jimp — CommonJS; під ESM вантажимо через createRequire (стабільно).
const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const Jimp = require("jimp");

const UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads";
const DPI = 300;
const cmToPx = (cm) => Math.round((cm / 2.54) * DPI);
const MARGIN_SPINE = cmToPx(1); // ~118 px (1 см — бік корінця)
const MARGIN_OUT = cmToPx(0.5); // ~59 px (0.5 см — решта сторін)

// Розмір сторінки (см) за форматом книги. 21x30 — за спекою студії (21.4×29 см).
// Квадратні формати — номінальний розмір (за потреби студія уточнить).
const PAGE_CM = {
  "21x30": { w: 21.4, h: 29 },
  "20x20": { w: 20, h: 20 },
  "25x25": { w: 25, h: 25 },
};

function fileFromUrl(u) {
  if (!u || typeof u !== "string") return null;
  const p = path.join(UPLOAD_DIR, path.basename(u));
  return fs.existsSync(p) ? p : null;
}

// Розкладка одного фото на готову друкарську сторінку: білий фон, поля
// (1 см корінець / 0.5 см решта), дзеркальність лівої/правої сторінки, фото по центру.
async function composePage(srcPath, { pageW, pageH, isRight }) {
  const leftM = isRight ? MARGIN_SPINE : MARGIN_OUT; // права сторінка → корінець ліворуч
  const rightM = isRight ? MARGIN_OUT : MARGIN_SPINE;
  const safeW = pageW - leftM - rightM;
  const safeH = pageH - MARGIN_OUT - MARGIN_OUT;

  const photo = await Jimp.read(srcPath);
  photo.scaleToFit(safeW, safeH); // вписати без обрізки, зберегти пропорції
  const x = Math.round(leftM + (safeW - photo.bitmap.width) / 2);
  const y = Math.round(MARGIN_OUT + (safeH - photo.bitmap.height) / 2);

  const page = await Jimp.create(pageW, pageH, 0xffffffff); // білий фон
  page.composite(photo, x, y);
  page.quality(92);
  return page.getBufferAsync(Jimp.MIME_JPEG);
}

// Збирає ZIP книги у памʼяті. Повертає { buffer, hasBook }.
export async function buildBookZip(order) {
  const books = (order.items || [])
    .map((it) => {
      let d = {};
      try { d = JSON.parse(it.design_data || "{}"); } catch { /* */ }
      return { it, d };
    })
    // d.book є ЛИШЕ у справжніх фотокниг; пачка фото теж має innerPhotos, але без book.
    .filter(({ d }) => Array.isArray(d.innerPhotos) && d.innerPhotos.length && d.book);

  if (!books.length) return { buffer: null, hasBook: false };

  const zip = new JSZip();

  for (let bi = 0; bi < books.length; bi++) {
    const { d } = books[bi];
    const baseDir = books.length > 1 ? `${order.order_number}/book-${bi + 1}/` : `${order.order_number}/`;
    const fmt = d.book?.format && PAGE_CM[d.book.format] ? d.book.format : "21x30";
    const cm = PAGE_CM[fmt];
    const pageW = cmToPx(cm.w);
    const pageH = cmToPx(cm.h);

    // Обкладинки — як є (готові макети).
    const cf = fileFromUrl(d.printFrontUrl);
    if (cf) zip.file(baseDir + "cover-front" + path.extname(cf), fs.readFileSync(cf));
    const cb = fileFromUrl(d.printBackUrl);
    if (cb) zip.file(baseDir + "cover-back" + path.extname(cb), fs.readFileSync(cb));

    // Розгортки → готові сторінки (нумерація + сторона R/L).
    for (let i = 0; i < d.innerPhotos.length; i++) {
      const src = fileFromUrl(d.innerPhotos[i]);
      if (!src) continue;
      const isRight = (i + 1) % 2 === 1;
      try {
        const buf = await composePage(src, { pageW, pageH, isRight });
        zip.file(`${baseDir}pages/page-${String(i + 1).padStart(2, "0")}-${isRight ? "R" : "L"}.jpg`, buf);
      } catch (e) {
        console.error(`composePage ${i + 1} failed:`, e.message);
      }
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { buffer, hasBook: true };
}

// On-demand: збирає й віддає в res. false — якщо в замовленні немає книги.
export async function streamBookArchive(order, res) {
  const { buffer, hasBook } = await buildBookZip(order);
  if (!hasBook) return false;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="book-${order.order_number}.zip"`);
  res.send(buffer);
  return true;
}

// Фонова збірка: зберігає архів на диск, повертає URL (/uploads/...) або null.
export async function buildBookArchiveToDisk(order) {
  const { buffer, hasBook } = await buildBookZip(order);
  if (!hasBook) return null;
  const name = `book_${String(order.order_number).replace(/[^\w-]/g, "")}_${Date.now().toString(36)}.zip`;
  await fs.promises.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

// УСІ файли замовлення (принти/прев'ю/сирі фото/розвороти) одним ZIP — як є з диска,
// без композиції. Для кнопки «Скачати всі фото» в адмінці (будь-який тип товару).
export async function streamOrderPhotos(order, res) {
  const names = new Set();
  const re = /\/uploads\/([\w.\-]+)/g;
  for (const it of order.items || []) {
    const hay = `${it.design_data || ""} ${it.design_preview || ""}`;
    let m;
    while ((m = re.exec(hay))) names.add(m[1]);
  }
  const zip = new JSZip();
  let count = 0;
  for (const name of names) {
    const p = path.join(UPLOAD_DIR, path.basename(name));
    try {
      if (fs.existsSync(p)) { zip.file(`${order.order_number}/${name}`, fs.readFileSync(p)); count++; }
    } catch { /* пропускаємо недоступний файл */ }
  }
  if (!count) return false;
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="order-${order.order_number}-photos.zip"`);
  res.send(buffer);
  return true;
}
