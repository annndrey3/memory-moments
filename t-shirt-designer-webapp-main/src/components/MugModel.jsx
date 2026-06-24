import { Center, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

export function MugModel({
  innerColor = "#FFFFFF",
  designTexture,
  bodyColor = "#FFFFFF",   // зовнішній колір корпусу (білий — проявлений стан хамелеона)
  handleColor,             // колір ручки; дефолт = innerColor (кольорова чашка) / чорний (хамелеон)
  rimColor,                // колір вінець ЗЗОВНІ; дефолт = bodyColor (білі). Для хамелеона — чорний
  handleCapColor = null,   // білий конектор-нубик угорі ручки (кольорова чашка SPS). null = немає
  coatColor = "#1c1c1c",   // колір термопокриття «хамелеона»
  coatLevel = null,        // 0..1 рівень проявлення (вода знизу). null = без покриття
  printAspect = 2.75,      // пропорція зони друку (ширина:висота) — синхронно з 2D-розгорткою
  showDesign = true,
}) {
  const handleCol = handleColor ?? innerColor;
  const rimCol = rimColor ?? bodyColor; // ЗЗОВНІ вінця білі (як корпус), а не кольорові
  // hasCoat: є чорне покриття, що відступає знизу вгору по мірі «наливання».
  const hasCoat = coatLevel != null && coatLevel < 0.995;
  const lvl = Math.max(0, Math.min(1, coatLevel ?? 0));
  const texture = useTexture(
    designTexture || `${import.meta.env.BASE_URL}3Dmodels/textures/design-fallback.png`
  );
  texture.colorSpace = THREE.SRGBColorSpace;

  // ── Корпус / дно / внутрішня поверхня ───────────────────────────────────────
  const outerGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 2.2, 96, 1, true), []);
  const innerGeometry = useMemo(() => new THREE.CylinderGeometry(0.95, 0.95, 2.2, 96, 1, false), []);
  const bottomGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.06, 96, 1, false), []);
  // Ручка — велике «D» як на реальній чашці (більший радіус, товстіша, зміщена
  // трохи вгору: верх кріпиться під вінцями, низ — нижче середини).
  const handleGeometry = useMemo(() => new THREE.TorusGeometry(0.66, 0.16, 24, 96, Math.PI), []);
  const HANDLE_Y = 0.14;                 // зсув ручки вгору
  const HANDLE_TOP = HANDLE_Y + 0.66;    // верхнє кріплення ручки (для нубика)
  // Каемка по ВЕРХНЬОМУ краю (≈3мм). Радіус 1.006 — трохи більший за корпус, без
  // z-fighting. ЗЗОВНІ біла (= корпус), всередині видно кольорову внутрішню стінку.
  const rimGeometry = useMemo(() => new THREE.CylinderGeometry(1.006, 1.006, 0.07, 96, 1, true), []);

  // ── Пояс друку ──────────────────────────────────────────────────────────────
  // Малюнок лягає АКУРАТНИМ ПОЯСОМ по центру чашки (а не на всю висоту), лишаючи
  // чисту кераміку під вінцями і над дном — тому НЕ налазить на каемку (раніше
  // декаль діставала до вінець → нахлест). Висота пояса й кут обгортання підібрані
  // за пропорцією зони друку: дуга/висота = printAspect, тож малюнок НЕ
  // спотворюється. Зазор під ручкою = решта кола (мін. ~60°).
  const PRINT_H = 1.62;
  const PRINT_R = 1.004;
  const printArc = Math.min(Math.PI * 2 - Math.PI / 3, (PRINT_H * printAspect) / PRINT_R);
  const printGap = Math.PI * 2 - printArc;
  const printGeometry = useMemo(
    () => new THREE.CylinderGeometry(PRINT_R, PRINT_R, PRINT_H, 96, 1, true, Math.PI / 2 + printGap / 2, printArc),
    [printArc, printGap]
  );

  // Термопокриття «хамелеона»: чорний циліндр РІВНО заввишки з корпусом (раніше було
  // вище → чорне «вилазило» над вінцями). Верх закріплений на вінцях, низ
  // опускається на «рівень води» (scaleY=1−рівень, зсув угору). НЕПРОЗОРИЙ —
  // чітка лінія води, без мерехтіння/нахлестів і без просвіту біля дна на 0%.
  const coatGeometry = useMemo(() => new THREE.CylinderGeometry(1.03, 1.03, 2.2, 96, 1, true), []);

  return (
    <Center position={[0, -0.2, 0]}>
      <group dispose={null}>

        {/* Корпус — глазурована кераміка з глянцем */}
        <mesh geometry={outerGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial color={bodyColor} roughness={0.12} metalness={0} clearcoat={0.7} clearcoatRoughness={0.18} side={THREE.FrontSide} />
        </mesh>

        {/* Друк — поясом по центру (під глазур'ю) */}
        {showDesign && (
          <mesh geometry={printGeometry}>
            <meshStandardMaterial map={texture} roughness={0.16} metalness={0} side={THREE.FrontSide} transparent polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        )}

        {/* Термопокриття «хамелеона» — відступає знизу вгору (рівень води) */}
        {hasCoat && (
          <mesh geometry={coatGeometry} position={[0, lvl * 1.1, 0]} scale={[1, Math.max(0.0001, 1 - lvl), 1]}>
            <meshPhysicalMaterial color={coatColor} roughness={0.22} metalness={0} clearcoat={0.5} clearcoatRoughness={0.22} side={THREE.FrontSide} />
          </mesh>
        )}

        {/* Внутрішня поверхня (кольорова) */}
        <mesh geometry={innerGeometry} receiveShadow>
          <meshPhysicalMaterial color={innerColor} roughness={0.1} metalness={0} clearcoat={0.6} clearcoatRoughness={0.2} side={THREE.BackSide} />
        </mesh>

        {/* Каемка по верхньому краю (ЗЗОВНІ — колір корпусу) */}
        <mesh geometry={rimGeometry} position={[0, 1.1 - 0.035, 0]} castShadow>
          <meshPhysicalMaterial color={rimCol} roughness={0.12} metalness={0} clearcoat={0.6} clearcoatRoughness={0.2} side={THREE.DoubleSide} />
        </mesh>

        {/* Дно — біле */}
        <mesh geometry={bottomGeometry} position={[0, -1.1, 0]} receiveShadow>
          <meshStandardMaterial color={bodyColor} roughness={0.25} metalness={0} />
        </mesh>

        {/* Ручка — кераміка з глянцем (кольорова) */}
        <mesh geometry={handleGeometry} position={[1, HANDLE_Y, 0]} rotation={[0, 0, -Math.PI / 2]} castShadow receiveShadow>
          <meshPhysicalMaterial color={handleCol} roughness={0.12} metalness={0} clearcoat={0.6} clearcoatRoughness={0.2} />
        </mesh>

        {/* Білий конектор-нубик угорі ручки (як на реальній кольоровій чашці SPS) */}
        {handleCapColor && (
          <mesh position={[1.0, HANDLE_TOP, 0]} castShadow>
            <sphereGeometry args={[0.17, 28, 28]} />
            <meshPhysicalMaterial color={handleCapColor} roughness={0.12} metalness={0} clearcoat={0.6} clearcoatRoughness={0.2} />
          </mesh>
        )}

      </group>
    </Center>
  );
}
