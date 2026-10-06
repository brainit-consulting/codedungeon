import { useRef } from 'react';
import * as THREE from 'three';
import { BACK_BAR, BAR_STOOLS, FEAST_TABLES, HALF_W, HEARTH, RECEPTION, WALL_H } from './layout';
import { STOOL_SCALE } from './tavernRules';
import { FIRE, Flame, useFireLight } from './lightPool';
import { Model } from './models';
import { Chandelier } from './Props';
import { stone } from './stone';
import { TableFood } from './Feast';

// The great hall's tavern: the bar with its back bar of kegs and bottles, the stools, the hearth, the feasting
// tables. Placed by layout.ts's constants, which also give each its collider.

const OAK = new THREE.MeshStandardMaterial({ color: '#3b281a', roughness: 0.8 });
const OAK_TOP = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.55 });
const SOOT = new THREE.MeshStandardMaterial({ color: '#0d0a08', roughness: 1 });
const EMBER = new THREE.MeshBasicMaterial({ color: '#ff5a1a', toneMapped: false });

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

/** The hearth in the middle of the west wall: a stone chimney breast, a deep firebox, logs and a big fire. */
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
      {[-0.35, 0, 0.35].map((x, i) => (
        <mesh key={x} position={[x, 0.12, d / 2]} rotation={[0, 0.5 - i * 0.5, Math.PI / 2]} material={OAK}>
          <cylinderGeometry args={[0.08, 0.09, 0.9, 8]} />
        </mesh>
      ))}
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
      {/* a cauldron on the hearthstone, a stack of logs beside */}
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
          <Model name="props/Table_Plate" position={[-0.4, 0.815, -0.25]} />
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
