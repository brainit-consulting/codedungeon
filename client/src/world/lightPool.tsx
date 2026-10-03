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

export const FIRE: Record<'torch' | 'candle' | 'chandelier' | 'hearth', FireLook> = {
  torch: { color: '#ff9a4a', intensity: 45, distance: 16 },
  candle: { color: '#ffb46b', intensity: 6, distance: 5 },
  chandelier: { color: '#ffa65a', intensity: 60, distance: 14 },
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

/** The nearest fire to `p` and how far it is (for the crackle), or null when there is none in reach. */
export function nearestFire(p: THREE.Vector3, reach = 10): { d: number; look: FireLook } | null {
  let best: Anchor | null = null;
  let bd = reach;
  for (const a of anchors) {
    const d = a.pos.distanceTo(p);
    // the hearth is heard from further than a candle
    const heard = d / Math.sqrt(a.intensity / FIRE.torch.intensity);
    if (heard < bd) {
      bd = heard;
      best = a;
    }
  }
  return best && { d: best.pos.distanceTo(p), look: best };
}

/** How many point lights are ever lit at once (measured: still 60 fps on the Overlord's laptop at eight). */
const POOL = 8;
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

// Every flame shares these, so a room full of candles costs no extra materials or geometry.
const FLAME_CORE = new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });
const FLAME_GLOW = new THREE.MeshBasicMaterial({ color: '#ff8a2a', transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false });
const FLAME_CORE_GEO = new THREE.SphereGeometry(0.035, 8, 8);
const FLAME_GLOW_GEO = new THREE.SphereGeometry(0.05, 8, 8);

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
      <mesh position={[0, 0.05, 0]} geometry={FLAME_CORE_GEO} material={FLAME_CORE} />
      <mesh position={[0, 0.1, 0]} scale={[1, 1.9, 1]} geometry={FLAME_GLOW_GEO} material={FLAME_GLOW} />
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
