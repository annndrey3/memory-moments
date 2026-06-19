import { useSelector, useDispatch } from "react-redux";
import { ShoppingCart, Trash2, Plus, Minus, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toggleCart, removeFromCart, updateQuantity, clearCart } from "@/features/tshirtSlice";
import { sendOrderToMarketplace } from "@/utils/canvasSyncManager";
import { useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

const MARKETPLACE_URL = import.meta.env.VITE_MARKETPLACE_URL || "http://localhost:5174";

// Відділення для самовивозу — ті самі, що в маркетплейс-чекауті.
const PICKUP_BRANCHES = [
  "просп. Князя Ярослава Мудрого, 14/4, Одеса",
  "вул. Академіка Корольова, 70/1, Одеса",
  "вул. Преображенська, 48, Одеса",
  "вул. Артура Савельєва, 12, Одеса",
];

const Header = () => {
  const dispatch = useDispatch();
  const { toast } = useToast();
  const cartItems = useSelector((state) => state.tshirt.cartItems || []);
  const isCartOpen = useSelector((state) => state.tshirt.isCartOpen || false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [deliveryType, setDeliveryType] = useState("nova_poshta");
  const [pickupBranch, setPickupBranch] = useState(PICKUP_BRANCHES[0]);
  const [novaPoshtaAddress, setNovaPoshtaAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Стабільний ключ ідемпотентності: генерується раз на спробу оформлення й
  // переживає повтори (після помилки), щоб таймаут-ретрай не плодив дублі заказу.
  const idemKeyRef = useRef(null);

  const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Формуємо рядок доставки так само, як у маркетплейс-чекауті.
  const buildShippingAddress = () => {
    if (deliveryType === "pickup") return `Самовивіз: ${pickupBranch}`;
    return novaPoshtaAddress.trim() || null;
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) {
      toast({ variant: "destructive", title: "Помилка", description: "Заповніть обов'язкові поля (Ім'я та Телефон)." });
      return;
    }
    if (deliveryType === "nova_poshta" && !novaPoshtaAddress.trim()) {
      toast({ variant: "destructive", title: "Помилка", description: "Вкажіть місто та відділення Нової Пошти." });
      return;
    }

    setIsSubmitting(true);
    // Ключ генеруємо раз і тримаємо в ref до успіху — повтори несуть той самий ключ.
    if (!idemKeyRef.current) {
      idemKeyRef.current = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    try {
      // Замовлення йде в маркетплейс-API: він зберігає його в адмінці
      // та сам надсилає сповіщення в Telegram (токен бота — лише на сервері).
      await sendOrderToMarketplace(
        cartItems,
        { name, phone, email, comment, address: buildShippingAddress() },
        idemKeyRef.current
      );
      idemKeyRef.current = null; // успіх — наступне замовлення отримає новий ключ
      toast({ title: "Успішно!", description: "Ваше замовлення відправлено!" });
      dispatch(clearCart());
      dispatch(toggleCart(false));
      setName("");
      setPhone("");
      setEmail("");
      setComment("");
      setNovaPoshtaAddress("");
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Помилка відправки", description: error.message || "Спробуйте ще раз." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex justify-between items-center gap-4 px-4 py-3 md:px-8 md:py-4">
      <div className="flex items-center gap-3 min-w-0">
        <picture>
          {/* BASE_URL = "/designer/" у проді — інакше лого шукається в корені домену (маркетплейс) і не вантажиться */}
          <source srcSet={`${import.meta.env.BASE_URL}logo-mm.webp`} type="image/webp" />
          <img
            src={`${import.meta.env.BASE_URL}logo-mm.png`}
            alt="Memory Moments"
            className="h-10 md:h-12 w-auto object-contain"
          />
        </picture>
        <p className="hidden lg:block max-w-xs text-xs md:text-sm text-muted-foreground leading-snug">
          Створіть унікальний дизайн для футболки, чашки чи фотоформату
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0 font-brand tracking-wide">
        <a href={MARKETPLACE_URL} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="lg" className="rounded-xl border-border/60 shadow-sm hover:border-primary/30 hidden sm:inline-flex">
            <Store className="h-5 w-5" />
            <span className="ml-1">Маркетплейс</span>
          </Button>
          <Button variant="outline" size="icon" className="rounded-xl sm:hidden">
            <Store className="h-5 w-5" />
          </Button>
        </a>

      <Sheet open={isCartOpen} onOpenChange={(open) => dispatch(toggleCart(open))}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="lg"
            className="relative rounded-xl border-border/60 shadow-sm hover:shadow-soft hover:border-primary/30 transition-all"
          >
            <ShoppingCart className="h-5 w-5" />
            <span className="hidden sm:inline ml-1">Кошик</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center shadow-glow">
                {totalItems}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:w-[480px] flex flex-col">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-xl">Ваш кошик ({totalItems})</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-hidden mt-2">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-3">
                <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium">Кошик порожній</p>
                <p className="text-sm text-center max-w-[240px]">
                  Додайте дизайн до кошика, щоб оформити замовлення
                </p>
              </div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="flex flex-col gap-3">
                  {cartItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-4 border border-border/60 p-3 rounded-xl bg-card shadow-sm hover:shadow-soft transition-shadow"
                    >
                      <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0 ring-1 ring-border/50">
                        {item.designTextureFront ? (
                          <img src={item.designTextureFront} alt="design" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Без макета</div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm line-clamp-2">{item.productName}</h4>
                            {item.variantLabel && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.variantLabel}</p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => dispatch(removeFromCart(item.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: Math.max(1, item.quantity - 1) }))}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 rounded-lg"
                            onClick={() => dispatch(updateQuantity({ id: item.id, quantity: item.quantity + 1 }))}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {cartItems.length > 0 && (
            <div className="mt-4 border-t border-border/60 pt-5">
              <form onSubmit={handleOrderSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Ім'я *</Label>
                  <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Введіть ваше ім'я" className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Телефон *</Label>
                  <Input id="phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+38 (000) 000-00-00" className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" className="rounded-lg" />
                </div>
                <div className="space-y-1.5">
                  <Label>Спосіб отримання *</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={deliveryType === "nova_poshta" ? "default" : "outline"}
                      className="flex-1 rounded-lg"
                      onClick={() => setDeliveryType("nova_poshta")}
                    >
                      Нова Пошта
                    </Button>
                    <Button
                      type="button"
                      variant={deliveryType === "pickup" ? "default" : "outline"}
                      className="flex-1 rounded-lg"
                      onClick={() => setDeliveryType("pickup")}
                    >
                      Самовивіз
                    </Button>
                  </div>
                </div>
                {deliveryType === "nova_poshta" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="np">Місто та відділення Нової Пошти *</Label>
                    <Input
                      id="np"
                      value={novaPoshtaAddress}
                      onChange={(e) => setNovaPoshtaAddress(e.target.value)}
                      placeholder="Наприклад: Одеса, відділення № 5"
                      className="rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="branch">Оберіть філіал</Label>
                    <select
                      id="branch"
                      value={pickupBranch}
                      onChange={(e) => setPickupBranch(e.target.value)}
                      className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {PICKUP_BRANCHES.map((addr) => (
                        <option key={addr} value={addr}>
                          {addr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="comment">Коментар</Label>
                  <Input id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Побажання до замовлення" className="rounded-lg" />
                </div>
                <Button type="submit" className="w-full rounded-xl h-11 shadow-glow" disabled={isSubmitting}>
                  {isSubmitting ? "Відправка..." : "Оформити замовлення"}
                </Button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
      </div>
    </div>
  );
};

export default Header;
