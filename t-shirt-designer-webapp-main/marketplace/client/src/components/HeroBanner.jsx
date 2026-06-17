import { useEffect, useState } from "react";
import {
  ShoppingBag, Palette, ChevronLeft, ChevronRight,
  Shirt, Coffee, Package, Gift, Image, BookOpen,
} from "lucide-react";
import { Button } from "./ui";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5174";

// Wood backgrounds (same pool as PricesPage, skip bg-wood-02 — plain grey)
const BG_POOL = [
  "/bg/bg-wood-04.jpg",
  "/bg/bg-wood-01.jpg",
  "/bg/bg-wood-10.jpg",
  "/bg/bg-wood-09.jpg",
  "/bg/bg-wood-07.jpg",
  "/bg/bg-wood-08.jpg",
  "/bg/bg-wood-06.jpg",
  "/bg/bg-wood-03.jpg",
];

function getCatIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("футболк") || n.includes("одяг")) return Shirt;
  if (n.includes("кружк") || n.includes("чашк") || n.includes("муг")) return Coffee;
  if (n.includes("фото") || n.includes("print") || n.includes("друк")) return Image;
  if (n.includes("книг") || n.includes("book")) return BookOpen;
  if (n.includes("подушк") || n.includes("сувенір")) return Gift;
  return Package;
}

export function HeroBanner({ categories = [], onCategorySelect }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const totalSlides = 1 + categories.length;

  useEffect(() => {
    if (totalSlides <= 1 || paused) return;
    const t = setInterval(() => setActiveSlide((p) => (p + 1) % totalSlides), 3500);
    return () => clearInterval(t);
  }, [totalSlides, paused]);

  const goTo = (i) => { setPaused(true); setActiveSlide(i); };
  const prev = () => goTo((activeSlide - 1 + totalSlides) % totalSlides);
  const next = () => goTo((activeSlide + 1) % totalSlides);

  const isHero = activeSlide === 0;

  return (
    <section className="overflow-hidden flex flex-col items-center">

      {/* ── Slideshow image area ── */}
      <div
        className="relative w-full h-[340px] md:h-[460px] overflow-hidden select-none"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Slide 0 — hero logo on paper texture */}
        <div
          className={`absolute inset-0 transition-opacity duration-700
            ${isHero ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          style={{ backgroundImage: "url(/bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <img
            src="/hero-logo.png"
            alt="Memory Moments"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Category slides */}
        {categories.map((cat, i) => {
          const Icon = getCatIcon(cat.name);
          const bg   = BG_POOL[i % BG_POOL.length];
          return (
            <div
              key={cat.id}
              className={`absolute inset-0 transition-opacity duration-700
                ${activeSlide === i + 1 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              style={{ backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
              {/* text-readable gradient from left */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-black/5" />

              <div className="relative z-10 h-full flex items-center px-8 md:px-16 gap-6">
                <div className="flex-shrink-0 h-16 w-16 md:h-20 md:w-20 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
                  <Icon className="h-8 w-8 md:h-10 md:w-10 text-white drop-shadow" />
                </div>
                <div>
                  {cat.product_count > 0 && (
                    <p className="text-white/60 text-sm font-semibold uppercase tracking-wider mb-2">
                      {cat.product_count} товарів
                    </p>
                  )}
                  <h2 className="text-white font-bold text-3xl md:text-5xl drop-shadow leading-tight">
                    {cat.name}
                  </h2>
                  <button
                    onClick={() => { goTo(0); onCategorySelect?.(cat.slug); }}
                    className="mt-4 inline-flex items-center gap-2 text-white/80 text-sm hover:text-white transition-colors"
                  >
                    <ShoppingBag className="h-4 w-4" />
                    Переглянути товари
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Arrows */}
        {totalSlides > 1 && (
          <>
            <button
              onClick={prev}
              className={`absolute left-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full
                flex items-center justify-center transition-colors
                ${isHero
                  ? "bg-black/10 hover:bg-black/25 text-[#5a3020]"
                  : "bg-white/20 hover:bg-white/35 text-white"}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              className={`absolute right-3 top-1/2 -translate-y-1/2 z-20 h-9 w-9 rounded-full
                flex items-center justify-center transition-colors
                ${isHero
                  ? "bg-black/10 hover:bg-black/25 text-[#5a3020]"
                  : "bg-white/20 hover:bg-white/35 text-white"}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dots */}
        {totalSlides > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-20">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300
                  ${i === activeSlide
                    ? `w-6 ${i === 0 ? "bg-[#7c3d2b]" : "bg-white"}`
                    : `w-1.5 ${i === 0 ? "bg-[#7c3d2b]/35 hover:bg-[#7c3d2b]/55" : "bg-white/40 hover:bg-white/65"}`}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Static content below slideshow ── */}
      <div className="w-full max-w-4xl px-6 pb-10 md:pb-14 flex flex-col items-center text-center gap-4">
        <div className="flex flex-wrap gap-3 justify-center mt-4 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <a href="#catalog">
            <Button size="lg" className="rounded-2xl px-7 shadow-lg" style={{ background: "#7c3d2b", color: "#fff" }}>
              <ShoppingBag className="h-4 w-4" />
              Каталог товарів
            </Button>
          </a>
          <a href={DESIGNER_URL}>
            <Button size="lg" variant="outline" className="rounded-2xl px-7 border-[#7c3d2b]/40 text-[#7c3d2b] hover:bg-[#7c3d2b]/10">
              <Palette className="h-4 w-4" />
              Конструктор
            </Button>
          </a>
        </div>

        <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <p className="font-hero text-3xl md:text-4xl text-[#6b3a2a] tracking-wide">
            Зберігаємо ваші моменти
          </p>
          <p className="font-hero text-base md:text-lg text-[#a06450]/80 tracking-widest">
            Фото · Друк · Дизайн · Сувеніри
          </p>
        </div>

        <img
          src="/hashtag-white.png"
          alt="#MemoryMoments"
          className="h-5 w-auto object-contain opacity-30 mt-2 animate-fade-in"
          style={{ animationDelay: "0.5s" }}
        />
      </div>
    </section>
  );
}
