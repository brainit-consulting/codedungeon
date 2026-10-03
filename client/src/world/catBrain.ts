import { planPath, type Nav, type Pt } from './nav';

// The dungeon's black cat: the mascot, who thinks she runs the place. A pure state machine over the dungeon's nav
// grid, stepped by Cat.tsx, so her whole routine can be tested and, given the same seed, replayed.
//
// She picks a favourite spot (the hearth to sleep, the bar counter to sit and push a mug about, a working coder's
// side, the DungeonMaster's desk, a Kanban board) or, now and then, a random corner; walks there on the grid; and
// stays a while, sitting, washing, purring or asleep. Called by the Overlord she ignores them first, then follows a
// little behind. She is decoration only: she has no collider and never stands where she'd block a click (Cat.tsx).

export type CatAction = 'walk' | 'jumpUp' | 'jumpDown' | 'sit' | 'wash' | 'purr' | 'sleep' | 'nudge' | 'ignore' | 'follow';

export type SpotKind = 'hearth' | 'bar' | 'coder' | 'throne' | 'board' | 'corner';

/** A favourite place. `y` > 0 means up on something (she jumps from `approach`). `facing` follows Player's yaw. */
export interface CatSpot {
  id: string;
  kind: SpotKind;
  x: number;
  z: number;
  y?: number;
  facing: number;
  approach?: Pt;
  weight: number;
}

export interface Cat {
  x: number;
  z: number;
  /** Height of her paws: 0 on the floor, or the top of what she's perched on. */
  y: number;
  heading: number;
  action: CatAction;
  /** Seconds left in the current action (walk and follow use their own conditions). */
  left: number;
  path: Pt[];
  goal: CatSpot | null;
  /** Where a jump starts and lands, and how far through it she is (0 to 1). */
  jump: { from: Pt & { y: number }; to: Pt & { y: number }; t: number } | null;
  /** The spot she last stayed at, so she doesn't pick it twice in a row. */
  last: string | null;
  /** Seconds (cat clock) until which she follows the player. */
  followUntil: number;
  /** Times she has pushed a mug this session (each push sends one off the edge). */
  nudges: number;
  /** The cat clock, in seconds. */
  clock: number;
  rng: number;
}

export interface CatEnv {
  nav: Nav;
  spots: CatSpot[];
  player: Pt | null;
  /** Random points she may wander to; Cat.tsx samples open cells. */
  corners: Pt[];
}

export const CAT = {
  walk: 0.75, // m/s
  follow: 1.3,
  turn: 5, // rad/s
  jumpS: 0.55,
  /** How long each kind of stay lasts, [min, max] seconds. */
  stay: {
    hearth: [50, 110],
    bar: [18, 40],
    coder: [14, 30],
    throne: [16, 34],
    board: [10, 22],
    corner: [6, 14],
  } as Record<SpotKind, [number, number]>,
  /** How long she pretends not to have heard, then how long she follows. */
  ignore: [3, 5] as [number, number],
  followFor: 12,
  /** She keeps this far from whoever she's following. */
  followGap: 1.1,
  /** Chance a stay starts with a wash. */
  washChance: 0.45,
};

// ---------- randomness: seeded, so a routine can be replayed ----------

function next(c: Cat): number {
  // mulberry32
  let t = (c.rng = (c.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (c: Cat, [a, b]: [number, number]) => a + (b - a) * next(c);

export function createCat(seed: number, at: Pt): Cat {
  return { x: at.x, z: at.z, y: 0, heading: 0, action: 'sit', left: 2, path: [], goal: null, jump: null, last: null, followUntil: 0, nudges: 0, clock: 0, rng: seed | 0 };
}

/** The Overlord calls her: she ignores them for a few seconds, then follows a while. */
export function callCat(c: Cat) {
  if (c.action === 'ignore' || c.action === 'follow') return;
  if (c.y > 0) {
    // ignoring you from up on the bar; she'll come down when she's ready
    c.action = 'ignore';
    c.left = between(c, CAT.ignore);
    c.followUntil = -1; // follow once she's down
    return;
  }
  c.action = 'ignore';
  c.left = between(c, CAT.ignore);
  c.path = [];
  c.goal = null;
  c.followUntil = c.clock + c.left + CAT.followFor;
}

// ---------- choosing where to go ----------

function pickSpot(c: Cat, env: CatEnv): CatSpot | null {
  const options = env.spots.filter((s) => s.id !== c.last && s.weight > 0);
  const wander = env.corners.length ? 1.5 : 0;
  const total = options.reduce((t, s) => t + s.weight, 0) + wander;
  if (total <= 0) return null;
  let r = next(c) * total;
  for (const s of options) {
    r -= s.weight;
    if (r < 0) return s;
  }
  const p = env.corners[Math.floor(next(c) * env.corners.length)];
  return { id: `corner:${p.x.toFixed(1)},${p.z.toFixed(1)}`, kind: 'corner', x: p.x, z: p.z, facing: next(c) * Math.PI * 2, weight: 0 };
}

function goTo(c: Cat, env: CatEnv, spot: CatSpot): boolean {
  const target = spot.y ? (spot.approach ?? spot) : spot;
  const path = planPath(env.nav, c, target);
  if (!path) return false;
  c.goal = spot;
  c.path = path;
  c.action = 'walk';
  return true;
}

/** Start staying at the spot she just reached. */
function settle(c: Cat, spot: CatSpot) {
  c.last = spot.id;
  c.heading = spot.facing;
  const stay = between(c, CAT.stay[spot.kind]);
  if (spot.kind === 'hearth') {
    c.action = 'sleep';
    c.left = stay;
  } else if (spot.kind === 'bar' && next(c) < 0.6) {
    c.action = 'nudge';
    c.left = 2.4;
  } else if (next(c) < CAT.washChance) {
    c.action = 'wash';
    c.left = Math.min(stay, 6 + next(c) * 6);
  } else {
    c.action = spot.kind === 'coder' ? 'purr' : 'sit';
    c.left = stay;
  }
  c.goal = spot;
}

function chooseNext(c: Cat, env: CatEnv) {
  // up on something: come down first, to where she jumped up from
  if (c.y > 0 && c.goal) {
    const to = c.goal.approach ?? { x: c.x, z: c.z + 0.6 };
    c.jump = { from: { x: c.x, z: c.z, y: c.y }, to: { x: to.x, z: to.z, y: 0 }, t: 0 };
    c.action = 'jumpDown';
    return;
  }
  for (let tries = 0; tries < 4; tries++) {
    const spot = pickSpot(c, env);
    if (spot && goTo(c, env, spot)) return;
  }
  c.action = 'sit';
  c.left = 4;
}

// ---------- stepping ----------

function turnToward(c: Cat, heading: number, dt: number) {
  let d = heading - c.heading;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = CAT.turn * dt;
  c.heading += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

/** Walk along the path at `speed`; true when the path is used up. */
function walkPath(c: Cat, dt: number, speed: number): boolean {
  let budget = speed * dt;
  while (budget > 0 && c.path.length) {
    const p = c.path[0];
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const d = Math.hypot(dx, dz);
    // forward is (-sin h, -cos h), as for the player
    if (d > 1e-6) turnToward(c, Math.atan2(-dx, -dz), dt);
    if (d <= budget) {
      c.x = p.x;
      c.z = p.z;
      budget -= d;
      c.path.shift();
    } else {
      c.x += (dx / d) * budget;
      c.z += (dz / d) * budget;
      budget = 0;
    }
  }
  return c.path.length === 0;
}

export function stepCat(c: Cat, dt: number, env: CatEnv) {
  c.clock += dt;
  switch (c.action) {
    case 'walk': {
      if (!walkPath(c, dt, CAT.walk)) return;
      const g = c.goal;
      if (!g) return chooseNext(c, env);
      if (g.y) {
        c.jump = { from: { x: c.x, z: c.z, y: 0 }, to: { x: g.x, z: g.z, y: g.y }, t: 0 };
        c.action = 'jumpUp';
        return;
      }
      settle(c, g);
      return;
    }
    case 'jumpUp':
    case 'jumpDown': {
      const j = c.jump!;
      j.t = Math.min(1, j.t + dt / CAT.jumpS);
      c.x = j.from.x + (j.to.x - j.from.x) * j.t;
      c.z = j.from.z + (j.to.z - j.from.z) * j.t;
      // a little arc over the lip
      c.y = j.from.y + (j.to.y - j.from.y) * j.t + Math.sin(j.t * Math.PI) * 0.25;
      turnToward(c, Math.atan2(-(j.to.x - j.from.x), -(j.to.z - j.from.z)), dt);
      if (j.t < 1) return;
      c.y = j.to.y;
      c.jump = null;
      if (c.action === 'jumpUp' && c.goal) return settle(c, c.goal);
      // down: follow if she was called while up, else on with her day
      c.goal = null;
      if (c.followUntil === -1) {
        c.followUntil = c.clock + CAT.followFor;
        c.action = 'follow';
        return;
      }
      return chooseNext(c, env);
    }
    case 'follow': {
      if (c.clock > c.followUntil || !env.player) {
        c.path = [];
        return chooseNext(c, env);
      }
      const p = env.player;
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d <= CAT.followGap) {
        c.path = [];
        turnToward(c, Math.atan2(-(p.x - c.x), -(p.z - c.z)), dt);
        return;
      }
      // re-plan about once a second, or when the path ran out
      if (!c.path.length || Math.floor(c.clock) !== Math.floor(c.clock - dt)) {
        const back = { x: p.x + ((c.x - p.x) / d) * CAT.followGap, z: p.z + ((c.z - p.z) / d) * CAT.followGap };
        c.path = planPath(env.nav, c, back) ?? [];
      }
      walkPath(c, dt, CAT.follow);
      return;
    }
    case 'ignore': {
      // back turned, tail flicking
      c.left -= dt;
      if (c.left > 0) return;
      if (c.y > 0) {
        // she was called while up: come down, then follow
        const to = c.goal?.approach ?? { x: c.x, z: c.z + 0.6 };
        c.jump = { from: { x: c.x, z: c.z, y: c.y }, to: { x: to.x, z: to.z, y: 0 }, t: 0 };
        c.action = 'jumpDown';
        return;
      }
      c.action = 'follow';
      return;
    }
    case 'nudge': {
      c.left -= dt;
      if (c.left > 0) return;
      c.nudges++;
      c.action = 'sit';
      c.left = between(c, CAT.stay.bar);
      return;
    }
    case 'wash': {
      c.left -= dt;
      if (c.left > 0) return;
      // a wash usually ends in a sit (or a purr beside a coder)
      c.action = c.goal?.kind === 'coder' ? 'purr' : c.goal?.kind === 'hearth' ? 'sleep' : 'sit';
      c.left = between(c, CAT.stay[c.goal?.kind ?? 'corner']) * 0.6;
      return;
    }
    default: {
      // sit, purr, sleep
      c.left -= dt;
      if (c.left > 0) return;
      chooseNext(c, env);
    }
  }
}
