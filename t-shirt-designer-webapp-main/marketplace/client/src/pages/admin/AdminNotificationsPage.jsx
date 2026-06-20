import { useEffect, useState } from "react";
import { Bell, BellOff, Send, Loader2, Check, AlertTriangle, MessageCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { pushSupported, getPushState, enablePush, disablePush } from "@/lib/push";

// Налаштування сповіщень власника: куди слати (Push на пристрій / Telegram / Email клієнту).
export default function AdminNotificationsPage() {
  const [push, setPush] = useState({ supported: true, subscribed: false, permission: "default" });
  const [busy, setBusy] = useState(false);
  const [subs, setSubs] = useState(null);
  const [msg, setMsg] = useState(null); // {type,text}
  const [channels, setChannels] = useState({ telegram: null, email: null });

  const refresh = async () => {
    setPush(await getPushState());
    try { setSubs((await api.pushStatus()).subscriptions); } catch { /* ignore */ }
  };

  useEffect(() => {
    refresh();
    // Статус інших каналів (необовʼязково — лише показуємо)
    api.getSiteConfigAdmin().then((c) => setChannels((s) => ({ ...s, telegram: c?.telegram?.chatId || "" }))).catch(() => {});
    api.getSmtpSettings().then((c) => setChannels((s) => ({ ...s, email: !!c?.configured }))).catch(() => {});
  }, []);

  const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 4000); };

  const onEnable = async () => {
    setBusy(true);
    try { await enablePush(); await refresh(); flash("ok", "Пуш увімкнено на цьому пристрої."); }
    catch (e) { flash("err", e.message || "Не вдалося увімкнути пуш."); }
    finally { setBusy(false); }
  };
  const onDisable = async () => {
    setBusy(true);
    try { await disablePush(); await refresh(); flash("ok", "Пуш вимкнено на цьому пристрої."); }
    catch (e) { flash("err", e.message); }
    finally { setBusy(false); }
  };
  const onTest = async () => {
    setBusy(true);
    try {
      const r = await api.pushTest();
      flash(r.ok ? "ok" : "err", r.ok ? "Тест надіслано — перевірте сповіщення." : "Немає активних підписок для тесту.");
    } catch (e) { flash("err", e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Сповіщення</h2>
        <p className="text-sm text-slate-500">Куди надсилати сповіщення про нові замовлення.</p>
      </div>

      {msg && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${msg.type === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* Push на цей пристрій */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl p-2.5 ${push.subscribed ? "bg-emerald-100 text-emerald-600" : "bg-violet-100 text-violet-600"}`}>
            {push.subscribed ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900">Пуш на цей пристрій</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Сповіщення приходять навіть коли адмінка закрита. Увімкніть на кожному пристрої окремо
              (телефон — додайте сайт «на головний екран»).
            </p>

            {!pushSupported() ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="h-4 w-4" /> Цей браузер не підтримує пуш.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {push.subscribed ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700">
                      <Check className="h-4 w-4" /> Увімкнено
                    </span>
                    <Button variant="outline" onClick={onTest} disabled={busy} className="h-9 gap-1.5">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Тест
                    </Button>
                    <Button variant="outline" onClick={onDisable} disabled={busy} className="h-9 gap-1.5 text-red-600 hover:bg-red-50">
                      <BellOff className="h-4 w-4" /> Вимкнути
                    </Button>
                  </>
                ) : (
                  <Button onClick={onEnable} disabled={busy} className="h-9 gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                    Увімкнути сповіщення
                  </Button>
                )}
                {push.permission === "denied" && (
                  <span className="text-xs text-amber-600">Сповіщення заблоковані у браузері — дозвольте їх у налаштуваннях сайту.</span>
                )}
              </div>
            )}
            {subs != null && (
              <p className="mt-3 text-xs text-slate-400">Активних пристроїв із пушем: {subs}</p>
            )}
          </div>
        </div>
      </div>

      {/* Інші канали (статус) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Інші канали</h3>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-sky-500" />
            <span className="flex-1 text-slate-700">Telegram (вам про нові замовлення)</span>
            <ChannelBadge on={channels.telegram == null ? null : !!channels.telegram} />
          </li>
          <li className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-violet-500" />
            <span className="flex-1 text-slate-700">Email клієнту (підтвердження + зміна статусу)</span>
            <ChannelBadge on={channels.email} />
          </li>
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          Telegram та Email налаштовуються в розділі «Налаштування».
        </p>
      </div>
    </div>
  );
}

function ChannelBadge({ on }) {
  if (on == null) return <span className="text-xs text-slate-400">…</span>;
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <Check className="h-3.5 w-3.5" /> Активно
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
      Не налаштовано
    </span>
  );
}
