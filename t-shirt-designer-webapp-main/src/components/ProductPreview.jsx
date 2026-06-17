const ASPECT_CLASSES = {
  portrait_2x3:  "aspect-[2/3]",
  landscape_3x2: "aspect-[3/2]",
  portrait_5x7:  "aspect-[5/7]",
  landscape_7x5: "aspect-[7/5]",
  portrait_3x4:  "aspect-[3/4]",
  landscape_4x3: "aspect-[4/3]",
  a4_portrait:   "aspect-[210/297]",
  a4_landscape:  "aspect-[297/210]",
  square:        "aspect-square",
};

const ProductPreview = ({ product, texture, baseColor }) => {
  const shape = product.previewShape || "portrait_2x3";
  const hasTexture = Boolean(texture);
  const front = product.views?.front || {};
  const pz = front.printZone;

  // ── Template formats (polaroid, instax, phone-case) ──────────────────────────
  // getCanvasTexture повертає ПОВНЕ полотно (прозоре поза зоною друку через clipPath),
  // тому просто накладаємо його поверх рамки шаблону через inset-0 —
  // не потрібно позиціювати по CSS-відсотках printZone.
  if (front.templateOverlay) {
    const [, , vbW, vbH] = (front.viewBox || "0 0 638 1016").split(/\s+/).map(Number);
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div
          className="relative shadow-lg overflow-hidden"
          style={{ aspectRatio: `${vbW} / ${vbH}`, width: "min(100%, 300px)", backgroundColor: "#ffffff" }}
        >
          <img
            src={front.templateOverlay}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-fill pointer-events-none"
          />
          {hasTexture && (
            <img
              src={texture}
              alt=""
              className="absolute inset-0 w-full h-full object-fill"
            />
          )}
        </div>
      </div>
    );
  }

  // ── T-shirt flat SVG preview ──────────────────────────────────────────────────
  if (shape === "tshirt") {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div style={{ width: "min(100%, 340px)" }}>
          <svg viewBox={front.viewBox || "0 0 810 810"} className="w-full drop-shadow-xl">
            <defs>
              {pz && (
                <clipPath id="pp-tshirt-pz">
                  <rect x={pz.x} y={pz.y} width={pz.width} height={pz.height} />
                </clipPath>
              )}
            </defs>
            <path
              d={front.path}
              fill={baseColor}
              stroke="#111827"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {hasTexture && pz && (
              <image
                href={texture}
                x={pz.x}
                y={pz.y}
                width={pz.width}
                height={pz.height}
                clipPath="url(#pp-tshirt-pz)"
                preserveAspectRatio="xMidYMid meet"
              />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ── Mug flat preview (fallback when 3D is off) ────────────────────────────────
  if (shape === "mug") {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="relative" style={{ width: "min(100%, 340px)" }}>
          <div
            className="relative overflow-hidden rounded-[42px] shadow-lg"
            style={{ backgroundColor: baseColor }}
          >
            <div className="aspect-[4/3] w-full rounded-[42px]">
              {hasTexture && (
                <img src={texture} alt="" className="h-full w-full object-cover mix-blend-multiply" />
              )}
            </div>
          </div>
          <div className="absolute right-[-18%] top-[28%] h-[44%] w-[28%] rounded-r-full border-[18px] border-l-0 border-muted-foreground/20 bg-transparent" />
        </div>
      </div>
    );
  }

  // ── Flat photo formats ────────────────────────────────────────────────────────
  const aspectClass = ASPECT_CLASSES[shape] ?? "aspect-[2/3]";
  return (
    <div className="h-full w-full flex items-center justify-center">
      <div
        className={`relative overflow-hidden bg-white shadow-lg ${aspectClass}`}
        style={{ width: "min(100%, 300px)" }}
      >
        {hasTexture ? (
          <img src={texture} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-muted/80" />
        )}
      </div>
    </div>
  );
};

export default ProductPreview;
