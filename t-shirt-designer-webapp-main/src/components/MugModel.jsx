import { Center, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

export function MugModel({
  innerColor = "#FFFFFF",
  designTexture,
}) {
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

  return (
    <Center position={[0, -0.2, 0]}>
      <group dispose={null}>
        
        {/* Outer Shell (White background) — глазурована кераміка з глянцем */}
        <mesh geometry={outerGeometry} castShadow receiveShadow>
          <meshPhysicalMaterial
            color="#FFFFFF"
            roughness={0.12}
            metalness={0}
            clearcoat={0.7}
            clearcoatRoughness={0.18}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Decal Shell (The Print) — під глазур'ю, тож трохи глянцевий */}
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
            color={innerColor}
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
