import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Model } from './models';

// Firelight. Every torch, candle and hearth registers where it is (an anchor); a fixed pool of point lights follows
// the anchors nearest the player. The pool never changes size, because three.js recompiles every material's shader
// when the number of lights changes, which would stutter each time a chamber comes into view. Anchors cost nothing
// until the pool picks them, so a room can have as many torches as looks right.

export interface FireLook {
  color: string;
  /** Candela at full strength, and the distance (m) the light reaches. */
  intensity: number;
  distance: number;
}

export const FIRE: Record<'torch' | 'candle' | 'hearth', FireLook> = {
  torch: { color: '#ff9a4a', intensity: 45, distance: 16 },
  candle: { color: '#ffb46b', intensity: 6, distance: 5 },
  hearth: { color: '#ff7a2e', intensity: 110, distance: 22 },
};

interface Anchor extends FireLook {
  pos: THREE.Vector3;
  seed: number;
}

const anchors = new Set<Anchor>();

/** Make `ref`'s world position a light source while it's mounted (read once, after it's placed). */
export function useFireLight(ref: React.RefObject<THREE.Object3D | null>, look: FireLook) {
  useEffect(() => {
    const o = ref.current;
    if (!o) return;
    o.updateWorldMatrix(true, false);
    const a: Anchor = { ...look, pos: o.getWorldPosition(new THREE.Vector3()), seed: Math.random() * 100 };
    anchors.add(a);
    return () => void anchors.delete(a);
  }, [ref, look]);
}

/** How many point lights are ever lit at once. Six keeps an old laptop's GPU comfortable. */
const POOL = 6;
const REACH = 26; // anchors further than this from the player are never picked

export function LightPool() {
  const lights = useRef<(THREE.PointLight | null)[]>([]);
  const picked = useRef<(Anchor | null)[]>(Array(POOL).fill(null));
  const frame = useRef(0);
  useFrame(({ camera, clock }) => {
    if (++frame.current % 12 === 0) {
      const p = camera.position;
      const near = [...anchors]
        .map((a) => [a, a.pos.distanceToSquared(p)] as const)
        .filter(([, d]) => d < REACH * REACH)
        // weigh brighter sources further: a hearth across the hall beats a candle beside you
        .sort((x, y) => x[1] / x[0].intensity - y[1] / y[0].intensity)
        .slice(0, POOL)
        .map(([a]) => a);
      for (let i = 0; i < POOL; i++) picked.current[i] = near[i] ?? null;
    }
    const t = clock.elapsedTime;
    for (let i = 0; i < POOL; i++) {
      const l = lights.current[i];
      const a = picked.current[i];
      if (!l) continue;
      if (!a) {
        l.intensity = 0;
        continue;
      }
      l.position.copy(a.pos);
      l.color.set(a.color);
      l.distance = a.distance;
      // fire never holds still: two slow waves and a fast one
      const s = a.seed;
      const flicker = 1 + 0.07 * Math.sin(t * 7.3 + s) + 0.05 * Math.sin(t * 13.1 + s * 2) + 0.03 * Math.sin(t * 29 + s * 3);
      l.intensity = a.intensity * flicker;
    }
  });
  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} intensity={0} decay={2} />
      ))}
    </>
  );
}

/** A flame: a small glowing teardrop that sways. Its light comes from the pool, not from itself. */
export function Flame({ size = 1 }: { size?: number }) {
  const g = useRef<THREE.Group>(null);
  const seed = useRef(Math.random() * 100);
  useFrame(({ clock }) => {
    const o = g.current;
    if (!o) return;
    const t = clock.elapsedTime + seed.current;
    o.scale.set(size * (1 + 0.08 * Math.sin(t * 11)), size * (1 + 0.15 * Math.sin(t * 8.7)), size);
    o.rotation.z = 0.12 * Math.sin(t * 5.1);
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.035, 8, 8]} />
        <meshBasicMaterial color="#ffd27a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.1, 0]} scale={[1, 1.9, 1]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color="#ff8a2a" transparent opacity={0.75} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A torch in its iron bracket on a wall, flame lit. Local +Z faces out of the wall; the origin is on the wall face. */
export function WallTorch({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const fire = useRef<THREE.Group>(null);
  useFireLight(fire, FIRE.torch);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Model name="props/Torch_Metal" />
      <group ref={fire} position={[0, 0.4, 0.3]}>
        <Flame size={1.3} />
      </group>
    </group>
  );
}
