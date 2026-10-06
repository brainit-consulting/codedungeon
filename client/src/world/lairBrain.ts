import type { Pt } from './nav';

// The great spider: a tarantula three times the size of the chest's, living in the dead end at the far end of the
// gallery. Pure and seeded like spiderBrain.ts, stepped by Cat.tsx with the cat, drawn by GreatSpider.tsx.
//
// It sits in its lair, shifting about a little. Come into its end of the gallery and it runs at you, stops short,
// rears up with its fangs out, then backs off home facing you; while you stay, it does it again after a pause. It
// never leaves its end of the gallery. The cat it only rears at, and she can kill it (catBrain.ts). Its body stays
// where it died and shrivels away some minutes later; a new one lets itself down from the ceiling on a thread some
// minutes after a death, never more than one alive at a time.

export type GreatAction = 'descend' | 'lurk' | 'shift' | 'alert' | 'charge' | 'rear' | 'retreat';

export interface Great {
  /** Far below zero: never taken for a rat or for one of the chest's spiders. */
  id: number;
  kind: 'great';
  x: number;
  z: number;
  /** Height of its feet: above 0 only while it comes down on its thread. */
  y: number;
  /** Follows Player's yaw: forward is (-sin heading, -cos heading). */
  heading: number;
  action: GreatAction;
  /** Seconds left in the current action (alert, charge, rear, descend) or until it next shifts about (lurk). */
  left: number;
  /** Seconds before it will see anyone off again. */
  cool: number;
  /** Where a shift ends. */
  to: Pt | null;
  /** Who it is running at or rearing up at. */
  at: Pt | null;
  /** Set by the cat when she kills it. */
  dead: boolean;
}

/** A dead one, on its back where it died. */
export interface Body {
  id: number;
  x: number;
  z: number;
  heading: number;
  /** Seconds since it died, and how long it lies there whole before it shrivels away. */
  age: number;
  life: number;
}

export interface Lair {
  /** The one alive, or null between a death and the next coming down. */
  great: Great | null;
  bodies: Body[];
  /** Seconds until the next comes down (counts only while none is alive). */
  respawnIn: number;
  made: number;
  rng: number;
}

export interface LairEnv {
  /** Its lair: just inside the gallery's end wall. */
  home: Pt;
  /** The heading facing out of the dead end, back up the gallery. */
  out: number;
  /** How far from home it defends (m): GREAT.range, less where the gallery is short. */
  range: number;
  /** The ceiling's height: it comes down from there. */
  ceiling: number;
  player: Pt | null;
  /** The cat, unless she's stalking it (it doesn't see her coming then). */
  cat: Pt | null;
}

export const GREAT = {
  range: 8,
  /** Running at you (m/s), how close it comes, and how long it gives itself to get there. */
  charge: 3.2,
  stop: 1.5,
  chargeFor: 4,
  /** The moment it tenses and turns before it runs. */
  alert: 0.35,
  rear: 1.3,
  /** Backing off home, facing you. */
  back: 1.3,
  /** The pause (s) after seeing someone off before it does it again. */
  cool: [3, 6] as [number, number],
  /** The cat this close makes it rear. */
  spook: 1.6,
  /** In its lair: a few steps about every so often. */
  shiftEvery: [6, 14] as [number, number],
  shiftLen: [0.15, 0.5] as [number, number],
  shiftSpeed: 0.25,
  /** After a death, the next comes down 2 to 19 minutes later, taking this long on its thread. */
  respawn: [120, 1140] as [number, number],
  descendS: 5,
  /** A body lies whole 4 to 15 minutes, then shrivels away over `shrivelS`. */
  bodyLife: [240, 900] as [number, number],
  shrivelS: 40,
  maxBodies: 4,
};

/** Further than this past its range, it (or a body) is somewhere the gallery no longer reaches. */
const STRANDED = 3;

// ---------- randomness: seeded, so a day in the lair can be replayed ----------

function next(s: { rng: number }): number {
  // mulberry32, as the cat's, the rats' and the chest spiders'
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (s: { rng: number }, [a, b]: [number, number]) => a + (b - a) * next(s);
const toward = (from: Pt, to: Pt) => Math.atan2(-(to.x - from.x), -(to.z - from.z));
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z);
const smooth = (u: number) => u * u * (3 - 2 * u);

function make(l: Lair, env: LairEnv, y: number, action: GreatAction): Great {
  l.made++;
  return { id: -1_000_000 - l.made, kind: 'great', x: env.home.x, z: env.home.z, y, heading: env.out, action, left: 0, cool: 0, to: null, at: null, dead: false };
}

/** A lair with its spider at home. */
export function createLair(seed: number, env: LairEnv): Lair {
  const l: Lair = { great: null, bodies: [], respawnIn: 0, made: 0, rng: seed | 0 };
  l.great = make(l, env, 0, 'lurk');
  l.great.left = between(l, GREAT.shiftEvery);
  return l;
}

/** How far a body has shrivelled away: 0 whole, 1 gone. */
export function bodyShrivel(b: Body): number {
  return Math.min(1, Math.max(0, (b.age - b.life) / GREAT.shrivelS));
}

// ---------- the one alive ----------

function lurk(l: Lair, g: Great, heading: number) {
  g.action = 'lurk';
  g.heading = heading;
  g.left = between(l, GREAT.shiftEvery);
  g.to = null;
}

function rear(g: Great, at: Pt) {
  g.action = 'rear';
  g.left = GREAT.rear;
  g.at = { x: at.x, z: at.z };
  g.heading = toward(g, at);
}

/** Someone to see off: you in its end of the gallery, or the cat right by it. True when it has turned on them. */
function react(g: Great, env: LairEnv): boolean {
  if (g.cool > 0) return false;
  const p = env.player;
  if (p && dist(p, env.home) <= env.range) {
    g.action = 'alert';
    g.left = GREAT.alert;
    g.at = { x: p.x, z: p.z };
    g.heading = toward(g, p);
    return true;
  }
  if (env.cat && dist(env.cat, g) < GREAT.spook) {
    rear(g, env.cat);
    return true;
  }
  return false;
}

/** Toward `to` at `speed`; true once there. */
function move(g: Great, to: Pt, speed: number, dt: number): boolean {
  const d = dist(g, to);
  const step = speed * dt;
  if (d <= step) {
    g.x = to.x;
    g.z = to.z;
    return true;
  }
  g.x += ((to.x - g.x) / d) * step;
  g.z += ((to.z - g.z) / d) * step;
  return false;
}

function stepGreat(l: Lair, g: Great, dt: number, env: LairEnv) {
  g.cool = Math.max(0, g.cool - dt);
  switch (g.action) {
    case 'descend': {
      // down its thread, slowing as it nears the floor; it heeds nobody until it's down
      g.left -= dt;
      const u = Math.min(1, 1 - g.left / GREAT.descendS);
      g.y = (env.ceiling - 0.25) * (1 - smooth(u));
      if (u < 1) return;
      g.y = 0;
      lurk(l, g, env.out);
      g.cool = 1.5;
      return;
    }
    case 'lurk': {
      if (react(g, env)) return;
      g.left -= dt;
      if (g.left > 0) return;
      const a = next(l) * Math.PI * 2;
      const d = between(l, GREAT.shiftLen);
      g.to = { x: env.home.x - Math.sin(a) * d, z: env.home.z - Math.cos(a) * d };
      g.heading = toward(g, g.to);
      g.action = 'shift';
      return;
    }
    case 'shift': {
      if (react(g, env)) return;
      if (move(g, g.to!, GREAT.shiftSpeed, dt)) lurk(l, g, env.out + (next(l) - 0.5) * 0.8);
      return;
    }
    case 'alert': {
      const p = env.player;
      if (p) g.heading = toward(g, p);
      g.left -= dt;
      if (g.left > 0) return;
      if (!p || dist(p, env.home) > env.range) return lurk(l, g, g.heading);
      g.action = 'charge';
      g.left = GREAT.chargeFor;
      return;
    }
    case 'charge': {
      const p = env.player ?? g.at!;
      g.at = { x: p.x, z: p.z };
      g.left -= dt;
      const d = dist(g, p);
      if (d <= GREAT.stop + 0.02 || g.left <= 0) return rear(g, p);
      // aim to stop just short of you, but never past the end of its own ground
      const to = { x: p.x - ((p.x - g.x) / d) * GREAT.stop, z: p.z - ((p.z - g.z) / d) * GREAT.stop };
      const out = dist(to, env.home);
      if (out > env.range) {
        to.x = env.home.x + ((to.x - env.home.x) / out) * env.range;
        to.z = env.home.z + ((to.z - env.home.z) / out) * env.range;
      }
      g.heading = toward(g, to);
      if (move(g, to, GREAT.charge, dt)) rear(g, p);
      return;
    }
    case 'rear': {
      g.left -= dt;
      if (g.left > 0) return;
      g.cool = between(l, GREAT.cool);
      if (dist(g, env.home) > 0.3) g.action = 'retreat';
      else lurk(l, g, env.out);
      return;
    }
    case 'retreat': {
      // backing off home, facing you while you're about
      const p = env.player;
      if (move(g, env.home, GREAT.back, dt)) {
        lurk(l, g, env.out);
        g.cool = Math.max(g.cool, between(l, GREAT.cool));
        return;
      }
      g.heading = p && dist(p, g) < env.range + STRANDED ? toward(g, p) : toward(env.home, g);
      return;
    }
  }
}

// ---------- the lair: the one alive, its bodies, and the next ----------

export function stepLair(l: Lair, dt: number, env: LairEnv) {
  // the gallery changed (a chamber added or taken away): a spider or body beyond its ground is put right
  for (let k = l.bodies.length - 1; k >= 0; k--) if (dist(l.bodies[k], env.home) > env.range + STRANDED) l.bodies.splice(k, 1);
  const g = l.great;
  if (g && !g.dead && dist(g, env.home) > env.range + STRANDED) {
    Object.assign(g, { x: env.home.x, z: env.home.z, y: 0 });
    lurk(l, g, env.out);
  }

  if (g?.dead) {
    l.bodies.push({ id: g.id, x: g.x, z: g.z, heading: g.heading, age: 0, life: between(l, GREAT.bodyLife) });
    while (l.bodies.length > GREAT.maxBodies) l.bodies.shift();
    l.great = null;
    l.respawnIn = between(l, GREAT.respawn);
  } else if (g) stepGreat(l, g, dt, env);
  else {
    l.respawnIn -= dt;
    if (l.respawnIn <= 0) {
      const n = make(l, env, env.ceiling - 0.25, 'descend');
      n.left = GREAT.descendS;
      l.great = n;
    }
  }

  for (let k = l.bodies.length - 1; k >= 0; k--) {
    const b = l.bodies[k];
    b.age += dt;
    if (b.age >= b.life + GREAT.shrivelS) l.bodies.splice(k, 1);
  }
}
