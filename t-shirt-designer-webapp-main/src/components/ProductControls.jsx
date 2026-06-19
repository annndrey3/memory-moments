import { useDispatch, useSelector } from "react-redux";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_TYPES,
  TSHIRT_SIZES,
  PAPER_TYPES,
  CANVAS_SIZES,
  canvasSizeLabel,
  SLIMBOOK_FORMATS,
  slimBookFormatLabel,
  isBookType,
  productHasSize,
  productHasPaper,
} from "../constants/designConstants";
import { setSelectedType, setSize, setPaperType, setCanvasSize, setSlimBookFormat } from "../features/tshirtSlice";
import { cn } from "@/lib/utils";
import TshirtSizeTable from "./TshirtSizeTable";

// Контроли «що друкуємо»: товар + розмір (футболка/полотно) / папір (фото).
// Живуть у шапці редактора, завжди видно (без сайдбару).
const ProductControls = () => {
  const dispatch = useDispatch();
  const selectedType = useSelector((s) => s.tshirt.selectedType);
  const size = useSelector((s) => s.tshirt.size);
  const canvasSize = useSelector((s) => s.tshirt.canvasSize);
  const slimBookFormat = useSelector((s) => s.tshirt.slimBookFormat);
  const paperType = useSelector((s) => s.tshirt.paperType);

  return (
    <div className="flex flex-wrap items-center gap-2" data-tour="product">
      <Select value={selectedType} onValueChange={(v) => dispatch(setSelectedType(v))}>
        <SelectTrigger className="h-9 w-[180px] rounded-lg bg-card border-border/70">
          <SelectValue placeholder="Оберіть товар" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(PRODUCT_TYPES).map(([value, { name }]) => (
              <SelectItem key={value} value={value}>
                {name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {productHasSize(selectedType) && (
        <div className="flex items-center gap-1">
          {TSHIRT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => dispatch(setSize(s))}
              className={cn(
                "h-9 min-w-9 px-2 rounded-lg text-xs font-semibold border transition-all",
                size === s
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-glow"
                  : "bg-card text-foreground/80 border-border/70 hover:border-primary/40 hover:bg-muted"
              )}
            >
              {s}
            </button>
          ))}
          <TshirtSizeTable selected={size} />
        </div>
      )}

      {selectedType === "canvas" && (
        <Select value={canvasSize} onValueChange={(v) => dispatch(setCanvasSize(v))}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg bg-card border-border/70">
            <SelectValue placeholder="Розмір" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CANVAS_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {canvasSizeLabel(s)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      {isBookType(selectedType) && (
        <Select value={slimBookFormat} onValueChange={(v) => dispatch(setSlimBookFormat(v))}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg bg-card border-border/70">
            <SelectValue placeholder="Формат" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SLIMBOOK_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {slimBookFormatLabel(f)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      {productHasPaper(selectedType) && (
        <Select value={paperType} onValueChange={(v) => dispatch(setPaperType(v))}>
          <SelectTrigger className="h-9 w-[150px] rounded-lg bg-card border-border/70">
            <SelectValue placeholder="Папір" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAPER_TYPES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default ProductControls;
