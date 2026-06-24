import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Minus, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCanvas } from "@/hooks/useCanvas";
import { setTshirtColor, setPrintSize, setQuantity, toggleCart, setSlimBookSpreads, setSlimBookExtra } from "@/features/tshirtSlice";
import { TSHIRT_COLORS, MUG_INNER_COLORS, SLIMBOOK_SPREADS, isBookType, bookUnit, isMultiPhoto } from "@/constants/designConstants";
import { useAddToCart } from "@/hooks/useAddToCart";
import { usePricing } from "@/hooks/usePricing";
import { cn } from "@/lib/utils";
import { canvasSyncManager } from "@/utils/canvasSyncManager";
import PhotobookPreview from "@/components/PhotobookPreview";

// Вибір кольору ВСЕРЕДИНІ — лише для «Чашка кольорова всередині». Біла = тільки біла,
// «хамелеон» = тільки чорна, тож у них вибору кольору немає.
const mugHasInnerColor = (type) => type === "mug-color";

const isEmbed = () =>
  new URLSearchParams(window.location.search).get("embed") === "1";

const formatPrice = (n) => Math.round(n).toLocaleString("uk-UA");

const OrderBar = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const { frontCanvas, backCanvas, getCanvas } = useCanvas();
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
  const { priceFor, tshirtPrice, canvasPrice, bookPrice, photoDiscountPct } = usePricing();
  // Кнопки «Фото розворотів»/«Передперегляд» переїхали в конструктор (поряд з
  // обкладинками). Передперегляд відкриваємо звідти через подію — стан/модалка
  // лишаються тут (мають доступ до полотен). Ref тримає актуальний openPreview,
  // щоб слухач (зареєстрований раз, ДО можливого early-return) кликав свіжу версію.
  const openPreviewRef = useRef(null);
  useEffect(() => {
    const open = () => openPreviewRef.current?.();
    window.addEventListener("mm:open-preview", open);
    return () => window.removeEventListener("mm:open-preview", open);
  }, []);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMin, setPreviewMin] = useState(false);
  const [coverImage, setCoverImage] = useState(null);
  const [backCoverImage, setBackCoverImage] = useState(null);
  const [spreadPreviews, setSpreadPreviews] = useState([]); // відрендерені розвороти для прев'ю
  const [adding, setAdding] = useState(null); // {done,total} під час підготовки позиції (рендер фото) перед кошиком

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

  // «Дод. розвороти» (extra) повністю похідні від кількості фото понад базу (10/15):
  // extra = max(0, фото − база). Раніше це був ручний «+» степпер → клієнт міг
  // завантажити 20 фото, а заплатити за 10. Тепер ціна рахує кожне фото автоматично.
  // Точне присвоєння (не лише підняття): при базі 15 та 12 фото extra=0, не лишок.
  // Без зациклення: needed === extra → без повторного dispatch.
  useEffect(() => {
    if (!isBookType(selectedType)) return;
    const needed = Math.max(0, slimBookPhotos.length - Number(slimBookSpreads));
    if (needed !== Number(slimBookExtra || 0)) dispatch(setSlimBookExtra(needed));
  }, [selectedType, slimBookPhotos.length, slimBookSpreads, slimBookExtra, dispatch]);

  // У режимі вбудовування (адмінка зберігає дизайн) панель замовлення не потрібна.
  if (isEmbed()) return null;

  const isTshirt = selectedType === "crew-neck";
  const isCanvas = selectedType === "canvas";
  const isBook = isBookType(selectedType);
  const isMulti = isMultiPhoto(selectedType); // фото-формат: друк пачки фото
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
  } else if (isBook) {
    const sp = bookPrice({ type: selectedType, format: slimBookFormat, spreads: slimBookSpreads, extra: slimBookExtra });
    if (sp != null) {
      unit = sp;
      total = sp * quantity;
      const totalSpreads = Number(slimBookSpreads) + Number(slimBookExtra || 0);
      secondNote = `${totalSpreads} ${bookUnit(selectedType)} · фото: ${slimBookPhotos.length}`;
    }
  } else if (isMulti) {
    // Пачка фото: ціна = (к-ть фото) × ціна формату − знижка за кількістю (з адмінки).
    const p = priceFor(selectedType);
    if (p) {
      const n = Math.max(1, slimBookPhotos.length);
      unit = p.price;
      const gross = p.price * n;
      const pct = photoDiscountPct(slimBookPhotos.length);
      total = pct ? Math.round(gross * (1 - pct / 100)) : gross;
      if (pct) compareTotal = gross;
      secondNote = slimBookPhotos.length > 0
        ? `${slimBookPhotos.length} фото × ${formatPrice(p.price)} ₴${pct ? ` · знижка −${pct}%` : ""}`
        : "завантажте фото для друку";
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

  const openPreview = () => {
    setCoverImage(frontCanvas ? canvasSyncManager.getCanvasTexture(frontCanvas) : null);
    setBackCoverImage(backCanvas ? canvasSyncManager.getCanvasTexture(backCanvas) : null);
    // Прев'ю показує ВІДРЕДАГОВАНІ розвороти: рендеримо кожен холст-розворот.
    // Фолбек — вихідне завантажене фото, якщо холста немає.
    setSpreadPreviews(
      slimBookPhotos.map((photo, i) => {
        const c = getCanvas(selectedType, `spread-${i}`);
        return (c && canvasSyncManager.getCanvasTexture(c)) || photo;
      })
    );
    setPreviewMin(false);
    setPreviewOpen(true);
  };
  openPreviewRef.current = openPreview; // тримаємо актуальну версію для слухача події

  const handleOrder = async () => {
    if (adding) return; // вже готуємо — не дублюємо
    if (hasDesign()) {
      // Багато фото → рендер кожного може зайняти час. Показуємо прогрес підготовки,
      // щоб кнопка не виглядала «завислою». Прогрес вивантаження на сервер — у кошику.
      setAdding({ done: 0, total: isMulti ? Math.max(1, slimBookPhotos.length) : 1 });
      try {
        const res = await addCurrentDesignToCart((p) => setAdding(p)); // додавання відкриває кошик
        if (res === "exists") dispatch(toggleCart(true)); // вже в кошику — просто відкрити
      } finally {
        setAdding(null);
      }
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
    <div className="sticky bottom-0 z-30 glass border-t border-border/60 shadow-elevated" data-tour="order">
      <div className="mx-auto max-w-7xl px-3 py-1 md:px-6 md:py-1.5 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-4">
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

        {/* Фотокнига: кіл-ть розворотів/листів (+дод.) та фото для внутрішніх сторінок */}
        {isBook && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedType === "print-book" ? "Листи" : "Розвороти"}
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
              {slimBookExtra > 0 && (
                <span
                  className="text-[11px] font-semibold tabular-nums text-violet-700 whitespace-nowrap"
                  title="Додаткові розвороти понад базу — рахуються автоматично за кількістю фото"
                >
                  +{slimBookExtra} дод.
                </span>
              )}
            </div>

            {/* «Фото розворотів» і «Передперегляд» — тепер у конструкторі, поряд з обкладинками */}
          </>
        )}

        {/* «Багато фото» прибрано — фото пачки завантажуються інструментом «Фото»
            в конструкторі (він приймає кілька файлів), а кожне фото видаляється
            хрестиком у каруселі. Тут дублювати не потрібно. */}

        {/* Кількість — для пачки фото ховаємо (к-ть = число завантажених фото) */}
        {!isMulti && (
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
        )}
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

          {/* Кнопка «Замовити!» — на мобільному займає весь залишок рядка (зручно пальцем).
              При підготовці позиції (рендер багатьох фото) показуємо прогрес, щоб не виглядало завислим. */}
          <Button
            onClick={handleOrder}
            disabled={!!adding}
            className="flex-1 lg:flex-none h-9 rounded-lg px-5 text-sm font-bold bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0 shadow-glow disabled:opacity-80"
          >
            {adding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {adding.total > 1 ? `Готуємо ${adding.done}/${adding.total}…` : "Готуємо…"}
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Замовити!
              </>
            )}
          </Button>
        </div>
      </div>

      <PhotobookPreview
        open={previewOpen}
        minimized={previewMin}
        onClose={() => { setPreviewOpen(false); setPreviewMin(false); }}
        onMinimize={() => setPreviewMin(true)}
        onRestore={() => setPreviewMin(false)}
        coverImage={coverImage}
        backCoverImage={backCoverImage}
        photos={spreadPreviews.length ? spreadPreviews : slimBookPhotos}
        readOnly
        format={slimBookFormat}
        spreads={slimBookSpreads}
        extra={slimBookExtra}
        unit={bookUnit(selectedType)}
      />
    </div>
  );
};

export default OrderBar;
