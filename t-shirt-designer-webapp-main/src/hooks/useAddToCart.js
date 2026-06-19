import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCanvas } from "@/hooks/useCanvas";
import { useToast } from "@/hooks/use-toast";
import { addToCart } from "@/features/tshirtSlice";
import { canvasSyncManager } from "@/utils/canvasSyncManager";
import { PRODUCT_TYPES, buildOptionsLabel, isBookType } from "@/constants/designConstants";

// Спільна логіка «додати поточний дизайн у кошик» — використовується і в
// сайдбарі (SaveDesign), і в нижній панелі замовлення (OrderBar), щоб обидва
// будували однакову позицію (мокап, друкарські файли, підпис опцій).
export function useAddToCart() {
  const { toast } = useToast();
  const { frontCanvas, backCanvas } = useCanvas();
  const dispatch = useDispatch();

  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const size = useSelector((state) => state.tshirt.size);
  const printSize = useSelector((state) => state.tshirt.printSize);
  const canvasSize = useSelector((state) => state.tshirt.canvasSize);
  const slimBookFormat = useSelector((state) => state.tshirt.slimBookFormat);
  const slimBookSpreads = useSelector((state) => state.tshirt.slimBookSpreads);
  const slimBookExtra = useSelector((state) => state.tshirt.slimBookExtra);
  const slimBookPhotos = useSelector((state) => state.tshirt.slimBookPhotos);
  const paperType = useSelector((state) => state.tshirt.paperType);
  const quantity = useSelector((state) => state.tshirt.quantity);
  const designDirty = useSelector((state) => state.tshirt.designDirty);
  const cartItems = useSelector((state) => state.tshirt.cartItems);

  // Чи є взагалі що замовляти (хоч один об'єкт на полотні front/back).
  const hasDesign = useCallback(() => {
    const f = frontCanvas?.getObjects?.().length || 0;
    const b = backCanvas?.getObjects?.().length || 0;
    return f + b > 0;
  }, [frontCanvas, backCanvas]);

  const addCurrentDesignToCart = useCallback(async () => {
    if (!frontCanvas && !backCanvas) {
      toast({
        variant: "destructive",
        title: "Немає дизайну",
        description: "Будь ласка, створіть дизайн перед додаванням до кошика.",
        duration: 3000,
      });
      return false;
    }

    // Поточний дизайн уже в кошику й не змінювався → не дублюємо позицію.
    if (!designDirty && cartItems.length > 0) {
      return "exists";
    }

    // Генеруємо макети лише для сторін З ВМІСТОМ: обидва полотна (перед/спина)
    // існують завжди, тож getPrintTexture порожньої сторони повернув би прозорий
    // PNG — це псувало б визначення «другої сторони» (ціна) і слало б пусті файли.
    const frontHas = (frontCanvas?.getObjects?.().length || 0) > 0;
    const backHas = (backCanvas?.getObjects?.().length || 0) > 0;

    let designTextureFront = frontHas ? canvasSyncManager.getCanvasTexture(frontCanvas) : null;
    let designTextureBack = backHas ? canvasSyncManager.getCanvasTexture(backCanvas) : null;
    const rawDesignFront = frontHas ? canvasSyncManager.getRawDesignTexture(frontCanvas) : null;
    const rawDesignBack = backHas ? canvasSyncManager.getRawDesignTexture(backCanvas) : null;
    const printFront = frontHas ? canvasSyncManager.getPrintTexture(frontCanvas) : null;
    const printBack = backHas ? canvasSyncManager.getPrintTexture(backCanvas) : null;
    const fabricFront = frontHas ? frontCanvas.toJSON() : null;
    const fabricBack = backHas ? backCanvas.toJSON() : null;
    const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];

    // Мокап «дизайн на товарі» для прев'ю в кошику/Telegram. Друкарський файл
    // (printFront/Back) лишається чистим макетом без фону.
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

    // Друга сторона друку = обидві сторони мають макет (впливає на ціну з прайсу).
    const bothSides = Boolean(printFront) && Boolean(printBack);
    const variantLabel = buildOptionsLabel({
      productType: selectedType,
      size,
      printSize,
      canvasSize,
      bothSides,
      paperType,
      color: tshirtColor,
      slimBookFormat,
      slimBookSpreads,
      slimBookExtra,
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
      printSize,
      canvasSize,
      paperType,
      slimBookFormat,
      slimBookSpreads,
      slimBookExtra,
      innerPhotos: isBookType(selectedType) ? slimBookPhotos : null,
      variantLabel,
      quantity,
    }));

    toast({
      title: "Додано до кошика",
      description: `${product.name} × ${quantity} успішно додано.`,
      duration: 3000,
    });
    return true;
  }, [frontCanvas, backCanvas, selectedType, tshirtColor, size, printSize, canvasSize, slimBookFormat, slimBookSpreads, slimBookExtra, slimBookPhotos, paperType, quantity, designDirty, cartItems.length, dispatch, toast]);

  return { addCurrentDesignToCart, hasDesign };
}
