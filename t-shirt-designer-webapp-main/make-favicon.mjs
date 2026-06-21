// Генерує круглі фавікони Memory Moments з логотипу (og-image): обрізаємо поля
// й вписуємо лого у біле коло з брунатним обідком — для ВСІХ розмірів
// (16/32, apple-touch 180, 192, 512 та favicon.ico).
// Малюємо у headless Chrome (canvas2D), favicon.ico збираємо вручну (PNG-в-ICO).
// Пишемо у public/ та dist/ обох застосунків.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OG = path.join(__dirname, "public", "og-image.png");
const ogDataUrl = "data:image/png;base64," + fs.readFileSync(OG).toString("base64");

const TARGETS = [
  path.join(__dirname, "public"),
  path.join(__dirname, "dist"),
  path.join(__dirname, "marketplace", "client", "public"),
  path.join(__dirname, "marketplace", "client", "dist"),
];

// --- кругла іконка: лого Memory Moments у білому колі з обідком ---
const drawLogo = `async (S, dataUrl, pad) => {
  const BRAND = "#7c3d2b";
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  const iw = img.naturalWidth, ih = img.naturalHeight;

  // обрізаємо прозорі / майже-білі поля -> рамка контенту лого
  const off = document.createElement("canvas");
  off.width = iw; off.height = ih;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0);
  const d = octx.getImageData(0, 0, iw, ih).data;
  let minX = iw, minY = ih, maxX = 0, maxY = 0;
  for (let y = 0; y < ih; y++) {
    for (let x = 0; x < iw; x++) {
      const i = (y*iw + x)*4;
      const nearWhite = d[i] > 245 && d[i+1] > 245 && d[i+2] > 245;
      if (d[i+3] > 16 && !nearWhite) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) { minX = 0; minY = 0; maxX = iw-1; maxY = ih-1; }
  const cw = maxX - minX + 1, ch = maxY - minY + 1;

  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  ctx.save();
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2, 0, Math.PI*2); ctx.clip();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, S, S);
  const scale = Math.min(S/cw, S/ch) * pad;
  const w = cw*scale, h = ch*scale;
  ctx.drawImage(img, minX, minY, cw, ch, (S-w)/2, (S-h)/2, w, h);
  ctx.restore();
  ctx.lineWidth = Math.max(1, S*0.03);
  ctx.strokeStyle = BRAND;
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - ctx.lineWidth/2, 0, Math.PI*2); ctx.stroke();
  return c.toDataURL("image/png");
}`;

function buildIco(frames) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  const parts = [header, dir];
  frames.forEach((f, i) => {
    const e = dir.subarray(i * 16, i * 16 + 16);
    e.writeUInt8(f.size >= 256 ? 0 : f.size, 0);
    e.writeUInt8(f.size >= 256 ? 0 : f.size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(f.buf.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += f.buf.length;
    parts.push(f.buf);
  });
  return Buffer.concat(parts);
}

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
const logoFn = new Function("return " + drawLogo)();
const logo = async (S) => Buffer.from((await p.evaluate(logoFn, S, ogDataUrl, 0.96)).split(",")[1], "base64");

const outputs = {
  "favicon-16x16.png": await logo(16),
  "favicon-32x32.png": await logo(32),
  "apple-touch-icon.png": await logo(180),
  "favicon-192.png": await logo(192),
  "favicon-512.png": await logo(512),
  "favicon.ico": buildIco([
    { size: 16, buf: await logo(16) },
    { size: 32, buf: await logo(32) },
    { size: 48, buf: await logo(48) },
  ]),
};
await b.close();

for (const dir of TARGETS) {
  if (!fs.existsSync(dir)) { console.log("skip (missing)", dir); continue; }
  for (const [name, buf] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(dir, name), buf);
  }
  console.log("wrote", Object.keys(outputs).length, "icons ->", dir);
}
