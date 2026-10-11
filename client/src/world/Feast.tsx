import * as THREE from 'three';
import { BITES, PLATE, plateFood, tableFood, tableGrapes, type Bite, type Bunch, type Dish, type OnPlate, type Placed } from './feastRules';

// The food on the great hall's feasting tables (feastRules.ts), built from primitives: crusty bread on boards, a
// cheese wheel with a wedge cut from it, a turned wooden bowl of apples, bunches of green and dark grapes, and on the
// plate slices of ham and cheese. Each dish stands on its own y = 0 and carries its name for propAudit.ts, which
// checks it rests on the table (or the plate, or the slice under it).

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
  // two shades of each, berry to berry: deep enough to stay purple, and a green that stays green, in the firelight
  grapes: { dark: [mat('#34183f', 0.35), mat('#4a1c34', 0.38)], green: [mat('#55701f', 0.38), mat('#6a8a2a', 0.4)] },
  ham: mat('#7a2020', 0.5),
  fat: mat('#d9bfa4', 0.5),
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
/** A cheese sector as a solid: from angle a, `len` radians round, r across, lying flat with its base at y = 0, h + 2 bevel high. */
function sector(a: number, len: number, r = WHEEL_R, h = WHEEL_H, bevel = 0.003) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, r, a, a + len, false);
  s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 36 })
    .rotateX(-Math.PI / 2)
    .translate(0, bevel, 0);
}
/** The rind round the curved outside only, so the cut faces show the pale cheese. A shape's angle a is a cylinder's a + π/2. */
function rind(a: number, len: number, r = WHEEL_R, h = WHEEL_H, bevel = 0.003) {
  return new THREE.CylinderGeometry(r + bevel * 1.5, r + bevel * 1.5, h + 2 * bevel - 0.002, 40, 1, true, a + Math.PI / 2, len).translate(0, h / 2 + bevel, 0);
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
const GRAPE = new THREE.SphereGeometry(1, 10, 8); // scaled to each berry

/** Five apples heaped in the bowl: three round the bottom, two on top. */
const APPLES: [number, number, number][] = [
  [0.055, 0.047, 0],
  [-0.0275, 0.047, 0.0476],
  [-0.0275, 0.047, -0.0476],
  [0.012, 0.11, 0.018],
  [-0.02, 0.105, -0.022],
];

// ---------- on the plate ----------

/**
 * A slice of ham: an uneven oval, `along` by `across`, with a band of fat round one side, lying flat on y = 0. The lean
 * is pulled in where the fat is, so the two meet edge to edge and never overlap.
 */
function hamSlice(seed: number): [THREE.BufferGeometry, THREE.BufferGeometry] {
  const { along, across, thick } = BITES.ham;
  const fatFrom = Math.PI * (0.55 + 0.1 * Math.sin(seed));
  const fatTo = fatFrom + Math.PI * 0.85;
  // how much of the radius is fat at angle t: none outside the band, easing in and out at its ends
  const fatAt = (t: number) => {
    const u = (t - fatFrom) / (fatTo - fatFrom);
    return u <= 0 || u >= 1 ? 0 : 0.2 * Math.sin(Math.PI * u) ** 0.6;
  };
  const outer = (t: number) => 0.92 + 0.05 * Math.sin(3 * t + seed) + 0.03 * Math.sin(5 * t + seed * 2.3); // at most 1
  const at = (t: number, k: number) => new THREE.Vector2(Math.cos(t) * along * k, Math.sin(t) * across * k);
  const round = Array.from({ length: 48 }, (_, i) => (i / 48) * Math.PI * 2);
  const lean = new THREE.Shape(round.map((t) => at(t, outer(t) * (1 - fatAt(t)))));
  const band = Array.from({ length: 25 }, (_, i) => fatFrom + ((fatTo - fatFrom) * i) / 24);
  const fat = new THREE.Shape([...band.map((t) => at(t, outer(t))), ...[...band].reverse().map((t) => at(t, outer(t) * (1 - fatAt(t))))]);
  const opts = { depth: thick - 0.002, bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: 1 };
  const flat = (g: THREE.BufferGeometry) => g.rotateX(-Math.PI / 2).translate(0, 0.001, 0);
  return [flat(new THREE.ExtrudeGeometry(lean, opts)), flat(new THREE.ExtrudeGeometry(fat, opts))];
}
const HAMS = [0, 1.7, 3.1].map(hamSlice);

/** A thin slice of cheese cut from a small wheel: a long triangle, its rind along the short end, centred on its middle. */
const SLICE_R = BITES.cheeseSlice.along * 2;
const SLICE_A = 2 * Math.asin(BITES.cheeseSlice.across / SLICE_R);
const SLICE = sector(-SLICE_A / 2, SLICE_A, SLICE_R, BITES.cheeseSlice.thick - 0.002, 0.001).translate(-SLICE_R / 2, 0, 0);
const SLICE_RIND = rind(-SLICE_A / 2, SLICE_A, SLICE_R, BITES.cheeseSlice.thick - 0.002, 0.001).translate(-SLICE_R / 2, 0, 0);
/** A small wedge, as the one cut from the wheel but from a smaller cheese, centred on its middle. */
const BITE_R = BITES.cheeseWedge.along * 2;
const BITE_A = 2 * Math.asin(BITES.cheeseWedge.across / BITE_R);
const BITE_WEDGE = sector(-BITE_A / 2, BITE_A, BITE_R, BITES.cheeseWedge.thick - 0.006).translate(-BITE_R / 2, 0, 0);
const BITE_RIND = rind(-BITE_A / 2, BITE_A, BITE_R, BITES.cheeseWedge.thick - 0.006).translate(-BITE_R / 2, 0, 0);

const BITE_SHAPES: Record<Bite, (i: number) => [THREE.BufferGeometry, THREE.Material][]> = {
  ham: (i) => [
    [HAMS[i % HAMS.length][0], M.ham],
    [HAMS[i % HAMS.length][1], M.fat],
  ],
  cheeseSlice: () => [
    [SLICE, M.cheese],
    [SLICE_RIND, M.rind],
  ],
  cheeseWedge: () => [
    [BITE_WEDGE, M.cheese],
    [BITE_RIND, M.rind],
  ],
};

/** A piece on the plate, on the slices it lies on (feastRules.ts plateFood). */
function PlatePiece({ piece, i }: { piece: OnPlate; i: number }) {
  return (
    <group position={[piece.x, piece.layer * BITES[piece.kind].thick, piece.z]} rotation={[0, piece.turn, 0]} userData={{ model: `food/${piece.kind}` }}>
      {BITE_SHAPES[piece.kind](i).map(([g, m], k) => (
        <mesh key={k} geometry={g} material={m} />
      ))}
    </group>
  );
}

// ---------- grapes ----------

/** A bunch of grapes lying on the table (feastRules.ts lays out its berries), its stalk at the wide end. */
function Grapes({ bunch }: { bunch: Bunch }) {
  const shades = M.grapes[bunch.colour];
  const stalkZ = Math.min(...bunch.berries.map(([, , z]) => z)) - 0.012;
  return (
    <group position={[bunch.x, 0, bunch.z]} rotation={[0, bunch.turn, 0]} userData={{ model: `food/grapes-${bunch.colour}` }}>
      {bunch.berries.map(([x, y, z, r], i) => (
        <mesh key={i} geometry={GRAPE} material={shades[i % 3 === 0 ? 1 : 0]} position={[x, y, z]} scale={r} />
      ))}
      <mesh geometry={STEM} material={M.stem} position={[0, 0.03, stalkZ]} rotation={[Math.PI / 2.4, 0, 0]} />
    </group>
  );
}

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

const DISHES: Record<Dish, () => React.JSX.Element> = { loaf: Loaf, boule: Boule, cheese: Cheese, apples: Apples };

function DishAt({ dish }: { dish: Placed }) {
  const Shape = DISHES[dish.kind];
  return (
    <group position={[dish.x, 0, dish.z]} rotation={[0, dish.turn, 0]} userData={{ model: `food/${dish.kind}` }}>
      <Shape />
    </group>
  );
}

/** One feasting table's spread, in the table's frame with its top at y = 0 (FeastTables puts it there), and its plate's. */
export function TableFood({ index }: { index: number }) {
  return (
    <>
      {tableFood(index).map((d) => (
        <DishAt key={`${d.kind}${d.x}`} dish={d} />
      ))}
      {tableGrapes(index).map((b, i) => (
        <Grapes key={i} bunch={b} />
      ))}
      <group position={[PLATE.x, PLATE.wellY, PLATE.z]}>
        {plateFood(index).map((p, i) => (
          <PlatePiece key={i} piece={p} i={i + index} />
        ))}
      </group>
    </>
  );
}
