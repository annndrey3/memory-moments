import { Center, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

// Градієнтна alphaMap для країв термопокриття: чорний (прозорий) на краях → білий (непрозорий) в центрі.
// Нижній край набуває м'якого fade-ефекту — виглядає як нагрівання від окропу.
function buildCoatAlphaMap() {
  const w = 4, h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0,    "white");  // верхній край — повністю непрозорий
  grad.addColorStop(0.82, "white");  // плавний вихід
  grad.addColorStop(1,    "black");  // нижній край — прозорий
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function MugModel({
  innerColor = "#FFFFFF",
  designTexture,
  bodyColor = "#FFFFFF",  // зовнішній колір чашки (білий — проявлений стан)
  handleColor,            // колір ручки (для «хамелеона» — завжди чорна); дефолт = innerColor
  coatColor = "#1c1c1c",  // колір термопокриття «хамелеона»
  coatLevel = null,       // 0..1 рівень проявлення (вода знизу). null = без покриття
  showDesign = true,
}) {
  const handleCol = handleColor ?? innerColor;
  // hasCoat: є чорне покриття, що відступає знизу вгору по мірі «наливання».
  const hasCoat = coatLevel != null && coatLevel < 0.995;
  const lvl = Math.max(0, Math.min(1, coatLevel ?? 0));
  const texture = useTexture(
    designTexture || `${import.meta.env.BASE_URL}3Dmodels/textures/design-fallback.png`
  );
  
  texture.colorSpace = THREE.SRGBColorSpace;

  const outerGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 2.2, 64, 1, true), []);
  const innerGeometry = useMemo(() => new THREE.CylinderGeometry(0.95, 0.95, 2.2, 64, 1, false), []);
  const bottomGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.05, 64, 1, false), []);
  const handleGeometry = useMemo(() => new THREE.TorusGeometry(0.65, 0.15, 16, 64, Math.PI), []);

  // Print area: starts slightly past the handle (Math.PI / 2 + gap) and leaves a gap
  const gapAngle = Math.PI / 3.5; // About 50 degrees gap
  const printGeometry = useMemo(() =>
    new THREE.CylinderGeometry(1.002, 1.002, 2.2, 64, 1, true, Math.PI / 2 + gapAngle / 2, Math.PI * 2 - gapAngle),
  []);
  // Покриття «хамелеона». Радіус помітно більший за малюнок (1.03 vs 1.002), щоб не
  // було z-fighting (мерехтіння/вертикальна смуга) при зумі. Вище за корпус (2.4),
  // щоб на 0% повністю закривати низ/вінця.
  const coatGeometry = useMemo(() => new THREE.CylinderGeometry(1.03, 1.03, 2.4, 64, 1, true), []);
  const coatAlphaMap = useMemo(() => buildCoatAlphaMap(), []);

  return (
    <Center position={[0, -0.2, 0]}>
      <group dispose={null}>
        
        {/* Outer Shell — глазурована кераміка з глянцем (білий або чорний «хамелеон») */}
        <mesh geometry={outerGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={bodyColor}
            roughness={0.12}
            metalness={0}
            clearcoat={0.7}
            clearcoatRoughness={0.18}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Decal Shell (The Print) — під глазур'ю, тож трохи глянцевий */}
        {showDesign && (
          <mesh geometry={printGeometry}>
            <meshStandardMaterial
              map={texture}
              roughness={0.16}
              metalness={0}
              side={THREE.FrontSide}
              transparent={true}
              polygonOffset={true}
              polygonOffsetFactor={-1}
            />
          </mesh>
        )}

        {/* Термопокриття «хамелеона»: чорний циліндр, що відступає знизу вгору.
            scale-y = (1-рівень), зсув угору на рівень → нижня частина проявляється (як від кипятку). */}
        {hasCoat && (
          <mesh geometry={coatGeometry} position={[0, lvl * 1.1, 0]} scale={[1, 1 - lvl, 1]}>
            <meshPhysicalMaterial
              color={coatColor}
              roughness={0.18}
              metalness={0}
              clearcoat={0.6}
              clearcoatRoughness={0.2}
              side={THREE.FrontSide}
              transparent={true}
              opacity={0.88}
              alphaMap={coatAlphaMap}
              polygonOffset={true}
              polygonOffsetFactor={-4}
              polygonOffsetUnits={-4}
            />
          </mesh>
        )}

        {/* Inner Shell (Colored) */}
        <mesh geometry={innerGeometry} receiveShadow>
          <meshPhysicalMaterial
            color={innerColor}
            roughness={0.1}
            metalness={0}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
            side={THREE.BackSide}
          />
        </mesh>

        {/* Bottom */}
        <mesh geometry={bottomGeometry} position={[0, -1.1, 0]} receiveShadow>
          <meshStandardMaterial
            color={innerColor}
            roughness={0.25}
            metalness={0}
          />
        </mesh>

        {/* Handle — кераміка з глянцем */}
        <mesh
          geometry={handleGeometry}
          position={[1, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={handleCol}
            roughness={0.12}
            metalness={0}
            clearcoat={0.6}
            clearcoatRoughness={0.2}
          />
        </mesh>

      </group>
    </Center>
  );
}
