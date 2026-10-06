import { forwardRef } from 'react';
import * as THREE from 'three';

// The writing things on a coder's bench: a squat iron inkwell and a goose-feather quill, built from primitives. The
// quill stands in the inkwell until its coder writes; then it's in their hand (RiggedCharacter.tsx: quillRules.ts says
// where the nib goes). The quill's nib is its origin and its shaft runs up +Y.

const IRON = new THREE.MeshStandardMaterial({ color: '#1e1a18', roughness: 0.45, metalness: 0.5 });
const INK = new THREE.MeshStandardMaterial({ color: '#07060a', roughness: 0.15 });
const SHAFT = new THREE.MeshStandardMaterial({ color: '#ddd3bd', roughness: 0.6 });
const VANE = new THREE.MeshStandardMaterial({ color: '#e9e0cc', roughness: 0.9, side: THREE.DoubleSide });
const NIB = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.4 });

const POT = new THREE.CylinderGeometry(0.03, 0.036, 0.048, 18).translate(0, 0.024, 0);
const SHOULDER = new THREE.CylinderGeometry(0.016, 0.03, 0.012, 18).translate(0, 0.054, 0);
const NECK = new THREE.CylinderGeometry(0.017, 0.016, 0.006, 18).translate(0, 0.063, 0);
const INK_TOP = new THREE.CircleGeometry(0.0145, 16).rotateX(-Math.PI / 2).translate(0, 0.061, 0);

/** A goose quill as scribes cut them: 30 cm, the bare barrel held near the nib, the feather along the rest. */
const QUILL_LEN = 0.3;
const NIB_LEN = 0.018;
const SHAFT_GEO = new THREE.CylinderGeometry(0.0015, 0.0032, QUILL_LEN - NIB_LEN, 8).translate(0, NIB_LEN + (QUILL_LEN - NIB_LEN) / 2, 0);
const NIB_GEO = new THREE.ConeGeometry(0.0032, NIB_LEN, 8).rotateX(Math.PI).translate(0, NIB_LEN / 2, 0);
/** The feather's vane: a long curved leaf along the upper two-thirds of the shaft, wider on one side, as a goose quill is. */
const VANE_GEO = (() => {
  const s = new THREE.Shape();
  const from = 0.1;
  s.moveTo(0, from);
  s.bezierCurveTo(-0.026, from + 0.05, -0.03, QUILL_LEN - 0.06, -0.005, QUILL_LEN + 0.012);
  s.bezierCurveTo(0.009, QUILL_LEN - 0.05, 0.014, from + 0.06, 0, from);
  return new THREE.ShapeGeometry(s, 14);
})();

/** The inkwell, its base at y = 0; its mouth is 0.064 m up. */
export function Inkwell(props: { position?: [number, number, number] }) {
  return (
    <group {...props}>
      <mesh geometry={POT} material={IRON} />
      <mesh geometry={SHOULDER} material={IRON} />
      <mesh geometry={NECK} material={IRON} />
      <mesh geometry={INK_TOP} material={INK} />
    </group>
  );
}

/** A quill: its nib at the origin, the shaft up +Y. A ref lets a hand carry it. */
export const Quill = forwardRef<THREE.Group, { position?: [number, number, number]; rotation?: [number, number, number]; visible?: boolean }>(function Quill(props, ref) {
  return (
    <group ref={ref} {...props}>
      <mesh geometry={NIB_GEO} material={NIB} />
      <mesh geometry={SHAFT_GEO} material={SHAFT} />
      <mesh geometry={VANE_GEO} material={VANE} />
    </group>
  );
});
