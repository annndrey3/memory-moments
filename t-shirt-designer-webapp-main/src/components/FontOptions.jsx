import { SelectGroup, SelectItem, SelectLabel } from "@/components/ui/select";
import { FONT_OPTIONS, FONT_GROUPS } from "@/constants/designConstants";

// Згруповані пункти вибору шрифту (кожен — своїм шрифтом для прев'ю).
// Спільні для плаваючої панелі тексту і для попапа «Шрифт».
export default function FontOptions() {
  return (
    <>
      {FONT_GROUPS.map((group) => {
        const items = FONT_OPTIONS.filter((f) => f.group === group);
        if (!items.length) return null;
        return (
          <SelectGroup key={group}>
            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {group}
            </SelectLabel>
            {items.map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectGroup>
        );
      })}
    </>
  );
}

// Зразок із латиницею + кирилицею (рос. + укр. і ї є ґ) — щоб document.fonts.load
// підтягнув потрібні сабсети шрифта перед перемальовуванням полотна.
export const FONT_SAMPLE = "AaЯяІіЇїҐґЄє";
