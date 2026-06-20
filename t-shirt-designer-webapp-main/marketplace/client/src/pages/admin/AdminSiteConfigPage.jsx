import { useEffect, useState } from "react";
import {
  Loader2, Save, Plus, Trash2, Phone, MapPin, Truck, Percent, Megaphone, Clock, FileText,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

const CARD = "bg-white rounded-xl border border-slate-200 p-5 space-y-4";
const LBL = "text-[11px] uppercase tracking-wider text-slate-500 font-medium";
const ICON_BTN = "h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50";

function Section({ title, icon: Icon, children, onSave, saving, msg }) {
  return (
    <div className={CARD}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-violet-600" />
        <h2 className="font-semibold text-slate-900">{title}</h2>
      </div>
      {children}
      <div className="flex items-center gap-3 pt-1">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Зберегти
        </Button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <Label className={LBL}>{label}</Label>
      <Input type={type} value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function AdminSiteConfigPage() {
  const [cfg, setCfg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [msg, setMsg] = useState({});      // { section: text }

  useEffect(() => {
    api.getSiteConfigAdmin()
      .then(setCfg)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── мутатори стану ──
  const setField = (sec, key, val) =>
    setCfg((c) => ({ ...c, [sec]: { ...c[sec], [key]: val } }));
  const setList = (sec, key, idx, patch) =>
    setCfg((c) => {
      const arr = [...c[sec][key]];
      arr[idx] = typeof arr[idx] === "object" ? { ...arr[idx], ...patch } : patch;
      return { ...c, [sec]: { ...c[sec], [key]: arr } };
    });
  const addItem = (sec, key, item) =>
    setCfg((c) => ({ ...c, [sec]: { ...c[sec], [key]: [...(c[sec][key] || []), item] } }));
  const removeItem = (sec, key, idx) =>
    setCfg((c) => ({ ...c, [sec]: { ...c[sec], [key]: c[sec][key].filter((_, i) => i !== idx) } }));

  const save = async (section, payloadOverride) => {
    setSaving(section); setMsg((m) => ({ ...m, [section]: "" }));
    try {
      await api.saveSiteConfigSection(section, payloadOverride ?? cfg[section]);
      setMsg((m) => ({ ...m, [section]: "✅ Збережено" }));
    } catch (e) {
      setMsg((m) => ({ ...m, [section]: "❌ " + e.message }));
    } finally { setSaving(null); }
  };

  if (loading) return <div className="text-slate-400 animate-pulse">Завантаження…</div>;
  if (error) return <div className="text-red-600">Помилка: {error}. Потрібен дозвіл «Системні налаштування».</div>;
  if (!cfg) return null;

  const { contacts, delivery, discounts, hero, seo } = cfg;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Налаштування сайту</h1>
        <p className="text-sm text-slate-500">Контакти, доставка, знижки, головний банер та SEO — без участі розробника.</p>
      </div>

      {/* ── Контакти ── */}
      <Section title="Контакти та філії" icon={Phone} saving={saving === "contacts"} msg={msg.contacts}
        onSave={() => save("contacts")}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Телефон" value={contacts.phone} onChange={(v) => setField("contacts", "phone", v)} />
          <Field label="Viber (номер)" value={contacts.viber} onChange={(v) => setField("contacts", "viber", v)} />
          <Field label="Instagram (нік без @)" value={contacts.instagram} onChange={(v) => setField("contacts", "instagram", v)} />
          <Field label="Telegram (нік без @ або +380…)" value={contacts.telegram} onChange={(v) => setField("contacts", "telegram", v)} />
          <Field label="Головна адреса" value={contacts.address} onChange={(v) => setField("contacts", "address", v)} className="sm:col-span-2" />
          <Field label="Посилання на карту" value={contacts.mapsUrl} onChange={(v) => setField("contacts", "mapsUrl", v)} className="sm:col-span-2" />
        </div>

        <div className="space-y-2">
          <Label className={LBL}>Філії (показуються у футері)</Label>
          {(contacts.branches || []).map((b, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Адреса" value={b.address}
                onChange={(e) => setList("contacts", "branches", i, { address: e.target.value })} />
              <Input placeholder="Посилання на карту" value={b.mapsUrl}
                onChange={(e) => setList("contacts", "branches", i, { mapsUrl: e.target.value })} />
              <button className={ICON_BTN} onClick={() => removeItem("contacts", "branches", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem("contacts", "branches", { address: "", mapsUrl: "" })}>
            <Plus className="h-4 w-4" /> Філія
          </Button>
        </div>

        <div className="space-y-2">
          <Label className={LBL}><Clock className="inline h-3 w-3 mr-1" />Години роботи</Label>
          {(contacts.hours || []).map((h, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Пн–Пт" value={h.days}
                onChange={(e) => setList("contacts", "hours", i, { days: e.target.value })} />
              <Input placeholder="09:00–19:00" value={h.time}
                onChange={(e) => setList("contacts", "hours", i, { time: e.target.value })} />
              <button className={ICON_BTN} onClick={() => removeItem("contacts", "hours", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem("contacts", "hours", { days: "", time: "" })}>
            <Plus className="h-4 w-4" /> Рядок
          </Button>
        </div>
      </Section>

      {/* ── Доставка ── */}
      <Section title="Доставка" icon={Truck} saving={saving === "delivery"} msg={msg.delivery}
        onSave={() => save("delivery")}>
        <div className="space-y-2">
          <Label className={LBL}>Способи доставки</Label>
          {(delivery.methods || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" checked={!!m.enabled}
                onChange={(e) => setList("delivery", "methods", i, { enabled: e.target.checked })} />
              <Input placeholder="Назва" value={m.label}
                onChange={(e) => setList("delivery", "methods", i, { label: e.target.value })} />
              <select className="h-9 rounded-lg border border-slate-200 text-sm px-2 bg-white" value={m.kind}
                onChange={(e) => setList("delivery", "methods", i, { kind: e.target.value })}>
                <option value="address">потрібна адреса</option>
                <option value="pickup">самовивіз</option>
              </select>
              <button className={ICON_BTN} onClick={() => removeItem("delivery", "methods", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm"
            onClick={() => addItem("delivery", "methods", { id: `m${Date.now()}`, label: "", enabled: true, kind: "address" })}>
            <Plus className="h-4 w-4" /> Спосіб
          </Button>
        </div>

        <div className="space-y-2">
          <Label className={LBL}>Відділення для самовивозу</Label>
          {(delivery.pickupBranches || []).map((addr, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Адреса відділення" value={addr}
                onChange={(e) => setList("delivery", "pickupBranches", i, e.target.value)} />
              <button className={ICON_BTN} onClick={() => removeItem("delivery", "pickupBranches", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem("delivery", "pickupBranches", "")}>
            <Plus className="h-4 w-4" /> Відділення
          </Button>
        </div>
      </Section>

      {/* ── Знижки фотодруку ── */}
      <Section title="Знижки на фотодрук" icon={Percent} saving={saving === "discounts"} msg={msg.discounts}
        onSave={() => save("discounts")}>
        <p className="text-xs text-slate-500">Від кількості фото у замовленні. Сервер застосовує найвищий поріг, що підходить.</p>
        <div className="space-y-2">
          {(discounts.photo || []).map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-sm text-slate-500 w-8">від</span>
              <Input type="number" className="w-24" value={t.min}
                onChange={(e) => setList("discounts", "photo", i, { min: Number(e.target.value) })} />
              <span className="text-sm text-slate-500">шт →</span>
              <Input type="number" className="w-20" value={t.pct}
                onChange={(e) => setList("discounts", "photo", i, { pct: Number(e.target.value) })} />
              <span className="text-sm text-slate-500">%</span>
              <button className={ICON_BTN} onClick={() => removeItem("discounts", "photo", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem("discounts", "photo", { min: 0, pct: 0 })}>
            <Plus className="h-4 w-4" /> Поріг
          </Button>
        </div>
      </Section>

      {/* ── Hero та SEO ── */}
      <Section title="Головний банер і SEO" icon={Megaphone} saving={saving === "hero"} msg={msg.hero}
        onSave={async () => { await save("hero"); await save("seo"); }}>
        <Field label="Заголовок банера" value={hero.headline} onChange={(v) => setField("hero", "headline", v)} />
        <Field label="Підпис банера" value={hero.tagline} onChange={(v) => setField("hero", "tagline", v)} />
        <Field label="Назва сайту (SEO)" value={seo.siteName} onChange={(v) => setField("seo", "siteName", v)} />
        <div className="space-y-1">
          <Label className={LBL}>Опис сайту (SEO meta description)</Label>
          <textarea className="w-full rounded-lg border border-slate-200 text-sm p-2 min-h-[64px]"
            value={seo.description ?? ""} onChange={(e) => setField("seo", "description", e.target.value)} />
        </div>
        <p className="text-[11px] text-slate-400">Кнопка «Зберегти» збереже і банер, і SEO.</p>
      </Section>

      {/* ── Умови та терміни (блок унизу сторінки цін) ── */}
      <Section title="Умови та терміни (на сторінці цін)" icon={FileText} saving={saving === "terms"} msg={msg.terms}
        onSave={() => save("terms")}>
        <p className="text-xs text-slate-500">Список умов унизу сторінки «Ціни». Кожен рядок — окремий пункт.</p>
        <div className="space-y-2">
          {((cfg.terms && cfg.terms.items) || []).map((t, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <textarea
                className="flex-1 rounded-lg border border-slate-200 text-sm p-2 min-h-[44px]"
                value={t}
                placeholder="Текст умови…"
                onChange={(e) => setList("terms", "items", i, e.target.value)}
              />
              <button className={ICON_BTN} onClick={() => removeItem("terms", "items", i)} title="Видалити">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => addItem("terms", "items", "")}>
            <Plus className="h-4 w-4" /> Пункт
          </Button>
        </div>
      </Section>

      <p className="text-[11px] text-slate-400">
        Telegram-сповіщення та сховище фото клієнтів (SFTP) тепер у розділі «Налаштування».
      </p>
    </div>
  );
}
