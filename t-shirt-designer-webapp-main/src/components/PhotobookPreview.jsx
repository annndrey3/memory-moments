import { forwardRef, useMemo, useRef, useState } from "react";
import HTMLFlipBook from "react-pageflip";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Сторінка книги — HTMLFlipBook клонує дітей і передає їм ref, тому потрібен forwardRef.
const Page = forwardRef(({ children, className = "" }, ref) => (
  <div ref={ref} className={`bg-white ${className}`}>
    {children}
  </div>
));
Page.displayName = "BookPage";

// Передперегляд фотокниги (Slim/Print Book): обкладинка + фото з гортанням сторінок
// і навігацією. Розкладка — по одному фото на сторінку (студія робить фінальну).
export default function PhotobookPreview({
  open,
  onClose,
  coverImage,
  photos = [],
  format = "21x30",
  spreads = 10,
  extra = 0,
  unit = "розворотів",
}) {
  const bookRef = useRef(null);
  const [page, setPage] = useState(0);

  const [w, h] = String(format).split("x").map(Number);
  const ratio = w && h ? w / h : 0.7;
  const pageH = 420;
  const pageW = Math.round(pageH * ratio);

  // Обкладинка + кожне фото окремою сторінкою (+ вирівнювання до парної к-ті) + спинка.
  const pages = useMemo(() => {
    const list = [{ type: "cover" }];
    photos.forEach((src, i) => list.push({ type: "photo", src, i }));
    if (photos.length % 2 === 1) list.push({ type: "blank" });
    list.push({ type: "back" });
    return list;
  }, [photos]);

  if (!open) return null;

  const total = Number(spreads) + Number(extra || 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-auto bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-4 text-white">
          <span className="text-sm font-semibold">
            Передперегляд книги · {String(format).replace("x", "×")} см · {total} {unit}
          </span>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15" title="Закрити">
            <X className="h-5 w-5" />
          </button>
        </div>

        {photos.length === 0 ? (
          <div
            className="rounded-xl bg-white p-10 text-center text-slate-500"
            style={{ width: Math.min(pageW * 2, 560), maxWidth: "90vw" }}
          >
            Завантажте «Фото розворотів» у панелі замовлення, щоб побачити передперегляд.
          </div>
        ) : (
          <>
            <div className="flex justify-center">
              <HTMLFlipBook
                key={`${format}-${pages.length}`}
                width={pageW}
                height={pageH}
                size="fixed"
                showCover
                maxShadowOpacity={0.4}
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
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 text-white">
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
            <p className="mt-2 text-center text-xs text-white/70">
              Завантажено {photos.length} фото · перегортайте сторінки · студія зробить фінальну розкладку
            </p>
          </>
        )}
      </div>
    </div>
  );
}
