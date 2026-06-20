// Генерує КРУГЛІ фавікони Memory Moments: брунатне (#7c3d2b) коло + біла
// емблема-камера. Малюємо у headless Chrome (canvas2D), пишемо PNG-и кожного
// розміру та збираємо favicon.ico вручну (PNG-в-ICO). Кладемо у public/ обох застосунків.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import puppeteer from "puppeteer-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const DESIGNER = path.join(__dirname, "public");
const MARKET = path.join(__dirname, "marketplace", "client", "public");

const drawFn = `(S) => {
  const BRAND = "#7c3d2b", WHITE = "#ffffff";
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  const u = (f) => f * S;
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };

  // брунатне коло на всю іконку (поза колом — прозоро)
  ctx.fillStyle = BRAND;
  ctx.beginPath(); ctx.arc(S/2, S/2, S/2, 0, Math.PI*2); ctx.fill();

  // біла камера
  ctx.fillStyle = WHITE;
  rr(u(0.405), u(0.330), u(0.19), u(0.075), u(0.025)); ctx.fill();   // спалах/видошукач
  rr(u(0.225), u(0.385), u(0.55), u(0.30), u(0.06));  ctx.fill();    // корпус

  // об'єктив: брунатна дірка → білий обідок → брунатний центр → блік
  const cx = S/2, cy = u(0.545);
  ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(cx, cy, u(0.115), 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx, cy, u(0.072), 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = BRAND; ctx.beginPath(); ctx.arc(cx, cy, u(0.042), 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(cx - u(0.03), cy - u(0.03), u(0.016), 0, Math.PI*2); ctx.fill();

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
const png = async (S) => {
  const url = await p.evaluate(new Function("return " + drawFn)(), S);
  return Buffer.from(url.split(",")[1], "base64");
};

const outputs = {
  "favicon-16x16.png": await png(16),
  "favicon-32x32.png": await png(32),
  "apple-touch-icon.png": await png(180),
  "favicon-192.png": await png(192),
  "favicon-512.png": await png(512),
  "favicon.ico": buildIco([
    { size: 16, buf: await png(16) },
    { size: 32, buf: await png(32) },
    { size: 48, buf: await png(48) },
  ]),
};
await b.close();

for (const dir of [DESIGNER, MARKET]) {
  for (const [name, buf] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(dir, name), buf);
  }
  console.log("wrote", Object.keys(outputs).length, "icons →", dir);
}
