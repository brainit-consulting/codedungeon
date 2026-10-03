import { openLine, type Nav, type Pt } from './nav';

// Rats, for the cat to hunt. Pure and seeded like catBrain.ts, stepped by Cat.tsx and drawn by Rats.tsx.
//
// A rat scurries in short straight dashes along open floor (the nav grid's open cells, so never into furniture or a
// wall), pausing between them to sniff, and bolts away from the cat or the player when they come close. The warren
// keeps up to three about, born on open floor well away from the player, until the cat has killed twelve: then no
// more come. Rats far from the player are stepped only every few frames. Nothing here blocks anything: rats have no
// collider and are not something you aim at.

export type RatAction = 'pause' | 'dash';

export interface Rat {
  id: number;
  x: number;
  z: number;
  /** Follows Player's yaw: forward is (-sin heading, -cos heading). */
  heading: number;
  action: RatAction;
  /** Seconds left in a pause. */
  left: number;
  /** Where the current dash ends. */
  to: Pt | null;
  speed: number;
  /** Running from something (a dash it won't break off to run from something else). */
  fleeing: boolean;
  /** Set by the cat when she catches it; the warren clears it away. */
  dead: boolean;
  rng: number;
  /** Time not yet stepped (a rat far from the player is stepped every few frames, with the time it's owed). */
  owed: number;
}

export interface RatEnv {
  nav: Nav;
  /** What rats run from: the player, and the cat unless she's stalking. */
  threats: Pt[];
}

export const RAT = {
  dash: 2.1, // m/s
  flee: 3.2,
  dashLen: [0.6, 2.2] as [number, number],
  fleeLen: [1.8, 3] as [number, number],
  pause: [0.5, 3.2] as [number, number],
  /** Something this close sends a rat running. */
  spook: 1.8,
  /** At most this many alive at once. */
  max: 3,
  /** The cat's tally: once she's killed this many, no more come (and never more alive than she has left to kill). */
  cap: 12,
  /** Seconds between births, and before the first. */
  spawnEvery: [6, 15] as [number, number],
  firstSpawn: 4,
  /** Never born closer than this to the player (m). */
  spawnClear: 8,
  /** Past this from the player, a rat is stepped only every `farEvery` frames. */
  near: 14,
  farEvery: 4,
};

/** The most dead rats her pile shows. */
export const PILE_MAX = 12;

// ---------- randomness: seeded, so a scurry can be replayed ----------

function next(s: { rng: number }): number {
  // mulberry32, as the cat's
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (s: { rng: number }, [a, b]: [number, number]) => a + (b - a) * next(s);

export function createRat(id: number, seed: number, at: Pt): Rat {
  const r: Rat = { id, x: at.x, z: at.z, heading: 0, action: 'pause', left: 0, to: null, speed: 0, fleeing: false, dead: false, rng: seed | 0, owed: 0 };
  r.heading = next(r) * Math.PI * 2;
  r.left = between(r, RAT.pause);
  return r;
}

// ---------- one rat ----------

/** A straight dash along open floor, roughly along `dir` (any way when null). */
function pickDash(r: Rat, nav: Nav, dir: number | null, len: [number, number]): { to: Pt; heading: number } | null {
  for (let tries = 0; tries < 8; tries++) {
    const heading = dir === null ? next(r) * Math.PI * 2 : dir + (next(r) - 0.5) * (0.6 + tries * 0.35);
    const d = between(r, len) * (tries < 4 ? 1 : 0.6);
    const to = { x: r.x - Math.sin(heading) * d, z: r.z - Math.cos(heading) * d };
    if (openLine(nav, r, to)) return { to, heading };
  }
  return null;
}

function dash(r: Rat, pick: { to: Pt; heading: number }, speed: number, fleeing: boolean) {
  r.action = 'dash';
  r.to = pick.to;
  r.heading = pick.heading;
  r.speed = speed;
  r.fleeing = fleeing;
}

export function stepRat(r: Rat, dt: number, env: RatEnv) {
  if (r.dead) return;
  if (!r.fleeing) {
    let near: Pt | null = null;
    let nearD = RAT.spook;
    for (const t of env.threats) {
      const d = Math.hypot(t.x - r.x, t.z - r.z);
      if (d < nearD) {
        near = t;
        nearD = d;
      }
    }
    if (near) {
      const away = Math.atan2(-(r.x - near.x), -(r.z - near.z));
      const pick = pickDash(r, env.nav, away, RAT.fleeLen);
      if (pick) dash(r, pick, RAT.flee, true);
    }
  }
  if (r.action === 'dash' && r.to) {
    const dx = r.to.x - r.x;
    const dz = r.to.z - r.z;
    const d = Math.hypot(dx, dz);
    const step = r.speed * dt;
    if (d > step) {
      r.x += (dx / d) * step;
      r.z += (dz / d) * step;
      return;
    }
    r.x = r.to.x;
    r.z = r.to.z;
    r.to = null;
    r.fleeing = false;
    r.action = 'pause';
    r.left = between(r, RAT.pause);
    return;
  }
  r.left -= dt;
  if (r.left > 0) return;
  const pick = pickDash(r, env.nav, null, RAT.dashLen);
  if (pick) dash(r, pick, RAT.dash, false);
  else r.left = 0.5;
}

// ---------- the warren: births, the cap, and stepping them all ----------

export interface Warren {
  /** The rats about now. Changed in place, so a reference to it stays current. */
  rats: Rat[];
  /** How many have been born (also the last one's id). */
  spawned: number;
  /** Clock time of the next birth. */
  spawnAt: number;
  clock: number;
  frame: number;
  rng: number;
}

export interface WarrenEnv {
  nav: Nav;
  player: Pt | null;
  /** How many the cat has killed this session. */
  kills: number;
  /** Whether a point is somewhere in the dungeon (the grid's box also covers ground outside its walls). */
  inside: (x: number, z: number) => boolean;
  /** Besides the player: the cat, unless she's stalking. */
  threats: Pt[];
}

export function createWarren(seed: number): Warren {
  return { rats: [], spawned: 0, spawnAt: RAT.firstSpawn, clock: 0, frame: 0, rng: seed | 0 };
}

/** A random open cell, all its neighbours open too, in the dungeon and well away from the player. */
function spawnPoint(w: Warren, env: WarrenEnv): Pt | null {
  const { cols, rows, blocked, cell, bounds } = env.nav;
  for (let tries = 0; tries < 40; tries++) {
    const i = 1 + Math.floor(next(w) * (cols - 2));
    const j = 1 + Math.floor(next(w) * (rows - 2));
    let open = true;
    for (let dj = -1; dj <= 1 && open; dj++) for (let di = -1; di <= 1 && open; di++) if (blocked[(j + dj) * cols + i + di]) open = false;
    if (!open) continue;
    const x = bounds.minX + (i + 0.5) * cell;
    const z = bounds.minZ + (j + 0.5) * cell;
    if (!env.inside(x, z)) continue;
    if (env.player && Math.hypot(x - env.player.x, z - env.player.z) < RAT.spawnClear) continue;
    return { x, z };
  }
  return null;
}


const SCRATCH: RatEnv = { nav: null as unknown as RatEnv['nav'], threats: [] };
export function stepWarren(w: Warren, dt: number, env: WarrenEnv) {
  w.clock += dt;
  w.frame++;
  // clear away the dead, and (now and then) any left outside the walls when a chamber went
  const sweep = w.frame % 30 === 0;
  for (let k = w.rats.length - 1; k >= 0; k--) {
    const r = w.rats[k];
    if (!r.dead && !(sweep && !env.inside(r.x, r.z))) continue;
    w.rats.splice(k, 1);
    w.spawnAt = Math.max(w.spawnAt, w.clock + between(w, RAT.spawnEvery));
  }
  if (w.clock >= w.spawnAt && w.rats.length < RAT.max && env.kills + w.rats.length < RAT.cap) {
    const at = spawnPoint(w, env);
    if (at) {
      w.spawned++;
      w.rats.push(createRat(w.spawned, Math.floor(next(w) * 2 ** 31), at));
      w.spawnAt = w.clock + between(w, RAT.spawnEvery);
    } else w.spawnAt = w.clock + 2;
  }
  // reused every frame: stepping runs every frame, so no fresh arrays here
  const renv = SCRATCH;
  renv.nav = env.nav;
  renv.threats.length = 0;
  for (const t of env.threats) renv.threats.push(t);
  if (env.player) renv.threats.push(env.player);
  for (const r of w.rats) {
    r.owed += dt;
    const far = env.player && Math.hypot(r.x - env.player.x, r.z - env.player.z) > RAT.near;
    if (far && (w.frame + r.id) % RAT.farEvery !== 0) continue;
    stepRat(r, r.owed, renv);
    r.owed = 0;
  }
}

// ---------- the pile ----------

/** Where each dead rat lies on the cat's pile, relative to its centre: a ring, then smaller rings stacked on top. */
export function pileLayout(n: number): { x: number; y: number; z: number; yaw: number }[] {
  const layers = [
    { count: 5, r: 0.2, y: 0 },
    { count: 4, r: 0.11, y: 0.045 },
    { count: 3, r: 0.05, y: 0.09 },
  ];
  const out: { x: number; y: number; z: number; yaw: number }[] = [];
  for (const [li, l] of layers.entries()) {
    for (let k = 0; k < l.count && out.length < Math.min(n, PILE_MAX); k++) {
      const a = (k / l.count) * Math.PI * 2 + li * 0.7;
      out.push({ x: Math.cos(a) * l.r, y: l.y, z: Math.sin(a) * l.r, yaw: a + Math.PI / 2 + ((k * 37) % 7) * 0.12 });
    }
  }
  return out;
}
