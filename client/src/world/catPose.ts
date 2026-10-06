import type * as THREE from 'three';
import type { CatAction } from './catBrain';

// The cat's body (Cat.tsx draws it from simple shapes): her build, and how each action poses it, frame by frame.
// Kept apart from the drawing so a test can stand her on a surface and measure where her paws and tail end up.

/** Pose parameters; each frame eases toward the target for the current action. */
export interface Pose {
  rear: number; // 0 standing .. 1 sat on her haunches
  curl: number; // 0 .. 1 curled up asleep
  stride: number; // leg swing amplitude
  headDown: number; // radians
  paw: number; // 0 .. 1 one front paw raised (washing, nudging)
  eyes: number; // 1 open .. 0 shut
  tailUp: number; // 1 tail up (walking) .. 0 tail down and wrapped
  stretch: number; // 0 .. 1 leaping
  crouch: number; // 0 .. 1 belly to the floor, stalking
}

export const POSES: Record<CatAction, Pose> = {
  walk: { rear: 0, curl: 0, stride: 1, headDown: 0.05, paw: 0, eyes: 1, tailUp: 1, stretch: 0, crouch: 0 },
  follow: { rear: 0, curl: 0, stride: 1.2, headDown: 0, paw: 0, eyes: 1, tailUp: 1, stretch: 0, crouch: 0 },
  jumpUp: { rear: 0, curl: 0, stride: 0, headDown: -0.2, paw: 0, eyes: 1, tailUp: 0.6, stretch: 1, crouch: 0 },
  jumpDown: { rear: 0, curl: 0, stride: 0, headDown: 0.3, paw: 0, eyes: 1, tailUp: 0.8, stretch: 1, crouch: 0 },
  sit: { rear: 1, curl: 0, stride: 0, headDown: 0, paw: 0, eyes: 1, tailUp: 0, stretch: 0, crouch: 0 },
  purr: { rear: 1, curl: 0, stride: 0, headDown: 0.12, paw: 0, eyes: 0.35, tailUp: 0, stretch: 0, crouch: 0 },
  ignore: { rear: 1, curl: 0, stride: 0, headDown: -0.15, paw: 0, eyes: 0.6, tailUp: 0, stretch: 0, crouch: 0 },
  wash: { rear: 1, curl: 0, stride: 0, headDown: 0.55, paw: 1, eyes: 0.5, tailUp: 0, stretch: 0, crouch: 0 },
  nudge: { rear: 1, curl: 0, stride: 0, headDown: 0.25, paw: 1, eyes: 1, tailUp: 0, stretch: 0, crouch: 0 },
  sleep: { rear: 0, curl: 1, stride: 0, headDown: 0.4, paw: 0, eyes: 0, tailUp: 0, stretch: 0, crouch: 0 },
  // belly low, head level and pushed forward, tail low and twitching at the tip
  stalk: { rear: 0, curl: 0, stride: 0.55, headDown: -0.1, paw: 0, eyes: 1, tailUp: 0.1, stretch: 0, crouch: 1 },
  pounce: { rear: 0, curl: 0, stride: 0, headDown: -0.1, paw: 0, eyes: 1, tailUp: 0.5, stretch: 1, crouch: 0 },
  // trotting home with it, head held high
  carry: { rear: 0, curl: 0, stride: 1, headDown: -0.35, paw: 0, eyes: 1, tailUp: 1, stretch: 0, crouch: 0 },
};

/**
 * Her build (m), in her own frame: facing -z, standing on y = 0. The torso (a capsule along z) and the haunches (a
 * ball behind it) in the body; legs hung from the shoulders and hips (front left, front right, hind left, hind right),
 * each a capsule ending in a flattened ball of a paw; the tail a chain of short segments from the rump.
 */
export const BUILD = {
  torso: { r: 0.08, len: 0.2 },
  haunch: { z: 0.11, r: 0.092, wide: 1.05 },
  legs: [
    [-0.05, -0.12],
    [0.05, -0.12],
    [-0.055, 0.11],
    [0.055, 0.11],
  ] as [number, number][],
  legY: -0.03,
  leg: { r: 0.022, len: 0.12, y: -0.075 },
  paw: { r: 0.026, y: -0.145, z: -0.012, flat: 0.6, long: 1.3 },
  tail: { at: [0, 0.03, 0.17] as [number, number, number], tilt: 0.3, n: 7, len: 0.045, r: 0.017, taper: 0.0012 },
};

/**
 * How she stands and sits (m, radians). Stood, her body's middle this high, so her paws are on the ground. Sat: her
 * body tipped up and let down till her haunches rest on the ground, her front legs reaching down straight, her hind
 * feet laid forward on the ground from under her haunches (the hind legs hung from there instead of the hips), her
 * tail down to the ground behind her and round her side, her head on her chest.
 */
export const STANCE = {
  stand: 0.19,
  sit: {
    pitch: 0.62,
    drop: 0.034,
    frontReach: 0.27,
    frontTurn: -0.5,
    hind: { at: [0.012, -0.033, 0.033] as [number, number, number], turn: 0.95 },
    tail: { down: [1.28, 0.3, -0.93, 0, 0, 0, 0], round: [0, 0, 0, 0.55, 0.55, 0.55, 0.5] },
    head: { up: 0.039, forward: 0.099 },
  },
  /** Curled up asleep: how far her body comes down, and her tail down to the floor and out along it. */
  sleep: { drop: 0.08, tail: { down: [-0.3, -0.1, -0.1, -0.1, -0.1, -0.1, -0.1], round: [1.2, -0.2, -0.2, -0.2, -0.2, -0.2, -0.2] } },
};

/** What a frame of posing moves: the body (torso, haunches, legs and tail ride on it), the head, its eyes, and so on. */
export interface CatParts {
  body: THREE.Object3D;
  head: THREE.Object3D;
  eyes: THREE.Object3D;
  /** front left, front right, hind left, hind right (null before they're drawn) */
  legs: (THREE.Object3D | null)[];
  /** root to tip */
  tail: (THREE.Object3D | null)[];
}

/**
 * Puts her parts in pose `p`, `t` seconds in, `ph` into her stride: pitched up sat, low and round curled, a bob
 * walking, breathing asleep; the head tracking the body; the legs in a diagonal gait walking, sat the front ones
 * straight and the hind ones tucked, one paw up to wash; the tail up in a question mark walking, wrapped round her
 * feet sat, round her nose asleep, flicking.
 */
export function poseCat(parts: CatParts, p: Pose, at: { t: number; ph: number; moving: boolean; action: CatAction }) {
  const { t, ph, moving, action } = at;
  const b = parts.body;
  const breathe = 1 + Math.sin(t * (p.curl > 0.5 ? 1.6 : 2.4)) * 0.025;
  const purr = action === 'purr' ? Math.sin(t * 60) * 0.002 : 0;
  const sit = STANCE.sit;
  b.position.set(0, STANCE.stand - p.rear * sit.drop - p.curl * STANCE.sleep.drop - p.crouch * 0.07 + (moving ? Math.abs(Math.sin(ph)) * 0.012 : 0) + purr, p.rear * 0.05);
  b.rotation.x = p.rear * sit.pitch - p.stretch * 0.15;
  b.rotation.z = p.curl * 1.2;
  b.scale.set(1 + p.curl * 0.15, breathe, 1 - p.curl * 0.25 + p.stretch * 0.15);

  // the head: looks down to wash, tucked in asleep; ignoring, she turns it away
  const h = parts.head;
  h.position.set(p.curl * 0.09, STANCE.stand + 0.11 - p.curl * 0.17 + p.rear * sit.head.up - p.crouch * 0.1, -0.19 + p.rear * sit.head.forward + p.curl * 0.05 - p.crouch * 0.03);
  const washBob = action === 'wash' ? Math.sin(t * 7) * 0.12 : 0;
  const hunting = action === 'stalk' || action === 'pounce';
  const look = action === 'ignore' ? 0.9 + Math.sin(t * 0.7) * 0.15 : hunting ? 0 : Math.sin(t * 0.37) * 0.25 * (1 - p.curl);
  h.rotation.set(p.headDown + washBob, look, p.curl * 0.8);
  // eyes: blink now and then, half shut purring, shut asleep
  const blink = (t * 0.31) % 1 > 0.97 ? 0.1 : 1;
  parts.eyes.scale.y = Math.max(0.05, p.eyes * blink);

  const swing = Math.sin(ph) * 0.55 * p.stride;
  const [fl, fr, hl, hr] = parts.legs;
  if (fl && fr && hl && hr) {
    fl.rotation.x = swing + p.rear * sit.frontTurn + p.stretch * -0.9 - p.paw * 1.6 + (action === 'nudge' ? Math.max(0, Math.sin(t * 3)) * 0.5 : 0);
    fr.rotation.x = -swing + p.rear * sit.frontTurn + p.stretch * -0.9;
    hl.rotation.x = -swing + p.rear * sit.hind.turn + p.stretch * 0.9;
    hr.rotation.x = swing + p.rear * sit.hind.turn + p.stretch * 0.9;
    parts.legs.forEach((leg, i) => {
      const [x, z] = BUILD.legs[i];
      const hind = i >= 2;
      // sat, the hind legs hang from under the haunches, low down, not from the hips
      leg!.position.set(x + (hind ? Math.sign(x) * p.rear * sit.hind.at[0] : 0), BUILD.legY + (hind ? p.rear * sit.hind.at[1] : 0), z + (hind ? p.rear * sit.hind.at[2] : 0));
      leg!.scale.y = (1 - p.curl * 0.85) * (1 - p.crouch * 0.44) * (hind ? 1 : 1 + p.rear * sit.frontReach);
    });
  }

  // the tail: up in a question mark walking; sat or asleep, down to the ground and round her, the tip flicking (each
  // segment bends about its own z to go round, about x to go up or down)
  const flick = action === 'ignore' || action === 'stalk' ? 0.6 : action === 'sleep' ? 0.04 : 0.18;
  const n = parts.tail.length;
  const down = p.rear * (1 - p.tailUp);
  const asleep = STANCE.sleep.tail;
  parts.tail.forEach((s, i) => {
    if (!s) return;
    const u = i / (n - 1);
    const up = p.tailUp * (0.5 - u * 0.15);
    s.rotation.set(-up + down * sit.tail.down[i] + p.curl * asleep.down[i], 0, down * sit.tail.round[i] + p.curl * asleep.round[i] + Math.sin(t * 2.2 - i * 0.6) * flick * u * u);
  });
}
