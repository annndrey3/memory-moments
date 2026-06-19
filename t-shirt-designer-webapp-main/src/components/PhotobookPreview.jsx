import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import HTMLFlipBook from "react-pageflip";
import { X, ChevronLeft, ChevronRight, Minimize2, Maximize2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

// Сторінка книги — HTMLFlipBook клонує дітей і передає їм ref, тому потрібен forwardRef.
const Page = forwardRef(({ children, className = "" }, ref) => (
  <div ref={ref} className={`bg-white ${className}`}>
    {children}
  </div>
));
Page.displayName = "BookPage";

// Повноекранний передперегляд фотокниги (Slim/Print Book) з гортанням сторінок,
// навігацією та можливістю згорнути в плаваючу кнопку (open/minimized — від батька).
export default function PhotobookPreview({
  open,
  minimized = false,
  onClose,
  onMinimize,
  onRestore,
  coverImage,
  photos = [],
  format = "21x30",
  spreads = 10,
  extra = 0,
  unit = "розворотів",
}) {
  const bookRef = useRef(null);
  const [page, setPage] = useState(0);
  const [vp, setVp] = useState({ w: 1280, h: 800 });

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [w, h] = String(format).split("x").map(Number);
  const ratio = w && h ? w / h : 0.7;

  const pages = useMemo(() => {
    const list = [{ type: "cover" }];
    photos.forEach((src, i) => list.push({ type: "photo", src, i }));
    if (photos.length % 2 === 1) list.push({ type: "blank" });
    list.push({ type: "back" });
    return list;
  }, [photos]);

  if (!open) return null;

  const total = Number(spreads) + Number(extra || 0);
  const title = `Передперегляд книги · ${String(format).replace("x", "×")} см · ${total} ${unit}`;

  // ── Згорнутий стан: плаваюча кнопка для відновлення ──
  if (minimized) {
    return createPortal(
      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-elevated">
        <BookOpen className="h-4 w-4 text-violet-600" />
        <button className="text-sm font-semibold text-foreground hover:text-violet-600" onClick={onRestore}>
          Передперегляд книги
        </button>
        <button className="rounded-md p-1 text-muted-foreground hover:text-foreground" title="Розгорнути" onClick={onRestore}>
          <Maximize2 className="h-4 w-4" />
        </button>
        <button className="rounded-md p-1 text-muted-foreground hover:text-destructive" title="Закрити" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>,
      document.body
    );
  }

  // Розмір сторінки під весь екран: обмежено висотою і половиною ширини (розворот = 2 стор.).
  const availH = Math.max(240, vp.h - 150);
  const availW = Math.max(240, vp.w - 48);
  let pageH = Math.min(availH, availW / 2 / ratio);
  pageH = Math.round(Math.max(220, Math.min(pageH, 1000)));
  const pageW = Math.round(pageH * ratio);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/95 backdrop-blur-sm">
      {/* Топ-бар */}
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white">
        <span className="truncate text-sm font-semibold">{title}</span>
        <div className="flex shrink-0 items-center gap-1">
          <button className="rounded-lg p-2 hover:bg-white/15" title="Згорнути" onClick={onMinimize}>
            <Minimize2 className="h-5 w-5" />
          </button>
          <button className="rounded-lg p-2 hover:bg-white/15" title="Закрити" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Книга */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        {photos.length === 0 ? (
          <div className="max-w-md rounded-xl bg-white p-10 text-center text-slate-500">
            Завантажте «Фото розворотів» у панелі замовлення, щоб побачити передперегляд.
          </div>
        ) : (
          <HTMLFlipBook
            key={`${format}-${pages.length}-${pageH}`}
            width={pageW}
            height={pageH}
            size="fixed"
            showCover
            maxShadowOpacity={0.5}
            mobileScrollSupport
            ref={bookRef}
            onFlip={(e) => setPage(e.data)}
            className="shadow-2xl"
          >
            {pages.map((p, idx) => (
              <Page key={idx} className="flex items-center justify-center overflow-hidden">
                {p.type === "cover" ? (
                  coverImage ? (
                    <img src={coverImage} alt="Обкладинка" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-lg font-bold text-white">
                      Обкладинка
                    </div>
                  )
                ) : p.type === "photo" ? (
                  <img src={p.src} alt={`Фото ${p.i + 1}`} className="h-full w-full object-cover" />
                ) : p.type === "back" ? (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
                    Memory Moments
                  </div>
                ) : (
                  <div className="h-full w-full bg-white" />
                )}
              </Page>
            ))}
          </HTMLFlipBook>
        )}
      </div>

      {/* Навігація */}
      {photos.length > 0 && (
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-center gap-3 text-white">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => bookRef.current?.pageFlip()?.flipPrev()}
              title="Назад"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm tabular-nums">
              {Math.min(page + 1, pages.length)} / {pages.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-lg border-white/30 bg-white/10 text-white hover:bg-white/20"
              onClick={() => bookRef.current?.pageFlip()?.flipNext()}
              title="Далі"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-white/60">
            Завантажено {photos.length} фото · перегортайте сторінки · студія зробить фінальну розкладку
          </p>
        </div>
      )}
    </div>,
    document.body
  );
}
