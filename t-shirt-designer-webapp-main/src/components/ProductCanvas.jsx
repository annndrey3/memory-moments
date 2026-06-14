import { CANVAS_CONFIG } from "@/constants/designConstants";
import { useTshirtCanvas } from "@/hooks/useTshirtCanvas";

const ProductCanvas = ({ view, viewConfig }) => {
  const { canvasRef, tshirtColor } = useTshirtCanvas({
    svgPath: viewConfig.path,
    viewBox: viewConfig.viewBox,
    printZone: viewConfig.printZone,
    view,
  });

  const pz = viewConfig.printZone;

  return (
    <div className="relative h-[500px] w-[450px] max-w-[78vw]">
      <div className="absolute inset-0 pointer-events-none">
        <svg viewBox={viewConfig.viewBox} className="w-full h-full">
          <path
            d={viewConfig.path}
            fill={viewConfig.surfaceColor || tshirtColor}
            stroke="#111827"
            strokeWidth="3"
          />
          {/* Пунктирна границя зони друку (лише підказка — в макет не потрапляє,
              бо цей SVG — оверлей поверх полотна, а не частина fabric-canvas). */}
          {pz && (
            <>
              <rect
                x={pz.x}
                y={pz.y}
                width={pz.width}
                height={pz.height}
                rx="8"
                fill="none"
                stroke="#7c3aed"
                strokeWidth="2.5"
                strokeDasharray="11 9"
                opacity="0.75"
              />
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
            </>
          )}
          {/* Для розгортки чашки: краї прямокутника сходяться біля ручки */}
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
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-10 h-full w-full"
        width={CANVAS_CONFIG.width}
        height={CANVAS_CONFIG.height}
      />
    </div>
  );
};

export default ProductCanvas;
