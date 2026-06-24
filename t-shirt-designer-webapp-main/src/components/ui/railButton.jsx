// Єдиний стиль кнопки-інструмента по периметру редактора (іконка + підпис).
// Раніше цей рядок-клас був скопійований у ~10 файлах і встиг розійтися; тепер —
// одне джерело правди.
//
//  • Розміри ≈ на 30% дрібніші за попередні (h-10 замість h-14) — щоб лишити більше
//    місця холсту. Іконки всередині зменшуємо одразу для ВСІХ кнопок через
//    дескриптор `[&_svg]` (перекриває локальні h-5/w-5 у компонентах — не треба
//    редагувати кожен інструмент окремо).
//  • data-[state=open] (його ставить Radix Popover на тригері) підсвічує активний
//    інструмент, поки його панель відкрита — видно, який інструмент обрано.
const BASE =
  "group/rail flex flex-col items-center justify-center gap-0.5 h-10 w-10 lg:w-12 shrink-0 rounded-lg border transition-all [&_svg]:h-3.5 [&_svg]:w-3.5";

export const RAIL_BTN =
  `${BASE} border-border/70 bg-card text-foreground/80 hover:border-primary/40 hover:bg-muted hover:text-foreground ` +
  "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-border/70 disabled:hover:bg-card " +
  "data-[state=open]:border-primary data-[state=open]:bg-primary/10 data-[state=open]:text-primary data-[state=open]:ring-1 data-[state=open]:ring-primary/30";

export const RAIL_BTN_DANGER =
  `${BASE} border-red-500/30 bg-red-500/5 text-red-500 hover:bg-red-500/10 ` +
  "disabled:opacity-40 disabled:cursor-not-allowed";

// Кнопка-інструмент з негайною дією (Фото/Текст/Лінія/Видалити…). Інструменти-
// випадайки (Колаж/Маска/Рамка…) використовують RAIL_BTN напряму на своєму тригері.
export function ToolBtn({ icon: Icon, label, onClick, danger, disabled, ...rest }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={danger ? RAIL_BTN_DANGER : RAIL_BTN}
      {...rest}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  );
}
