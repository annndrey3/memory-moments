import { CANVAS_CONFIG } from "@/constants/designConstants";
import { useTshirtCanvas } from "@/hooks/useTshirtCanvas";

const ProductCanvas = ({ view, viewConfig }) => {
  const { canvasRef, tshirtColor } = useTshirtCanvas({
    svgPath: viewConfig.path,
    viewBox: viewConfig.viewBox,
    view,
  });

  return (
    <div className="relative h-[500px] w-[450px] max-w-[78vw]">
      <div className="absolute inset-0 pointer-events-none">
        <svg viewBox={viewConfig.viewBox} className="w-full h-full">
          <path
            d={viewConfig.path}
            fill={tshirtColor}
            stroke="#111827"
            strokeWidth="3"
          />
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
