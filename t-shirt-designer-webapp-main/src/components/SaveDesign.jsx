import { Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCanvas } from "@/hooks/useCanvas";

// For template formats (polaroid, instax, phone-case) the frame is composited here
// so the downloaded file is print-ready with the frame baked in.
const compositeTemplateForDownload = (canvas) => {
  const templateImg = canvas.templateImg;
  if (!templateImg || !templateImg.complete || !templateImg.naturalWidth) return null;
  const w = canvas.width, h = canvas.height;
  const off = document.createElement("canvas");
  off.width = w; off.height = h;
  const ctx = off.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(templateImg, 0, 0, w, h);
  ctx.drawImage(canvas.lowerCanvasEl, 0, 0, w, h);
  return off.toDataURL("image/png");
};

const SaveDesign = ({ className }) => {
  const { toast } = useToast();
  const { frontCanvas, backCanvas } = useCanvas();

  const saveCanvasToFile = async (canvas, filename, includeShirt = false) => {
    try {
      let dataUrl;

      // Template formats (polaroid, instax, phone-case): frame already at 300 DPI,
      // composite white + frame + design so the download is print-ready.
      if (canvas.templateImg) {
        dataUrl = compositeTemplateForDownload(canvas);
        if (!dataUrl) {
          dataUrl = canvas.toDataURL({ format: "png", quality: 1 });
        }
      } else if (includeShirt) {
        const tempCanvas = document.createElement("canvas");
        const ctx = tempCanvas.getContext("2d");

        const container = canvas.wrapperEl.parentElement;
        tempCanvas.width = container.offsetWidth;
        tempCanvas.height = container.offsetHeight;

        const tshirtImg = container.querySelector("img");
        if (tshirtImg) {
          ctx.drawImage(tshirtImg, 0, 0, tempCanvas.width, tempCanvas.height);
        }

        const rect = canvas.wrapperEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const x = rect.left - containerRect.left;
        const y = rect.top - containerRect.top;
        ctx.drawImage(canvas.lowerCanvasEl, x, y, canvas.width, canvas.height);
        dataUrl = tempCanvas.toDataURL({ format: "png", quality: 1 });
      } else {
        dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier: 2 });
      }

      const link = document.createElement("a");
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    } catch (error) {
      console.error(`Error saving ${filename}:`, error);
      return false;
    }
  };

  const handleSave = async (includeShirt = false) => {
    try {
      if (!frontCanvas && !backCanvas) {
        toast({
          variant: "destructive",
          title: "No Design Found",
          description: "Please create a design before saving.",
          duration: 3000,
        });
        return;
      }

      let savedCount = 0;
      let failedCount = 0;

      if (frontCanvas) {
        const frontSaved = await saveCanvasToFile(
          frontCanvas,
          `tshirt-front-${includeShirt ? "with-shirt" : "design-only"}.png`,
          includeShirt
        );
        frontSaved ? savedCount++ : failedCount++;
      }

      if (backCanvas) {
        const backSaved = await saveCanvasToFile(
          backCanvas,
          `tshirt-back-${includeShirt ? "with-shirt" : "design-only"}.png`,
          includeShirt
        );
        backSaved ? savedCount++ : failedCount++;
      }

      if (failedCount > 0) {
        toast({
          variant: "destructive",
          title: "Save Error",
          description: `Failed to save ${failedCount} design${
            failedCount > 1 ? "s" : ""
          }.`,
          duration: 3000,
        });
      } else {
        toast({
          title: "Design Saved!",
          description: `Successfully saved ${savedCount} design file${
            savedCount > 1 ? "s" : ""
          }.`,
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Save error:", error);
      toast({
        variant: "destructive",
        title: "Save Error",
        description: "An unexpected error occurred while saving.",
        duration: 3000,
      });
    }
  };

  // Замовлення — через нижню панель «Замовити!». Тут лише завантаження макета.
  return (
    <button type="button" onClick={() => handleSave(false)} className={className} title="Завантажити макет">
      <Save className="h-5 w-5" />
      <span className="text-[10px] font-medium leading-none">Зберегти</span>
    </button>
  );
};

export default SaveDesign;
