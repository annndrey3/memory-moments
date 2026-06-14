import { Center, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { useMemo } from "react";

export function MugModel({
  innerColor = "#FFFFFF",
  designTexture,
}) {
  const texture = useTexture(
    designTexture || "/3Dmodels/textures/design-fallback.png"
  );
  
  // To prevent the texture from appearing upside down or flipped
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  // Outer Mug Geometry (white body for the print)
  // Radius Top, Radius Bottom, Height, Radial Segments, Height Segments, Open Ended
  const outerGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 2.2, 64, 1, true), []);
  
  // Inner Mug Geometry & Bottom (colored)
  const innerGeometry = useMemo(() => new THREE.CylinderGeometry(0.95, 0.95, 2.2, 64, 1, false), []);
  const bottomGeometry = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.05, 64, 1, false), []);
  
  // Handle Geometry (colored)
  // Radius, Tube, Radial Segments, Tubular Segments, Arc
  const handleGeometry = useMemo(() => new THREE.TorusGeometry(0.65, 0.15, 16, 64, Math.PI), []);

  return (
    <Center position={[0, -0.2, 0]}>
      <group dispose={null}>
        
        {/* Outer Shell (White background + Print) */}
        <mesh geometry={outerGeometry} castShadow receiveShadow>
          <meshStandardMaterial 
            color="#FFFFFF"
            map={texture}
            roughness={0.2}
            metalness={0.1}
            side={THREE.FrontSide}
          />
        </mesh>

        {/* Inner Shell (Colored) */}
        <mesh geometry={innerGeometry} receiveShadow>
          <meshStandardMaterial 
            color={innerColor} 
            roughness={0.1}
            metalness={0.1}
            side={THREE.BackSide} // Render inside
          />
        </mesh>

        {/* Bottom (Colored, slightly offset to cover the open end) */}
        <mesh geometry={bottomGeometry} position={[0, -1.1, 0]} receiveShadow>
          <meshStandardMaterial 
            color={innerColor} 
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>

        {/* Handle (Colored) */}
        <mesh 
          geometry={handleGeometry} 
          position={[1, 0, 0]} 
          rotation={[0, 0, -Math.PI / 2]}
          castShadow 
          receiveShadow
        >
          <meshStandardMaterial 
            color={innerColor} 
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>

      </group>
    </Center>
  );
}
