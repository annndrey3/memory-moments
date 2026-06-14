import { Link } from "react-router-dom";
import { ShoppingBag, Palette } from "lucide-react";
import { Button } from "./ui";

const DESIGNER_URL = import.meta.env.VITE_DESIGNER_URL || "http://localhost:5174";

export function HeroBanner() {
  return (
    <section className="relative overflow-hidden">
      {/* Фон — рожева мармурова текстура */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#f0cbbc",
          backgroundImage: `
            radial-gradient(ellipse at 15% 20%, rgba(255,255,255,0.55) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 75%, rgba(255,255,255,0.45) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(240,203,188,0.8) 0%, rgba(233,185,168,0.9) 100%)
          `,
        }}
      />

      {/* SVG шум для імітації штукатурки/мармуру */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.18] pointer-events-none" aria-hidden>
        <filter id="hero-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.72"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-noise)" />
      </svg>

      {/* Світлі пастельні «орби», що м'яко плавають */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        <div className="absolute -top-10 left-[8%] h-40 w-40 rounded-full bg-white/40 blur-2xl animate-blob" />
        <div className="absolute top-1/3 right-[10%] h-56 w-56 rounded-full bg-rose-200/40 blur-3xl animate-float-slow" />
        <div className="absolute bottom-0 left-1/3 h-48 w-48 rounded-full bg-violet-200/30 blur-3xl animate-blob" style={{ animationDelay: "-6s" }} />
        <div className="absolute top-12 right-1/3 h-24 w-24 rounded-full bg-amber-100/50 blur-2xl animate-float" />
      </div>

      {/* Контент */}
      <div className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:py-24 flex flex-col items-center text-center gap-6">

        {/* Логотип */}
        <div className="drop-shadow-xl animate-float">
          <img
            src="/logo-mm.png"
            alt="Memory Moments"
            className="h-28 md:h-36 w-auto object-contain animate-fade-in"
          />
        </div>

        {/* Слоган */}
        <div className="space-y-1 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <p className="font-hero text-3xl md:text-4xl text-[#6b3a2a] tracking-wide">
            Зберігаємо ваші моменти
          </p>
          <p className="font-hero text-base md:text-lg text-[#a06450]/80 tracking-widest">
            Фото · Друк · Дизайн · Сувеніри
          </p>
        </div>

        {/* CTA-кнопки */}
        <div className="flex flex-wrap gap-3 justify-center mt-2 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Link to="/">
            <Button
              size="lg"
              className="rounded-2xl px-7 shadow-lg"
              style={{ background: "#7c3d2b", color: "#fff" }}
            >
              <ShoppingBag className="h-4 w-4" />
              Каталог товарів
            </Button>
          </Link>
          <a href={DESIGNER_URL}>
            <Button
              size="lg"
              variant="outline"
              className="rounded-2xl px-7 border-[#7c3d2b]/40 text-[#7c3d2b] hover:bg-[#7c3d2b]/10"
            >
              <Palette className="h-4 w-4" />
              Конструктор
            </Button>
          </a>
        </div>

        {/* Хештег */}
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
