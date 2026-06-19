import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import { TSHIRT_SIZE_TABLE } from "@/constants/designConstants";

// Таблиця розмірів футболки — підказка, як виріб сяде. Підсвічує обраний розмір.
export default function TshirtSizeTable({ selected }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Таблиця розмірів"
          className="h-9 px-2.5 flex items-center gap-1 rounded-lg border border-border/70 bg-card text-xs font-medium text-foreground/80 hover:border-primary/40 hover:bg-muted transition-all shrink-0"
        >
          <Ruler className="h-4 w-4" />
          <span className="hidden sm:inline">Розміри</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-[260px] p-3">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Таблиця розмірів (см)
        </p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="text-left font-medium pb-1">Розмір</th>
              <th className="text-right font-medium pb-1">Обхват грудей</th>
              <th className="text-right font-medium pb-1">Довжина</th>
            </tr>
          </thead>
          <tbody>
            {TSHIRT_SIZE_TABLE.map((r) => (
              <tr
                key={r.size}
                className={cn(
                  "border-t border-border/50",
                  r.size === selected && "bg-violet-50 font-semibold text-violet-700"
                )}
              >
                <td className="py-1.5 pl-1 rounded-l-md">{r.size}</td>
                <td className="py-1.5 text-right tabular-nums">{r.chest}</td>
                <td className="py-1.5 pr-1 text-right tabular-nums rounded-r-md">{r.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
          Значення приблизні (±2 см). Обхват грудей — повне коло; довжина — від плеча донизу.
        </p>
      </PopoverContent>
    </Popover>
  );
}
