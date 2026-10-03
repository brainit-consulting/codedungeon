import type { Pt } from './nav';

// The great hall's wolf, asleep on his rug by the hearth: a pure state machine, stepped by Wolf.tsx, so his whole
// night can be tested and, given the same seed, replayed. He never leaves the rug.
//
// He sleeps. Every so often he stirs (an ear, the tail, a sigh, a shift of the head, a yawn), and every few minutes he
// gets up of his own accord, stretches, turns round and lies down again. A player who comes near may get a look; one
// who stays close gets, once per visit, either the full rise-stretch-yawn or a bored glance and a sigh, after which he
// ignores them for a while. Whatever he does, at least `calm` seconds of plain sleep come between two things, he gets
// up at most once every 90 s, and he always ends up asleep again.

export type WolfAction = 'sleep' | 'stir' | 'look' | 'glance' | 'rise' | 'stretch' | 'stand' | 'circle' | 'lieDown' | 'settle';
export type StirKind = 'ear' | 'tail' | 'sigh' | 'shift' | 'yawn';
type Band = 'far' | 'near' | 'close';

export const WOLF = {
  /** Plain sleep (s) between any two things he does, at the least. */
  calm: 8,
  /** Seconds between stirs when nothing else happens. */
  stirGap: [25, 70] as [number, number],
  /** Seconds asleep before he gets up on his own. */
  getUpGap: [240, 480] as [number, number],
  /** He gets up at most this often (s); each rise draws its own gap from the range. */
  riseGap: [90, 180] as [number, number],
  /** A player is near inside near[0] m, and stays near until near[1] m; the same for close. */
  near: [3.5, 4.5] as [number, number],
  close: [2.0, 2.6] as [number, number],
  /** How long after you come near before he reacts, and how long you must stay close for the visit's reaction. */
  react: [1, 4] as [number, number],
  closeWait: 4,
  lookChance: 0.6,
  /** The visit's reaction: a full rise, or else (lying) a yawn or a glance. */
  riseChance: 0.45,
  yawnChance: 0.3,
  /** He gets up for a visitor only after this long asleep. */
  sleptFor: 40,
  /** After a visit's reaction, he ignores the visitor this long (ear flicks only), then glances at most every `glanceEvery`. */
  ignore: [30, 60] as [number, number],
  glanceEvery: 60,
  /** No second look within this many seconds. */
  lookEvery: 25,
  /** Turning on the spot before lying down, rad/s. */
  turn: 1.5,
  /** How long each thing takes (s). The clips in wolf.glb are made to these lengths (scripts/build-wolf.py). */
  dur: {
    look: [3, 6] as [number, number],
    glance: 4.5,
    rise: 1.5,
    stretch: 3.5,
    stand: [2, 5] as [number, number],
    standAlone: [0.6, 1.2] as [number, number],
    lieDown: 2,
    settle: 2.5,
  },
  stirs: { ear: 1.2, tail: 1.6, sigh: 2.6, shift: 2.4, yawn: 2.8 } as Record<StirKind, number>,
  /** How often each stir is picked. */
  stirWeights: [
    ['ear', 0.35],
    ['tail', 0.25],
    ['sigh', 0.2],
    ['shift', 0.1],
    ['yawn', 0.1],
  ] as [StirKind, number][],
};

export interface Wolf {
  action: WolfAction;
  /** Which stir, while stirring. */
  stir: StirKind | null;
  /** Seconds left in the current action, and how long it was. */
  left: number;
  dur: number;
  /** Bumped at every action start (for the renderer and the tests). */
  started: number;
  /** Which way round he lies (0 or 1, half a turn apart), and his yaw now (radians, 0 = lying the first way). */
  lie: 0 | 1;
  yaw: number;
  turnFrom: number;
  turnBy: number;
  /** What's left of a rise: stretch, stand, circle, lieDown, settle. */
  queue: WolfAction[];
  /** The wolf clock (s). */
  clock: number;
  rng: number;
  band: Band;
  /** Seconds the player has been close, continuously. */
  closeFor: number;
  /** When he reacts to a player who came near (-1: nothing pending). */
  reactAt: number;
  /** This visit's close-up reaction is used up. */
  visited: boolean;
  /** No new action from sleep before this. */
  quietUntil: number;
  nextStir: number;
  nextGetUp: number;
  /** When he last settled down to sleep. */
  sleptSince: number;
  lastRise: number;
  riseGap: number;
  lookAgain: number;
  ignoreUntil: number;
  lastGlance: number;
  /** The cat: whether she was by him last step, and an ear flick owed for her arrival. */
  catWas: boolean;
  catPing: boolean;
  rises: number;
}

export interface WolfEnv {
  /** Where he lies (the middle of his rug). */
  at: Pt;
  player: Pt | null;
  /** The cat is curled up against him. */
  catNear?: boolean;
}

// ---------- randomness: seeded, so a night can be replayed ----------

function next(w: Wolf): number {
  // mulberry32
  let t = (w.rng = (w.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const between = (w: Wolf, [a, b]: [number, number]) => a + (b - a) * next(w);

export function createWolf(seed: number): Wolf {
  const w: Wolf = {
    action: 'sleep',
    stir: null,
    left: 0,
    dur: 0,
    started: 0,
    lie: 0,
    yaw: 0,
    turnFrom: 0,
    turnBy: 0,
    queue: [],
    clock: 0,
    rng: seed | 0,
    band: 'far',
    closeFor: 0,
    reactAt: -1,
    visited: false,
    quietUntil: 0,
    nextStir: 0,
    nextGetUp: 0,
    sleptSince: 0,
    lastRise: -1e9,
    riseGap: WOLF.riseGap[0],
    lookAgain: 0,
    ignoreUntil: 0,
    lastGlance: -1e9,
    catWas: false,
    catPing: false,
    rises: 0,
  };
  w.lie = next(w) < 0.5 ? 0 : 1;
  w.yaw = w.lie * Math.PI;
  w.quietUntil = between(w, [2, 6]);
  w.nextStir = between(w, WOLF.stirGap);
  w.nextGetUp = between(w, WOLF.getUpGap);
  return w;
}

// ---------- starting things ----------

function begin(w: Wolf, action: WolfAction, dur: number, stir: StirKind | null = null) {
  w.action = action;
  w.stir = stir;
  w.left = w.dur = dur;
  w.started++;
}

function pickStir(w: Wolf): StirKind {
  // while ignoring a visitor, only his ears move
  if (w.clock < w.ignoreUntil) return 'ear';
  let r = next(w) * WOLF.stirWeights.reduce((t, [, p]) => t + p, 0);
  for (const [k, p] of WOLF.stirWeights) {
    r -= p;
    if (r < 0) return k;
  }
  return 'ear';
}

const stir = (w: Wolf, kind: StirKind) => begin(w, 'stir', WOLF.stirs[kind], kind);

function rise(w: Wolf) {
  w.lastRise = w.clock;
  w.riseGap = between(w, WOLF.riseGap);
  w.rises++;
  w.queue = ['stretch', 'stand', 'circle', 'lieDown', 'settle'];
  begin(w, 'rise', WOLF.dur.rise);
}

const mayRise = (w: Wolf) => w.clock - w.lastRise >= w.riseGap;

function glance(w: Wolf) {
  w.lastGlance = w.clock;
  begin(w, 'glance', WOLF.dur.glance);
}

/** The visit's one reaction to a player who stays close: the full rise, or a yawn, or a bored glance. */
function visitReaction(w: Wolf) {
  w.visited = true;
  w.reactAt = -1;
  if (w.clock - w.sleptSince >= WOLF.sleptFor && mayRise(w) && next(w) < WOLF.riseChance) rise(w);
  else if (next(w) < WOLF.yawnChance) stir(w, 'yawn');
  else glance(w);
  w.ignoreUntil = w.clock + w.dur + (w.queue.length ? 14 : 0) + between(w, WOLF.ignore);
}

/** The next part of a rise, or back to sleep. */
function finish(w: Wolf) {
  if (w.action === 'circle') w.yaw = w.lie * Math.PI;
  const nextUp = w.queue.shift();
  if (nextUp) {
    switch (nextUp) {
      case 'stand':
        // nobody to look at: he barely pauses
        return begin(w, 'stand', between(w, w.band === 'far' ? WOLF.dur.standAlone : WOLF.dur.stand));
      case 'circle': {
        const lie: 0 | 1 = next(w) < 0.5 ? 0 : 1;
        const dir = next(w) < 0.5 ? 1 : -1;
        w.turnFrom = w.yaw;
        // the same way round: a full turn; the other way: half a turn
        w.turnBy = dir * (lie === w.lie ? Math.PI * 2 : Math.PI);
        w.lie = lie;
        return begin(w, 'circle', Math.abs(w.turnBy) / WOLF.turn);
      }
      default:
        return begin(w, nextUp, WOLF.dur[nextUp as 'stretch' | 'lieDown' | 'settle']);
    }
  }
  if (w.action === 'settle') {
    w.sleptSince = w.clock;
    w.nextGetUp = w.clock + between(w, WOLF.getUpGap);
  }
  if (w.action === 'look') w.lookAgain = w.clock + WOLF.lookEvery;
  begin(w, 'sleep', 0);
  w.quietUntil = w.clock + WOLF.calm + next(w) * 4;
  w.nextStir = w.clock + between(w, WOLF.stirGap);
}

// ---------- the player ----------

function sense(w: Wolf, env: WolfEnv, dt: number) {
  const d = env.player ? Math.hypot(env.player.x - env.at.x, env.player.z - env.at.z) : Infinity;
  if (w.band === 'far') {
    if (d < WOLF.near[0]) {
      // a new visit
      w.band = d < WOLF.close[0] ? 'close' : 'near';
      w.visited = false;
      w.reactAt = w.clock + between(w, WOLF.react);
    }
  } else if (w.band === 'near') {
    if (d > WOLF.near[1]) w.band = 'far';
    else if (d < WOLF.close[0]) w.band = 'close';
  } else if (d > WOLF.close[1]) w.band = d > WOLF.near[1] ? 'far' : 'near';
  if (w.band === 'far') w.reactAt = -1;
  w.closeFor = w.band === 'close' ? w.closeFor + dt : 0;
  const cat = env.catNear === true;
  if (cat && !w.catWas) w.catPing = true;
  w.catWas = cat;
}

// ---------- stepping ----------

function fromSleep(w: Wolf) {
  if (w.clock < w.quietUntil) {
    w.catPing = false; // an ear flick for the cat isn't worth waiting for
    return;
  }
  if (w.band === 'close' && w.closeFor >= WOLF.closeWait && !w.visited) return visitReaction(w);
  if (w.reactAt >= 0 && w.clock >= w.reactAt) {
    w.reactAt = -1;
    if (w.clock >= w.lookAgain && w.clock >= w.ignoreUntil && next(w) < WOLF.lookChance) return begin(w, 'look', between(w, WOLF.dur.look));
    return stir(w, 'ear');
  }
  if (w.band === 'close' && w.visited && w.clock >= w.ignoreUntil && w.clock - w.lastGlance >= WOLF.glanceEvery) return glance(w);
  if (w.clock >= w.nextGetUp) {
    if (mayRise(w)) return rise(w);
    w.nextGetUp = w.lastRise + w.riseGap;
  }
  if (w.catPing) {
    w.catPing = false;
    return stir(w, 'ear');
  }
  if (w.clock >= w.nextStir) return stir(w, pickStir(w));
}

export function stepWolf(w: Wolf, dt: number, env: WolfEnv) {
  w.clock += dt;
  sense(w, env, dt);
  if (w.action === 'sleep') return fromSleep(w);
  w.left -= dt;
  if (w.action === 'circle') w.yaw = w.turnFrom + w.turnBy * Math.min(1, 1 - w.left / w.dur);
  if (w.action === 'look') {
    // you stayed: the look becomes this visit's reaction; you left: he lays his head down sooner
    if (w.band === 'close' && w.closeFor >= WOLF.closeWait && !w.visited) return visitReaction(w);
    if (w.band === 'far') w.left = Math.min(w.left, 1);
  }
  if (w.left <= 0) finish(w);
}
