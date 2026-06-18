import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Check, Image as ImageIcon, GalleryHorizontal } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { api } from "@/lib/api";

const EMPTY = { image_url: "", title: "", subtitle: "", link: "", cta_label: "", sort_order: 0, is_active: 1 };

export default function AdminSlidesPage() {
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [neu, setNeu] = useState({ ...EMPTY });

  const load = () => {
    setLoading(true);
    api.getSlidesAdmin().then(setSlides).catch((e) => alert(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const get = (s) => ({ ...s, ...drafts[s.id] });
  const patch = (id, field, value) =>
    setDrafts((p) => ({ ...p, [id]: { ...slides.find((s) => s.id === id), ...p[id], [field]: value } }));

  const save = async (s) => {
    const d = get(s);
    setSavingId(s.id);
    try {
      await api.updateSlide(s.id, {
        image_url: d.image_url || null, title: d.title || null, subtitle: d.subtitle || null,
        link: d.link || null, cta_label: d.cta_label || null,
        sort_order: Number(d.sort_order) || 0, is_active: d.is_active ? 1 : 0,
      });
      setDrafts((p) => { const x = { ...p }; delete x[s.id]; return x; });
      load();
    } catch (e) { alert(e.message); } finally { setSavingId(null); }
  };

  const remove = async (s) => {
    if (!confirm("Видалити слайд?")) return;
    setDeletingId(s.id);
    try { await api.deleteSlide(s.id); load(); } catch (e) { alert(e.message); } finally { setDeletingId(null); }
  };

  // upload — для існуючого слайда (id) або для форми нового (id = "new")
  const upload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const { url } = await api.uploadImage(file);
      if (id === "new") setNeu((n) => ({ ...n, image_url: url }));
      else patch(id, "image_url", url);
    } catch (e) { alert(e.message); } finally { setUploadingId(null); }
  };

  const add = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.createSlide({ ...neu, sort_order: Number(neu.sort_order) || 0 });
      setNeu({ ...EMPTY });
      load();
    } catch (e) { alert(e.message); } finally { setAdding(false); }
  };

  const [seeding, setSeeding] = useState(false);
  const seedFromCategories = async () => {
    setSeeding(true);
    try {
      const r = await api.seedSlidesFromCategories();
      load();
      if (!r.created) alert("Слайди для категорій уже створені.");
    } catch (e) { alert(e.message); } finally { setSeeding(false); }
  };

  const Img = ({ url, busy }) => (
    <div className="w-28 h-16 rounded-lg overflow-hidden bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center shrink-0">
      {busy ? <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        : url ? <img src={url} alt="" className="w-full h-full object-cover" />
        : <ImageIcon className="h-6 w-6 text-slate-300" />}
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-center gap-2">
        <GalleryHorizontal className="h-5 w-5 text-violet-600" />
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900">Слайди банера</h2>
          <p className="text-sm text-slate-500">Усього: {slides.length}</p>
        </div>
        <Button variant="outline" className="rounded-xl" disabled={seeding} onClick={seedFromCategories}>
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Створити з категорій
        </Button>
      </div>

      {/* Новий слайд */}
      <form onSubmit={add} className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <p className="text-sm font-semibold text-slate-700">Новий слайд</p>
        <div className="flex gap-3">
          <Img url={neu.image_url} busy={uploadingId === "new"} />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="Заголовок" value={neu.title} onChange={(e) => setNeu({ ...neu, title: e.target.value })} />
            <Input placeholder="Підзаголовок" value={neu.subtitle} onChange={(e) => setNeu({ ...neu, subtitle: e.target.value })} />
            <Input placeholder="Посилання (напр. #catalog або /product/...)" value={neu.link} onChange={(e) => setNeu({ ...neu, link: e.target.value })} />
            <Input placeholder="Текст кнопки (напр. Детальніше)" value={neu.cta_label} onChange={(e) => setNeu({ ...neu, cta_label: e.target.value })} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">
            <ImageIcon className="h-4 w-4" /> Завантажити фото
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload("new", e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Порядок</Label>
            <Input type="number" className="w-20 text-center" value={neu.sort_order} onChange={(e) => setNeu({ ...neu, sort_order: e.target.value })} />
          </div>
          <Button type="submit" disabled={adding} className="rounded-xl ml-auto">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Додати слайд
          </Button>
        </div>
      </form>

      {/* Список */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : slides.length === 0 ? (
        <div className="text-center py-12 px-6 rounded-xl border border-slate-200 bg-white">
          <GalleryHorizontal className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p className="text-slate-500 mb-1">Власних слайдів ще немає.</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            Зараз на головній показуються авто-слайди з категорій. Натисніть, щоб створити їх
            як редаговані слайди — або додайте власний слайд вище.
          </p>
          <Button variant="outline" className="rounded-xl" disabled={seeding} onClick={seedFromCategories}>
            {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Створити слайди з категорій
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {slides.map((s) => {
            const d = get(s);
            return (
              <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex gap-3">
                  <Img url={d.image_url} busy={uploadingId === s.id} />
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Заголовок" value={d.title || ""} onChange={(e) => patch(s.id, "title", e.target.value)} />
                    <Input placeholder="Підзаголовок" value={d.subtitle || ""} onChange={(e) => patch(s.id, "subtitle", e.target.value)} />
                    <Input placeholder="Посилання" value={d.link || ""} onChange={(e) => patch(s.id, "link", e.target.value)} />
                    <Input placeholder="Текст кнопки" value={d.cta_label || ""} onChange={(e) => patch(s.id, "cta_label", e.target.value)} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-slate-200 text-sm font-medium cursor-pointer hover:bg-slate-50">
                    <ImageIcon className="h-4 w-4" /> {d.image_url ? "Змінити фото" : "Завантажити фото"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { upload(s.id, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Порядок</Label>
                    <Input type="number" className="w-20 text-center" value={d.sort_order ?? 0} onChange={(e) => patch(s.id, "sort_order", e.target.value)} />
                  </div>
                  <button type="button" onClick={() => patch(s.id, "is_active", d.is_active ? 0 : 1)}
                    className={`relative inline-flex w-10 h-6 rounded-full transition-colors ${d.is_active ? "bg-violet-600" : "bg-slate-300"}`} title={d.is_active ? "Активний" : "Прихований"}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${d.is_active ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <span className="text-xs text-slate-500">{d.is_active ? "Показується" : "Прихований"}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" onClick={() => save(s)} disabled={savingId === s.id} className="rounded-lg">
                      {savingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Зберегти
                    </Button>
                    <button type="button" onClick={() => remove(s)} disabled={deletingId === s.id}
                      className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500" title="Видалити">
                      {deletingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
