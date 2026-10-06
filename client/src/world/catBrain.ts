import { openLine, planPath, type Nav, type Pt } from './nav';

// The dungeon's black cat: the mascot, who thinks she runs the place. A pure state machine over the dungeon's nav
// grid, stepped by Cat.tsx, so her whole routine can be tested and, given the same seed, replayed.
//
// She picks a favourite spot (the hearth to sleep, the bar counter to sit and push a mug about, a working coder's
// side, the DungeonMaster's desk, a Kanban board) or, now and then, a random corner; walks there on the grid; and
// stays a while, sitting, washing, purring or asleep. Called by the Overlord she ignores them first, then follows a
// little behind. She is decoration only: she has no collider and never stands where she'd block a click (Cat.tsx).
//
// And she hunts rats (ratBrain.ts). A rat within a few metres that she can see on the grid gets her up from any
// idle stay (never out of a leap mid-air, and not while she's answering the Overlord's call): she stalks it low and
// slow, pounces from close, and carries her kill in her mouth to her pile by the hearth. The chest's spiders
// (spiderBrain.ts) she goes for only now and then, and eats one where she catches it. The great spider in the
// gallery's dead end (lairBrain.ts) she goes for more often, and kills it but leaves it where it fell.

export type CatAction =
  | 'walk'
  | 'jumpUp'
  | 'jumpDown'
  | 'sit'
  | 'wash'
  | 'purr'
  | 'sleep'
  | 'nudge'
  | 'ignore'
  | 'follow'
  | 'stalk'
  | 'pounce'
  | 'carry';

export type SpotKind = 'hearth' | 'bar' | 'coder' | 'throne' | 'board' | 'lair' | 'corner';

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

/** A rat, as far as the cat is concerned (ratBrain's Rat fits), or a spider. She sets `dead` when she catches it. */
export interface Prey {
  id: number;
  x: number;
  z: number;
  dead: boolean;
  /**
   * A spider (spiderBrain's Spider fits): she goes for one only now and then, and eats it where she catches it. The
   * great spider (lairBrain's Great fits) she goes for more often, and leaves where she kills it.
   */
  kind?: 'rat' | 'spider' | 'great';
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
  /** Spots she couldn't find a way to, and until when (cat clock) she leaves them alone. */
  unreachable: Record<string, number>;
  /** When following and no way to the player was found: don't try again before this. */
  retryAt: number;
  /** Called while in the air: she answers (by ignoring you) once she lands. */
  called: boolean;
  /** The rat she's after, and the one in her mouth. */
  prey: number | null;
  carrying: number | null;
  /** Rats killed this session, and how many of them she's laid on her pile. */
  kills: number;
  dropped: number;
  /** Spiders she has caught and eaten this session. */
  ate: number;
  /** Great spiders she has killed this session. */
  slain: number;
  /** Pounces that missed the rat she's after. */
  misses: number;
  /** Cat clock time when she gives up stalking the current rat. */
  huntUntil: number;
  /** Rats that got away, and until when (cat clock) she lets them be. */
  spared: Record<number, number>;
  /** Cat clock time of her next look round for rats. */
  lookAt: number;
}

export interface CatEnv {
  nav: Nav;
  spots: CatSpot[];
  player: Pt | null;
  /** Random points she may wander to; Cat.tsx samples open cells. */
  corners: Pt[];
  /** Rats about (none: she doesn't hunt). */
  rats?: Prey[];
  /** Where she lays her kills (she hunts only when she has one). */
  pile?: CatSpot;
}

/** How long (s) she leaves alone a spot she found no way to. */
const UNREACHABLE_FOR = 60;

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
    lair: [8, 16],
    corner: [6, 14],
  } as Record<SpotKind, [number, number]>,
  /** How long she pretends not to have heard, then how long she follows. */
  ignore: [3, 5] as [number, number],
  followFor: 12,
  /** She keeps this far from whoever she's following. */
  followGap: 1.1,
  /** Chance a stay starts with a wash. */
  washChance: 0.45,
  /** Hunting: she notices a rat this close (m) that she can see, creeps up at `stalk` m/s, pounces from `pounceRange`. */
  notice: 6,
  stalk: 0.35,
  pounceRange: 1.1,
  pounceS: 0.38,
  pounceH: 0.14,
  /** A pounce that lands this close to the rat catches it. */
  catchR: 0.45,
  /** She gives up on a rat after this long stalking, this many misses, or once it's this far off. */
  stalkFor: 25,
  misses: 3,
  lose: 9,
  /** How long she lets be a rat that got away (or a spider she passed over). */
  spareFor: 20,
  /** How often a spider she notices is worth the bother. */
  spiderChance: 0.3,
  /** And how often the great spider is. */
  greatChance: 0.5,
  carry: 0.9,
  /** The wash she gives herself after laying a rat on the pile. */
  proud: [4, 8] as [number, number],
};

/** She sees past whatever she's sat right against (the bar's stools, a table leg). */
const SIGHT_MARGIN = 0.5;
/** What a rat can get her up from. */
const IDLE = new Set<CatAction>(['walk', 'sit', 'wash', 'purr', 'sleep', 'nudge']);

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
  return {
    x: at.x,
    z: at.z,
    y: 0,
    heading: 0,
    action: 'sit',
    left: 2,
    path: [],
    goal: null,
    jump: null,
    last: null,
    followUntil: 0,
    nudges: 0,
    clock: 0,
    rng: seed | 0,
    unreachable: {},
    retryAt: 0,
    called: false,
    prey: null,
    carrying: null,
    kills: 0,
    dropped: 0,
    ate: 0,
    slain: 0,
    misses: 0,
    huntUntil: 0,
    spared: {},
    lookAt: 0.5,
  };
}

/** The Overlord calls her: she ignores them for a few seconds, then follows a while. */
export function callCat(c: Cat) {
  if (c.action === 'ignore' || c.action === 'follow') return;
  // busy with a rat: she doesn't hear you
  if (c.action === 'stalk' || c.action === 'pounce' || c.action === 'carry') return;
  if (c.action === 'jumpUp' || c.action === 'jumpDown') {
    c.called = true; // she'll land first
    return;
  }
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
  const options = env.spots.filter((s) => s.id !== c.last && s.weight > 0 && !((c.unreachable[s.id] ?? 0) > c.clock));
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
  if (!path) {
    c.unreachable[spot.id] = c.clock + UNREACHABLE_FOR;
    return false;
  }
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

/**
 * Where she is a fraction `t` through a jump. Like a real cat: jumping down she pushes off out over the edge first and
 * drops after, jumping up she rises first and comes over the edge after, so either way she clears the lip of the bar
 * or the table instead of passing through it. (A straight line with a small arc dipped through the bar's front edge.)
 */
export function jumpPoint(j: { from: Pt & { y: number }; to: Pt & { y: number } }, t: number): Pt & { y: number } {
  const down = j.to.y < j.from.y;
  const across = down ? 1 - (1 - t) * (1 - t) : t * t;
  const rise = down ? t * t : 1 - (1 - t) * (1 - t);
  return {
    x: j.from.x + (j.to.x - j.from.x) * across,
    z: j.from.z + (j.to.z - j.from.z) * across,
    y: j.from.y + (j.to.y - j.from.y) * rise + (t > 0 && t < 1 ? Math.sin(t * Math.PI) * 0.25 : 0),
  };
}

/** Jump down from what she's on, to where she jumped up from. */
function comeDown(c: Cat) {
  const to = c.goal?.approach ?? { x: c.x, z: c.z + 0.6 };
  c.jump = { from: { x: c.x, z: c.z, y: c.y }, to: { x: to.x, z: to.z, y: 0 }, t: 0 };
  c.action = 'jumpDown';
}

function chooseNext(c: Cat, env: CatEnv) {
  // up on something: come down first, to where she jumped up from
  if (c.y > 0 && c.goal) return comeDown(c);
  const rat = noticeRat(c, env);
  if (rat) return startHunt(c, rat);
  for (let tries = 0; tries < 4; tries++) {
    const spot = pickSpot(c, env);
    if (spot && goTo(c, env, spot)) return;
  }
  c.action = 'sit';
  c.left = 4;
}

// ---------- hunting ----------

/**
 * The nearest rat (or spider) she can see within range (from up on something, she looks from where she jumped up). A
 * spider she mostly passes over, and then lets be a while.
 */
function noticeRat(c: Cat, env: CatEnv): Prey | null {
  if (!env.rats || !env.pile || c.carrying !== null) return null;
  const eye = c.y > 0 ? (c.goal?.approach ?? c) : c;
  let best: Prey | null = null;
  let bestD = CAT.notice;
  for (const r of env.rats) {
    if (r.dead || (c.spared[r.id] ?? 0) > c.clock) continue;
    const d = Math.hypot(r.x - eye.x, r.z - eye.z);
    if (d > bestD || !openLine(env.nav, eye, r, SIGHT_MARGIN)) continue;
    best = r;
    bestD = d;
  }
  const chance = best?.kind === 'spider' ? CAT.spiderChance : best?.kind === 'great' ? CAT.greatChance : 1;
  if (best && chance < 1 && next(c) >= chance) {
    c.spared[best.id] = c.clock + CAT.spareFor;
    return null;
  }
  return best;
}

function startHunt(c: Cat, r: Prey) {
  c.prey = r.id;
  c.action = 'stalk';
  c.path = [];
  c.goal = null;
  c.misses = 0;
  c.retryAt = 0;
  c.huntUntil = c.clock + CAT.stalkFor;
}

const preyOf = (c: Cat, env: CatEnv) => env.rats?.find((r) => r.id === c.prey && !r.dead) ?? null;

function giveUp(c: Cat, env: CatEnv, r: Prey | null) {
  if (r) c.spared[r.id] = c.clock + CAT.spareFor;
  c.prey = null;
  c.path = [];
  chooseNext(c, env);
}

function caught(c: Cat, env: CatEnv, r: Prey) {
  r.dead = true;
  c.prey = null;
  if (r.kind === 'spider' || r.kind === 'great') {
    // eaten where she caught it (the great one is too big: left where it fell), then a wash
    if (r.kind === 'spider') c.ate++;
    else c.slain++;
    c.path = [];
    c.goal = null;
    c.action = 'wash';
    c.left = between(c, CAT.proud);
    return;
  }
  c.carrying = r.id;
  c.kills++;
  const path = planPath(env.nav, c, env.pile!);
  if (!path) {
    // no way to the pile from here (never so in the dungeon): it's laid there all the same
    c.carrying = null;
    c.dropped++;
    return chooseNext(c, env);
  }
  c.path = path;
  c.goal = env.pile!;
  c.action = 'carry';
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
  // twice a second, a look round for rats (never mid-leap, nor while she's with the Overlord)
  if (env.rats?.length && IDLE.has(c.action) && c.clock >= c.lookAt) {
    c.lookAt = c.clock + 0.5;
    const rat = noticeRat(c, env);
    if (rat) {
      if (c.y > 0) return comeDown(c); // she'll see it again once she's down
      return startHunt(c, rat);
    }
  }
  switch (c.action) {
    case 'stalk': {
      const r = preyOf(c, env);
      if (!r || c.clock > c.huntUntil) return giveUp(c, env, r);
      const d = Math.hypot(r.x - c.x, r.z - c.z);
      if (d > CAT.lose) return giveUp(c, env, r);
      if (d <= CAT.pounceRange && openLine(env.nav, c, r, SIGHT_MARGIN)) {
        // land just short of it, front paws on it
        const k = Math.max(0, d - 0.12) / Math.max(d, 1e-6);
        c.jump = { from: { x: c.x, z: c.z, y: 0 }, to: { x: c.x + (r.x - c.x) * k, z: c.z + (r.z - c.z) * k, y: 0 }, t: 0 };
        c.heading = Math.atan2(-(r.x - c.x), -(r.z - c.z));
        c.path = [];
        c.action = 'pounce';
        return;
      }
      // creep along a path to it, re-planned at most once a second
      if (c.clock >= c.retryAt) {
        const path = planPath(env.nav, c, r);
        if (!path) return giveUp(c, env, r);
        c.path = path;
        c.retryAt = c.clock + 1;
      }
      if (c.path.length) walkPath(c, dt, CAT.stalk);
      else turnToward(c, Math.atan2(-(r.x - c.x), -(r.z - c.z)), dt);
      return;
    }
    case 'pounce': {
      const j = c.jump!;
      j.t = Math.min(1, j.t + dt / CAT.pounceS);
      c.x = j.from.x + (j.to.x - j.from.x) * j.t;
      c.z = j.from.z + (j.to.z - j.from.z) * j.t;
      c.y = Math.sin(j.t * Math.PI) * CAT.pounceH;
      if (j.t < 1) return;
      c.y = 0;
      c.jump = null;
      const r = preyOf(c, env);
      if (r && Math.hypot(r.x - c.x, r.z - c.z) <= CAT.catchR) return caught(c, env, r);
      c.misses++;
      if (!r || c.misses >= CAT.misses) return giveUp(c, env, r);
      // missed: gather herself, then creep after it again
      c.action = 'stalk';
      c.path = [];
      c.retryAt = c.clock + 0.5;
      return;
    }
    case 'carry': {
      if (!walkPath(c, dt, CAT.carry)) return;
      c.carrying = null;
      c.dropped++;
      if (c.goal) c.heading = c.goal.facing;
      c.action = 'wash';
      c.left = between(c, CAT.proud);
      return;
    }
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
      const at = jumpPoint(j, j.t);
      c.x = at.x;
      c.z = at.z;
      c.y = at.y;
      turnToward(c, Math.atan2(-(j.to.x - j.from.x), -(j.to.z - j.from.z)), dt);
      if (j.t < 1) return;
      c.y = j.to.y;
      c.jump = null;
      const called = c.called;
      c.called = false;
      if (c.action === 'jumpUp' && c.goal) {
        settle(c, c.goal);
        if (called) callCat(c);
        return;
      }
      if (called) {
        c.goal = null;
        c.action = 'sit';
        callCat(c);
        return;
      }
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
      if ((!c.path.length || Math.floor(c.clock) !== Math.floor(c.clock - dt)) && c.clock >= c.retryAt) {
        const back = { x: p.x + ((c.x - p.x) / d) * CAT.followGap, z: p.z + ((c.z - p.z) / d) * CAT.followGap };
        const path = planPath(env.nav, c, back);
        c.path = path ?? [];
        // no way to you: sit tight and look again in a second, rather than searching the whole dungeon every frame
        if (!path) c.retryAt = c.clock + 1;
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
