import { useEffect } from "react";

// Прив'язка (snap) при перетягуванні: коли центр об'єкта підходить до центру зони
// друку — «клацає» рівно по центру й показує рожеву напрямну (горизонтальну/вертикальну).
// Допомагає рівно ставити фото/текст без мороки. Напрямні малюються на верхньому
// контексті полотна (contextTop) і не потрапляють у друк/мокап (це не fabric-об'єкти).
const TH = 6; // поріг притягання, px у координатах полотна

export function useSnapGuides(canvas) {
  useEffect(() => {
    if (!canvas) return;
    let guides = []; // [[x1,y1,x2,y2], …] у координатах полотна

    const zone = () =>
      canvas.printArea || { left: 0, top: 0, width: canvas.getWidth(), height: canvas.getHeight() };

    const onMoving = (e) => {
      const o = e.target;
      if (!o) return;
      const pa = zone();
      const cx = pa.left + pa.width / 2;
      const cy = pa.top + pa.height / 2;
      const c = o.getCenterPoint();
      guides = [];
      if (Math.abs(c.x - cx) < TH) {
        o.left += cx - c.x;
        guides.push([cx, pa.top, cx, pa.top + pa.height]);
      }
      if (Math.abs(c.y - cy) < TH) {
        o.top += cy - c.y;
        guides.push([pa.left, cy, pa.left + pa.width, cy]);
      }
      if (guides.length) o.setCoords();
    };

    const clearGuides = () => {
      if (guides.length) { guides = []; canvas.requestRenderAll(); }
    };

    const onAfter = () => {
      if (!guides.length) return;
      const ctx = canvas.contextTop;
      if (!ctx) return;
      const vt = canvas.viewportTransform;
      const r = canvas.getRetinaScaling();
      const toScreen = (x, y) => [(x * vt[0] + y * vt[2] + vt[4]) * r, (x * vt[1] + y * vt[3] + vt[5]) * r];
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#ec4899";
      ctx.setLineDash([4, 4]);
      guides.forEach(([x1, y1, x2, y2]) => {
        const a = toScreen(x1, y1), b = toScreen(x2, y2);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      });
      ctx.restore();
    };

    canvas.on("object:moving", onMoving);
    canvas.on("after:render", onAfter);
    canvas.on("mouse:up", clearGuides);
    canvas.on("object:modified", clearGuides);
    return () => {
      canvas.off("object:moving", onMoving);
      canvas.off("after:render", onAfter);
      canvas.off("mouse:up", clearGuides);
      canvas.off("object:modified", clearGuides);
    };
  }, [canvas]);
}
