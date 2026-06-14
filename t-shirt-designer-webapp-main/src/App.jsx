import { useCallback, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import DesignArea from "./components/DesignArea";
import Header from "./components/Header";
import { Toaster } from "@/components/ui/toaster";
import { Canvas } from "@react-three/fiber";
import { Environment, Loader, OrbitControls } from "@react-three/drei";
import { setSelectedView, setSelectedType } from "./features/tshirtSlice";
import { useCanvas } from "./hooks/useCanvas";
import { TshirtModel } from "./components/TShirtModel";
import { MugModel } from "./components/MugModel";
import { useCanvasTextureSync } from "./hooks/useCanvasTextureSync";
import { ToolsSidebar } from "./components/ToolsSidebar";
import ProductPreview from "./components/ProductPreview";
import EmbedBridge from "./components/EmbedBridge";
import { PRODUCT_TYPES } from "./constants/designConstants";
import { Sparkles } from "lucide-react";

function App() {
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const dispatch = useDispatch();
  const { getCanvas } = useCanvas();
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  const frontCanvas = getCanvas(selectedType, "front");
  const backCanvas = getCanvas(selectedType, "back");

  const { designTextureFront, designTextureBack, manualTriggerSync } =
    useCanvasTextureSync({
      frontCanvas,
      backCanvas,
      selectedView,
      selectedType,
    });

  const manualSync = useCallback(() => {
    manualTriggerSync(selectedView);
  }, [manualTriggerSync, selectedView]);

  const handleViewChange = useCallback((view) => {
    if (view !== selectedView) {
      dispatch(setSelectedView(view));
    }
  }, [dispatch, selectedView]);

  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type && PRODUCT_TYPES[type]) {
      dispatch(setSelectedType(type));
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-mesh-animated">
      <div className="flex min-h-screen">
        <ToolsSidebar manualSync={manualSync} />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-30 glass border-b border-border/50 animate-fade-in">
            <Header />
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-7xl">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 xl:gap-12 items-start">
                {/* Preview panel */}
                <section className="order-2 xl:order-1 animate-fade-in-up">
                  <div className="rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden transition-shadow hover:shadow-elevated">
                    <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50">
                      <h2 className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">
                        Попередній перегляд
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.name}
                      </p>
                    </div>

                    <div className="p-4 md:p-6">
                      <div className="h-[360px] md:h-[480px] relative rounded-xl bg-gradient-to-b from-muted/30 to-muted/10">
                        {product.previewMode === "3d" ? (
                          <>
                            <Canvas>
                              <OrbitControls
                                maxPolarAngle={Math.PI / 2}
                                minPolarAngle={Math.PI / 3}
                              />
                              <Suspense fallback={null}>
                                {selectedType === "mug" ? (
                                  <MugModel
                                    innerColor={tshirtColor}
                                    designTexture={designTextureFront}
                                  />
                                ) : (
                                  <TshirtModel
                                    tshirtColor={tshirtColor}
                                    onViewChange={handleViewChange}
                                    designTexture={designTextureFront}
                                    designTextureBack={designTextureBack}
                                  />
                                )}
                                <Environment preset="sunset" />
                              </Suspense>
                            </Canvas>
                            <Loader
                              containerStyles={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: "100%",
                                background: "rgba(255, 255, 255, 0.85)",
                                backdropFilter: "blur(4px)",
                                pointerEvents: "none",
                                borderRadius: "0.75rem",
                              }}
                              dataStyles={{
                                color: "hsl(262 83% 40%)",
                                fontSize: "13px",
                                fontWeight: "500",
                              }}
                              barStyles={{
                                backgroundColor: "hsl(262 83% 58%)",
                                height: "3px",
                                borderRadius: "999px",
                              }}
                            />
                          </>
                        ) : (
                          <ProductPreview
                            product={product}
                            texture={designTextureFront}
                            baseColor={tshirtColor}
                          />
                        )}
                      </div>

                      <div className="mt-4 flex items-start gap-2 text-muted-foreground text-sm">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p>
                          {product.previewMode === "3d"
                            ? "Клікніть на 3D модель, щоб перемикатися між зонами дизайну"
                            : product.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Design canvas panel */}
                <section className="order-1 xl:order-2 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                  <DesignArea />
                </section>
              </div>
            </div>
          </main>
        </div>
      </div>
      <Toaster />
      <EmbedBridge />
    </div>
  );
}

export default App;
