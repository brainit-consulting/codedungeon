import { hashId } from './appearance';

// Logs: the fire's in the hearth, the stack beside it and the tied bundle. Each pile is laid out here as circles (a
// log seen end on) so it can be tested: every log on the floor or resting in the hollow between two below it, none in
// another. GreatHall.tsx draws them.

/** One log: its middle (x along it in its pile's frame, z across, y up), how thick, how long, and a little turn. */
export interface Log {
  x: number;
  y: number;
  z: number;
  r: number;
  len: number;
  yaw: number;
}

/** A small seeded generator (mulberry32), so a pile looks the same every visit. */
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

type Round = { z: number; y: number; r: number };

/** Where a log of radius r rests on two logs side by side (circles in z, y): touching both, above them. */
export function restOn(a: Round, b: Round, r: number): { z: number; y: number } {
  const ra = a.r + r;
  const rb = b.r + r;
  const dz = b.z - a.z;
  const dy = b.y - a.y;
  const d = Math.hypot(dz, dy);
  // where the two circles' meeting line crosses the line between their centres, then up off it
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const up = Math.sqrt(Math.max(0, ra * ra - along * along));
  const s = dz >= 0 ? 1 : -1; // of the two perpendiculars, the one pointing up
  return { z: a.z + (dz * along) / d - (s * dy * up) / d, y: a.y + (dy * along) / d + (s * dz * up) / d };
}

/**
 * A pile of logs laid side by side, `rows` counting from the bottom (e.g. [4, 3, 2, 1]): the bottom row on y = base,
 * each one above resting in the hollows of the row under it. Logs are of slightly different thickness and length.
 */
export function logPile(seed: string, rows: number[], opts: { r: number; len: number; base?: number; spread?: number }): Log[] {
  const rand = random(hashId(seed));
  const base = opts.base ?? 0;
  const thick = () => opts.r * (0.85 + rand() * 0.3);
  const log = (at: { z: number; y: number }, r: number): Log => ({ ...at, r, x: (rand() - 0.5) * 0.04, len: opts.len * (0.9 + rand() * 0.15), yaw: (rand() - 0.5) * 0.08 });
  const out: Log[] = [];
  let below: Log[] = [];
  rows.forEach((n, row) => {
    const here: Log[] = [];
    if (row === 0) {
      const radii = Array.from({ length: n }, thick);
      const gap = opts.spread ?? 0.004;
      let z = -(radii.reduce((s, r) => s + 2 * r, 0) + gap * (n - 1)) / 2;
      for (const r of radii) {
        here.push(log({ z: z + r, y: base + r }, r));
        z += 2 * r + gap;
      }
    } else {
      // one in each hollow of the row below, from one end; a row holds no more logs than it has hollows
      for (let k = 0; k < Math.min(n, below.length - 1); k++) {
        // a thinner one where a thick one would press into its neighbour in this row
        let r = Math.min(thick(), below[k].r, below[k + 1].r);
        let at = restOn(below[k], below[k + 1], r);
        const prev = here[here.length - 1];
        while (prev && Math.hypot(at.z - prev.z, at.y - prev.y) < prev.r + r) {
          r *= 0.96;
          at = restOn(below[k], below[k + 1], r);
        }
        here.push(log(at, r));
      }
    }
    out.push(...here);
    below = here;
  });
  return out;
}

/** A bundle of sticks tied together: one in the middle and a ring of six round it, all along x, lying on y = 0. */
export function bundle(seed: string, r: number, len: number): { logs: Log[]; radius: number } {
  const rand = random(hashId(seed));
  const ring = 2 * r;
  const logs: Log[] = [{ x: 0, y: 0, z: 0, r, len, yaw: 0 }];
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.25;
    logs.push({ x: (rand() - 0.5) * 0.05, y: Math.sin(a) * ring, z: Math.cos(a) * ring, r: r * (0.88 + rand() * 0.12), len: len * (0.92 + rand() * 0.1), yaw: 0 });
  }
  // stood on the floor: lifted so its lowest stick touches y = 0
  const low = Math.min(...logs.map((l) => l.y - l.r));
  for (const l of logs) l.y -= low;
  return { logs, radius: ring + r };
}

/** The fire's logs on their firedogs (whose bars are `dogs` high): four across the bars, three over them, then two. */
export const FIRE_LOGS = { rows: [4, 3, 2], r: 0.075, len: 0.95, dogs: 0.11 };
export const fireLogs = () => logPile('hearth', FIRE_LOGS.rows, { r: FIRE_LOGS.r, len: FIRE_LOGS.len, base: FIRE_LOGS.dogs, spread: 0.02 });

/**
 * Two shorter logs thrown on top, across the others at a slant: the first lying on the top of the pile, the second
 * crossing over the first. Each is a `Log` turned by its yaw (about y).
 */
export function fireTop(pile: Log[]): Log[] {
  const top = Math.max(...pile.map((l) => l.y + l.r));
  const r = FIRE_LOGS.r * 0.85;
  const first: Log = { x: -0.12, y: top + r, z: -0.05, r, len: 0.62, yaw: 0.5 };
  const second: Log = { x: 0.14, y: first.y + 2 * r, z: 0.04, r, len: 0.58, yaw: -0.55 };
  return [first, second];
}
