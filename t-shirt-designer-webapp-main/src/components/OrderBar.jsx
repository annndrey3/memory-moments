import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Minus, Plus, ShoppingCart, Images, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCanvas } from "@/hooks/useCanvas";
import { setTshirtColor, setPrintSize, setQuantity, toggleCart, setSlimBookSpreads, setSlimBookExtra, addSlimBookPhotos, clearSlimBookPhotos } from "@/features/tshirtSlice";
import { TSHIRT_COLORS, MUG_INNER_COLORS, isMugType, SLIMBOOK_SPREADS } from "@/constants/designConstants";
import { useAddToCart } from "@/hooks/useAddToCart";
import { usePricing } from "@/hooks/usePricing";
import { cn } from "@/lib/utils";

// Вибір кольору ВСЕРЕДИНІ — лише для «Чашка кольорова всередині». Біла = тільки біла,
// «хамелеон» = тільки чорна, тож у них вибору кольору немає.
const mugHasInnerColor = (type) => type === "mug-color";

const isEmbed = () =>
  new URLSearchParams(window.location.search).get("embed") === "1";

const formatPrice = (n) => Math.round(n).toLocaleString("uk-UA");

const OrderBar = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { frontCanvas, backCanvas } = useCanvas();
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const printSize = useSelector((state) => state.tshirt.printSize);
  const canvasSize = useSelector((state) => state.tshirt.canvasSize);
  const slimBookFormat = useSelector((state) => state.tshirt.slimBookFormat);
  const slimBookSpreads = useSelector((state) => state.tshirt.slimBookSpreads);
  const slimBookExtra = useSelector((state) => state.tshirt.slimBookExtra);
  const slimBookPhotos = useSelector((state) => state.tshirt.slimBookPhotos || []);
  const quantity = useSelector((state) => state.tshirt.quantity);
  const cartItems = useSelector((state) => state.tshirt.cartItems || []);
  const { addCurrentDesignToCart, hasDesign } = useAddToCart();
  const { priceFor, tshirtPrice, canvasPrice, slimBookPrice } = usePricing();
  const spreadInputRef = useRef(null);

  // Скільки об'єктів на кожній стороні — щоб знати, чи друкуємо обидві сторони
  // (друга сторона додає ціну з прайсу). Реактивно слухаємо обидва полотна.
  const [counts, setCounts] = useState({ front: 0, back: 0 });
  useEffect(() => {
    const subs = [];
    const attach = (canvas, key) => {
      if (!canvas) return;
      const update = () =>
        setCounts((c) => ({ ...c, [key]: canvas.getObjects?.().length || 0 }));
      update();
      canvas.on("object:added", update);
      canvas.on("object:removed", update);
      subs.push(() => {
        canvas.off("object:added", update);
        canvas.off("object:removed", update);
      });
    };
    attach(frontCanvas, "front");
    attach(backCanvas, "back");
    return () => subs.forEach((fn) => fn());
  }, [frontCanvas, backCanvas]);

  // У режимі вбудовування (адмінка зберігає дизайн) панель замовлення не потрібна.
  if (isEmbed()) return null;

  const isTshirt = selectedType === "crew-neck";
  const isCanvas = selectedType === "canvas";
  const isSlimBook = selectedType === "slim-book";
  const bothSides = counts.front > 0 && counts.back > 0;

  // Ціна: футболка — з прайсу (колір+формат+2 сторони), решта — з каталогу.
  let unit = null;
  let total = null;
  let compareTotal = null;
  let secondNote = null;
  if (isTshirt) {
    const tp = tshirtPrice({ color: tshirtColor, printSize, bothSides });
    if (tp) {
      unit = tp.total;
      total = tp.total * quantity;
      if (tp.second > 0) secondNote = `вкл. 2-у сторону +${formatPrice(tp.second)} ₴`;
    }
  } else if (isCanvas) {
    const cp = canvasPrice(canvasSize);
    if (cp != null) {
      unit = cp;
      total = cp * quantity;
      secondNote = `Полотно ${canvasSize.replace("x", "×")} см`;
    }
  } else if (isSlimBook) {
    const sp = slimBookPrice({ format: slimBookFormat, spreads: slimBookSpreads, extra: slimBookExtra });
    if (sp != null) {
      unit = sp;
      total = sp * quantity;
      const totalSpreads = Number(slimBookSpreads) + Number(slimBookExtra || 0);
      secondNote = `${totalSpreads} розворотів · фото: ${slimBookPhotos.length}`;
    }
  } else {
    const p = priceFor(selectedType);
    if (p) {
      unit = p.price;
      total = p.price * quantity;
      if (p.compare_at_price && p.compare_at_price > p.price) {
        compareTotal = p.compare_at_price * quantity;
      }
    }
  }

  // Стиснення фото розвороту: даунскейл до 2400px по довшій стороні, JPEG 0.88 —
  // якість достатня для друку книги, payload лишається помірним.
  const compressPhoto = (file) =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const MAX = 2400;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          c.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/jpeg", 0.88));
        };
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });

  const handleSpreadPhotos = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (!files.length) return;
    const urls = (await Promise.all(files.map(compressPhoto))).filter(Boolean);
    if (urls.length) dispatch(addSlimBookPhotos(urls));
  };

  const handleOrder = async () => {
    if (hasDesign()) {
      const res = await addCurrentDesignToCart(); // додавання відкриває кошик
      if (res === "exists") dispatch(toggleCart(true)); // вже в кошику — просто відкрити
    } else if (cartItems.length > 0) {
      dispatch(toggleCart(true));
    } else {
      toast({
        variant: "destructive",
        title: "Спочатку додайте фото",
        description: "Натисніть на товар і завантажте фото, перш ніж замовляти.",
        duration: 3000,
      });
    }
  };

  return (
    <div className="sticky bottom-0 z-30 glass border-t border-border/60 shadow-elevated">
      <div className="mx-auto max-w-7xl px-3 py-2 md:px-8 md:py-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-5">
        {/* Опції: колір, формат друку, кількість */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Футболка Soft Style: лише біла/чорна, з ціною біля кожного кольору */}
        {isTshirt && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Колір
            </span>
            <div className="flex items-center gap-1.5">
              {TSHIRT_COLORS.map(({ hex, label }) => {
                const cp = tshirtPrice({ color: hex, printSize, bothSides: false });
                const active = tshirtColor?.toUpperCase() === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => dispatch(setTshirtColor(hex))}
                    className={cn(
                      "flex items-center gap-1.5 h-8 pl-1.5 pr-2.5 rounded-lg border transition-all",
                      active
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-border/60 hover:border-primary/40 hover:bg-muted"
                    )}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-black/15 shadow-sm"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-xs font-semibold whitespace-nowrap">
                      {label}
                      {cp ? ` · ${formatPrice(cp.base)} ₴` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Звичайна чашка: колір ВСЕРЕДИНІ (наявні кольори). «Хамелеон» — без вибору (чорна). */}
        {!isTshirt && mugHasInnerColor(selectedType) && (
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Колір всередині
            </span>
            <div className="flex flex-wrap items-center gap-1.5 max-w-[300px]">
              {MUG_INNER_COLORS.map(({ hex, label }) => (
                <button
                  key={hex}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => dispatch(setTshirtColor(hex))}
                  className={cn(
                    "w-7 h-7 rounded-full border shadow-sm transition-transform hover:scale-110",
                    tshirtColor?.toUpperCase() === hex.toUpperCase()
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background border-white"
                      : "border-white/70 ring-1 ring-border/50"
                  )}
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Формат друку А4/А3 (тільки футболка — впливає на ціну з прайсу) */}
        {isTshirt && (
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Друк
            </span>
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              {["A4", "A3"].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => dispatch(setPrintSize(sz))}
                  className={cn(
                    "h-8 px-3 text-sm font-semibold transition-colors",
                    printSize === sz
                      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                      : "bg-transparent text-foreground/80 hover:bg-muted"
                  )}
                >
                  {sz === "A4" ? "А4" : "А3"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Slim Book: кіл-ть розворотів (+дод.) та фото для внутрішніх сторінок */}
        {isSlimBook && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Розвороти
              </span>
              <div className="flex rounded-lg border border-border/60 overflow-hidden">
                {SLIMBOOK_SPREADS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => dispatch(setSlimBookSpreads(n))}
                    className={cn(
                      "h-8 px-3 text-sm font-semibold transition-colors",
                      Number(slimBookSpreads) === n
                        ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white"
                        : "bg-transparent text-foreground/80 hover:bg-muted"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                  onClick={() => dispatch(setSlimBookExtra(slimBookExtra - 1))} disabled={slimBookExtra <= 0}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs font-semibold tabular-nums w-9 text-center">+{slimBookExtra}</span>
                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg"
                  onClick={() => dispatch(setSlimBookExtra(slimBookExtra + 1))}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input type="file" accept="image/*" multiple ref={spreadInputRef} onChange={handleSpreadPhotos} className="hidden" />
              <Button type="button" variant="outline" className="h-8 rounded-lg gap-1.5"
                onClick={() => spreadInputRef.current?.click()}>
                <Images className="h-4 w-4" />
                <span className="text-xs font-semibold">Фото розворотів</span>
              </Button>
              {slimBookPhotos.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-semibold text-violet-700">
                  {slimBookPhotos.length}
                  <button type="button" title="Очистити" onClick={() => dispatch(clearSlimBookPhotos())}
                    className="text-muted-foreground hover:text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          </>
        )}

        {/* Кількість */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => dispatch(setQuantity(quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => dispatch(setQuantity(quantity + 1))}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        </div>

        {/* Ціна + кнопка замовлення (на мобільному — окремий рядок на всю ширину) */}
        <div className="flex items-center gap-3 lg:ml-auto">
          {/* Ціна в моменті */}
          <div className="flex flex-col leading-tight">
          {total != null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-xl md:text-2xl font-extrabold text-foreground">
                  {formatPrice(total)} ₴
                </span>
                {compareTotal && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(compareTotal)} ₴
                  </span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {secondNote
                  ? secondNote
                  : quantity > 1
                  ? `${formatPrice(unit)} ₴ × ${quantity}`
                  : "разом"}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground max-w-[160px]">
              Ціну розрахуємо при оформленні
            </span>
          )}
        </div>

          {/* Кнопка «Замовити!» — на мобільному займає весь залишок рядка (зручно пальцем) */}
          <Button
            onClick={handleOrder}
            className="flex-1 lg:flex-none h-12 rounded-xl px-6 text-base font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-glow"
          >
            <ShoppingCart className="h-5 w-5" />
            Замовити!
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderBar;
