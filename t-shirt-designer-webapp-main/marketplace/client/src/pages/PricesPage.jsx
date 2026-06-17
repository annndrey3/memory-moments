import { useEffect, useMemo, useRef, useState } from "react";
import {
  Instagram, Info, Tag, Loader2, List, X, ChevronDown,
  ChevronLeft, ChevronRight,
  Camera, Palette, Printer, Gift, BookOpen, CreditCard, Layers, Maximize2,
} from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Badge } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { api } from "@/lib/api";
import { useSeo } from "@/lib/seo";

const TERMS = [
  "Термін виготовлення книг — 5 робочих днів після затвердження макета.",
  "Термін виготовлення візиток — 4-5 робочих днів після затвердження макета.",
  "Термін виготовлення замовлень — 1-2 робочих дні після затвердження макета.",
  "Замовлення прийняті до 16:00 будуть готові наступного дня, після 16:00 — через день.",
  "Сувенірна продукція та широкоформатний друк від 30×40, прийняті в пʼятницю після 15:00, будуть готові у вівторок.",
  "Мінімальне замовлення — від 100 грн. Акційна ціна діє при замовленні від 40 фото.",
  "Від 200 фотографій — знижка 10%, від 300 фото — безкоштовна доставка.",
];

// Групуємо послуги категорії за назвою (формати — під спільною назвою).
function groupByName(services) {
  const groups = [];
  const index = {};
  for (const s of services) {
    if (index[s.name] === undefined) {
      index[s.name] = groups.length;
      groups.push({ name: s.name, code: s.code, rows: [] });
    }
    groups[index[s.name]].rows.push(s);
  }
  return groups;
}

// Category → icon + wood texture background
const CAT_META = [
  { match: "фото друк",  icon: Camera,     img: "/bg/bg-wood-01.jpg" },
  { match: "дизайн",     icon: Palette,    img: "/bg/bg-wood-05.jpg" },
  { match: "додатков",   icon: Layers,     img: "/bg/bg-wood-09.jpg" },
  { match: "поліграф",   icon: Printer,    img: "/bg/bg-wood-03.jpg" },
  { match: "фотопапір",  icon: Maximize2,  img: "/bg/bg-wood-06.jpg" },
  { match: "полотно",    icon: Maximize2,  img: "/bg/bg-wood-07.jpg" },
  { match: "сувенір",    icon: Gift,       img: "/bg/bg-wood-04.jpg" },
  { match: "print",      icon: BookOpen,   img: "/bg/bg-wood-10.jpg" },
  { match: "slim",       icon: BookOpen,   img: "/bg/bg-wood-08.jpg" },
  { match: "візитк",     icon: CreditCard, img: "/bg/bg-wood-02.jpg" },
  { match: "пвх",        icon: Layers,     img: "/bg/bg-wood-07.jpg" },
];
function getCategoryMeta(name) {
  const n = name.toLowerCase();
  return CAT_META.find((m) => n.includes(m.match))
    ?? { icon: Tag, colors: ["#7c3aed", "#a21caf"] };
}

export default function PricesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const fabRef = useRef(null);

  useSeo({
    title: "Ціни на послуги",
    description:
      "Прайс Memory Moments: фотодрук, поліграфія, широкоформатний друк, сувенірна продукція та фотокниги.",
  });

  useEffect(() => {
    api
      .getServices()
      .then((data) => setCategories(data.categories || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.services.length > 0),
    [categories]
  );

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!fabRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  // Slideshow auto-advance
  const totalSlides = 1 + visibleCategories.length;
  useEffect(() => {
    if (loading || totalSlides <= 1 || paused) return;
    const t = setInterval(() => setActiveSlide((p) => (p + 1) % totalSlides), 3500);
    return () => clearInterval(t);
  }, [loading, totalSlides, paused]);

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />

      {/* ── Mobile sticky category strip (below header) ── */}
      {!loading && visibleCategories.length > 0 && (
        <div ref={fabRef} className="lg:hidden sticky top-16 z-20">
          {/* strip bar */}
          <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 py-2.5 text-sm font-semibold text-slate-700 hover:text-violet-600 transition-colors w-full"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <List className="h-4 w-4" />}
              <span>Категорії</span>
              <ChevronDown
                className={`h-3.5 w-3.5 ml-0.5 transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* dropdown panel */}
          {menuOpen && (
            <div className="bg-white border-b border-slate-200 shadow-lg">
              <div className="grid grid-cols-2 p-3 gap-1 max-h-[55vh] overflow-y-auto">
                {visibleCategories.map((c, i) => (
                  <a
                    key={c.id}
                    href={`#cat-${i}`}
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl px-3 py-3 text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 active:bg-violet-100 transition-colors leading-tight"
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* ── Slideshow banner ── */}
        <section
          className="mb-8 relative overflow-hidden rounded-2xl h-52 sm:h-48 animate-fade-in-up"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Slide 0 – hero */}
          <div
            className={`absolute inset-0 transition-opacity duration-700 ease-in-out
              ${activeSlide === 0 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            style={{
              backgroundImage: "url(/bg/bg-wood-05.jpg)",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            {/* light violet overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/80 to-violet-50/90" />
            <div className="relative z-10 h-full flex flex-col justify-center px-7 md:px-10">
              <div className="flex items-center gap-2 text-violet-600 mb-2">
                <Tag className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Прайс</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Ціни на <span className="text-gradient-animated">послуги</span>
              </h1>
              <p className="mt-1.5 text-slate-600 text-sm max-w-lg">
                Фотодрук, поліграфія, широкоформатний друк,&nbsp;
                сувенірна продукція та фотокниги.
              </p>
            </div>
          </div>

          {/* Category slides */}
          {visibleCategories.map((cat, i) => {
            const meta = getCategoryMeta(cat.name);
            const Icon = meta.icon;
            return (
              <div
                key={cat.id}
                className={`absolute inset-0 transition-opacity duration-700 ease-in-out
                  ${activeSlide === i + 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                style={{
                  backgroundImage: `url(${meta.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {/* dark gradient from left — ensures text is readable on any texture */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-black/5" />

                <div className="relative z-10 h-full flex items-center px-7 md:px-10 gap-5">
                  <div className="flex-shrink-0 h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <Icon className="h-7 w-7 text-white drop-shadow" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white/65 text-xs font-semibold uppercase tracking-wider mb-1">
                      {cat.services.length} послуг
                    </p>
                    <h2 className="text-white font-bold text-lg md:text-xl leading-snug line-clamp-2 drop-shadow">
                      {cat.name}
                    </h2>
                    <a
                      href={`#cat-${i}`}
                      onClick={() => setMenuOpen(false)}
                      className="mt-1.5 inline-flex items-center gap-1 text-white/75 text-xs hover:text-white transition-colors"
                    >
                      Переглянути ціни
                      <ChevronRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Prev / Next arrows */}
          {totalSlides > 1 && (
            <>
              <button
                onClick={() => { setPaused(true); setActiveSlide((p) => (p - 1 + totalSlides) % totalSlides); }}
                className={`absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center transition-colors
                  ${activeSlide === 0
                    ? "bg-violet-100/80 hover:bg-violet-200/80 text-violet-700"
                    : "bg-white/20 hover:bg-white/35 text-white"}`}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setPaused(true); setActiveSlide((p) => (p + 1) % totalSlides); }}
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full flex items-center justify-center transition-colors
                  ${activeSlide === 0
                    ? "bg-violet-100/80 hover:bg-violet-200/80 text-violet-700"
                    : "bg-white/20 hover:bg-white/35 text-white"}`}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Dot indicators */}
          {totalSlides > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => { setPaused(true); setActiveSlide(i); }}
                  className={`h-1.5 rounded-full transition-all duration-300
                    ${i === activeSlide
                      ? "w-5 " + (activeSlide === 0 ? "bg-violet-500" : "bg-white")
                      : "w-1.5 " + (activeSlide === 0 ? "bg-slate-300 hover:bg-slate-400" : "bg-white/40 hover:bg-white/70")}`}
                />
              ))}
            </div>
          )}
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          <div className="grid lg:grid-cols-[220px_1fr] gap-8">
            {/* Sticky category nav */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Категорії
                </p>
                {visibleCategories.map((c, i) => (
                  <a
                    key={c.id}
                    href={`#cat-${i}`}
                    className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-all duration-200 hover:translate-x-1"
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            </aside>

            {/* Categories */}
            <div className="space-y-8 min-w-0">
              {visibleCategories.map((cat, i) => {
                const hasInsta = cat.services.some((s) => s.price_insta != null);
                const groups = groupByName(cat.services);
                return (
                  <section
                    key={cat.id}
                    id={`cat-${i}`}
                    className="scroll-mt-[6.5rem] lg:scroll-mt-24 animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}
                  >
                    <div className="rounded-2xl border border-slate-200 bg-white shadow-soft overflow-hidden transition-shadow hover:shadow-elevated">
                      <div className="px-5 py-4 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50 border-b border-slate-200">
                        <h2 className="font-bold text-slate-900">{cat.name}</h2>
                      </div>

                      {/* Column header */}
                      <div className="hidden sm:flex items-center px-5 py-2 text-xs font-medium uppercase tracking-wide text-slate-400 border-b border-slate-100">
                        <div className="flex-1">Послуга</div>
                        <div className="w-28 text-right">Роздріб</div>
                        {hasInsta && (
                          <div className="w-28 text-right flex items-center justify-end gap-1">
                            <Instagram className="h-3.5 w-3.5" /> Instagram
                          </div>
                        )}
                      </div>

                      <div className="divide-y divide-slate-100">
                        {groups.map((g, gi) => (
                          <div key={gi} className="px-5 py-3">
                            <p className="font-medium text-slate-800">{g.name}</p>
                            <div className="mt-1 space-y-1">
                              {g.rows.map((s) => (
                                <div
                                  key={s.id}
                                  className="flex items-center gap-3 text-sm"
                                >
                                  <div className="flex-1 text-slate-500">
                                    {s.format || (g.rows.length > 1 ? "—" : "")}
                                  </div>
                                  <div className="w-28 text-right font-semibold text-slate-900">
                                    {s.price != null ? formatPrice(s.price) : "—"}
                                  </div>
                                  {hasInsta && (
                                    <div className="w-28 text-right">
                                      {s.price_insta != null ? (
                                        <span className="text-violet-600 font-medium">
                                          {formatPrice(s.price_insta)}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300">—</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}

              {/* Terms */}
              <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 animate-fade-in-up">
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-5 w-5 text-amber-600" />
                  <h2 className="font-semibold text-slate-900">Умови та терміни</h2>
                </div>
                <ul className="space-y-1.5 text-sm text-slate-600 list-disc pl-5">
                  {TERMS.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                <p className="mt-3">
                  <Badge variant="success">Ціни в гривнях (₴)</Badge>
                </p>
              </section>
            </div>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
