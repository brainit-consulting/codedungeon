import * as THREE from 'three';
import { tableFood, type Dish, type Placed } from './feastRules';

// The food on the great hall's feasting tables (feastRules.ts), built from primitives: crusty bread on boards, a
// cheese wheel with a wedge cut from it, a turned wooden bowl of apples and a bunch of grapes. Each dish stands on its
// own y = 0 and carries its name for propAudit.ts, which checks it rests on the table.

const mat = (color: string, roughness: number) => new THREE.MeshStandardMaterial({ color, roughness });
const M = {
  board: mat('#6b4629', 0.85),
  crust: mat('#a2622a', 0.75),
  score: mat('#c08a4e', 0.8), // the paler crumb showing where the crust was cut
  cheese: mat('#e3bd55', 0.6),
  rind: mat('#b9842a', 0.55),
  bowl: mat('#5a3a20', 0.7),
  apples: [mat('#8a2318', 0.45), mat('#7d973a', 0.5), mat('#ab4e27', 0.45)],
  stem: mat('#46301a', 0.9),
  grape: mat('#34183f', 0.35), // deep enough to stay purple in the firelight
};

// ---------- the shapes, built once ----------

const BOARD = new THREE.BoxGeometry(0.36, 0.024, 0.2).translate(0, 0.012, 0);
const ROUND_BOARD = new THREE.CylinderGeometry(0.105, 0.105, 0.02, 24).translate(0, 0.01, 0);
const CHEESE_BOARD = new THREE.CylinderGeometry(0.155, 0.155, 0.02, 28).translate(0, 0.01, 0);
const LOAF = new THREE.SphereGeometry(0.075, 22, 14).scale(1.75, 0.72, 1);
const BOULE = new THREE.SphereGeometry(0.08, 22, 14).scale(1, 0.68, 1);
const SCORE = new THREE.BoxGeometry(0.07, 0.004, 0.012);

const WHEEL_R = 0.11;
const WHEEL_H = 0.072;
const GAP = 0.65; // the wedge cut from the wheel (radians)
/** A cheese sector as a solid: from angle a, `len` radians round, lying flat with its base at y = 0. */
function sector(a: number, len: number) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, WHEEL_R, a, a + len, false);
  s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: WHEEL_H, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 36 })
    .rotateX(-Math.PI / 2)
    .translate(0, 0.003, 0);
}
/** The rind round the curved outside only, so the cut faces show the pale cheese. A shape's angle a is a cylinder's a + π/2. */
function rind(a: number, len: number) {
  return new THREE.CylinderGeometry(WHEEL_R + 0.0045, WHEEL_R + 0.0045, WHEEL_H + 0.004, 40, 1, true, a + Math.PI / 2, len).translate(0, WHEEL_H / 2 + 0.003, 0);
}
const WHEEL = sector(GAP / 2, Math.PI * 2 - GAP);
const WHEEL_RIND = rind(GAP / 2, Math.PI * 2 - GAP);
const WEDGE = sector(-GAP / 2, GAP);
const WEDGE_RIND = rind(-GAP / 2, GAP);

// a turned bowl: outside, over the lip, and back down the inside
const BOWL = new THREE.LatheGeometry(
  [
    [0, 0],
    [0.07, 0],
    [0.11, 0.018],
    [0.135, 0.05],
    [0.142, 0.064],
    [0.133, 0.065],
    [0.126, 0.054],
    [0.1, 0.026],
    [0.06, 0.014],
    [0, 0.014],
  ].map(([x, y]) => new THREE.Vector2(x, y)),
  28,
);
const APPLE = new THREE.SphereGeometry(0.037, 16, 12).scale(1, 0.9, 1);
const STEM = new THREE.CylinderGeometry(0.0025, 0.0025, 0.02, 5);
const GRAPE = new THREE.SphereGeometry(0.0135, 10, 8);

/** Five apples heaped in the bowl: three round the bottom, two on top. */
const APPLES: [number, number, number][] = [
  [0.055, 0.047, 0],
  [-0.0275, 0.047, 0.0476],
  [-0.0275, 0.047, -0.0476],
  [0.012, 0.11, 0.018],
  [-0.02, 0.105, -0.022],
];

/** A bunch of grapes lying on the table: a tapering spread of berries, and a second layer along its middle. */
const GRAPES: [number, number, number][] = [];
for (const [row, n] of [4, 4, 3, 2, 1].entries()) for (let k = 0; k < n; k++) GRAPES.push([(k - (n - 1) / 2) * 0.026, 0.0135, row * 0.023 - 0.045]);
for (const [row, n] of [3, 2, 1].entries()) for (let k = 0; k < n; k++) GRAPES.push([(k - (n - 1) / 2) * 0.026, 0.035, row * 0.023 - 0.034]);

// ---------- the dishes ----------

function Loaf() {
  return (
    <>
      <mesh geometry={BOARD} material={M.board} />
      <mesh geometry={LOAF} material={M.crust} position={[0, 0.024 + 0.054, 0]} />
      {[-0.06, 0, 0.06].map((x) => (
        <mesh key={x} geometry={SCORE} material={M.score} position={[x, 0.024 + 0.103, 0]} rotation={[0, -0.6, 0]} />
      ))}
    </>
  );
}

function Boule() {
  return (
    <>
      <mesh geometry={ROUND_BOARD} material={M.board} />
      <mesh geometry={BOULE} material={M.crust} position={[0, 0.02 + 0.0544, 0]} />
      {[0, Math.PI / 2].map((a) => (
        <mesh key={a} geometry={SCORE} material={M.score} position={[0, 0.02 + 0.104, 0]} rotation={[0, a, 0]} />
      ))}
    </>
  );
}

function Cheese() {
  return (
    <>
      <mesh geometry={CHEESE_BOARD} material={M.board} />
      <group position={[-0.02, 0.02, 0]}>
        <mesh geometry={WHEEL} material={M.cheese} />
        <mesh geometry={WHEEL_RIND} material={M.rind} />
      </group>
      {/* the wedge, cut and set down beside the wheel */}
      <group position={[0.07, 0.02, 0.05]} rotation={[0, 0.5, 0]}>
        <mesh geometry={WEDGE} material={M.cheese} />
        <mesh geometry={WEDGE_RIND} material={M.rind} />
      </group>
    </>
  );
}

function Apples() {
  return (
    <>
      <mesh geometry={BOWL} material={M.bowl} />
      {APPLES.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} rotation={[i * 0.4, i * 1.3, i * 0.3]}>
          <mesh geometry={APPLE} material={M.apples[i % M.apples.length]} />
          <mesh geometry={STEM} material={M.stem} position={[0, 0.036, 0]} rotation={[0.3, 0, 0.2]} />
        </group>
      ))}
    </>
  );
}

function Grapes() {
  return (
    <>
      {GRAPES.map(([x, y, z], i) => (
        <mesh key={i} geometry={GRAPE} material={M.grape} position={[x, y, z]} />
      ))}
      <mesh geometry={STEM} material={M.stem} position={[0, 0.03, -0.06]} rotation={[Math.PI / 2.4, 0, 0]} />
    </>
  );
}

const DISHES: Record<Dish, () => React.JSX.Element> = { loaf: Loaf, boule: Boule, cheese: Cheese, apples: Apples, grapes: Grapes };

function DishAt({ dish }: { dish: Placed }) {
  const Shape = DISHES[dish.kind];
  return (
    <group position={[dish.x, 0, dish.z]} rotation={[0, dish.turn, 0]} userData={{ model: `food/${dish.kind}` }}>
      <Shape />
    </group>
  );
}

/** One feasting table's spread, in the table's frame with its top at y = 0 (FeastTables puts it there). */
export function TableFood({ index }: { index: number }) {
  return (
    <>
      {tableFood(index).map((d) => (
        <DishAt key={`${d.kind}${d.x}`} dish={d} />
      ))}
    </>
  );
}
