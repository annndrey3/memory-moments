import { Phone, Instagram, Send, MessageCircle, MapPin, Clock } from "lucide-react";
import { CONTACTS, contactLinks } from "@/lib/contacts";

// Контакти у футері — клікабельні, відкривають дзвінок/застосунок/чат напряму.
export function SiteFooter() {
  const links = contactLinks();
  const tgValue = CONTACTS.telegram?.startsWith("+")
    ? CONTACTS.telegram
    : `@${(CONTACTS.telegram || "").replace(/^@/, "")}`;

  const items = [
    { key: "phone", href: links.phone, label: "Телефон", value: CONTACTS.phone, Icon: Phone, color: "bg-emerald-500" },
    {
      key: "instagram", href: links.instagram, label: "Instagram",
      value: `@${(CONTACTS.instagram || "").replace(/^@/, "")}`, Icon: Instagram,
      color: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400", external: true,
    },
    { key: "telegram", href: links.telegram, label: "Telegram", value: tgValue, Icon: Send, color: "bg-sky-500", external: true },
    { key: "viber", href: links.viber, label: "Viber", value: CONTACTS.viber, Icon: MessageCircle, color: "bg-violet-600" },
  ];

  return (
    <footer id="contacts" className="mt-16 scroll-mt-20 border-t border-slate-200/80 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 space-y-8">

        {/* Години роботи + адреса — по центру */}
        <div className="flex flex-wrap justify-center gap-3">
          <div className="inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-soft">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white">
              <Clock className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Години роботи</span>
              {CONTACTS.hours.map((h) => (
                <span key={h.days} className="block text-sm text-slate-700">
                  <span className="font-medium text-slate-800">{h.days}:</span> {h.time}
                </span>
              ))}
            </span>
          </div>

          <a
            href={links.maps}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-elevated"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500 text-white">
              <MapPin className="h-4 w-4" />
            </span>
            <span className="leading-tight">
              <span className="block text-[11px] uppercase tracking-wide text-slate-400">Адреса</span>
              <span className="block max-w-[220px] text-sm font-medium text-slate-800 group-hover:text-violet-700">
                {CONTACTS.address}
              </span>
            </span>
          </a>
        </div>

        <div className="border-t border-slate-100 pt-5 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Memory Moments. Усі права захищені.
        </div>
      </div>
    </footer>
  );
}
