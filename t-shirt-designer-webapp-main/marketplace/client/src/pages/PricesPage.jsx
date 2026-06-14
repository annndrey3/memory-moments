import { useEffect, useMemo, useState } from "react";
import { Instagram, Info, Tag, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui";
import { formatPrice } from "@/lib/utils";
import { api } from "@/lib/api";

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

export default function PricesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="min-h-screen bg-mesh-animated">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {/* Hero */}
        <section className="mb-8 animate-fade-in-up">
          <div className="flex items-center gap-2 text-violet-600 mb-2">
            <Tag className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Прайс</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900">
            Ціни на <span className="text-gradient-animated">послуги</span>
          </h1>
          <p className="mt-2 text-slate-500 max-w-2xl">
            Фотодрук, поліграфія, широкоформатний друк, сувенірна продукція та фотокниги.
            Спеціальна ціна <span className="text-violet-600 font-medium">Instagram</span> діє за акційними умовами.
          </p>
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
                    className="scroll-mt-24 animate-fade-in-up"
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
    </div>
  );
}
