import { openLine, type Nav, type Pt } from './nav';

// The chest's spiders: black tarantulas that now and then climb out of the chest of spoils (SpoilsChest.tsx), jump
// down in front of it and live about the dungeon a while. Pure and seeded like ratBrain.ts, stepped by Cat.tsx with
// the cat and the rats, drawn by Spiders.tsx.
//
// A spider creeps a short way along open floor and freezes for long spells, now and then skittering off fast. When
// you or the cat come close it rears up at you, front legs raised, then scuttles away. At most three are about, and
// none is ever born anywhere but the chest. The cat goes for one now and then (catBrain.ts) and eats it. An old one
// slips away, but only while you're well away from it. No colliders, nothing to aim at.

export type SpiderAction = 'climb' | 'perch' | 'leap' | 'freeze' | 'creep' | 'scuttle' | 'rear';

export interface P3 extends Pt {
  y: number;
}

export interface Spider {
  /** Below zero, so the cat (who hunts rats too) never takes it for a rat. */
  id: number;
  kind: 'spider';
  x: number;
  z: number;
  /** Height of its feet: 0 on the floor, above it while climbing out of the chest and jumping down. */
  y: number;
  /** Follows Player's yaw: forward is (-sin heading, -cos heading). */
  heading: number;
  action: SpiderAction;
  /** Seconds left frozen, perched or reared up. */
  left: number;
  /** Where the current creep or scuttle ends. */
  to: Pt | null;
  speed: number;
  /** A climb or a jump: from, to, how far through it (0 to 1), how long it takes (s) and how high it arcs (m). */
  hop: { from: P3; to: P3; t: number; s: number; h: number } | null;
  /** Where it jumps down to from the chest's rim. */
  landing: Pt;
  /** What it reared up at, and runs from. */
  from: Pt | null;
  /** Set by the cat when she catches it; the nest clears it away. */
  dead: boolean;
  /** Seconds since it came out, and how long it stays about. */
  age: number;
  life: number;
  rng: number;
  /** Time not yet stepped (one far from the player is stepped every few frames, with the time it's owed). */
  owed: number;
}

export interface SpiderEnv {
  nav: Nav;
  /** What it rears at: the player, and the cat unless she's stalking. */
  threats: Pt[];
}

export const SPIDER = {
  creep: 0.18, // m/s
  scuttle: 1.3,
  creepLen: [0.25, 1.1] as [number, number],
  /** About one move in four is a skitter: a short fast dash out of nowhere. */
  skitter: 0.25,
  skitterLen: [0.5, 1.2] as [number, number],
  /** How far it runs after rearing. */
  fleeLen: [1.6, 2.8] as [number, number],
  freeze: [2, 7] as [number, number],
  /** Something this close makes it rear. */
  spook: 1.5,
  /** Seconds reared up before it runs. */
  rear: 0.9,
  /** Out of the chest: up onto the rim, a wait there, the jump down, and a moment still where it lands. */
  climbS: 0.45,
  climbH: 0.05,
  perchS: 0.8,
  leapS: 0.42,
  leapH: 0.22,
  land: 0.3,
  max: 3,
  /** How long one stays about (s); then it slips away once you're further off than `vanishBeyond`. */
  life: [240, 420] as [number, number],
  vanishBeyond: 15,
  /** Past this from the player, a spider is stepped only every `farEvery` frames. */
  near: 14,
  farEvery: 4,
};

// ---------- randomness: seeded, so a creep can be replayed ----------

function next(s: { rng: number }): number {
  // mulberry32, as the cat's and the rats'
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (s: { rng: number }, [a, b]: [number, number]) => a + (b - a) * next(s);
const toward = (from: Pt, to: Pt) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

/** A spider that starts inside the chest, climbs onto its rim and jumps down to `landing`. */
export function createSpider(id: number, seed: number, inside: P3, rim: P3, landing: Pt): Spider {
  const s: Spider = {
    id,
    kind: 'spider',
    ...inside,
    heading: toward(rim, landing),
    action: 'climb',
    left: 0,
    to: null,
    speed: 0,
    hop: { from: { ...inside }, to: { ...rim }, t: 0, s: SPIDER.climbS, h: SPIDER.climbH },
    landing: { x: landing.x, z: landing.z },
    from: null,
    dead: false,
    age: 0,
    life: 0,
    rng: seed | 0,
    owed: 0,
  };
  s.life = between(s, SPIDER.life);
  return s;
}

// ---------- one spider ----------

/** A straight move along open floor, roughly along `dir` (any way when null). */
function pickMove(s: Spider, nav: Nav, dir: number | null, len: [number, number]): { to: Pt; heading: number } | null {
  for (let tries = 0; tries < 8; tries++) {
    const heading = dir === null ? next(s) * Math.PI * 2 : dir + (next(s) - 0.5) * (0.6 + tries * 0.35);
    const d = between(s, len) * (tries < 4 ? 1 : 0.6);
    const to = { x: s.x - Math.sin(heading) * d, z: s.z - Math.cos(heading) * d };
    if (openLine(nav, s, to)) return { to, heading };
  }
  return null;
}

function go(s: Spider, pick: { to: Pt; heading: number }, action: 'creep' | 'scuttle') {
  s.action = action;
  s.to = pick.to;
  s.heading = pick.heading;
  s.speed = action === 'scuttle' ? SPIDER.scuttle : SPIDER.creep;
}

function freeze(s: Spider, secs: number) {
  s.action = 'freeze';
  s.left = secs;
  s.to = null;
  s.speed = 0;
}

/** The nearest threat within reach, if any. */
function threatened(s: Spider, env: SpiderEnv): Pt | null {
  let near: Pt | null = null;
  let nearD = SPIDER.spook;
  for (const t of env.threats) {
    const d = Math.hypot(t.x - s.x, t.z - s.z);
    if (d < nearD) {
      near = t;
      nearD = d;
    }
  }
  return near;
}

function rearAt(s: Spider, t: Pt) {
  s.action = 'rear';
  s.left = SPIDER.rear;
  s.to = null;
  s.speed = 0;
  s.from = { x: t.x, z: t.z };
  s.heading = toward(s, t);
}

/** Along the current climb or jump; true once it's over. */
function hopStep(s: Spider, dt: number): boolean {
  const j = s.hop!;
  j.t = Math.min(1, j.t + dt / j.s);
  s.x = j.from.x + (j.to.x - j.from.x) * j.t;
  s.z = j.from.z + (j.to.z - j.from.z) * j.t;
  s.y = j.from.y + (j.to.y - j.from.y) * j.t + Math.sin(j.t * Math.PI) * j.h;
  if (j.t < 1) return false;
  Object.assign(s, j.to); // exactly there
  s.hop = null;
  return true;
}

/** Along the current creep or scuttle; frozen once there. */
function travel(s: Spider, dt: number) {
  const to = s.to!;
  const dx = to.x - s.x;
  const dz = to.z - s.z;
  const d = Math.hypot(dx, dz);
  const step = s.speed * dt;
  if (d > step) {
    s.x += (dx / d) * step;
    s.z += (dz / d) * step;
    return;
  }
  s.x = to.x;
  s.z = to.z;
  freeze(s, between(s, SPIDER.freeze));
}

export function stepSpider(s: Spider, dt: number, env: SpiderEnv) {
  if (s.dead) return;
  s.age += dt;
  switch (s.action) {
    case 'climb': {
      if (!hopStep(s, dt)) return;
      s.action = 'perch';
      s.left = SPIDER.perchS;
      return;
    }
    case 'perch': {
      // on the rim, facing out: it heeds nobody until it's down
      s.left -= dt;
      if (s.left > 0) return;
      s.action = 'leap';
      s.hop = { from: { x: s.x, y: s.y, z: s.z }, to: { ...s.landing, y: 0 }, t: 0, s: SPIDER.leapS, h: SPIDER.leapH };
      return;
    }
    case 'leap': {
      if (hopStep(s, dt)) freeze(s, SPIDER.land);
      return;
    }
    case 'rear': {
      s.left -= dt;
      if (s.left > 0) return;
      const from = s.from ?? s;
      const pick = pickMove(s, env.nav, toward(from, s), SPIDER.fleeLen);
      s.from = null;
      if (pick) go(s, pick, 'scuttle');
      else freeze(s, 1);
      return;
    }
    case 'scuttle': {
      travel(s, dt);
      return;
    }
    case 'creep': {
      const t = threatened(s, env);
      if (t) return rearAt(s, t);
      travel(s, dt);
      return;
    }
    case 'freeze': {
      const t = threatened(s, env);
      if (t) return rearAt(s, t);
      s.left -= dt;
      if (s.left > 0) return;
      const skitter = next(s) < SPIDER.skitter;
      const pick = pickMove(s, env.nav, null, skitter ? SPIDER.skitterLen : SPIDER.creepLen);
      if (pick) go(s, pick, skitter ? 'scuttle' : 'creep');
      else s.left = 0.5;
    }
  }
}

// ---------- the nest: the spiders about, stepped together ----------

export interface Nest {
  /** The spiders about now. Changed in place, so a reference to it stays current. */
  spiders: Spider[];
  /** How many have come out (the last one's id is minus this). */
  made: number;
  frame: number;
  rng: number;
}

export interface NestEnv {
  nav: Nav;
  player: Pt | null;
  /** Whether a point is somewhere in the dungeon (the grid's box also covers ground outside its walls). */
  inside: (x: number, z: number) => boolean;
  /** Besides the player: the cat, unless she's stalking. */
  threats: Pt[];
}

export function createNest(seed: number): Nest {
  return { spiders: [], made: 0, frame: 0, rng: seed | 0 };
}

/** One out of the chest: from `inside` it climbs to the `rim`, then jumps down to `landing`. Null when three are about. */
export function releaseSpider(n: Nest, inside: P3, rim: P3, landing: Pt): Spider | null {
  if (n.spiders.length >= SPIDER.max) return null;
  n.made++;
  const s = createSpider(-n.made, Math.floor(next(n) * 2 ** 31), inside, rim, landing);
  n.spiders.push(s);
  return s;
}

const SCRATCH: SpiderEnv = { nav: null as unknown as Nav, threats: [] };
export function stepNest(n: Nest, dt: number, env: NestEnv) {
  n.frame++;
  const dist = (s: Spider) => (env.player ? Math.hypot(s.x - env.player.x, s.z - env.player.z) : Infinity);
  // clear away the caught, the old ones once you're well away, and (now and then) any left outside the walls
  const sweep = n.frame % 30 === 0;
  for (let k = n.spiders.length - 1; k >= 0; k--) {
    const s = n.spiders[k];
    const down = s.y === 0 && !s.hop;
    const old = down && s.age > s.life && dist(s) > SPIDER.vanishBeyond;
    if (s.dead || old || (sweep && down && !env.inside(s.x, s.z))) n.spiders.splice(k, 1);
  }
  // reused every frame: stepping runs every frame, so no fresh arrays here
  const senv = SCRATCH;
  senv.nav = env.nav;
  senv.threats.length = 0;
  for (const t of env.threats) senv.threats.push(t);
  if (env.player) senv.threats.push(env.player);
  for (const s of n.spiders) {
    s.owed += dt;
    if (dist(s) > SPIDER.near && (n.frame + s.id) % SPIDER.farEvery !== 0) continue;
    stepSpider(s, s.owed, senv);
    s.owed = 0;
  }
}
