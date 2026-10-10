import { useRef } from 'react';
import * as THREE from 'three';
import { FIRE, Flame, useFireLight, type FireLook } from './lightPool';
import { Model } from './models';
import { Bookcase } from './Books';

// The dungeon's furnishings. The names are the office's old ones (a "plant" is now a floor candle stand, the
// "kitchenette" the ale corner) so the rooms that place them didn't have to change; each keeps its old footprint,
// which layout.ts's colliders still describe.

type P = [number, number, number];

const WOOD = new THREE.MeshStandardMaterial({ color: '#3a2819', roughness: 0.92 });
const WOOD_DARK = new THREE.MeshStandardMaterial({ color: '#24180f', roughness: 0.95 });
const IRON = new THREE.MeshStandardMaterial({ color: '#2b2a29', roughness: 0.6, metalness: 0.6 });

/** Where a point of firelight sits, invisible: a flame drawn elsewhere, or a model's own candles. */
function FirePoint({ position, look }: { position: P; look: FireLook }) {
  const ref = useRef<THREE.Group>(null);
  useFireLight(ref, look);
  return <group ref={ref} position={position} />;
}

/** A tall iron candle stand with a lit candle (was: a potted plant); `look` FIRE.candelabrum lights a room with it. */
export function Plant({ position, scale = 1, look = FIRE.candle }: { position: P; scale?: number; pot?: string; look?: FireLook }) {
  return (
    <group position={position} scale={scale}>
      <Model name="props/CandleStick_Stand" />
      <group position={[0, 1.33, 0]}>
        <Flame />
      </group>
      <FirePoint position={[0, 1.42, 0]} look={look} />
    </group>
  );
}

/** A water barrel on a block, with a bucket (was: the water cooler). */
export function WaterCooler({ position }: { position: P }) {
  return (
    <group position={position}>
      <Model name="props/Barrel" />
      <Model name="props/Bucket_Wooden_1" position={[-0.05, 0.862, 0]} rotation={[0, 0.6, 0]} />
    </group>
  );
}

/** A long bench, back to the wall (was: the couch). Local +Z is the side you sit facing. */
export function Couch({ position, rotationY = 0 }: { position: P; rotationY?: number; color?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Model name="props/Bench" />
    </group>
  );
}

/** A crate used as a table, a candle and a mug on it (was: the coffee table). */
export function CoffeeTable({ position, rotationY = 0 }: { position: P; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Model name="props/Crate_Wooden" scale={[0.9, 0.45, 0.7]} />
      {/* on the squashed crate's lid, 0.383 m up (measured with propAudit.ts) */}
      <Model name="props/Mug" position={[0.25, 0.388, 0.1]} />
      <Model name="props/CandleStick" position={[-0.2, 0.382, -0.05]} />
      <group position={[-0.24, 0.532, -0.05]}>
        <Flame size={0.6} />
      </group>
      <FirePoint position={[-0.24, 0.592, -0.05]} look={FIRE.candle} />
    </group>
  );
}

/**
 * The ale corner against the east wall (was: the kitchenette and fridge): a keg on its cradle, bottles on a shelf, a
 * cupboard with mugs, and a spare barrel. Laid out along local Z, the wall at local +X, like the counter it replaces.
 */
export function Kitchenette({ position }: { position: P }) {
  const facing: P = [0, -Math.PI / 2, 0]; // fronts face away from the east wall
  return (
    <group position={position}>
      <Model name="props/Barrel_Holder" position={[0, 0, -1.4]} rotation={facing} />
      <Model name="props/Shelf_Small_Bottles" position={[0.42, 1.45, 0.4]} rotation={facing} />
      <Model name="props/Cabinet" position={[0.22, 0, 0.6]} rotation={facing} />
      <Model name="props/Mug" position={[0.15, 1.0, 0.25]} />
      <Model name="props/Mug" position={[0.2, 1.0, 0.8]} rotation={[0, 1.2, 0]} />
      <Model name="props/Bottle_1" position={[0.25, 1.0, 1.05]} />
      <Model name="props/Barrel" position={[0.05, 0, 2.3]} />
    </group>
  );
}

/** A worn rug, its colour sunk deep into the dark. */
export function Rug({ position, size, color }: { position: P; size: [number, number]; color: string }) {
  const c = new THREE.Color(color).lerp(new THREE.Color('#1c130d'), 0.72);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      <meshStandardMaterial color={c} roughness={1} />
    </mesh>
  );
}

/** A wooden shield hung on the wall (was: the wall clock). */
export function WallClock({ position, rotationY = 0 }: { position: P; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Model name="props/Shield_Wooden" scale={1.3} />
    </group>
  );
}

/** Three bookcases side by side, 4.4 m along local X, backs to the wall, filled with the library (Books.tsx). */
export function Bookshelf({ position, rotationY = 0 }: { position: P; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-1.47, 0, 1.47].map((x, i) => (
        <Bookcase key={x} position={[x, 0, 0]} seed={i + 1} offset={i * 15} />
      ))}
    </group>
  );
}

/**
 * A wooden screen between two points (was: a glass wall): a low panelled wall, posts, and a top rail, so you can
 * still see over and between. The colliders (layout.ts) are unchanged.
 */
export function GlassWall({ from, to, height = 2.8 }: { from: [number, number]; to: [number, number]; height?: number }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  const cx = (from[0] + to[0]) / 2;
  const cz = (from[1] + to[1]) / 2;
  const rot = -Math.atan2(dz, dx);
  const posts = Math.max(2, Math.round(len / 1.2) + 1);
  return (
    <group position={[cx, 0, cz]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.5, 0]} material={WOOD_DARK}>
        <boxGeometry args={[len, 1, 0.08]} />
      </mesh>
      <mesh position={[0, 1.02, 0]} material={WOOD}>
        <boxGeometry args={[len, 0.06, 0.14]} />
      </mesh>
      <mesh position={[0, height - 0.05, 0]} material={WOOD}>
        <boxGeometry args={[len, 0.1, 0.12]} />
      </mesh>
      {Array.from({ length: posts }, (_, i) => (
        <mesh key={i} position={[-len / 2 + (len * i) / (posts - 1), height / 2, 0]} material={WOOD}>
          <boxGeometry args={[0.1, height, 0.1]} />
        </mesh>
      ))}
    </group>
  );
}

// The chandelier model's six candles: on its ring, just below the top of the spikes.
const CANDLE_Y = -0.98;
const CANDLES = Array.from({ length: 6 }, (_, i) => [Math.cos((i * Math.PI) / 3) * 0.58, Math.sin((i * Math.PI) / 3) * 0.58] as const);

/** An iron ring chandelier with candles, hung from the vault at `position` (its top). */
export function Chandelier({ position }: { position: P }) {
  return (
    <group position={position}>
      <Model name="props/Chandelier" />
      {CANDLES.map(([x, z], i) => (
        <group key={i} position={[x, CANDLE_Y, z]}>
          <Flame size={0.55} />
        </group>
      ))}
      <FirePoint position={[0, -1.1, 0]} look={FIRE.chandelier} />
    </group>
  );
}

export { IRON };
