import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { ZoomIn, ZoomOut } from "lucide-react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { useTshirtCanvas } from "@/hooks/useTshirtCanvas";

const ProductCanvas = ({ view, viewConfig, seedImage, shirtScale, fullscreen }) => {
  const canvasW = viewConfig.canvasSize?.width ?? CANVAS_CONFIG.width;
  const canvasH = viewConfig.canvasSize?.height ?? CANVAS_CONFIG.height;
  const isTemplate = Boolean(viewConfig.templateOverlay);
  // Колір силуету залежить від виробу: лише футболка фарбується обраним кольором,
  // решта (книга, полотно, фото) — білий «папір». Інакше глобальний tshirtColor
  // протікав у фон фотокниги/полотна (напр. чорна футболка → чорні сторінки книги).
  const selectedType = useSelector((s) => s.tshirt.selectedType);
  const isGarment = selectedType === "crew-neck";

  const { canvasRef, tshirtColor } = useTshirtCanvas({
    svgPath: viewConfig.path,
    viewBox: viewConfig.viewBox,
    printZone: viewConfig.printZone,
    view,
    canvasSize: viewConfig.canvasSize,
    templateOverlay: viewConfig.templateOverlay,
    seedImage,
  });

  const containerRef = useRef(null);
  const fitRef = useRef(null); // зовнішня область висотою = вільне місце; центрує холст
  const [scale, setScale] = useState(1);

  // На великих екранах (десктоп) даємо полотну більший бюджет — там вистачає
  // вертикального місця. Мобільна/планшетна верстка не змінюється. Аналогічно
  // до isWide для 3D-прев'ю чашки.
  // Три діапазони (рейли по-різному займають місце): десктоп (рейли стовпчиками
  // збоку, ≥1024), планшет/вузьке вікно (рейли рядами, 640–1024) і телефон (<640,
  // де UI переноситься на більше рядків → потрібен більший «хром»).
  const [isWide, setIsWide] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mqWide = window.matchMedia("(min-width: 1024px)"); // = перехід рейлів у стовпчики (lg)
    const mqPhone = window.matchMedia("(max-width: 639px)");
    const apply = () => { setIsWide(mqWide.matches); setIsPhone(mqPhone.matches); };
    apply();
    mqWide.addEventListener?.("change", apply);
    mqPhone.addEventListener?.("change", apply);
    return () => { mqWide.removeEventListener?.("change", apply); mqPhone.removeEventListener?.("change", apply); };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / canvasW);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);

  // Регулюємо холст під РОЗМІР МАКЕТА: міряємо реальну вільну висоту під холст
  // (від його верху до низу екрана мінус футер/нижні рейли) і робимо холст таким,
  // щоб він вписався цілком за пропорцією макета. Точніше за «магічний» chrome:
  // верхній відступ (шапка/опції/рейл) вимірюється наживо.
  const [availH, setAvailH] = useState(0);
  useEffect(() => {
    const el = fitRef.current;
    if (!el) return;
    const measure = () => {
      const fitRect = el.getBoundingClientRect();
      const top = fitRect.top; // усе НАД холстом (стабільне відносно розміру холста)
      // НИЖНЯ межа = верх футера «Замовити!» (виміряний наживо), щоб холст «прилипав»
      // до футера, а не лишав порожнечу. У повноекранному режимі футера немає → низ екрана.
      const footerEl = fullscreen ? null : document.querySelector('[data-tour="order"]');
      const bottomBound = footerEl ? footerEl.getBoundingClientRect().top : window.innerHeight;
      // Скільки реально займає контент ПІД холстом (рейл дій; для книги — ще
      // обкладинки + карусель розворотів). Раніше це була константа-здогадка (106px
      // на телефоні), а фактичний рейл — лише ~46px, тож під ним зяяла мертва
      // порожнеча до футера. Тепер міряємо НАЖИВО: від низу холста до низу всього
      // блоку редактора. Ця різниця НЕ залежить від розміру холста (обидва краї
      // рухаються разом), тож збігається за один прохід — і рейл «прилипає» до
      // футера для БУДЬ-ЯКОГО товару без підбору констант. +10 — повітряний зазор.
      const editorEl = el.closest("[data-mm-editor]");
      const visible = el.offsetParent !== null && fitRect.height > 0;
      let belowContent;
      if (editorEl && visible) {
        belowContent = Math.max(0, editorEl.getBoundingClientRect().bottom - fitRect.bottom) + 10;
      } else {
        // Запасна формула-константа: холст прихований (інший вид) або блок не знайдено.
        belowContent = (fullscreen
          ? (isWide ? 16 : 96)
          : (isWide ? 16 : (isPhone ? 106 : 92)))
          + (viewConfig.reservedExtra ?? 0);
      }
      setAvailH(Math.max(160, bottomBound - top - belowContent));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(document.body); // зміни розкладки (рейли/каруселі/шрифти) → переміряти
    window.addEventListener("resize", measure);
    // Повторні виміри, поки розкладка «усідається» (веб-шрифти, рейли, каруселі):
    // інакше top зчитується з тимчасово вищої шапки → холст виходить трохи нижчим.
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 450);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); clearTimeout(t1); clearTimeout(t2); };
  }, [isWide, isPhone, fullscreen, viewConfig.reservedExtra]);

  // ── Зум полотна (лише ВІЗУАЛЬНО, CSS-transform) ───────────────────────────────
  // Важливо: саме fabric-полотно лишається 1:1, тож друк/превʼю/хіт-детект НЕ
  // спотворюються (вони читають справжнє полотно). Зум центрований; Ctrl/Cmd+колесо
  // або щипок двома пальцями. Скидання — кнопкою «100%».
  const [zoom, setZoom] = useState(1);
  const clampZoom = (z) => Math.min(4, Math.max(1, z));
  const zoomIn = () => setZoom((z) => clampZoom(z * 1.25));
  const zoomOut = () => setZoom((z) => clampZoom(z / 1.25));
  const resetZoom = () => setZoom(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return; // лише Ctrl/Cmd+колесо — не заважаємо скролу сторінки
      e.preventDefault();
      setZoom((z) => clampZoom(z * 0.999 ** e.deltaY));
    };
    let pinch = 0;
    const onTouchMove = (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      if (pinch) setZoom((z) => clampZoom(z * (d / pinch)));
      pinch = d;
    };
    const onTouchEnd = (e) => { if (e.touches.length < 2) pinch = 0; };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Розмір полотна. Десктоп (isWide): полотно ЗАПОВНЮЄ доступну висоту дисплея —
  // екран мінус шапка/панель опцій/нижній ордербар (≈ chrome). Так макет великий і
  // чіткий на весь екран, без вертикального скролу. Мобільний — попередня формула
  // з vh-бюджетом (налаштована, щоб усе вміщалось на малих екранах).
  const ratio = canvasW / canvasH;
  const chrome = viewConfig.chromeWide ?? 240; // книги задають більший (є карусель розворотів)
  // Полотно займає МАКСИМУМ простору: на десктопі — до 1100px / 92vw або наскільки
  // дозволяє висота екрана; на мобільному — майже на всю ширину (90vw). Дрібніші
  // іконки інструментів звільнили місце з боків, тож холст ширший.
  // Повноекранний режим: шапки/футера немає → лишається лише вузький «хром» під
  // тулбари, тож холст розгортається майже на весь екран.
  // Вузький екран (рейли горизонтальні, зверху/знизу) забирає більше ВИСОТИ під
  // тулбари → більший «хром». Раніше тут був заниженний vhBudget, через що холст не
  // заповнював вільне місце з боків. Тепер і вузький, і широкий режим заповнюють
  // доступну висоту: width = (висота екрана − хром) × пропорція, обмежено шириною вікна.
  const chromeNarrow = viewConfig.chromeNarrow ?? 350;          // планшет/вузьке вікно
  const chromePhone = viewConfig.chromePhone ?? (chromeNarrow + 100); // телефон (UI переноситься)
  let widthCss;
  if (fullscreen) {
    // На весь екран: лишаються тільки тулбари редактора. Десктоп — рейли збоку
    // (мало висоти), вузьке/телефон — рейли рядами над/під холстом (більше висоти).
    const fsChrome = isWide ? 132 : (isPhone ? 240 : 220);
    widthCss = `min(98vw, calc((100vh - ${fsChrome}px) * ${ratio.toFixed(3)}))`;
  } else if (isWide) {
    widthCss = `min(1100px, 94vw, calc((100vh - ${chrome}px) * ${ratio.toFixed(3)}))`;
  } else {
    widthCss = `min(96vw, calc((100vh - ${isPhone ? chromePhone : chromeNarrow}px) * ${ratio.toFixed(3)}))`;
  }
  // Заміна на виміряну вільну висоту (точніше за chrome). chrome-формула — фолбек,
  // поки не зміряно (перший кадр) або якщо вимір не вдався.
  if (availH > 0) {
    const maxW = Math.floor(availH * ratio);
    const wCap = fullscreen ? "98vw" : isWide ? "94vw" : "96vw";
    widthCss = isWide && !fullscreen
      ? `min(1100px, ${wCap}, ${maxW}px)`
      : `min(${wCap}, ${maxW}px)`;
  }

  const pz = viewConfig.printZone;

  // Shared style for canvas-sized elements scaled to the display container
  const scaledStyle = {
    transformOrigin: "top left",
    transform: `scale(${scale})`,
    width: canvasW,
    height: canvasH,
  };

  return (
    <div
      ref={fitRef}
      className="w-full flex items-center justify-center"
      // Зовнішня область = ВСЯ вільна висота. Холст центрується в ній: вузький/широкий
      // виріб (напр. розгортка чашки) не лишає велику порожнечу знизу — блок розтягнуто.
      style={availH > 0 ? { height: `${availH}px` } : undefined}
    >
    <div
      ref={containerRef}
      className="relative overflow-hidden max-w-full max-h-full"
      style={{ width: widthCss, aspectRatio: `${canvasW} / ${canvasH}` }}
    >
      {/* Шар зуму: масштабує ВСЕ зображення холста (силует+fabric+підказки) лише
          візуально. Саме fabric-полотно всередині лишається 1:1. */}
      <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: "center center", transition: "transform 0.08s" }}>
      {/* ── Non-template formats: SVG shape outline below canvas ── */}
      {!isTemplate && (
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox={viewConfig.viewBox} className="w-full h-full">
            {/* Силует футболки масштабуємо під обраний розмір навколо центру зони
                друку: виріб росте/меншає, а зона друку (і дизайн) лишаються — видно,
                як реально сяде малюнок. Решта товарів — без масштабу (shirtScale=null). */}
            <g
              transform={
                shirtScale && pz
                  ? `translate(${pz.x + pz.width / 2} ${pz.y + pz.height / 2}) scale(${shirtScale.sx} ${shirtScale.sy}) translate(${-(pz.x + pz.width / 2)} ${-(pz.y + pz.height / 2)})`
                  : undefined
              }
            >
              <path
                d={viewConfig.path}
                fill={viewConfig.surfaceColor || (isGarment ? tshirtColor : "#ffffff")}
                fillOpacity="0.82"
                stroke="#111827"
                strokeWidth="3"
              />
            </g>
            {pz && (
              <>
                <rect
                  x={pz.x}
                  y={pz.y}
                  width={pz.width}
                  height={pz.height}
                  fill="none"
                  stroke="#7c3aed"
                  strokeWidth={viewConfig.path ? "2.5" : "8"}
                  strokeDasharray={viewConfig.path ? "11 9" : "20 16"}
                  opacity={viewConfig.path ? "0.75" : "0.45"}
                />
                {viewConfig.path && (
                  <text
                    x={pz.x + pz.width / 2}
                    y={pz.y - 10}
                    textAnchor="middle"
                    fontSize="20"
                    fontWeight="600"
                    fill="#7c3aed"
                    opacity="0.8"
                  >
                    Зона друку
                  </text>
                )}
              </>
            )}
            {viewConfig.seamHint && pz && (
              <>
                {/* Підпис — НИЖЧЕ рамки розгортки (рамка знизу на y≈315), щоб текст
                    не перетинав її. Виносимо у вільну смугу під рамкою. */}
                <text
                  x={pz.x + pz.width / 2}
                  y={pz.y + pz.height + 52}
                  textAnchor="middle"
                  fontSize="17"
                  fill="#64748b"
                  opacity="0.9"
                >
                  Краї розгортки сходяться біля ручки
                </text>
                <text x={pz.x - 4} y={pz.y + pz.height / 2} textAnchor="end" fontSize="15" fill="#94a3b8">↤ ручка</text>
                <text x={pz.x + pz.width + 4} y={pz.y + pz.height / 2} textAnchor="start" fontSize="15" fill="#94a3b8">ручка ↦</text>
              </>
            )}
          </svg>
        </div>
      )}

      {/* ── Template formats: white paper + PNG frame behind canvas ──
           White bg ensures transparent template areas look like paper (not page bg).
           Canvas is transparent; destination-in clip doesn't affect this layer. */}
      {isTemplate && (
        <div
          className="absolute top-0 left-0 z-0 pointer-events-none overflow-hidden"
          style={{ ...scaledStyle, backgroundColor: "#ffffff" }}
        >
          <img
            src={viewConfig.templateOverlay}
            width={canvasW}
            height={canvasH}
            alt=""
            draggable={false}
            style={{ display: "block" }}
          />
        </div>
      )}

      {/* ── Canvas: Fabric.js content, transparent bg, clipped to print zone ── */}
      <div className="absolute top-0 left-0 z-10" style={scaledStyle}>
        <canvas ref={canvasRef} width={canvasW} height={canvasH} />
      </div>

      {/* ── Розворот: лінія згину по центру + підписи «Ліва»/«Права» (НАД холстом,
           щоб було видно поверх фото). Це лише підказка — не обʼєкт fabric, тож у
           друк-файл/мокап не потрапляє. ── */}
      {viewConfig.spread && pz && (() => {
        const cx = pz.x + pz.width / 2;
        const safe = viewConfig.safe || { edgeX: 0, edgeY: 0, seam: 0 };
        return (
          <div className="absolute inset-0 z-20 pointer-events-none">
            <svg viewBox={viewConfig.viewBox} className="w-full h-full">
              {/* Межа розвороту (корінець/палітурка): червона смуга завширшки 10 мм —
                  саме стільки «з'їдає» згин/палітурка, тож важливе сюди не розміщують.
                  Напівпрозора смуга показує ШИРИНУ зони, суцільна лінія — точний центр.
                  Це лише підказка (pointer-events-none, не fabric) — у друк не йде.
                  safe.seam задано як 1 см у одиницях viewBox (buildSpreadView). */}
              <line x1={cx} y1={pz.y} x2={cx} y2={pz.y + pz.height}
                stroke="#ef4444" strokeWidth={safe.seam || 18} opacity="0.4" />
              <line x1={cx} y1={pz.y} x2={cx} y2={pz.y + pz.height}
                stroke="#ef4444" strokeWidth="2.5" />
              {/* Безпечні поля (0.5 см) — тримайте важливе всередині цієї рамки */}
              {(safe.edgeX > 0 || safe.edgeY > 0) && (
                <rect x={pz.x + safe.edgeX} y={pz.y + safe.edgeY}
                  width={pz.width - safe.edgeX * 2} height={pz.height - safe.edgeY * 2}
                  fill="none" stroke="#10b981" strokeWidth="2" strokeDasharray="6 6" opacity="0.7" />
              )}
              <text x={pz.x + pz.width / 4} y={pz.y + 30} textAnchor="middle"
                fontSize="22" fontWeight="700" fill="#7c3aed" opacity="0.75">Ліва</text>
              <text x={pz.x + (pz.width * 3) / 4} y={pz.y + 30} textAnchor="middle"
                fontSize="22" fontWeight="700" fill="#7c3aed" opacity="0.75">Права</text>
              {viewConfig.sizeLabel && (
                <text x={cx} y={pz.y + pz.height - 12} textAnchor="middle"
                  fontSize="15" fill="#475569" opacity="0.85">{viewConfig.sizeLabel}</text>
              )}
            </svg>
          </div>
        );
      })()}

      {/* ── Template formats: dashed print zone hint above canvas ── */}
      {isTemplate && pz && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full h-full">
            <rect
              x={pz.x}
              y={pz.y}
              width={pz.width}
              height={pz.height}
              fill="none"
              stroke="#7c3aed"
              strokeWidth="8"
              strokeDasharray="20 16"
              opacity="0.45"
            />
          </svg>
        </div>
      )}
      </div>{/* /шар зуму */}

      {/* Керування зумом — поверх, саме НЕ масштабується */}
      <div className="absolute bottom-1 right-1 z-30 flex items-center gap-0.5 rounded-lg border border-border/60 bg-card/90 backdrop-blur px-0.5 py-0.5 shadow-soft">
        <button type="button" title="Зменшити" onClick={zoomOut} disabled={zoom <= 1}
          className="h-6 w-6 flex items-center justify-center rounded text-foreground/70 hover:bg-muted disabled:opacity-30">
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button type="button" title="Скинути масштаб (100%)" onClick={resetZoom}
          className="px-1 text-[10px] font-semibold tabular-nums text-foreground/70 hover:text-foreground min-w-[34px]">
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" title="Збільшити (Ctrl+колесо)" onClick={zoomIn} disabled={zoom >= 4}
          className="h-6 w-6 flex items-center justify-center rounded text-foreground/70 hover:bg-muted disabled:opacity-30">
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
    </div>
  );
};

export default ProductCanvas;
