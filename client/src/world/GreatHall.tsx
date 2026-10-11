import { useRef } from 'react';
import * as THREE from 'three';
import { BACK_BAR, BAR_STOOLS, FEAST_TABLES, FIREWOOD, HALF_W, HEARTH, RECEPTION, WALL_H } from './layout';
import { FIRE_LOGS, bundle, fireLogs, fireTop, logPile, type Log } from './firewood';
import { STOOL_SCALE } from './tavernRules';
import { FIRE, Flame, useFireLight } from './lightPool';
import { Model } from './models';
import { Chandelier } from './Props';
import { stone } from './stone';
import { TableFood } from './Feast';
import { PLATE } from './feastRules';

// The great hall's tavern: the bar with its back bar of kegs and bottles, the stools, the hearth and its firewood, the
// feasting tables. Placed by layout.ts's constants, which also give each its collider.

const OAK = new THREE.MeshStandardMaterial({ color: '#3b281a', roughness: 0.8 });
const OAK_TOP = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.55 });
const SOOT = new THREE.MeshStandardMaterial({ color: '#0d0a08', roughness: 1 });
const EMBER = new THREE.MeshBasicMaterial({ color: '#ff5a1a', toneMapped: false });
const IRON = new THREE.MeshStandardMaterial({ color: '#1d1b1a', roughness: 0.6, metalness: 0.6 });

// ---------- the jug on the bar ----------

/**
 * A glazed earthenware jug: a turned body (out over the lip and back down the inside, so its mouth is open), the lip
 * pinched out into a pouring spout, and a flat strap handle opposite. Base at y = 0, the spout towards +x.
 */
function jugBody(): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(
    [
      [0, 0],
      [0.05, 0],
      [0.058, 0.008],
      [0.072, 0.045],
      [0.078, 0.085],
      [0.072, 0.13],
      [0.056, 0.17],
      [0.046, 0.195],
      [0.048, 0.215],
      [0.056, 0.236],
      [0.058, 0.242],
      [0.052, 0.242],
      [0.049, 0.232],
      [0.041, 0.212],
      [0.04, 0.19],
      [0.05, 0.165],
      [0.066, 0.12],
      [0.066, 0.05],
      [0.05, 0.016],
      [0, 0.014],
    ].map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );
  // the spout: the lip drawn out and up on the +x side, most at the very top
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = [p.getX(i), p.getY(i), p.getZ(i)];
    const r = Math.hypot(x, z);
    if (y < 0.195 || r < 1e-6) continue;
    const w = Math.max(0, x / r) ** 6 * ((y - 0.195) / 0.047) ** 2;
    const k = (r + w * 0.03) / r;
    p.setXYZ(i, x * k, y + w * 0.012, z * k * (1 - w * 0.35));
  }
  g.computeVertexNormals();
  return g;
}
const JUG = jugBody();
const JUG_HANDLE = new THREE.TubeGeometry(
  new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.044, 0.215, 0),
    new THREE.Vector3(-0.1, 0.205, 0),
    new THREE.Vector3(-0.118, 0.15, 0),
    new THREE.Vector3(-0.1, 0.09, 0),
    new THREE.Vector3(-0.07, 0.06, 0),
  ]),
  20,
  0.0095,
  8,
).scale(1, 1, 1.6);
const GLAZE = new THREE.MeshStandardMaterial({ color: '#4f2e17', roughness: 0.32 });

function Jug({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]} userData={{ model: 'props/jug' }}>
      <mesh geometry={JUG} material={GLAZE} />
      <mesh geometry={JUG_HANDLE} material={GLAZE} />
    </group>
  );
}

// ---------- logs ----------

// a log: a rough round of bark along x, its sawn ends showing pale wood (or char, in the fire); turned about its own
// length so no two look alike, then by its yaw
const LOG = new THREE.CylinderGeometry(1, 1, 1, 9).rotateZ(Math.PI / 2);
const BARK = new THREE.MeshStandardMaterial({ color: '#3f2b1c', roughness: 0.95 });
const END_GRAIN = new THREE.MeshStandardMaterial({ color: '#9c7448', roughness: 0.9 });
const CHAR = new THREE.MeshStandardMaterial({ color: '#2e1f15', roughness: 1 });
const CHAR_END = new THREE.MeshStandardMaterial({ color: '#6a3418', roughness: 1 });
const ROPE = new THREE.MeshStandardMaterial({ color: '#7a6040', roughness: 1 });
const SAWN = [BARK, END_GRAIN, END_GRAIN];
const BURNT = [CHAR, CHAR_END, CHAR_END];

/** Logs laid out by firewood.ts, in their pile's frame (x along the logs). */
function Logs({ logs, burnt }: { logs: Log[]; burnt?: boolean }) {
  return (
    <>
      {logs.map((l, i) => (
        <mesh key={i} geometry={LOG} material={burnt ? BURNT : SAWN} position={[l.x, l.y, l.z]} rotation={[i * 1.3, l.yaw, 0, 'YXZ']} scale={[l.len, l.r, l.r]} />
      ))}
    </>
  );
}

/** An iron firedog: a bar front to back for the logs to lie across, on two feet, with a post and knob at the front. */
function Firedog({ x, from, to }: { x: number; from: number; to: number }) {
  const bar = FIRE_LOGS.dogs - 0.012;
  return (
    <group position={[x, 0, 0]}>
      <mesh material={IRON} position={[0, bar, (from + to) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, to - from, 6]} />
      </mesh>
      {[from + 0.03, to - 0.02].map((z) => (
        <mesh key={z} material={IRON} position={[0, bar / 2, z]}>
          <boxGeometry args={[0.07, bar, 0.018]} />
        </mesh>
      ))}
      <mesh material={IRON} position={[0, 0.17, to]}>
        <cylinderGeometry args={[0.014, 0.018, 0.34, 6]} />
      </mesh>
      <mesh material={IRON} position={[0, 0.355, to]}>
        <sphereGeometry args={[0.03, 8, 6]} />
      </mesh>
    </group>
  );
}

const FIRE_PILE = fireLogs();
const FIRE_LAID = [...FIRE_PILE, ...fireTop(FIRE_PILE)];
const STACK = logPile('stack', [5, 4, 3, 2], { r: 0.06, len: 0.46, spread: 0.008 });
const BUNDLE = bundle('bundle', 0.042, 0.62);

/** The firewood against the wall beside the hearth (layout.ts FIREWOOD): a stack, ends to the room, and a tied bundle along the wall. */
export function Firewood() {
  const { stack, bundle: tied } = FIREWOOD;
  return (
    <>
      <group position={[stack.x, 0, stack.z]} userData={{ model: 'firewood/stack' }}>
        <Logs logs={STACK} />
      </group>
      <group position={[tied.x, 0, tied.z]} rotation={[0, Math.PI / 2, 0]} userData={{ model: 'firewood/bundle' }}>
        <Logs logs={BUNDLE.logs} />
        {[-0.18, 0.18].map((x) => (
          <mesh key={x} material={ROPE} position={[x, BUNDLE.logs[0].y, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[BUNDLE.radius + 0.004, BUNDLE.radius + 0.004, 0.03, 14, 1, true]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

// ---------- the bar, the hearth, the tables ----------

/** The bar: a heavy oak counter (the old reception desk's footprint), mugs and bottles on it, stools before it. */
export function Bar() {
  const { x, z, w, d } = RECEPTION;
  return (
    <group>
      <group position={[x, 0, z]}>
        <mesh position={[0, 0.52, 0]} material={OAK}>
          <boxGeometry args={[w, 1.04, d]} />
        </mesh>
        <mesh position={[0, 1.07, 0]} material={OAK_TOP}>
          <boxGeometry args={[w + 0.12, 0.07, d + 0.12]} />
        </mesh>
        {/* a foot rail on the drinkers' side */}
        <mesh position={[0, 0.2, d / 2 + 0.12]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, w - 0.2, 8]} />
          <meshStandardMaterial color="#2d2a26" roughness={0.5} metalness={0.7} />
        </mesh>
        {/* the drinkers bring their own mugs (Tavern.tsx); this one stands between two stools */}
        <Model name="props/Mug" position={[1.3, 1.1, 0.2]} rotation={[0, 0.7, 0]} />
        <Model name="props/Bottle_1" position={[0.5, 1.1, -0.2]} />
        <Model name="props/Chalice" position={[2.0, 1.1, -0.1]} />
        <Model name="props/Table_Plate" position={[-1.0, 1.105, 0.05]} />
        {/* a jug of ale at the west end, behind where the cat sits with her tankard (Cat.tsx) */}
        <Jug position={[-2.32, 1.105, -0.26]} rotationY={-0.5} />
      </group>

      {/* the back bar: two kegs on cradles, a cupboard between them with bottles on top */}
      <group position={[BACK_BAR.x, 0, BACK_BAR.z]} rotation={[0, Math.PI, 0]}>
        <Model name="props/Barrel_Holder" position={[-1.85, 0, 0]} />
        <Model name="props/Barrel_Holder" position={[1.85, 0, 0]} />
        <Model name="props/Cabinet" position={[0, 0, -0.1]} />
        <Model name="props/SmallBottles_1" position={[-0.35, 1.0, -0.1]} />
        <Model name="props/Bottle_1" position={[0.1, 1.0, -0.12]} />
        <Model name="props/SmallBottle" position={[0.4, 1.0, -0.05]} />
        <Model name="props/Vase_4" position={[0.55, 1.0, -0.15]} scale={0.6} />
      </group>

      {BAR_STOOLS.map((s) => (
        <Model key={s.x} name="props/Stool" position={[s.x, 0, s.z]} rotation={[0, s.x, 0]} scale={[1, STOOL_SCALE, 1]} />
      ))}
    </group>
  );
}

/** The hearth in the middle of the west wall: a stone chimney breast, a deep firebox, logs on firedogs and a big fire. */
export function Hearth() {
  const fire = useRef<THREE.Group>(null);
  useFireLight(fire, FIRE.hearth);
  const { z, w, d } = HEARTH;
  const opening = { w: 1.9, h: 1.3 };
  const side = (w - opening.w) / 2;
  return (
    <group position={[-HALF_W, 0, z]} rotation={[0, Math.PI / 2, 0]}>
      {/* local +Z faces into the hall; the wall is at local z = 0 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (opening.w / 2 + side / 2), opening.h / 2, d / 2]} material={stone('brick', side, opening.h)}>
          <boxGeometry args={[side, opening.h, d]} />
        </mesh>
      ))}
      <mesh position={[0, (opening.h + WALL_H) / 2, d / 2]} material={stone('brick', w, WALL_H - opening.h)}>
        <boxGeometry args={[w, WALL_H - opening.h, d]} />
      </mesh>
      {/* mantel */}
      <mesh position={[0, opening.h + 0.08, d + 0.08]} material={OAK}>
        <boxGeometry args={[w + 0.2, 0.16, 0.3]} />
      </mesh>
      {/* the firebox: sooty back and floor, logs, embers, flames */}
      <mesh position={[0, opening.h / 2, 0.05]} material={SOOT}>
        <boxGeometry args={[opening.w, opening.h, 0.1]} />
      </mesh>
      <mesh position={[0, 0.02, d / 2]} rotation={[-Math.PI / 2, 0, 0]} material={SOOT}>
        <planeGeometry args={[opening.w, d]} />
      </mesh>
      {/* the logs, on a pair of firedogs */}
      <group position={[0, 0, d / 2]}>
        <Firedog x={-0.32} from={-0.33} to={0.36} />
        <Firedog x={0.32} from={-0.33} to={0.36} />
        <Logs logs={FIRE_LAID} burnt />
      </group>
      <mesh position={[0, 0.06, d / 2]} rotation={[-Math.PI / 2, 0, 0]} material={EMBER}>
        <circleGeometry args={[0.45, 16]} />
      </mesh>
      <group ref={fire} position={[0, 0.25, d / 2]}>
        {[-0.35, -0.12, 0.12, 0.35].map((x, i) => (
          <group key={x} position={[x, 0, (i % 2) * 0.1]}>
            <Flame size={2.6 - Math.abs(x) * 2} />
          </group>
        ))}
      </group>
      {/* a cauldron on the hearthstone */}
      <Model name="props/Cauldron" position={[1.25, 0, d + 0.45]} scale={0.7} />
    </group>
  );
}

/** Two long feasting tables with a bench either side, a candle and some mugs on each, a chandelier over each. */
export function FeastTables() {
  return (
    <>
      <Chandelier position={[RECEPTION.x, WALL_H, RECEPTION.z - 0.9]} />
      {FEAST_TABLES.map((t, i) => (
        <group key={t.x} position={[t.x, 0, t.z]}>
          <Chandelier position={[0, WALL_H, 0]} />
          <Model name="props/Table_Large" />
          <Model name="props/Bench" position={[0, 0, -0.85]} />
          <Model name="props/Bench" position={[0, 0, 0.85]} rotation={[0, Math.PI, 0]} />
          <Model name="props/CandleStick_Triple" position={[0, 0.81, 0]} />
          <Model name="props/Table_Plate" position={[PLATE.x, 0.815, PLATE.z]} />
          <TableCandles />
          <group position={[0, 0.815, 0]}>
            <TableFood index={i} />
          </group>
        </group>
      ))}
    </>
  );
}

function TableCandles() {
  const fire = useRef<THREE.Group>(null);
  useFireLight(fire, FIRE.candle);
  return (
    <group ref={fire} position={[0, 1.27, 0]}>
      {[-0.17, 0, 0.17].map((x) => (
        <group key={x} position={[x, x === 0 ? 0.03 : 0, 0]}>
          <Flame size={0.55} />
        </group>
      ))}
    </group>
  );
}
