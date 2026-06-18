import { useEffect, useState } from "react";
import {
  Loader2, Save, KeyRound, Lock, CheckCircle, AlertCircle,
  Eye, EyeOff, Trash2, UserPlus, Users, Mail, ShieldCheck, ChevronDown, ChevronUp,
  HardDrive, Database, Download, Upload, Send,
} from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";
import { usePermissions } from "@/contexts/PermissionsContext";

// ─── Permission definitions ───────────────────────────────────────────────────
const PERM_SECTIONS = [
  {
    label: "Замовлення",
    perms: [
      { key: "orders.view",   label: "Перегляд" },
      { key: "orders.manage", label: "Управління (статус)" },
    ],
  },
  {
    label: "Товари",
    perms: [
      { key: "products.view",   label: "Перегляд" },
      { key: "products.manage", label: "Редагування" },
    ],
  },
  {
    label: "Дизайни",
    perms: [
      { key: "designs.view",   label: "Перегляд" },
      { key: "designs.manage", label: "Редагування" },
    ],
  },
  {
    label: "Прайс",
    perms: [
      { key: "services.view",   label: "Перегляд" },
      { key: "services.manage", label: "Редагування + імпорт Excel" },
    ],
  },
  {
    label: "Налаштування",
    perms: [
      { key: "settings.system", label: "Gemini API ключ" },
    ],
  },
];

// ─── Shared components ────────────────────────────────────────────────────────
// ─── Імпорт / експорт даних (JSON) ─────────────────────────────────────────────
const DATA_KINDS = [
  ["categories", "Категорії"],
  ["services", "Прайс"],
  ["products", "Товари"],
];

function DataSection() {
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState("");

  const exportKind = async (kind, label) => {
    setBusy(`${kind}-exp`); setMsg("");
    try {
      const blob = await api.exportDataFile(kind);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `mm-${kind}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(a.href);
      setMsg(`✅ ${label}: експортовано (Excel)`);
    } catch (e) { setMsg("❌ " + e.message); }
    finally { setBusy(null); }
  };

  const importKind = async (kind, label, file) => {
    if (!file) return;
    setBusy(`${kind}-imp`); setMsg("");
    try {
      const r = await api.importDataFile(kind, file);
      setMsg(`✅ ${label}: оновлено ${r.updated || 0}, додано ${r.created || 0}${r.skipped ? `, пропущено ${r.skipped}` : ""}`);
    } catch (e) { setMsg("❌ " + (e.message || "помилка імпорту")); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Excel-таблиця (.xlsx). Експорт — викачати, відредагувати в Excel і завантажити назад.
        Імпорт лише <b>оновлює та додає</b> (нічого не видаляє), тож ціни, до яких прив'язаний
        конструктор, не зламаються.
      </p>
      {DATA_KINDS.map(([kind, label]) => (
        <div key={kind} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2">
          <span className="text-sm font-medium text-slate-700">{label}</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => exportKind(kind, label)}>
              {busy === `${kind}-exp` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Експорт
            </Button>
            <label className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50 ${busy ? "opacity-50 pointer-events-none" : ""}`}>
              {busy === `${kind}-imp` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Імпорт
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
                onChange={(e) => { importKind(kind, label, e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          </div>
        </div>
      ))}
      {msg && <p className="text-sm text-slate-700">{msg}</p>}
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <Icon className="h-4 w-4 text-violet-600" />
        <h3 className="font-semibold text-slate-900 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusMsg({ type, msg }) {
  if (!msg) return null;
  const ok = type === "success";
  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${ok ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
      {ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {msg}
    </div>
  );
}

// ─── Permission editor ────────────────────────────────────────────────────────
function PermissionEditor({ userId, initial = [], onSaved }) {
  const [selected, setSelected] = useState(new Set(initial));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // if removing manage, also remove view isn't needed — view is independent
      } else {
        next.add(key);
        // manage implies view: auto-enable view
        if (key.endsWith(".manage")) {
          next.add(key.replace(".manage", ".view"));
        }
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setStatus(null);
    try {
      await api.updateUserPermissions(userId, [...selected]);
      setStatus({ type: "success", msg: "Дозволи збережено" });
      onSaved?.([...selected]);
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-slate-100 pt-3 mt-2 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Дозволи</p>
      <div className="grid grid-cols-1 gap-2">
        {PERM_SECTIONS.map((section) => (
          <div key={section.label} className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wide">
              {section.label}
            </div>
            <div className="px-3 py-2 flex flex-wrap gap-x-6 gap-y-2">
              {section.perms.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    onChange={() => toggle(key)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm text-slate-700">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <StatusMsg {...(status || {})} />
      <Button size="sm" onClick={save} disabled={saving} className="rounded-lg">
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        Зберегти дозволи
      </Button>
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────
function ProfileSection() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.getAdminProfile()
      .then(({ admin }) => setEmail(admin.email || ""))
      .catch((e) => setStatus({ type: "error", msg: e.message }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setStatus(null);
    try {
      await api.updateAdminProfile({ email });
      setStatus({ type: "success", msg: "Email оновлено" });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-4 max-w-sm">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
        />
      </div>
      <StatusMsg {...(status || {})} />
      <Button onClick={save} disabled={saving || !email.trim()} className="rounded-lg">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Зберегти
      </Button>
    </div>
  );
}

// ─── Password section ─────────────────────────────────────────────────────────
function PasswordSection() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);

  const save = async () => {
    if (form.newPassword !== form.confirm)
      return setStatus({ type: "error", msg: "Паролі не збігаються" });
    if (form.newPassword.length < 8)
      return setStatus({ type: "error", msg: "Мінімум 8 символів" });
    setSaving(true); setStatus(null);
    try {
      await api.changeAdminPassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      setStatus({ type: "success", msg: "Пароль змінено" });
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          placeholder="••••••••"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4 max-w-sm">
      {field("currentPassword", "Поточний пароль")}
      {field("newPassword", "Новий пароль")}
      {field("confirm", "Повторіть новий пароль")}
      <StatusMsg {...(status || {})} />
      <Button onClick={save} disabled={saving || !form.currentPassword || !form.newPassword} className="rounded-lg">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
        Змінити пароль
      </Button>
    </div>
  );
}

// ─── Gemini section ───────────────────────────────────────────────────────────
function GeminiSection() {
  const [info, setInfo] = useState(null);
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  const load = () => {
    setLoading(true);
    api.getGeminiSettings()
      .then(setInfo)
      .catch((e) => setStatus({ type: "error", msg: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true); setStatus(null);
    try {
      await api.setGeminiKey(key.trim());
      setKey("");
      setStatus({ type: "success", msg: "Ключ збережено в БД" });
      load();
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Видалити збережений ключ?")) return;
    try {
      await api.deleteGeminiKey();
      setStatus({ type: "success", msg: "Ключ видалено" });
      load();
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  };

  return (
    <div className="space-y-4 max-w-sm">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {info?.hasKey ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Ключ активний</p>
              <p className="font-mono text-sm text-emerald-900">{info.masked}</p>
              <p className="text-xs text-emerald-600">Джерело: {info.source === "db" ? "БД" : ".env"}</p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Ключ не налаштовано — імпорт Excel не працюватиме.
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Новий API ключ</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIza..."
                className="pr-10 font-mono text-sm"
              />
              <button type="button" onClick={() => setShow((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400">Безкоштовний ключ: aistudio.google.com</p>
          </div>
          <StatusMsg {...(status || {})} />
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !key.trim()} className="rounded-lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Зберегти ключ
            </Button>
            {info?.hasKey && info.source === "db" && (
              <Button variant="outline" onClick={remove} className="rounded-lg text-red-600 border-red-200 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
                Видалити
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Users section ────────────────────────────────────────────────────────────
function UserRow({ user, myId, onDelete, onPermissionsUpdate }) {
  const [open, setOpen] = useState(false);
  const isSelf = user.id === myId;
  const isSuperadmin = user.role === "superadmin";

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 bg-white">
        <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-900 truncate">{user.email}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ShieldCheck className="h-3 w-3 text-slate-400" />
            <span className="text-xs text-slate-500">
              {isSuperadmin ? "Суперадмін" : "Адмін"}
            </span>
            {isSelf && <span className="text-xs text-violet-600 font-medium">(ви)</span>}
          </div>
        </div>
        {!isSuperadmin && !isSelf && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
            title="Редагувати дозволи"
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        )}
        {!isSelf && (
          <button
            onClick={() => onDelete(user)}
            className="p-1.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Видалити"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && !isSuperadmin && (
        <div className="px-4 pb-4 bg-white">
          <PermissionEditor
            userId={user.id}
            initial={user.permissions || []}
            onSaved={(perms) => onPermissionsUpdate(user.id, perms)}
          />
        </div>
      )}
    </div>
  );
}

function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", role: "admin" });
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [myId, setMyId] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAdminUsers(), api.getAdminProfile()])
      .then(([{ users }, { admin }]) => {
        setUsers(users);
        setMyId(admin.id);
      })
      .catch((e) => setStatus({ type: "error", msg: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const create = async () => {
    if (!form.email.trim() || !form.password) return;
    setSaving(true); setStatus(null);
    try {
      await api.createAdminUser(form);
      setForm({ email: "", password: "", role: "admin" });
      setAdding(false);
      setStatus({ type: "success", msg: "Користувача створено. Встановіть йому дозволи нижче." });
      load();
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (user) => {
    if (!window.confirm(`Видалити ${user.email}?`)) return;
    try {
      await api.deleteAdminUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setStatus({ type: "success", msg: `${user.email} видалено` });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  };

  const updatePerms = (userId, perms) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, permissions: perms } : u))
    );
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden divide-y-0">
          {users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              myId={myId}
              onDelete={remove}
              onPermissionsUpdate={updatePerms}
            />
          ))}
        </div>
      )}

      <StatusMsg {...(status || {})} />

      {adding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-sm font-medium text-slate-700">Новий користувач</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Пароль</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Мінімум 8 символів"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPass((s) => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Роль</Label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="admin">Адмін</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-400">Після створення встановіть дозволи у рядку користувача.</p>
          <div className="flex gap-2 pt-1">
            <Button onClick={create} disabled={saving || !form.email.trim() || !form.password} className="rounded-lg">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Створити
            </Button>
            <Button variant="outline" onClick={() => { setAdding(false); setForm({ email: "", password: "", role: "admin" }); }} className="rounded-lg">
              Скасувати
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="rounded-lg">
          <UserPlus className="h-4 w-4" />
          Додати користувача
        </Button>
      )}
    </div>
  );
}

// ─── SMTP section ─────────────────────────────────────────────────────────────
function SmtpSection() {
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ host: "", port: "587", secure: false, user: "", pass: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(null);

  const load = () => {
    setLoading(true);
    api.getSmtpSettings()
      .then((data) => {
        setInfo(data);
        if (!data.configured) setEditing(true);
      })
      .catch((e) => setStatus({ type: "error", msg: e.message }))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const save = async () => {
    setSaving(true); setStatus(null);
    try {
      await api.setSmtpSettings({
        host: form.host.trim(),
        port: form.port,
        secure: form.secure,
        user: form.user.trim(),
        pass: form.pass.trim(),
      });
      setStatus({ type: "success", msg: "Налаштування збережено" });
      setEditing(false);
      setForm((f) => ({ ...f, pass: "" }));
      load();
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Видалити збережені SMTP-налаштування? Буде використано .env (якщо є).")) return;
    try {
      await api.deleteSmtpSettings();
      setStatus({ type: "success", msg: "Налаштування видалено" });
      setEditing(true);
      load();
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    }
  };

  const test = async () => {
    setTesting(true); setStatus(null);
    try {
      await api.testSmtp();
      setStatus({ type: "success", msg: "Тестовий лист надіслано на вашу пошту адміна" });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setTesting(false);
    }
  };

  const setF = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {info?.configured && !editing && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">SMTP налаштовано</p>
              <p className="text-sm text-emerald-900 font-mono">{info.user}</p>
              <p className="text-xs text-emerald-600">Хост: {info.host}:{info.port} · Джерело: {info.source === "db" ? "БД" : ".env"}</p>
            </div>
          )}

          {!info?.configured && !editing && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              SMTP не налаштовано — підтверджувальні листи не надсилаються.
            </div>
          )}

          {editing && (
            <div className="space-y-3 max-w-sm">
              <div className="space-y-1.5">
                <Label>SMTP хост</Label>
                <Input value={form.host} onChange={(e) => setF("host", e.target.value)} placeholder="mail.memory-moments.online" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Порт</Label>
                  <Input value={form.port} onChange={(e) => setF("port", e.target.value)} placeholder="587" />
                </div>
                <div className="space-y-1.5">
                  <Label>SSL (порт 465)</Label>
                  <div className="flex items-center h-10">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.secure}
                        onChange={(e) => setF("secure", e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                      />
                      <span className="text-sm text-slate-700">Увімкнено</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Адреса відправника (SMTP login)</Label>
                <Input type="email" value={form.user} onChange={(e) => setF("user", e.target.value)} placeholder="orders@memory-moments.online" />
              </div>
              <div className="space-y-1.5">
                <Label>Пароль</Label>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={form.pass}
                    onChange={(e) => setF("pass", e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button type="button" onClick={() => setShowPass((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <StatusMsg {...(status || {})} />

          <div className="flex flex-wrap gap-2">
            {editing ? (
              <>
                <Button onClick={save} disabled={saving || !form.host.trim() || !form.user.trim() || !form.pass.trim()} className="rounded-lg">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Зберегти
                </Button>
                {info?.configured && (
                  <Button variant="outline" onClick={() => setEditing(false)} className="rounded-lg">
                    Скасувати
                  </Button>
                )}
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)} className="rounded-lg">
                Змінити
              </Button>
            )}
            {info?.configured && !editing && (
              <>
                <Button variant="outline" onClick={test} disabled={testing} className="rounded-lg">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Тестовий лист
                </Button>
                {info.source === "db" && (
                  <Button variant="outline" onClick={remove} className="rounded-lg text-red-600 border-red-200 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                    Видалити
                  </Button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Cleanup section ──────────────────────────────────────────────────────────
function CleanupSection() {
  const [days, setDays] = useState(30);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const loadPreview = async () => {
    setLoading(true); setStatus(null); setPreview(null);
    try {
      const data = await api.cleanupPreview(days);
      setPreview(data);
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  const run = async () => {
    if (!window.confirm(`Видалити ${preview?.deleted} файл(ів)? Це незворотньо.`)) return;
    setLoading(true); setStatus(null);
    try {
      const data = await api.cleanupRun(days);
      setPreview(null);
      setStatus({ type: "success", msg: `Видалено ${data.deleted} файл(ів), звільнено ${data.mbFreed} МБ` });
    } catch (e) {
      setStatus({ type: "error", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Видаляє файли друку та фото клієнтів старші зазначеного терміну.
        Зображення товарів та файли свіжих замовлень не видаляються.
      </p>
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Старіші ніж</Label>
        <input
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => { setDays(Number(e.target.value)); setPreview(null); }}
          className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <span className="text-sm text-slate-500">днів</span>
      </div>

      {preview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-slate-700">
            Знайдено: <span className="text-red-600 font-semibold">{preview.deleted} файл(ів)</span> → {preview.mbFreed} МБ
          </p>
          <p className="text-xs text-slate-400">Буде збережено: {preview.kept} файл(ів)</p>
        </div>
      )}

      <StatusMsg {...(status || {})} />

      <div className="flex gap-2">
        <Button variant="outline" onClick={loadPreview} disabled={loading} className="rounded-lg">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
          Перевірити
        </Button>
        {preview?.deleted > 0 && (
          <Button onClick={run} disabled={loading} className="rounded-lg bg-red-600 hover:bg-red-700 text-white">
            <Trash2 className="h-4 w-4" />
            Видалити {preview.deleted} файл(ів)
          </Button>
        )}
        {preview?.deleted === 0 && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" /> Нічого чистити
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminSettingsPage() {
  const { role } = usePermissions();
  const isSuperadmin = role === "superadmin";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Налаштування</h2>
        <p className="text-sm text-slate-500 mt-1">Профіль, пароль і інтеграції</p>
      </div>

      <SectionCard icon={Mail} title="Профіль">
        <ProfileSection />
      </SectionCard>

      <SectionCard icon={Lock} title="Зміна пароля">
        <PasswordSection />
      </SectionCard>

      {isSuperadmin && (
        <SectionCard icon={Users} title="Користувачі адмінки">
          <UsersSection />
        </SectionCard>
      )}

      {isSuperadmin && (
        <SectionCard icon={KeyRound} title="Gemini API">
          <GeminiSection />
        </SectionCard>
      )}

      {isSuperadmin && (
        <SectionCard icon={Send} title="Email / SMTP">
          <SmtpSection />
        </SectionCard>
      )}

      <SectionCard icon={Database} title="Дані: імпорт / експорт">
        <DataSection />
      </SectionCard>

      <SectionCard icon={HardDrive} title="Очистка сховища">
        <CleanupSection />
      </SectionCard>
    </div>
  );
}
