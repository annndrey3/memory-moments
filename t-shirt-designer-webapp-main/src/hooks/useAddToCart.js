import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useCanvas } from "@/hooks/useCanvas";
import { useToast } from "@/hooks/use-toast";
import { addToCart } from "@/features/tshirtSlice";
import { canvasSyncManager } from "@/utils/canvasSyncManager";
import { usePricing } from "@/hooks/usePricing";
import { PRODUCT_TYPES, buildOptionsLabel, isBookType, isMultiPhoto } from "@/constants/designConstants";

const genKey = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// Перекодування друкарської текстури розвороту в JPEG (менший payload; розвороти
// — це фото). Прозорі ділянки колажу заливаються білим (це сторінка книги).
function pngToJpeg(dataUrl, quality = 0.9) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Спільна логіка «додати поточний дизайн у кошик» — використовується і в
// сайдбарі (SaveDesign), і в нижній панелі замовлення (OrderBar), щоб обидва
// будували однакову позицію (мокап, друкарські файли, підпис опцій).
export function useAddToCart() {
  const { toast } = useToast();
  const { frontCanvas, backCanvas, getCanvas } = useCanvas();
  const { priceFor, tshirtPrice, canvasPrice, bookPrice } = usePricing();
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

  // Чи є взагалі що замовляти. Пачка фото — є завантажені фото; решта — об'єкти front/back.
  const hasDesign = useCallback(() => {
    if (isMultiPhoto(selectedType)) return (slimBookPhotos?.length || 0) > 0;
    const f = frontCanvas?.getObjects?.().length || 0;
    const b = backCanvas?.getObjects?.().length || 0;
    return f + b > 0;
  }, [frontCanvas, backCanvas, selectedType, slimBookPhotos]);

  // onProgress({done,total}) — щоб UI показував підготовку (рендер 200 фото може
  // зайняти час; без зворотного звʼязку виглядає як «зависання»).
  const addCurrentDesignToCart = useCallback(async (onProgress) => {
    // Пачка фото: 1 позиція кошика = N фото (кожне — окрема відрендерена сторінка).
    // quantity=N → ціна (cartItemPrice × quantity) і сервер рахуються без окремих гілок.
    if (isMultiPhoto(selectedType)) {
      if (!slimBookPhotos.length) {
        toast({ variant: "destructive", title: "Немає фото", description: "Завантажте фото для друку.", duration: 3000 });
        return false;
      }
      if (!designDirty && cartItems.length > 0) return "exists";
      const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
      const total = slimBookPhotos.length;
      const photos = [];
      onProgress?.({ done: 0, total });
      for (let i = 0; i < total; i++) {
        const c = getCanvas(selectedType, `spread-${i}`);
        const png = c ? canvasSyncManager.getPrintTexture(c) : null;
        const jpg = png ? await pngToJpeg(png) : null;
        photos.push(jpg || slimBookPhotos[i]);
        onProgress?.({ done: i + 1, total });
        // Поступаємось потоку, щоб React встиг перемалювати прогрес (не «зависає»).
        if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
      }
      dispatch(addToCart({
        key: genKey(),
        type: "design",
        name: product.name,
        image: photos[0] || null, // прев'ю в кошику — перше фото
        unit_price: priceFor(selectedType)?.price ?? null,
        variant_label: buildOptionsLabel({ productType: selectedType, paperType }),
        quantity: photos.length,
        is_photo_pack: true,
        // order payload
        product_type: selectedType,
        inner_photos: photos,
        design_preview: photos[0] || null,
      }));
      toast({ title: "Додано до кошика", description: `${product.name} × ${photos.length} успішно додано.`, duration: 3000 });
      return true;
    }

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

    // Книга: рендеримо кожен розворот-холст у друкарську текстуру (відображає
    // колаж/рамки/текст/маски). Фолбек — вихідне фото, якщо холста немає.
    let innerPhotos = null;
    if (isBookType(selectedType)) {
      innerPhotos = [];
      const total = slimBookPhotos.length;
      onProgress?.({ done: 0, total });
      for (let i = 0; i < total; i++) {
        const c = getCanvas(selectedType, `spread-${i}`);
        const png = c ? canvasSyncManager.getPrintTexture(c) : null;
        const jpg = png ? await pngToJpeg(png) : null;
        innerPhotos.push(jpg || slimBookPhotos[i]);
        onProgress?.({ done: i + 1, total });
        if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Ціна одиниці (для показу в кошику; сервер усе одно перерахує з прайсу).
    let unitPrice = null;
    if (selectedType === "crew-neck") { const tp = tshirtPrice({ color: tshirtColor, printSize, bothSides }); unitPrice = tp ? tp.total : null; }
    else if (selectedType === "canvas") unitPrice = canvasPrice(canvasSize);
    else if (isBookType(selectedType)) unitPrice = bookPrice({ type: selectedType, format: slimBookFormat, spreads: slimBookSpreads, extra: slimBookExtra });
    else unitPrice = priceFor(selectedType)?.price ?? null;

    dispatch(addToCart({
      key: genKey(),
      type: "design",
      name: product.name,
      image: designTextureFront,
      unit_price: unitPrice,
      variant_label: variantLabel,
      quantity,
      is_photo_pack: false,
      // order payload
      product_type: selectedType,
      color: tshirtColor,
      print_size: printSize,
      canvas_size: canvasSize,
      format: slimBookFormat,
      spreads: slimBookSpreads,
      extra_spreads: slimBookExtra,
      inner_photos: innerPhotos,
      design_data: JSON.stringify({ front: fabricFront, back: fabricBack }),
      design_preview: designTextureFront,
      design_preview_back: designTextureBack,
      print_front: printFront,
      print_back: printBack,
      raw_front: rawDesignFront,
      raw_back: rawDesignBack,
    }));

    toast({
      title: "Додано до кошика",
      description: `${product.name} × ${quantity} успішно додано.`,
      duration: 3000,
    });
    return true;
  }, [frontCanvas, backCanvas, getCanvas, selectedType, tshirtColor, size, printSize, canvasSize, slimBookFormat, slimBookSpreads, slimBookExtra, slimBookPhotos, paperType, quantity, designDirty, cartItems.length, dispatch, toast, priceFor, tshirtPrice, canvasPrice, bookPrice]);

  return { addCurrentDesignToCart, hasDesign };
}
