import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Phone, Instagram, Send, MessageCircle, X } from "lucide-react";
import { contactLinks } from "@/lib/contacts";
import { useSiteConfig } from "@/lib/siteConfig";

export function ContactFloatingButton() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const { contacts } = useSiteConfig();

  if (pathname.startsWith("/admin")) return null;

  const links = contactLinks(contacts);
  const tgValue = contacts.telegram?.startsWith("+")
    ? contacts.telegram
    : `@${(contacts.telegram || "").replace(/^@/, "")}`;

  const items = [
    { key: "phone", href: links.phone, label: "Телефон", value: contacts.phone, Icon: Phone, color: "bg-emerald-500" },
    {
      key: "instagram", href: links.instagram, label: "Instagram",
      value: `@${(contacts.instagram || "").replace(/^@/, "")}`,
      Icon: Instagram, color: "bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400", external: true,
    },
    { key: "telegram", href: links.telegram, label: "Telegram", value: tgValue, Icon: Send, color: "bg-sky-500", external: true },
    { key: "viber", href: links.viber, label: "Viber", value: contacts.viber, Icon: MessageCircle, color: "bg-violet-600" },
  ];

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Popup */}
      {open && (
        <div className="mb-4 w-72 rounded-2xl border border-slate-200 bg-white shadow-elevated animate-fade-in-up">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-sm font-semibold text-slate-700">Зв'язатися з нами</p>
            <button
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="px-2 pb-2 space-y-0.5">
            {items.map(({ key, href, label, value, Icon, color, external }) => (
              <a
                key={key}
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noopener noreferrer" : undefined}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-violet-50 transition-colors"
                onClick={() => setOpen(false)}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white ${color}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="leading-tight">
                  <span className="block text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
                  <span className="block text-sm font-medium text-slate-800 group-hover:text-violet-700 transition-colors">
                    {value}
                  </span>
                </span>
              </a>
            ))}

          </div>
        </div>
      )}

      {/* Floating button */}
      <div className="relative">
        {!open && (
          <>
            <span className="absolute inset-0 rounded-full bg-violet-500 opacity-50 animate-ping" />
            <span
              className="absolute inset-0 rounded-full bg-violet-400 opacity-25 animate-ping"
              style={{ animationDelay: "0.75s" }}
            />
          </>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow-lg shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-110 transition-all duration-300 animate-pulse-glow"
          aria-label="Контакти"
        >
          {open ? <X className="h-6 w-6" /> : <Phone className="h-6 w-6" />}
        </button>
      </div>
    </div>
  );
}
