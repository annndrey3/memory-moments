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
import DesignerTour from "./components/DesignerTour";
import { PRODUCT_TYPES, isMugType } from "./constants/designConstants";
import { ensureCanvasFonts, rerenderText } from "./utils/fontSync";
import { Sparkles, Minimize2, Maximize2, X, Box } from "lucide-react";

function App() {
  const tshirtColor = useSelector((state) => state.tshirt.tshirtColor);
  const selectedType = useSelector((state) => state.tshirt.selectedType);
  const selectedView = useSelector((state) => state.tshirt.selectedView);
  const dispatch = useDispatch();
  const { getCanvas, canvasesByKey } = useCanvas();
  const product = PRODUCT_TYPES[selectedType] || PRODUCT_TYPES["crew-neck"];
  // Пропорція зони друку чашки (ширина:висота) — щоб 3D-модель обгортала малюнок
  // тим самим співвідношенням, що й 2D-розгортка (без спотворення).
  const mugPz = product.views?.front?.printZone;
  const mugPrintAspect = mugPz ? mugPz.width / mugPz.height : 2.75;

  // Кирилиця у веб-шрифтах: сабсет вантажиться асинхронно, а fabric кешує гліфи —
  // тож текст міг лишитись із запасним шрифтом («шрифти не працюють для рос/укр»).
  // Коли веб-шрифти дозавантажились (loadingdone) — позначаємо текст брудним і
  // перемальовуємо ВСІ полотна. Плюс підвантажуємо сабсети шрифтів поточних макетів
  // (напр. після перезавантаження збереженого дизайну).
  useEffect(() => {
    const all = () => Object.values(canvasesByKey || {});
    const onDone = () => rerenderText(all());
    document.fonts?.addEventListener?.("loadingdone", onDone);
    document.fonts?.ready?.then(() => rerenderText(all())).catch(() => {});
    ensureCanvasFonts(all());
    return () => document.fonts?.removeEventListener?.("loadingdone", onDone);
  }, [canvasesByKey]);
  // Панель превʼю — лише для чашок (3D). Футболку й так видно в редакторі;
  // для решти (фото, полароїд, чохол, полотно) окремого превʼю не показуємо.
  const showPreview = isMugType(selectedType);
  // «Хамелеон»: чорна чашка, малюнок проявляється від гарячого. magicFill (0..100) —
  // «скільки налито кипятку»: чим більше, тим вище піднявся прояв (знизу вгору).
  const isMagic = selectedType === "mug-magic";
  const [magicFill, setMagicFill] = useState(100);
  // Повноекранний режим: лише холст + інструменти (шапка/футер/превʼю сховані).
  const [fullscreen, setFullscreen] = useState(false);
  // 3D-перегляд виробу (чашки) — відкривається НА ВЕСЬ ЕКРАН іконкою «3D» у редакторі,
  // згортається стрілкою у плаваючу кнопку. Доступний і в повноекранному режимі.
  const [show3d, setShow3d] = useState(false);       // 3D-перегляд відкрито (на весь екран)
  const [preview3dMin, setPreview3dMin] = useState(false); // згорнуто у плаваючу кнопку
  useEffect(() => {
    if (!fullscreen) return;
    // Esc виходить з повноекранного — але якщо поверх відкрито 3D-перегляд, спершу
    // закриваємо його (це робить ефект show3d нижче), а з повноекранного НЕ виходимо.
    const onKey = (e) => { if (e.key === "Escape" && !(show3d && !preview3dMin)) setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen, show3d, preview3dMin]);
  useEffect(() => {
    if (!show3d || preview3dMin) return;
    const onKey = (e) => { if (e.key === "Escape") setShow3d(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show3d, preview3dMin]);
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
          {!fullscreen && (
          <header className="sticky top-0 z-30 glass border-b border-border/50 animate-fade-in">
            <Header />
          </header>
          )}

          <main className={fullscreen ? "flex-1 p-1" : "flex-1 px-2 py-1 md:px-4 md:py-1.5"}>
            <div className="mx-auto max-w-none">
              <div className="grid grid-cols-1 gap-2">
                {/* Preview panel — приховано для футболки (видно в редакторі) та у повноекранному режимі */}
                {/* 3D-перегляд виробу — НА ВЕСЬ ЕКРАН; згортається стрілкою у плаваючу кнопку.
                    Працює і в повноекранному режимі редактора (модалка лягає поверх). */}
                {showPreview && show3d && !preview3dMin && (
                  <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900/95 backdrop-blur-sm animate-fade-in">
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white">
                      <span className="truncate text-sm font-semibold">3D-перегляд · {product.name}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" className="rounded-lg p-2 hover:bg-white/15" title="Згорнути" onClick={() => setPreview3dMin(true)}>
                          <Minimize2 className="h-5 w-5" />
                        </button>
                        <button type="button" className="rounded-lg p-2 hover:bg-white/15" title="Закрити" onClick={() => setShow3d(false)}>
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 flex flex-col flex-1 min-h-0 bg-white">
                      <div className="relative flex-1 min-h-[220px]">
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
                                  rimColor={isMagic ? "#1c1c1c" : undefined}
                                  handleCapColor={selectedType === "mug-color" ? "#FFFFFF" : undefined}
                                  coatLevel={isMagic ? magicFill / 100 : null}
                                  designTexture={designTextureFront}
                                  printAspect={mugPrintAspect}
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
                )}
                {/* Згорнуто → плаваюча кнопка «розгорнути 3D» */}
                {showPreview && show3d && preview3dMin && (
                  <button type="button" onClick={() => setPreview3dMin(false)}
                    className="fixed bottom-24 right-4 z-[60] flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm font-semibold shadow-elevated hover:border-primary/40">
                    <Box className="h-4 w-4 text-violet-600" /> 3D-перегляд
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}

                {/* Design canvas panel */}
                <section className="order-1 animate-fade-in-up flex flex-col" style={{ animationDelay: "0.1s" }}>
                  <DesignArea
                    manualSync={manualSync}
                    fullscreen={fullscreen}
                    onToggleFullscreen={() => setFullscreen((f) => !f)}
                    canShow3d={showPreview}
                    show3d={show3d}
                    onToggle3d={() => { setPreview3dMin(false); setShow3d((o) => !o); }}
                  />
                </section>
              </div>
            </div>
          </main>

          {/* Залипаюча панель замовлення: ціна в моменті + колір у 1 клік + «Замовити!».
              У повноекранному режимі сховано (лише холст + інструменти). */}
          {!fullscreen && <OrderBar />}
      <Toaster />
      <EmbedBridge />
      <DesignerTour />
    </div>
  );
}

export default App;
