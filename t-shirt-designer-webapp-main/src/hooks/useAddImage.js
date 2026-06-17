import * as fabric from "fabric";
import { useCanvas } from "@/hooks/useCanvas";
import { useToast } from "@/hooks/use-toast";
import { CANVAS_CONFIG } from "@/constants/designConstants";
import { DESIGNER_CONFIG } from "@/config/designer.config";

export function useAddImage() {
  const { activeCanvas } = useCanvas();
  const { toast } = useToast();

  const getPrintableArea = () =>
    activeCanvas?.printArea || {
      left: 0,
      top: 0,
      width: CANVAS_CONFIG.width,
      height: CANVAS_CONFIG.height,
    };

  const addImageFile = (file) => {
    if (!activeCanvas || !file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const imgObj = new Image();
      imgObj.src = event.target.result;
      imgObj.onload = () => {
        if (
          imgObj.width < DESIGNER_CONFIG.minWidthPx ||
          imgObj.height < DESIGNER_CONFIG.minHeightPx
        ) {
          toast({
            variant: "destructive",
            title: "Низька якість (DPI)",
            description: `Роздільна здатність файлу ${imgObj.width}×${imgObj.height} px. Рекомендується мінімум ${DESIGNER_CONFIG.minWidthPx}×${DESIGNER_CONFIG.minHeightPx} px для якісного друку.`,
          });
        }
        const image = new fabric.Image(imgObj);
        const printArea = getPrintableArea();
        const maxWidth = printArea.width;
        const maxHeight = printArea.height;
        if (image.width > maxWidth || image.height > maxHeight) {
          const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
          image.scale(scale);
        }
        image.set({
          left: printArea.left + (printArea.width - image.getScaledWidth()) / 2,
          top: printArea.top + (printArea.height - image.getScaledHeight()) / 2,
        });
        activeCanvas.add(image);
        activeCanvas.setActiveObject(image);
        activeCanvas.renderAll();
      };
    };
    reader.readAsDataURL(file);
  };

  return { addImageFile };
}
