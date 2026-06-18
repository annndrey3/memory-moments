import { useCallback, Suspense, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import DesignArea from "./components/DesignArea";
import Header from "./components/Header";
import { Toaster } from "@/components/ui/toaster";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Loader, OrbitControls } from "@react-three/drei";
import { setSelectedType } from "./features/tshirtSlice";
import { useCanvas } from "./hooks/useCanvas";
import { MugModel } from "./components/MugModel";
import { useCanvasTextureSync } from "./hooks/useCanvasTextureSync";
import ProductPreview from "./components/ProductPreview";
import OrderBar from "./components/OrderBar";
import EmbedBridge from "./components/EmbedBridge";
import { PRODUCT_TYPES, isMugType } from "./constants/designConstants";
import { Sparkles } from "lucide-react";

function App() {
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const dispatch = useDispatch();
  const { getCanvas } = useCanvas();
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  // Панель превʼю — лише для чашок (3D). Футболку й так видно в редакторі;
  // для решти (фото, полароїд, чохол, полотно) окремого превʼю не показуємо.
  const showPreview = isMugType(selectedType);
  // «Хамелеон»: чорна чашка, малюнок проявляється від гарячого. magicFill (0..100) —
  // «скільки налито кипятку»: чим більше, тим вище піднявся прояв (знизу вгору).
  const isMagic = selectedType === "mug-magic";
  const [magicFill, setMagicFill] = useState(100);
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

  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type && PRODUCT_TYPES[type]) {
      dispatch(setSelectedType(type));
    }
  }, [dispatch]);

  return (
    <div className="min-h-screen bg-mesh-animated flex flex-col">
          <header className="sticky top-0 z-30 glass border-b border-border/50 animate-fade-in">
            <Header />
          </header>

          <main className="flex-1 px-4 py-3 pb-24 md:px-8 md:py-4">
            <div className="mx-auto max-w-7xl">
              <div className={`grid grid-cols-1 gap-4 xl:gap-6 items-start ${showPreview ? "xl:grid-cols-2" : ""}`}>
                {/* Preview panel — приховано для футболки (видно в редакторі) */}
                {showPreview && (
                <section className="order-2 animate-fade-in-up">
                  <div className="rounded-2xl border border-border/60 bg-card shadow-soft overflow-hidden transition-shadow hover:shadow-elevated">
                    <div className="px-4 py-2.5 border-b border-border/50 bg-gradient-to-r from-violet-50/80 to-fuchsia-50/50">
                      <h2 className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">
                        Попередній перегляд
                      </h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.name}
                      </p>
                    </div>

                    <div className="p-3">
                      <div className="h-[clamp(180px,34vh,400px)] relative">
                        {product.previewMode === "3d" && product.previewShape === "mug" ? (
                          <>
                            <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
                              <ambientLight intensity={0.55} />
                              <directionalLight position={[4, 6, 5]} intensity={1.3} />
                              <directionalLight position={[-5, 2, -4]} intensity={0.45} />
                              <Suspense fallback={null}>
                                <MugModel
                                  // «Хамелеон»: тіло біле (проявлений стан) + чорне покриття,
                                  // що відступає знизу по рівню «налитого кипятку» (magicFill).
                                  // Ручка лишається чорною. Колір «всередині» — лише у кольорової.
                                  innerColor={selectedType === "mug-color" ? tshirtColor : "#FFFFFF"}
                                  bodyColor="#FFFFFF"
                                  handleColor={isMagic ? "#1c1c1c" : undefined}
                                  coatLevel={isMagic ? magicFill / 100 : null}
                                  designTexture={designTextureFront}
                                />
                                <Environment preset="studio" />
                                <ContactShadows
                                  position={[0, -1.35, 0]}
                                  opacity={0.35}
                                  scale={12}
                                  blur={2.6}
                                  far={4.5}
                                  resolution={512}
                                  color="#2e2440"
                                />
                              </Suspense>
                              <OrbitControls
                                makeDefault
                                enablePan={false}
                                enableDamping
                                dampingFactor={0.08}
                                minDistance={3.2}
                                maxDistance={7.5}
                                maxPolarAngle={Math.PI / 2}
                                minPolarAngle={Math.PI / 3}
                              />
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
                            texture={selectedView === "back" ? designTextureBack : designTextureFront}
                            baseColor={tshirtColor}
                          />
                        )}
                        {/* «Хамелеон»: повзунок «наливаємо окріп» — малюнок проявляється знизу */}
                        {isMagic && (
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 w-[82%] max-w-xs flex items-center gap-2 rounded-full bg-white/90 backdrop-blur px-3 py-2 shadow-soft border border-border/50">
                            <span title="Холодна">💧</span>
                            <input
                              type="range" min="0" max="100" value={magicFill}
                              onChange={(e) => setMagicFill(Number(e.target.value))}
                              aria-label="Рівень кипятку"
                              className="flex-1 h-1.5 accent-orange-500 cursor-pointer"
                            />
                            <span title="Окріп">🔥</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-start gap-2 text-muted-foreground text-sm">
                        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p>
                          {isMagic
                            ? "Потягніть повзунок — ніби наливаєте окріп: малюнок проявляється знизу вгору. Ручка лишається чорною."
                            : product.previewMode === "3d" && product.previewShape === "mug"
                            ? "Перетягуйте, щоб обертати 3D-модель"
                            : product.description}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
                )}

                {/* Design canvas panel */}
                <section className="order-1 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                  <DesignArea manualSync={manualSync} />
                </section>
              </div>
            </div>
          </main>

          {/* Залипаюча панель замовлення: ціна в моменті + колір у 1 клік + «Замовити!» */}
          <OrderBar />
      <Toaster />
      <EmbedBridge />
    </div>
  );
}

export default App;
