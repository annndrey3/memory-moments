import { Button } from "@/components/ui/button";
import { Save, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCanvas } from "@/hooks/useCanvas";
import { useDispatch, useSelector } from "react-redux";
import { addToCart } from "@/features/tshirtSlice";
import { canvasSyncManager } from "@/utils/canvasSyncManager";
import { PRODUCT_TYPES } from "@/constants/designConstants";

const SaveDesign = () => {
  const { toast } = useToast();
  const { frontCanvas, backCanvas } = useCanvas();
  const dispatch = useDispatch();

  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);

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

    const designTextureFront = frontCanvas ? canvasSyncManager.getCanvasTexture(frontCanvas) : null;
    const designTextureBack = backCanvas ? canvasSyncManager.getCanvasTexture(backCanvas) : null;
    const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];

    dispatch(addToCart({
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      productType: selectedType,
      productName: product.name,
      designTextureFront,
      designTextureBack,
      color: tshirtColor,
      quantity: 1,
    }));

    toast({
      title: "Додано до кошика",
      description: `${product.name} успішно додано.`,
      duration: 3000,
    });
  };

  const saveCanvasToFile = async (canvas, filename, includeShirt = false) => {
    try {
      if (includeShirt) {
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

        const dataUrl = tempCanvas.toDataURL({
          format: "png",
          quality: 1,
        });

        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const dataUrl = canvas.toDataURL({
          format: "png",
          quality: 1,
          multiplier: 2,
          width: canvas.width,
          height: canvas.height,
        });

        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
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
