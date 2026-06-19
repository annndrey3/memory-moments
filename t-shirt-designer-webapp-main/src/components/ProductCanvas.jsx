import { useEffect, useRef, useState } from "react";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { useTshirtCanvas } from "@/hooks/useTshirtCanvas";

const ProductCanvas = ({ view, viewConfig, seedImage }) => {
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / canvasW);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [canvasW]);

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
      style={{ width: `min(450px, 84vw, ${(56 * (canvasW / canvasH)).toFixed(1)}vh)`, aspectRatio: `${canvasW} / ${canvasH}` }}
    >
      {/* ── Non-template formats: SVG shape outline below canvas ── */}
      {!isTemplate && (
        <div className="absolute inset-0 pointer-events-none">
          <svg viewBox={viewConfig.viewBox} className="w-full h-full">
            <path
              d={viewConfig.path}
              fill={viewConfig.surfaceColor || tshirtColor}
              stroke="#111827"
              strokeWidth="3"
            />
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
