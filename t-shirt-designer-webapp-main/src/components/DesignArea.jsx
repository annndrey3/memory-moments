import { useSelector, useDispatch } from "react-redux";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PRODUCT_TYPES } from "../constants/designConstants";
import ProductCanvas from "./ProductCanvas";
import { setSelectedView } from "../features/tshirtSlice";
import { useCanvas } from "@/hooks/useCanvas";
import { cn } from "@/lib/utils";
import { PenTool } from "lucide-react";

const DesignArea = () => {
  const dispatch = useDispatch();
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const { activeCanvas, setSelectedObject } = useCanvas();
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  const views = Object.entries(product.views);

  const handleViewChange = (view) => {
    if (view !== selectedView) {
      if (activeCanvas) {
        activeCanvas.discardActiveObject();
        activeCanvas.renderAll();
      }
      setSelectedObject(null);
      dispatch(setSelectedView(view));
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <Card className="w-full border-border/60 shadow-soft rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-5 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50 border-b border-border/50">
          <div className="flex items-center gap-2">
            <PenTool className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold tracking-wide uppercase text-foreground/80">
                Редактор дизайну
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {product.name}
              </p>
            </div>
          </div>

          {views.length > 1 && (
            <div className="flex gap-1.5 mt-3 p-1 bg-muted/60 rounded-xl w-fit">
              {views.map(([view, viewConfig]) => (
                <Button
                  key={view}
                  onClick={() => handleViewChange(view)}
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "rounded-lg h-8 px-4 text-xs font-medium transition-all",
                    selectedView === view
                      ? "bg-white text-primary shadow-sm hover:bg-white hover:text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                  )}
                >
                  {viewConfig.label}
                </Button>
              ))}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 md:p-6 flex justify-center bg-gradient-to-b from-card to-muted/20">
          <div className="rounded-xl ring-1 ring-border/40 shadow-elevated overflow-hidden">
            <ProductCanvas
              key={`${selectedType}-${selectedView}`}
              view={selectedView}
              viewConfig={product.views[selectedView] || product.views.front}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DesignArea;
