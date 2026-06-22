import { FONT_OPTIONS } from "@/constants/designConstants";

// Зразок із кирилицею (рос. + укр.) — щоб document.fonts.load підтягнув кириличний
// сабсет шрифта, а не лише латиницю.
const SAMPLE = "AaЯяІіЇїҐґЄє0123";

// Веб-шрифти (Google Fonts) — для них треба завантажувати сабсети. Системні
// (ОС) рендеряться напряму, латиничні — без кирилиці (пропускаємо).
const WEB_FONTS = new Set(
  FONT_OPTIONS.filter((f) => f.group !== "Системні" && f.group !== "Лише латиниця (English)").map((f) => f.value)
);

// Позначити весь текст «брудним» і перемалювати — щоб fabric перерендерив кеш
// гліфів ПІСЛЯ того, як підвантажився кириличний сабсет (інакше лишається
// растровий кеш із запасним шрифтом — кирилиця «не працює», хоча шрифт уже є).
export function rerenderText(canvases) {
  (canvases || []).forEach((c) => {
    if (!c?.getObjects) return;
    c.getObjects().forEach((o) => {
      if (o?.type === "textbox") {
        o.set?.("dirty", true);
        o.initDimensions?.();
      }
    });
    c.requestRenderAll?.();
  });
}

// Підвантажити кириличні сабсети шрифтів, які реально використані в тексті на
// полотнах (напр. після перезавантаження збереженого макета), і перемалювати.
export async function ensureCanvasFonts(canvases) {
  const fams = new Set();
  (canvases || []).forEach((c) =>
    c?.getObjects?.().forEach((o) => {
      if (o?.type === "textbox" && o.fontFamily) fams.add(o.fontFamily);
    })
  );
  const toLoad = [...fams].filter((f) => WEB_FONTS.has(f));
  if (toLoad.length && document.fonts?.load) {
    await Promise.all(toLoad.map((f) => document.fonts.load(`32px "${f}"`, SAMPLE).catch(() => {})));
  }
  rerenderText(canvases);
}

// Підвантажити кириличний сабсет конкретного шрифта (при додаванні/зміні шрифта),
// тоді перемалювати передані полотна.
export async function loadFont(family, canvases) {
  if (family && WEB_FONTS.has(family) && document.fonts?.load) {
    await document.fonts.load(`32px "${family}"`, SAMPLE).catch(() => {});
  }
  rerenderText(canvases);
}
