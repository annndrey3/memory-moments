import { useEffect, useRef, useState } from "react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { useTshirtCanvas } from "@/hooks/useTshirtCanvas";

const ProductCanvas = ({ view, viewConfig, seedImage, shirtScale }) => {
  const canvasW = viewConfig.canvasSize?.width ?? CANVAS_CONFIG.width;
  const canvasH = viewConfig.canvasSize?.height ?? CANVAS_CONFIG.height;
  const isTemplate = Boolean(viewConfig.templateOverlay);

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
  const [scale, setScale] = useState(1);

  // На великих екранах (десктоп) даємо полотну більший бюджет — там вистачає
  // вертикального місця. Мобільна/планшетна верстка не змінюється. Аналогічно
  // до isWide для 3D-прев'ю чашки.
  const [isWide, setIsWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    // Десктоп = широкий екран. Висоту НЕ гейтимо: розмір рахуємо від доступної
    // висоти (calc нижче), тож скролу не буде навіть на низькому вікні.
    const mq = window.matchMedia("(min-width: 1280px)");
    const apply = () => setIsWide(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
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

  // Розмір полотна. Десктоп (isWide): полотно ЗАПОВНЮЄ доступну висоту дисплея —
  // екран мінус шапка/панель опцій/нижній ордербар (≈ chrome). Так макет великий і
  // чіткий на весь екран, без вертикального скролу. Мобільний — попередня формула
  // з vh-бюджетом (налаштована, щоб усе вміщалось на малих екранах).
  const ratio = canvasW / canvasH;
  const chrome = viewConfig.chromeWide ?? 280; // книги задають більший (є карусель розворотів)
  const widthCss = isWide
    ? `min(820px, 88vw, calc((100vh - ${chrome}px) * ${ratio.toFixed(3)}))`
    : `min(450px, 84vw, ${((viewConfig.vhBudget ?? 34) * ratio).toFixed(1)}vh)`;

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
      ref={containerRef}
      className="relative mx-auto overflow-hidden"
      // Розмір залежить і від ширини, і від ВИСОТИ екрана (vh) — щоб редактор
      // вміщався без прокрутки. Width = min(макс, 84vw, висотний бюджет × пропорція).
      style={{ width: widthCss, aspectRatio: `${canvasW} / ${canvasH}` }}
    >
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
                fill={viewConfig.surfaceColor || tshirtColor}
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
                <text
                  x={pz.x + pz.width / 2}
                  y={pz.y + pz.height + 30}
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
              {/* Зона шва (корінець): смуга по центру розвороту, де не варто
                  розміщувати важливе — там згин/палітурка. */}
              {safe.seam > 0 && (
                <rect x={cx - safe.seam} y={pz.y} width={safe.seam * 2} height={pz.height}
                  fill="#ef4444" opacity="0.10" />
              )}
              {/* Лінія згину по центру */}
              <line x1={cx} y1={pz.y} x2={cx} y2={pz.y + pz.height}
                stroke="#7c3aed" strokeWidth="2.5" strokeDasharray="8 7" opacity="0.7" />
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
    </div>
  );
};

export default ProductCanvas;
