import { Phone, Instagram, Send, MessageCircle, MapPin, Clock, Navigation } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { contactLinks } from "@/lib/contacts";
import { useSiteConfig } from "@/lib/siteConfig";
import { useSeo } from "@/lib/seo";

const tel = (s) => `tel:${(s || "").replace(/[^\d+]/g, "")}`;
// Вбудована Google-карта без API-ключа: q=<адреса>&output=embed.
const mapEmbed = (address) =>
  `https://maps.google.com/maps?q=${encodeURIComponent(address || "")}&hl=uk&z=16&output=embed`;
// Посилання «прокласти маршрут»: конкретне посилання філії або пошук за адресою.
const mapsHref = (b) =>
  b.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address || "")}`;

export default function ContactsPage() {
  const { contacts } = useSiteConfig();
  const links = contactLinks(contacts);
  useSeo({ title: "Контакти", description: "Адреси філій, телефони та карти Memory Moments в Одесі." });

  const tgValue = contacts.telegram?.startsWith("+")
    ? contacts.telegram
    : `@${(contacts.telegram || "").replace(/^@/, "")}`;

  const channels = [
    { href: links.phone, label: "Телефон", value: contacts.phone, Icon: Phone, color: "bg-emerald-500" },
    { href: links.instagram, label: "Instagram", value: `@${(contacts.instagram || "").replace(/^@/, "")}`, Icon: Instagram, color: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400", external: true },
    { href: links.telegram, label: "Telegram", value: tgValue, Icon: Send, color: "bg-sky-500", external: true },
    { href: links.viber, label: "Viber", value: contacts.viber, Icon: MessageCircle, color: "bg-violet-600" },
  ];

  const branches = contacts.branches || [];

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        {/* Hero */}
        <div className="text-center animate-fade-in-up">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-violet-700">
            <MapPin className="h-3.5 w-3.5" /> Memory Moments · Одеса
          </span>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold text-slate-900">Наші контакти</h1>
          <p className="mt-2 text-slate-500 max-w-2xl mx-auto">
            Завітайте до будь-якої з наших філій або зв'яжіться зручним способом — ми завжди раді допомогти.
          </p>
        </div>

        {/* Канали зв'язку */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {channels.map(({ href, label, value, Icon, color, external }) => (
            <a
              key={label}
              href={href}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-elevated"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${color}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
                <span className="block truncate text-sm font-semibold text-slate-800 group-hover:text-violet-700">{value}</span>
              </span>
            </a>
          ))}
        </div>

        {/* Години роботи */}
        {(contacts.hours || []).length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-2xl border border-slate-200 bg-white/80 px-5 py-3 shadow-soft backdrop-blur">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Clock className="h-4 w-4 text-amber-500" /> Години роботи:
            </span>
            {(contacts.hours || []).map((h) => (
              <span key={h.days} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">{h.days}</span> {h.time}
              </span>
            ))}
          </div>
        )}

        {/* Філії з картами */}
        <h2 className="mt-12 mb-5 text-center text-2xl font-bold text-slate-900">
          Філії <span className="text-violet-600">({branches.length})</span>
        </h2>

        <div className="grid gap-6 sm:grid-cols-2">
          {branches.map((b, i) => (
            <div
              key={`${b.address}-${i}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft transition-shadow duration-300 hover:shadow-elevated animate-fade-in-up"
            >
              {/* Карта */}
              <div className="relative aspect-[16/10] w-full bg-slate-100">
                <iframe
                  title={`Карта: ${b.name || b.address}`}
                  src={mapEmbed(b.address)}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0 h-full w-full border-0"
                />
              </div>

              {/* Інфо */}
              <div className="p-5 space-y-3">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500 text-white">
                    <MapPin className="h-4 w-4" />
                  </span>
                  {b.name || b.address}
                </h3>
                {b.name && <p className="text-sm text-slate-600">{b.address}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {b.phone && (
                    <a
                      href={tel(b.phone)}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
                    >
                      <Phone className="h-4 w-4" /> {b.phone}
                    </a>
                  )}
                  <a
                    href={mapsHref(b)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
                  >
                    <Navigation className="h-4 w-4" /> Маршрут
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
