import { useState } from "react";
import { Download, ExternalLink, BookOpen } from "lucide-react";
import { Button } from "@/components/ui";

// Посібник користувача — переглядач PDF (укр/рос) прямо в адмінці + завантаження.
const GUIDES = {
  ua: { file: "/guides/guide-ua.pdf", label: "Українською", dl: "Memory-Moments-Посібник.pdf" },
  ru: { file: "/guides/guide-ru.pdf", label: "Російською", dl: "Memory-Moments-Rukovodstvo.pdf" },
};

export default function AdminGuidePage() {
  const [lang, setLang] = useState("ua");
  const g = GUIDES[lang];

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-violet-600" />
            <h2 className="text-2xl font-bold text-slate-900">Посібник користувача</h2>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Як користуватись конструктором і адмінкою.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            {Object.entries(GUIDES).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setLang(k)}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                  lang === k ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <a href={g.file} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-1.5 rounded-lg">
              <ExternalLink className="h-4 w-4" /> Відкрити
            </Button>
          </a>
          <a href={g.file} download={g.dl}>
            <Button className="gap-1.5 rounded-lg">
              <Download className="h-4 w-4" /> Завантажити PDF
            </Button>
          </a>
        </div>
      </div>

      <div
        className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
        style={{ height: "calc(100vh - 230px)", minHeight: "480px" }}
      >
        {/* key={lang} перезавантажує iframe при зміні мови */}
        <iframe key={lang} src={g.file} title="Посібник користувача" className="w-full h-full border-0" />
      </div>
      <p className="text-xs text-slate-400">
        Якщо PDF не відображається — натисніть «Відкрити» або «Завантажити PDF».
      </p>
    </div>
  );
}
