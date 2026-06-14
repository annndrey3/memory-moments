import { CANVAS_CONFIG } from "@/constants/designConstants";

const shapeClassNames = {
  mug: "rounded-[42px] aspect-[4/3]",
  polaroid: "aspect-[5/6]",
  instax: "aspect-[54/86]",
  portrait_2x3: "aspect-[2/3]",
  landscape_3x2: "aspect-[3/2]",
  portrait_5x7: "aspect-[5/7]",
  landscape_7x5: "aspect-[7/5]",
  portrait_3x4: "aspect-[3/4]",
  landscape_4x3: "aspect-[4/3]",
  a4_portrait: "aspect-[210/297]",
  a4_landscape: "aspect-[297/210]",
  square: "aspect-square",
};

const ProductPreview = ({ product, texture, baseColor }) => {
  const shape = product.previewShape || "portrait_2x3";
  const hasTexture = Boolean(texture);

  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <div className="relative w-[82%] max-w-[320px]">
        {shape === "mug" ? (
          <div className="relative">
            <div
              className="relative overflow-hidden rounded-[42px] shadow-elevated ring-1 ring-border/30"
              style={{ backgroundColor: baseColor }}
            >
              <div className={`${shapeClassNames.mug} w-full`}>
                {hasTexture && (
                  <img
                    src={texture}
                    alt=""
                    className="h-full w-full object-cover mix-blend-multiply"
                  />
                )}
              </div>
            </div>
            <div className="absolute right-[-18%] top-[28%] h-[44%] w-[28%] rounded-r-full border-[18px] border-l-0 border-muted-foreground/20 bg-transparent" />
          </div>
        ) : (
          <div
            className={`relative overflow-hidden bg-white shadow-elevated ring-1 ring-border/30 ${shapeClassNames[shape]}`}
          >
            <div
              className={
                shape === "polaroid"
                  ? "absolute left-[8%] right-[8%] top-[7%] bottom-[23%] overflow-hidden bg-muted/50"
                  : shape === "instax"
                  ? "absolute left-[8%] right-[8%] top-[11%] bottom-[25%] overflow-hidden bg-muted/50"
                  : "absolute inset-0 overflow-hidden bg-muted/30"
              }
            >
              {hasTexture ? (
                <img src={texture} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-muted/40 to-muted/80" />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPreview;
