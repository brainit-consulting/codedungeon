import { useRef } from 'react';
import * as THREE from 'three';
import { FIRE, Flame, useFireLight, type FireLook } from './lightPool';
import { Model } from './models';
import { Bookcase } from './Books';
import { useCanvasTexture } from './interact';

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

// ---------- the wolf's rug ----------

const RUG_PX = 160; // canvas pixels to the metre
/** How deep the fringe at each short end is (m), part of the rug's length. */
const FRINGE = 0.07;

/**
 * A knotted wool rug in the old style, painted on a canvas: a madder-red field with a stepped lozenge medallion and a
 * lattice of small diamonds, a deep indigo border of ochre lozenges between pale guard stripes, the weave showing
 * through, a little worn, and a fringe of loose warp threads at both short ends (drawn on transparent canvas, cut out
 * by alphaTest), W by H canvas pixels.
 */
function paintRug(ctx: CanvasRenderingContext2D, W: number, H: number) {
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const f = Math.round(FRINGE * RUG_PX);
  const C = { field: '#8e2f22', indigo: '#28304a', ochre: '#c8913a', cream: '#d8c39a', dark: '#3b1712', green: '#4d5a32' };
  // the fringe: warp threads, a little uneven, knotted in bunches at the rug's edge
  for (const top of [true, false]) {
    for (let x = 4; x < W - 3; x += 5) {
      const len = f * (0.75 + rand() * 0.25);
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x, top ? f : H - f);
      ctx.lineTo(x + (rand() - 0.5) * 3, top ? f - len : H - f + len);
      ctx.stroke();
    }
    ctx.fillStyle = C.cream;
    for (let x = 6; x < W - 6; x += 15) ctx.fillRect(x - 4, top ? f - 7 : H - f + 1, 8, 6);
  }
  const x0 = 0;
  const y0 = f;
  const w = W;
  const h = H - 2 * f;
  const diamond = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
  };
  // the field, its lattice of small diamonds
  ctx.fillStyle = C.field;
  ctx.fillRect(x0, y0, w, h);
  const B = 34; // the border's width
  const G = 6; // a guard stripe
  ctx.save();
  ctx.beginPath();
  ctx.rect(B + 2 * G, y0 + B + 2 * G, w - 2 * (B + 2 * G), h - 2 * (B + 2 * G));
  ctx.clip();
  for (let y = y0 + 20; y < y0 + h; y += 28)
    for (let x = ((y - y0) / 28) % 2 ? 14 : 0; x < w + 14; x += 28) {
      diamond(x, y, 6, 8);
      ctx.fillStyle = C.dark;
      ctx.fill();
      diamond(x, y, 2.5, 3.5);
      ctx.fillStyle = C.ochre;
      ctx.fill();
    }
  // the medallion: stepped lozenges, one in another, and a small one above and below it
  const cx = w / 2;
  const cy = y0 + h / 2;
  [
    [70, 108, C.cream],
    [64, 100, C.indigo],
    [50, 80, C.ochre],
    [42, 68, C.field],
    [30, 50, C.indigo],
    [18, 30, C.cream],
    [9, 15, C.field],
  ].forEach(([rx, ry, c]) => {
    diamond(cx, cy, rx as number, ry as number);
    ctx.fillStyle = c as string;
    ctx.fill();
  });
  for (const s of [-1, 1]) {
    diamond(cx, cy + s * 140, 26, 26);
    ctx.fillStyle = C.indigo;
    ctx.fill();
    diamond(cx, cy + s * 140, 12, 12);
    ctx.fillStyle = C.green;
    ctx.fill();
  }
  ctx.restore();
  // the border: guard stripe, indigo band of ochre lozenges, guard stripe
  const band = (inset: number, width: number, colour: string) => {
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.strokeRect(x0 + inset + width / 2, y0 + inset + width / 2, w - 2 * inset - width, h - 2 * inset - width);
  };
  band(0, G, C.cream);
  band(G, B, C.indigo);
  band(G + B, G, C.cream);
  const mid = G + B / 2;
  const along = (len: number, at: (t: number) => [number, number]) => {
    const n = Math.round(len / 30);
    for (let i = 0; i < n; i++) {
      const [x, y] = at((i + 0.5) / n);
      diamond(x, y, 11, 11);
      ctx.fillStyle = C.ochre;
      ctx.fill();
      diamond(x, y, 4, 4);
      ctx.fillStyle = C.field;
      ctx.fill();
    }
  };
  along(w - 2 * mid, (t) => [mid + t * (w - 2 * mid), y0 + mid]);
  along(w - 2 * mid, (t) => [mid + t * (w - 2 * mid), y0 + h - mid]);
  along(h - 2 * mid, (t) => [mid, y0 + mid + t * (h - 2 * mid)]);
  along(h - 2 * mid, (t) => [w - mid, y0 + mid + t * (h - 2 * mid)]);
  // the weave: fine rows of knots, and wear, most where the wolf lies
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#000';
  for (let y = y0; y < y0 + h; y += 3) ctx.fillRect(x0, y, w, 1);
  ctx.globalAlpha = 1;
  for (let i = 0; i < 2600; i++) {
    const x = rand() * w;
    const y = y0 + rand() * h;
    const near = 1 - Math.min(1, Math.hypot((x - cx) / w, (y - cy) / h) * 2.2);
    ctx.globalAlpha = 0.06 + 0.12 * near;
    ctx.fillStyle = rand() < 0.5 ? '#000' : C.cream;
    ctx.fillRect(x, y, 1 + rand() * 3, 1 + rand() * 2);
  }
  ctx.globalAlpha = 1;
}

/** The wolf's rug (Wolf.tsx), `size` [across, long] in metres, lying flat, its fringe at the long ends. */
export function WovenRug({ position, size }: { position: P; size: [number, number] }) {
  const tex = useCanvasTexture(Math.round(size[0] * RUG_PX), Math.round(size[1] * RUG_PX), (ctx) => paintRug(ctx, ctx.canvas.width, ctx.canvas.height), []);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={size} />
      {/* toned down to sit in the firelight like the rest of the hall */}
      <meshStandardMaterial map={tex} color="#6a5a50" roughness={1} alphaTest={0.5} />
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
        <Bookcase key={x} position={[x, 0, 0]} seed={i + 1} offset={i * 15} feature={i === 1 ? 'ledger' : undefined} />
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
