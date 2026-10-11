import { hashId } from './appearance';
import { FEAST_TABLES } from './layout';
import { TAVERN_SEATS, restTargets } from './tavernRules';

// What's on the great hall's feasting tables: bread, cheese and fruit, laid along the middle of each table, clear
// of the candlestick, the plate, and the mugs and resting hands of whoever sits there (tavernRules.ts); cold meat and
// cheese on each table's plate; and bunches of grapes, green and dark, a different few on each table. Pure, so it
// can be tested; Feast.tsx draws it.

export type Dish = 'loaf' | 'boule' | 'cheese' | 'apples';

/** How much table each dish takes: the circle it fits in (m). A bunch of grapes says its own (Bunch.radius). */
export const TABLE_FOOD: Record<Dish, { radius: number }> = {
  loaf: { radius: 0.21 }, // a long loaf on its board
  boule: { radius: 0.11 },
  cheese: { radius: 0.17 }, // the wheel and the wedge cut from it
  apples: { radius: 0.15 }, // a bowl of them
};

export interface Placed {
  kind: Dish;
  /** In the table's frame (its middle, on the top): x along it, z across it. */
  x: number;
  z: number;
  /** Turned about the vertical (radians). */
  turn: number;
}

/** Each table's plate (Table_Plate.gltf) in the table's frame: its rim's radius, and the flat well food lies in. */
export const PLATE = { x: -0.4, z: -0.25, r: 0.167, well: 0.125, wellY: 0.006 };
/** The table top's half length and half width (Table_Large.gltf), and the candlestick's round foot in its middle. */
const TOP = { halfX: 1.4, halfZ: 0.53 };
const CANDLESTICK = 0.25;

/** Each table's spread, by its place in FEAST_TABLES: two different spreads, so the tables don't look stamped out. */
const SPREADS: Placed[][] = [
  [
    { kind: 'loaf', x: -1.15, z: 0, turn: 0.15 },
    { kind: 'cheese', x: 0.62, z: 0.02, turn: 2.2 },
    { kind: 'apples', x: 1.15, z: -0.02, turn: 0.6 },
  ],
  [
    { kind: 'cheese', x: -1.1, z: 0.02, turn: -0.8 },
    { kind: 'boule', x: -0.62, z: 0.14, turn: 0.4 },
    { kind: 'loaf', x: 0.75, z: 0.02, turn: -0.1 },
    { kind: 'apples', x: 1.22, z: 0, turn: 1.9 },
  ],
];

export function tableFood(index: number): Placed[] {
  return SPREADS[index % SPREADS.length];
}

/** A small seeded generator (mulberry32), so a table looks the same every visit. */
function random(seed: number) {
  let a = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- where there's room ----------

/** How far food keeps from the drinkers' mugs and resting left hands. */
export const HAND_ROOM = 0.08;

/** The mugs and resting left hands of whoever sits at table `index`, in its frame. */
export function handSpots(index: number): { x: number; z: number }[] {
  const t = FEAST_TABLES[index % FEAST_TABLES.length];
  return TAVERN_SEATS.filter((s) => s.kind === 'bench' && Math.abs(s.mug.x - t.x) < 1.5 && Math.abs(s.mug.z - t.z) < 1).flatMap((s) =>
    [s.mug, restTargets(s).left].map((p) => ({ x: p.x - t.x, z: p.z - t.z })),
  );
}

/** Whether a circle of radius r at (x, z) on table `index` is on the top and clear of everything already there. */
export function roomFor(index: number, x: number, z: number, r: number, taken: { x: number; z: number; r: number }[]): boolean {
  if (Math.abs(x) + r >= TOP.halfX || Math.abs(z) + r >= TOP.halfZ) return false;
  if (Math.abs(x) - r <= CANDLESTICK) return false;
  if (Math.hypot(x - PLATE.x, z - PLATE.z) - r <= PLATE.r) return false;
  if (handSpots(index).some((p) => Math.hypot(x - p.x, z - p.z) - r <= HAND_ROOM)) return false;
  return taken.every((o) => Math.hypot(x - o.x, z - o.z) > r + o.r);
}

// ---------- grapes ----------

export type GrapeColour = 'green' | 'dark';
/** A berry in its bunch's frame: x across the bunch, y up, z along it from the stalk, and its radius. */
export type Berry = [number, number, number, number];

/** A bunch of grapes lying on the table, in the table's frame. */
export interface Bunch {
  x: number;
  z: number;
  turn: number;
  colour: GrapeColour;
  berries: Berry[];
  /** The circle the bunch (and any berries fallen off it) fits in. */
  radius: number;
}

/**
 * One bunch's berries, lying on its side: rows across it, widest at the stalk end (-z) and tapering to the tip, each
 * row set into the gaps of the one before; a second layer on the hollows of the first and a third along the top of
 * the widest part, packed close and a little uneven; and now and then a berry fallen off beside it. `rows` from 3 (a
 * small bunch) to 7 (a big one).
 */
export function grapeBerries(rand: () => number, rows: number): Berry[] {
  const wide = rows >= 5 ? 5 : 4;
  const widths = Array.from({ length: rows }, (_, row) => Math.max(1, Math.round(wide * (1 - row / rows) ** 0.75)));
  const out: Berry[] = [];
  const pitch = 0.022; // a little less than a berry's width: they press together
  const step = 0.019;
  const z0 = -((rows - 1) * step) / 2;
  const size = () => 0.0115 + rand() * 0.003;
  const jitter = () => (rand() - 0.5) * 0.005;
  const layer = (lift: number, counts: number[], offset: number) =>
    counts.forEach((n, row) => {
      for (let k = 0; k < n; k++) {
        const r = size();
        out.push([(k - (n - 1) / 2) * pitch + jitter(), lift + r, z0 + (row + offset) * step + jitter(), r]);
      }
    });
  layer(0, widths, 0);
  layer(0.0165, widths.slice(0, -1).map((n) => Math.max(0, n - 1)), 0.5);
  layer(0.031, widths.slice(0, Math.max(1, Math.floor(rows / 2))).map((n) => Math.max(0, n - 2)), 0.25);
  // fallen off: on the table beside the bunch
  const loose = rand() < 0.5 ? 0 : 1 + Math.floor(rand() * 2);
  for (let i = 0; i < loose; i++) {
    const r = size();
    out.push([(i % 2 ? 1 : -1) * ((wide * pitch) / 2 + 0.018 + rand() * 0.012), r, z0 + rand() * rows * step, r]);
  }
  return out;
}

/** The circle a bunch's berries fit in, about its middle. */
export const bunchRadius = (berries: Berry[]) => Math.max(...berries.map(([x, , z, r]) => Math.hypot(x, z) + r));

/**
 * Each table's grapes: two or three bunches, at least one green and one dark, of different sizes, wherever there is
 * room among the dishes. Seeded by the table, so they stay put from one visit to the next.
 */
export function tableGrapes(index: number): Bunch[] {
  const rand = random(hashId(`grapes:${index}`));
  const taken = tableFood(index).map((d) => ({ x: d.x, z: d.z, r: TABLE_FOOD[d.kind].radius }));
  const want = 2 + Math.floor(rand() * 2);
  const first: GrapeColour = rand() < 0.5 ? 'green' : 'dark';
  const out: Bunch[] = [];
  for (let b = 0; b < want; b++) {
    const colour: GrapeColour = b === 0 ? first : b === 1 ? (first === 'green' ? 'dark' : 'green') : rand() < 0.5 ? 'green' : 'dark';
    // a big bunch if one fits somewhere, else a smaller one
    for (let rows = 3 + Math.floor(rand() * 5); rows >= 3; rows--) {
      const berries = grapeBerries(rand, rows);
      const radius = bunchRadius(berries);
      let spot: { x: number; z: number } | null = null;
      for (let tries = 0; tries < 400 && !spot; tries++) {
        const x = (rand() * 2 - 1) * (TOP.halfX - radius);
        const z = (rand() * 2 - 1) * (TOP.halfZ - radius);
        if (roomFor(index, x, z, radius, taken)) spot = { x, z };
      }
      if (!spot) continue;
      out.push({ ...spot, turn: rand() * Math.PI * 2, colour, berries, radius });
      taken.push({ ...spot, r: radius });
      break;
    }
  }
  return out;
}

// ---------- on the plate ----------

export type Bite = 'ham' | 'cheeseSlice' | 'cheeseWedge';

/** Each piece's footprint (Feast.tsx builds it centred, its length along its own x): half its length and width, and its thickness (m). */
export const BITES: Record<Bite, { along: number; across: number; thick: number }> = {
  ham: { along: 0.055, across: 0.038, thick: 0.005 },
  cheeseSlice: { along: 0.045, across: 0.02, thick: 0.006 },
  cheeseWedge: { along: 0.035, across: 0.023, thick: 0.045 },
};

/** A piece of food on a plate, in the plate's frame. */
export interface OnPlate {
  kind: Bite;
  x: number;
  z: number;
  /** Turned about the vertical (radians, as three.js's rotation.y). */
  turn: number;
  /** How many slices of its fan it lies on. */
  layer: number;
  /** Which half of the plate it's on: the direction from the plate's middle into that half (radians in x, z). */
  side: number;
}

/** What each plate holds, by its table, so the plates differ: two things to a plate, one on each half. */
const MENUS: [{ kind: Bite; n: number }, { kind: Bite; n: number }][] = [
  [
    { kind: 'ham', n: 3 },
    { kind: 'cheeseWedge', n: 1 },
  ],
  [
    { kind: 'cheeseSlice', n: 3 },
    { kind: 'ham', n: 2 },
  ],
  [
    { kind: 'ham', n: 2 },
    { kind: 'cheeseSlice', n: 2 },
  ],
];

/**
 * A table's plate of cold meat and cheese: slices fanned out along one half of the plate, each lying partly on the
 * one before, and a wedge or a second fan on the other half. Every piece stays in the plate's well, on its own half.
 */
export function plateFood(index: number): OnPlate[] {
  const rand = random(hashId(`plate:${index}`));
  const out: OnPlate[] = [];
  const start = rand() * Math.PI * 2;
  MENUS[index % MENUS.length].forEach(({ kind, n }, i) => {
    const side = start + i * Math.PI;
    // out from the middle just past half its width, so the two halves never touch
    const d = BITES[kind].across + 0.008;
    const tangent = side + Math.PI / 2;
    const gap = (kind === 'ham' ? 0.028 : 0.026) + rand() * 0.004;
    for (let k = 0; k < n; k++) {
      const s = (k - (n - 1) / 2) * gap;
      const dd = d + (n > 1 ? rand() * 0.004 : 0);
      out.push({
        kind,
        x: Math.cos(side) * dd + Math.cos(tangent) * s,
        z: Math.sin(side) * dd + Math.sin(tangent) * s,
        // its length along the fan (a three.js turn of -a lays its x along the direction a), a little askew
        turn: -tangent + (rand() - 0.5) * 0.2 + (kind === 'cheeseWedge' && rand() < 0.5 ? Math.PI : 0),
        layer: k,
        side,
      });
    }
  });
  return out;
}
