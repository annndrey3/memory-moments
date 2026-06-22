import { Clock, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteConfig } from "@/lib/siteConfig";

// Футер: години роботи + посилання на сторінку «Контакти» (адреси філій і карти
// тепер живуть там, тож у футері їх не дублюємо).
export function SiteFooter() {
  const { contacts } = useSiteConfig();

  return (
    <footer id="contacts" className="mt-16 scroll-mt-20 border-t border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 space-y-6">

        <div className="flex flex-wrap justify-center gap-3">
          {/* Години роботи */}
          <div className="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-soft">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Clock className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Години роботи</span>
              {(contacts.hours || []).map((h) => (
                <span key={h.days} className="block text-sm text-slate-700">
                  <span className="font-medium text-slate-800">{h.days}:</span> {h.time}
                </span>
              ))}
            </span>
          </div>

          {/* Посилання на сторінку контактів (усі філії + карти) */}
          <Link
            to="/contacts"
            className="group inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-elevated"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 text-white">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Наші філії</span>
              <span className="block text-sm font-medium text-slate-800 group-hover:text-violet-700">
                Адреси та карти →
              </span>
            </span>
          </Link>
        </div>

        <div className="border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Memory Moments. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
