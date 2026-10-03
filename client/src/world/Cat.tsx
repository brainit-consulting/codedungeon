import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { CAT, callCat, createCat, stepCat, type Cat as CatState, type CatAction, type CatEnv, type CatSpot } from './catBrain';
import { GALLERY, chamber, dungeonColliders, galleryEnd, inDungeon, toWorld } from './dungeon';
import { CEO_DESK, DESK_ROWS, HALF_D, HALF_W, HEARTH, RECEPTION, deskPosition } from './layout';
import { makeNav, type Pt } from './nav';

// The dungeon's black cat, drawn from simple shapes and posed by hand each frame from what her brain (catBrain.ts)
// is doing. She has no collider and is not something you aim at, so she never blocks a click or the way; you call
// her with C (Player.tsx).

let calls = 0;
const HOME = { x: -HALF_W + HEARTH.d + 0.6, z: HEARTH.z + 0.8 };
let living: CatState | null = null;
/** The cat as she is right now (for her purr), or null before she's in the dungeon. */
export const theCat = () => living;
/** The Overlord calls the cat (C). */
export function callTheCat() {
  calls++;
}

// ---------- where she likes to be ----------

export function hallSpots(ceoBusy: boolean): CatSpot[] {
  return [
    { id: 'hearth', kind: 'hearth', x: -HALF_W + HEARTH.d + 0.55, z: HEARTH.z, facing: Math.PI / 2, weight: 3 },
    {
      id: 'bar',
      kind: 'bar',
      x: RECEPTION.x - 1.0,
      z: RECEPTION.z - 0.05,
      y: 1.105,
      approach: { x: RECEPTION.x - 1.2, z: RECEPTION.z + 1.75 },
      facing: Math.PI,
      weight: 2.5,
    },
    {
      // the DungeonMaster's desk: she claims it when he's not looking
      id: 'throne',
      kind: 'throne',
      x: CEO_DESK.x + 0.55,
      z: CEO_DESK.z - 0.15,
      y: 0.76,
      approach: { x: CEO_DESK.x + 1.55, z: CEO_DESK.z + 0.1 },
      facing: Math.PI,
      weight: ceoBusy ? 0.6 : 2.5,
    },
  ];
}

interface ChamberInfo {
  slot: number;
  busyDesks: number[];
}

export function chamberSpots(ch: ChamberInfo): CatSpot[] {
  const c = chamber(ch.slot);
  const out: CatSpot[] = [];
  for (const d of ch.busyDesks) {
    const desk = deskPosition(d);
    // on the floor beside the coder's chair, facing the same way they do
    const p = toWorld(c, desk.x + 0.75, desk.z + 0.9);
    out.push({ id: `coder:${ch.slot}:${d}`, kind: 'coder', x: p.x, z: p.z, facing: c.rot, weight: 1.6 });
  }
  // in front of the Kanban board, right where you'd stand to read it
  const b = toWorld(c, 1.2, -HALF_D + 1.3);
  out.push({ id: `board:${ch.slot}`, kind: 'board', x: b.x, z: b.z, facing: c.rot + Math.PI, weight: 0.8 });
  return out;
}

/** A few random open spots in the hall, the gallery and each chamber, for wandering. */
function corners(slots: number[]): Pt[] {
  const out: Pt[] = [
    { x: -10, z: 8 },
    { x: 9, z: 9 },
    { x: -3, z: 1 },
    { x: 0, z: HALF_D + 6 },
  ];
  for (const s of slots) {
    const c = chamber(s);
    for (const [x, z] of [
      [-13, 8],
      [0, 7.5],
      [12, -10],
    ])
      out.push(toWorld(c, x, z));
  }
  return out;
}

/** The grid she walks: the whole dungeon, at 0.3 m (measured: a long trip across ten chambers plans in under 30 ms). */
export function catNav(slots: number[]) {
  const end = galleryEnd(slots);
  const wide = slots.length ? GALLERY.half + GALLERY.wall + HALF_D * 2 + 0.4 : HALF_W;
  const bounds = { minX: -Math.max(HALF_W, wide) - 0.4, maxX: Math.max(HALF_W, wide) + 0.4, minZ: -HALF_D - 0.4, maxZ: end + 0.4 };
  return makeNav(dungeonColliders(slots), bounds, 0.3);
}

// ---------- her body ----------

// Black, but with a faint sheen so she still reads in candlelight; her eyes catch the light.
const FUR = new THREE.MeshStandardMaterial({ color: '#1c1816', roughness: 0.55, metalness: 0.15 });
const INNER = new THREE.MeshStandardMaterial({ color: '#2a1d1d', roughness: 0.9 });
const EYE = new THREE.MeshBasicMaterial({ color: '#e8f05a', toneMapped: false });
const PUPIL = new THREE.MeshBasicMaterial({ color: '#050505' });

/** Pose parameters; each frame eases toward the target for the current action. */
interface Pose {
  rear: number; // 0 standing .. 1 sat on her haunches
  curl: number; // 0 .. 1 curled up asleep
  stride: number; // leg swing amplitude
  headDown: number; // radians
  paw: number; // 0 .. 1 one front paw raised (washing, nudging)
  eyes: number; // 1 open .. 0 shut
  tailUp: number; // 1 tail up (walking) .. 0 tail down and wrapped
  stretch: number; // 0 .. 1 leaping
}

const POSES: Record<CatAction, Pose> = {
  walk: { rear: 0, curl: 0, stride: 1, headDown: 0.05, paw: 0, eyes: 1, tailUp: 1, stretch: 0 },
  follow: { rear: 0, curl: 0, stride: 1.2, headDown: 0, paw: 0, eyes: 1, tailUp: 1, stretch: 0 },
  jumpUp: { rear: 0, curl: 0, stride: 0, headDown: -0.2, paw: 0, eyes: 1, tailUp: 0.6, stretch: 1 },
  jumpDown: { rear: 0, curl: 0, stride: 0, headDown: 0.3, paw: 0, eyes: 1, tailUp: 0.8, stretch: 1 },
  sit: { rear: 1, curl: 0, stride: 0, headDown: 0, paw: 0, eyes: 1, tailUp: 0, stretch: 0 },
  purr: { rear: 1, curl: 0, stride: 0, headDown: 0.12, paw: 0, eyes: 0.35, tailUp: 0, stretch: 0 },
  ignore: { rear: 1, curl: 0, stride: 0, headDown: -0.15, paw: 0, eyes: 0.6, tailUp: 0.3, stretch: 0 },
  wash: { rear: 1, curl: 0, stride: 0, headDown: 0.55, paw: 1, eyes: 0.5, tailUp: 0, stretch: 0 },
  nudge: { rear: 1, curl: 0, stride: 0, headDown: 0.25, paw: 1, eyes: 1, tailUp: 0.2, stretch: 0 },
  sleep: { rear: 0, curl: 1, stride: 0, headDown: 0.4, paw: 0, eyes: 0, tailUp: 0, stretch: 0 },
};

const TAIL = 7;

function CatBody({ brain }: { brain: React.RefObject<CatState | null> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const pose = useRef<Pose>({ ...POSES.sit });
  const phase = useRef(0);

  useFrame(({ clock }, dt) => {
    const c = brain.current;
    const g = root.current;
    if (!c || !g) return;
    const t = clock.elapsedTime;
    const target = POSES[c.action];
    const k = 1 - Math.exp(-dt * 7);
    const p = pose.current;
    for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (target[key] - p[key]) * k;

    g.position.set(c.x, c.y, c.z);
    g.rotation.y = c.heading;
    const moving = c.action === 'walk' || c.action === 'follow';
    phase.current += dt * (moving ? (c.action === 'follow' ? 11 : 8) : 0);
    const ph = phase.current;

    // body: pitched up when sat, low and round when curled, a slight bob when walking, breathing when asleep
    const b = body.current!;
    const breathe = 1 + Math.sin(t * (p.curl > 0.5 ? 1.6 : 2.4)) * 0.025;
    const purr = c.action === 'purr' ? Math.sin(t * 60) * 0.002 : 0;
    b.position.set(0, 0.17 - p.curl * 0.09 + (moving ? Math.abs(Math.sin(ph)) * 0.012 : 0) + purr, p.rear * 0.05);
    b.rotation.x = p.rear * 0.62 - p.stretch * 0.15;
    b.rotation.z = p.curl * 1.2;
    b.scale.set(1 + p.curl * 0.15, breathe, 1 - p.curl * 0.25 + p.stretch * 0.15);

    // head: tracks the body, looks down to wash, tucked in asleep; ignoring, she turns it away
    const h = head.current!;
    h.position.set(p.curl * 0.09, 0.28 - p.curl * 0.17 + p.rear * 0.09, -0.19 + p.rear * 0.07 + p.curl * 0.05);
    const washBob = c.action === 'wash' ? Math.sin(t * 7) * 0.12 : 0;
    const look = c.action === 'ignore' ? 0.9 + Math.sin(t * 0.7) * 0.15 : Math.sin(t * 0.37) * 0.25 * (1 - p.curl);
    h.rotation.set(p.headDown + washBob, look, p.curl * 0.8);
    // eyes: blink now and then, half shut purring, shut asleep
    const blink = (t * 0.31) % 1 > 0.97 ? 0.1 : 1;
    eyes.current!.scale.y = Math.max(0.05, p.eyes * blink);

    // legs: a diagonal gait walking; sat, the front ones straight and the hind ones tucked; one paw up to wash
    const L = legs.current;
    const swing = Math.sin(ph) * 0.55 * p.stride;
    const [fl, fr, hl, hr] = L;
    if (fl && fr && hl && hr) {
      fl.rotation.x = swing - p.rear * 0.5 + p.stretch * -0.9 - p.paw * 1.6 + (c.action === 'nudge' ? Math.max(0, Math.sin(t * 3)) * 0.5 : 0);
      fr.rotation.x = -swing - p.rear * 0.5 + p.stretch * -0.9;
      hl.rotation.x = -swing + p.rear * 1.3 + p.stretch * 0.9;
      hr.rotation.x = swing + p.rear * 1.3 + p.stretch * 0.9;
      for (const leg of L) if (leg) leg.scale.y = 1 - p.curl * 0.85;
    }

    // tail: up in a question mark when walking, wrapped round her feet sat, around her nose asleep; it flicks
    const flick = c.action === 'ignore' ? 0.6 : 0.18;
    for (let i = 0; i < TAIL; i++) {
      const s = tail.current[i];
      if (!s) continue;
      const u = i / (TAIL - 1);
      const up = p.tailUp * (0.5 - u * 0.15);
      const wrap = (1 - p.tailUp) * (0.35 + p.curl * 0.25);
      s.rotation.set(-up, wrap + Math.sin(t * 2.2 - i * 0.6) * flick * u, 0);
    }
  });

  const legAt: [number, number][] = [
    [-0.05, -0.12],
    [0.05, -0.12],
    [-0.055, 0.11],
    [0.055, 0.11],
  ];
  return (
    <group ref={root}>
      <group ref={body}>
        {/* torso, chest, haunches */}
        <mesh material={FUR} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.08, 0.2, 6, 12]} />
        </mesh>
        <mesh material={FUR} position={[0, 0.0, 0.11]} scale={[1.05, 1, 1]}>
          <sphereGeometry args={[0.092, 12, 10]} />
        </mesh>
        {/* legs, from the shoulders and hips */}
        {legAt.map(([x, z], i) => (
          <group key={i} ref={(o) => void (legs.current[i] = o)} position={[x, -0.03, z]}>
            <mesh material={FUR} position={[0, -0.075, 0]}>
              <capsuleGeometry args={[0.022, 0.12, 4, 6]} />
            </mesh>
            <mesh material={FUR} position={[0, -0.145, -0.012]} scale={[1, 0.6, 1.3]}>
              <sphereGeometry args={[0.026, 8, 6]} />
            </mesh>
          </group>
        ))}
        {/* the tail, a chain of segments from the rump */}
        <group position={[0, 0.03, 0.17]} rotation={[0.3, 0, 0]}>
          <TailChain refs={tail} i={0} />
        </group>
      </group>
      <group ref={head}>
        <mesh material={FUR} scale={[1.1, 0.95, 1]}>
          <sphereGeometry args={[0.072, 14, 12]} />
        </mesh>
        <mesh material={FUR} position={[0, -0.02, -0.055]} scale={[1, 0.75, 0.8]}>
          <sphereGeometry args={[0.04, 10, 8]} />
        </mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.042, 0.06, 0.005]} rotation={[0, 0, -s * 0.25]}>
            <mesh material={FUR}>
              <coneGeometry args={[0.028, 0.06, 4]} />
            </mesh>
            <mesh material={INNER} position={[0, -0.004, -0.009]} scale={[0.6, 0.8, 0.4]}>
              <coneGeometry args={[0.028, 0.06, 4]} />
            </mesh>
          </group>
        ))}
        <group ref={eyes} position={[0, 0.012, -0.062]}>
          {[-1, 1].map((s) => (
            <group key={s} position={[s * 0.028, 0, 0]}>
              <mesh material={EYE} scale={[1, 0.8, 0.5]}>
                <sphereGeometry args={[0.017, 10, 8]} />
              </mesh>
              <mesh material={PUPIL} position={[0, 0, -0.006]} scale={[0.35, 1, 0.5]}>
                <sphereGeometry args={[0.012, 8, 6]} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}

function TailChain({ refs, i }: { refs: React.RefObject<(THREE.Group | null)[]>; i: number }) {
  if (i >= TAIL) return null;
  const len = 0.045;
  return (
    <group ref={(o) => void (refs.current[i] = o)}>
      <mesh material={FUR} position={[0, len / 2, 0]}>
        <capsuleGeometry args={[0.017 - i * 0.0012, len, 3, 6]} />
      </mesh>
      <group position={[0, len, 0]}>
        <TailChain refs={refs} i={i + 1} />
      </group>
    </group>
  );
}

// ---------- the cat in the dungeon ----------

/** The mug on the bar she pushes towards the edge, a little each time, until it's put back. */
function BarMug({ brain }: { brain: React.RefObject<CatState | null> }) {
  const g = useRef<THREE.Group>(null);
  const at = useRef(0);
  useFrame((_, dt) => {
    const c = brain.current;
    if (!c || !g.current) return;
    const pushing = c.action === 'nudge' && c.goal?.kind === 'bar';
    if (pushing) at.current = Math.min(0.42, at.current + dt * 0.12);
    else if (c.goal?.kind !== 'bar') at.current = Math.max(0, at.current - dt * 0.05); // someone tidies it back
    g.current.position.set(RECEPTION.x - 1.25 - 0.0, 1.105, RECEPTION.z - 0.1 + at.current);
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.045, 0.04, 0.12, 12]} />
        <meshStandardMaterial color="#5a3d26" roughness={0.7} />
      </mesh>
    </group>
  );
}

export function Cat({ slots }: { slots: number[] }) {
  const agents = useStore((s) => s.agents);
  const repos = useStore((s) => s.repos);
  const camera = useThree((s) => s.camera);
  const brain = useRef<CatState | null>(null);

  const nav = useMemo(() => catNav(slots), [slots]);

  const busyKey = Object.values(agents)
    .filter((a) => a.repoId && (a.status === 'working' || a.status === 'preparing') && a.role === 'dev')
    .map((a) => `${a.repoId}:${a.desk}`)
    .sort()
    .join();
  const ceoBusy = Object.values(agents).some((a) => a.role === 'ceo' && (a.status === 'working' || a.status === 'preparing'));
  const env = useMemo<CatEnv>(() => {
    const busy = new Set(busyKey ? busyKey.split(',') : []);
    const spots = [...hallSpots(ceoBusy)];
    for (const r of repos) {
      if (!slots.includes(r.floor)) continue;
      const desks = Array.from({ length: DESK_ROWS.length * 4 }, (_, d) => d).filter((d) => busy.has(`${r.id}:${d}`));
      spots.push(...chamberSpots({ slot: r.floor, busyDesks: desks }));
    }
    return { nav, spots, player: null, corners: corners(slots) };
  }, [nav, repos, slots, busyKey, ceoBusy]);

  useEffect(() => {
    if (!brain.current) brain.current = createCat(Math.floor(Math.random() * 1e9), { ...HOME });
    living = brain.current;
    // window.__dungeonCat: a read-only peek for QA (what she's doing, where, and where she's heading)
    const peek = () => {
      const c = brain.current;
      return c && { action: c.action, x: c.x, y: c.y, z: c.z, goal: c.goal?.id ?? null, nudges: c.nudges, left: c.left };
    };
    if (!import.meta.env.DEV) return;
    Object.defineProperty(window, '__dungeonCat', { get: peek, configurable: true });
    return () => void delete (window as unknown as Record<string, unknown>).__dungeonCat;
  }, []);

  const seenCalls = useRef(calls);
  const checks = useRef(0);
  useFrame((_, rawDt) => {
    const c = brain.current;
    if (!c) return;
    const dt = Math.min(rawDt, 0.1);
    if (calls !== seenCalls.current) {
      seenCalls.current = calls;
      if (Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < 12) callCat(c);
    }
    env.player = { x: camera.position.x, z: camera.position.z };
    // a project removed while she was in its chamber leaves her outside the walls: home to the hearth
    if (++checks.current % 120 === 0 && c.y === 0 && !inDungeon(c.x, c.z, slots)) {
      Object.assign(c, HOME, { y: 0, action: 'sit', left: 3, path: [], goal: null, jump: null });
    }
    stepCat(c, dt, env);
  });

  return (
    <>
      <CatBody brain={brain} />
      <BarMug brain={brain} />
    </>
  );
}

export { CAT };
