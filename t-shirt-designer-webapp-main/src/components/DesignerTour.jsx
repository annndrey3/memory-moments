import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";

// Підсвічуване навчання для нових відвідувачів конструктора. З'являється один раз
// (зберігається у localStorage), має кнопку «Пропустити» і плаваючу кнопку
// «Підказки», щоб запустити повторно. Без зовнішніх залежностей.
const SEEN_KEY = "mm_designer_tour_v2";

// Повний гайд по конструктору. Кроки, чий елемент відсутній у поточному режимі,
// автоматично пропускаються (фільтр нижче), тож один список покриває всі товари.
const STEPS = [
  {
    sel: '[data-tour="product"]',
    title: "Оберіть товар",
    text: "Спершу виберіть, що персоналізуєте: футболку, чашку, фотодрук, полотно чи фотокнигу. Поряд зʼявляться розмір, формат друку та інші опції саме цього товару.",
  },
  {
    sel: '[title="Фото"]',
    title: "Додайте фото",
    text: "Завантажте своє зображення (або просто перетягніть його на макет). Порада: вантажте оригінал у високій якості — від цього залежить чіткість друку.",
  },
  {
    sel: '[title="Текст"]',
    title: "Додайте текст",
    text: "Натисніть і одразу друкуйте. Унизу під холстом зʼявиться віджет: шрифт, розмір, колір, жирний/курсив. Підтримуються українська та російська.",
  },
  {
    sel: '[title="Лінія"]',
    title: "Лінія",
    text: "Додайте лінію-роздільник. Її, як і будь-який обʼєкт, можна рухати, повертати й масштабувати.",
  },
  {
    sel: '[title="Маска фото"], [title="Оберіть фото для маски"]',
    title: "Маска (форма фото)",
    text: "Виділіть фото і виберіть форму — коло, серце, зірка тощо. Фото можна рухати всередині маски.",
  },
  {
    sel: '[title="Колаж"]',
    title: "Колаж із кількох фото",
    text: "Оберіть готову розкладку, далі натисніть на комірку (+) і додайте фото. Кожне фото рухається всередині своєї комірки.",
  },
  {
    sel: '[title="Рамка"]',
    title: "Рамки",
    text: "Прикрасьте дизайн однією з рамок (зокрема «Полароїд»). Рамка завжди лишається поверх фото. На полароїд/інстакс можна додати підпис, клікнувши по нижній смузі.",
  },
  {
    sel: '[title="Заливка / Градієнт"]',
    title: "Заливка та градієнт",
    text: "Додайте суцільний колір або градієнт — як фон під текст чи акцентну плашку.",
  },
  {
    sel: '[title="Фон"]',
    title: "Готові фони",
    text: "Накладіть готовий фон на весь формат — він ляже нижнім шаром під вашим дизайном.",
  },
  {
    sel: '[data-tour="undo"]',
    title: "Скасувати дію",
    text: "Помилились? Кнопка «Скасувати» над холстом (або Ctrl+Z) поверне попередній крок.",
  },
  {
    sel: '[title="Властивості"], [title="Налаштування тексту"], [title="Налаштування лінії"]',
    title: "Властивості шару",
    text: "Тонке налаштування активного обʼєкта: для тексту — шрифт і стиль, для лінії — товщина й колір.",
  },
  {
    sel: '[title="Прозорість"]',
    title: "Прозорість і дзеркало",
    text: "Змініть прозорість активного обʼєкта та віддзеркальте його по горизонталі/вертикалі.",
  },
  {
    sel: '[title="Шари"]',
    title: "Шари",
    text: "Усі обʼєкти макета — тут. Клікніть шар, щоб зробити його активним: рухати й змінювати на макеті можна ЛИШЕ активний шар. Шари можна ховати 👁, міняти порядок ↑↓ і видаляти.",
  },
  {
    sel: '[title="Видалити"]',
    title: "Видалити / Очистити",
    text: "«Видалити» прибирає вибраний обʼєкт, «Очистити» — весь макет. Також працює клавіша Delete.",
  },
  {
    sel: '[title="Завантажити макет"]',
    title: "Зберегти макет",
    text: "Завантажте прев'ю свого дизайну собі на пристрій — щоб зберегти або поділитися.",
  },
  {
    sel: '[data-tour="order"]',
    title: "Оформіть замовлення",
    text: "Ціна рахується в реальному часі. Коли все готово — натисніть «Замовити». Готово! 🎉",
  },
];

const PAD = 8; // відступ підсвічування навколо елемента

export default function DesignerTour() {
  const [active, setActive] = useState(false);
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);

  // Лише наявні на сторінці кроки (товар/рамка можуть бути відсутні в деяких режимах).
  const steps = STEPS.filter((s) => document.querySelector(s.sel));
  const step = steps[idx];

  const finish = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ }
    setActive(false);
    setIdx(0);
  }, []);

  const start = useCallback(() => { setIdx(0); setActive(true); }, []);

  // Кнопка «Підказки» у шапці конструктора запускає тур через подію вікна.
  useEffect(() => {
    const onStart = () => start();
    window.addEventListener("mm:start-tour", onStart);
    return () => window.removeEventListener("mm:start-tour", onStart);
  }, [start]);

  // Автозапуск один раз для нового відвідувача.
  useEffect(() => {
    let seen = "1";
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    if (!seen) {
      const t = setTimeout(() => setActive(true), 700); // дати редактору промалюватись
      return () => clearTimeout(t);
    }
  }, []);

  // Порахувати позицію підсвічування для поточного кроку.
  const measure = useCallback(() => {
    if (!active || !step) return;
    const el = document.querySelector(step.sel);
    if (!el) { setRect(null); return; }
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    setRect(el.getBoundingClientRect());
  }, [active, step]);

  useLayoutEffect(() => { measure(); }, [measure, idx]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => {
      const el = step && document.querySelector(step.sel);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, step]);

  // Esc — пропустити.
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, steps.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, finish, steps.length]);

  const next = () => (idx >= steps.length - 1 ? finish() : setIdx((i) => i + 1));
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  let overlay = null;
  if (active && step) {
    // Позиція картки-підказки: під елементом, якщо є місце, інакше над ним.
    const vh = window.innerHeight;
    const below = rect ? rect.bottom + 12 : vh / 2;
    const placeBelow = !rect || rect.bottom + 200 < vh;
    const cardStyle = rect
      ? placeBelow
        ? { top: Math.min(below, vh - 220), left: Math.max(12, Math.min(rect.left, window.innerWidth - 360)) }
        : { bottom: vh - rect.top + 12, left: Math.max(12, Math.min(rect.left, window.innerWidth - 360)) }
      : { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };

    overlay = createPortal(
      <div className="fixed inset-0 z-[9997]">
        {/* Ловець кліків — блокує взаємодію зі сторінкою під час навчання */}
        <div className="absolute inset-0" onClick={() => {}} />

        {/* Підсвічування елемента (затемнення навколо через box-shadow) */}
        {rect && (
          <div
            className="absolute rounded-xl ring-2 ring-violet-400 transition-all duration-300"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 9999px rgba(15,23,42,0.62)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Картка-підказка */}
        <div
          className="absolute z-[9999] w-[340px] max-w-[92vw] rounded-2xl border border-violet-200 bg-white p-4 shadow-elevated animate-fade-in-up"
          style={cardStyle}
        >
          <div className="mb-1.5 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            <p className="text-sm font-bold text-slate-900">{step.title}</p>
          </div>
          <p className="text-sm leading-snug text-slate-600">{step.text}</p>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={finish}
              className="text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Пропустити навчання
            </button>

            <div className="flex items-center gap-1.5">
              <span className="mr-1 text-[11px] tabular-nums text-slate-400">{idx + 1}/{steps.length}</span>
              {idx > 0 && (
                <button
                  type="button"
                  onClick={prev}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={next}
                className="flex h-8 items-center gap-1 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                {idx >= steps.length - 1 ? (<><Check className="h-4 w-4" /> Готово</>) : (<>Далі <ChevronRight className="h-4 w-4" /></>)}
              </button>
            </div>
          </div>

          {/* Закрити (хрестик) */}
          <button
            type="button"
            onClick={finish}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-500"
            aria-label="Закрити"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return overlay;
}
