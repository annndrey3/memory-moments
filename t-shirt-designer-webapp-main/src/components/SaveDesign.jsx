import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Save, ShoppingCart, Minus, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCanvas } from "@/hooks/useCanvas";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "@/features/tshirtSlice";
import { canvasSyncManager } from "@/utils/canvasSyncManager";

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
import { PRODUCT_TYPES, buildOptionsLabel } from "@/constants/designConstants";

const SaveDesign = () => {
  const { toast } = useToast();
  const { frontCanvas, backCanvas } = useCanvas();
  const dispatch = useDispatch();

  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const size = useSelector((state) => state.tshirt.size);
  const paperType = useSelector((state) => state.tshirt.paperType);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = async () => {
    if (!frontCanvas && !backCanvas) {
      toast({
        variant: "destructive",
        title: "Немає дизайну",
        description: "Будь ласка, створіть дизайн перед додаванням до кошика.",
        duration: 3000,
      });
      return;
    }

    let designTextureFront = frontCanvas ? canvasSyncManager.getCanvasTexture(frontCanvas) : null;
    let designTextureBack = backCanvas ? canvasSyncManager.getCanvasTexture(backCanvas) : null;
    // Сирий кроп зони друку (без рамки шаблону) — до buildMockup, поки текстура ще «чиста».
    const rawDesignFront = frontCanvas ? canvasSyncManager.getRawDesignTexture(frontCanvas) : null;
    const rawDesignBack = backCanvas ? canvasSyncManager.getRawDesignTexture(backCanvas) : null;
    // Друкарські макети у повній роздільності (підуть у Telegram як документи).
    const printFront = frontCanvas ? canvasSyncManager.getPrintTexture(frontCanvas) : null;
    const printBack = backCanvas ? canvasSyncManager.getPrintTexture(backCanvas) : null;
    // Сам макет (fabric JSON) — щоб замовлення зберегло редаговане джерело, а не лише прев'ю.
    const fabricFront = frontCanvas ? frontCanvas.toJSON() : null;
    const fabricBack = backCanvas ? backCanvas.toJSON() : null;
    const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];

    // Для всіх продуктів будуємо мокап «дизайн на товарі» для прев'ю в кошику/Telegram.
    // Друкарський файл (printFront/Back) лишається чистим макетом без фону.
    const views = product.views || {};
    const mockupColor = selectedType === "crew-neck" ? tshirtColor : (views.front?.surfaceColor || "#ffffff");
    if (designTextureFront && views.front) {
      designTextureFront =
        (await canvasSyncManager.buildMockup({ ...views.front, color: mockupColor, design: designTextureFront })) ||
        designTextureFront;
    }
    if (designTextureBack && views.back) {
      designTextureBack =
        (await canvasSyncManager.buildMockup({ ...views.back, color: mockupColor, design: designTextureBack })) ||
        designTextureBack;
    }

    // Підпис обраних опцій (розмір/папір/колір) — піде в кошик і в замовлення.
    const variantLabel = buildOptionsLabel({
      productType: selectedType,
      size,
      paperType,
      color: tshirtColor,
    });

    dispatch(addToCart({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      productType: selectedType,
      productName: product.name,
      designTextureFront,
      designTextureBack,
      rawDesignFront,
      rawDesignBack,
      printFront,
      printBack,
      fabricFront,
      fabricBack,
      color: tshirtColor,
      size,
      paperType,
      variantLabel,
      quantity,
    }));

    toast({
      title: "Додано до кошика",
      description: `${product.name} × ${quantity} успішно додано.`,
      duration: 3000,
    });
    setQuantity(1);
  };

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

  return (
    <div className="panel-section space-y-2 mt-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
        Зберегти
      </p>

      {/* Кількість */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-sidebar-foreground/80">Кількість</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground/90 hover:bg-sidebar-accent disabled:opacity-40"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-8 w-12 rounded-lg border border-sidebar-border bg-sidebar-accent/60 text-center text-sm font-medium text-sidebar-foreground outline-none focus:border-sidebar-primary/40"
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground/90 hover:bg-sidebar-accent"
            onClick={() => setQuantity((q) => q + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Button
        onClick={handleAddToCart}
        className="w-full rounded-lg h-9 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-glow"
      >
        <ShoppingCart className="h-4 w-4" />
        В кошик
      </Button>
      <Button
        onClick={() => handleSave(false)}
        variant="outline"
        className="w-full rounded-lg h-9 bg-sidebar-accent/50 border-sidebar-border/50 text-sidebar-foreground hover:bg-sidebar-accent hover:border-sidebar-primary/30"
      >
        <Save className="h-4 w-4" />
        Завантажити
      </Button>
    </div>
  );
};

export default SaveDesign;
