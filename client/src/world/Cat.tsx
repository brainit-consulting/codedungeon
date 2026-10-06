import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { CAT, callCat, createCat, stepCat, type Cat as CatState, type CatEnv, type CatSpot, type Prey } from './catBrain';
import { BUILD, POSES, poseCat, type Pose } from './catPose';
import { GALLERY, chamber, drawnFor, dungeonColliders, galleryEnd, inDungeon, toWorld } from './dungeon';
import { GreatSpider } from './GreatSpider';
import { GREAT, createLair, stepLair, type Lair, type LairEnv } from './lairBrain';
import { CEO_DESK, DESK_ROWS, ELEVATOR, HALF_D, HALF_W, HEARTH, RECEPTION, WALL_H, deskPosition } from './layout';
import { makeNav, type Pt } from './nav';
import { RAT, createWarren, releaseRat, stepWarren, type Warren, type WarrenEnv } from './ratBrain';
import { DeadRat, PILE_DROP, Rats } from './Rats';
import { SPIDER, createNest, releaseSpider, stepNest, type Nest, type NestEnv, type P3, type Spider } from './spiderBrain';
import { Spiders } from './Spiders';

// The dungeon's black cat, drawn from simple shapes and posed by hand each frame from what her brain (catBrain.ts)
// is doing. She has no collider and is not something you aim at, so she never blocks a click or the way; you call
// her with C (Player.tsx). The rats she hunts (ratBrain.ts, drawn by Rats.tsx) and the chest's spiders
// (spiderBrain.ts, drawn by Spiders.tsx) are stepped here with her, and so is the great spider in the gallery's dead
// end (lairBrain.ts, drawn by GreatSpider.tsx).

let calls = 0;
const HOME = { x: -HALF_W + HEARTH.d + 0.6, z: HEARTH.z + 0.8 };
let living: CatState | null = null;
/** The session's rats and spiders: kept with her across remounts, so only a reload starts the count over. */
let warren: Warren | null = null;
let nest: Nest | null = null;
let lair: Lair | null = null;
/** The cat as she is right now (for her purr), or null before she's in the dungeon. */
export const theCat = () => living;
/** The Overlord calls the cat (C). */
export function callTheCat() {
  calls++;
}
/** A rat bolts out of somewhere (the chest of spoils), away from `from`: one more for her to chase. False before the warren exists. */
export function letOutRat(at: Pt, from?: Pt): boolean {
  if (!roomForRat()) return false;
  releaseRat(warren!, at, from);
  return true;
}
/** Whether another rat may come out: the warren's limits hold for chest rats too (RAT.max about, her tally's cap). */
export function roomForRat(): boolean {
  return !!warren && warren.rats.length < RAT.max && (living?.kills ?? 0) + warren.rats.length < RAT.cap;
}
/** A spider climbs out of the chest and jumps down to `landing`. Null before the nest exists or with three about. */
export function letOutSpider(inside: P3, rim: P3, landing: Pt): Spider | null {
  return nest && releaseSpider(nest, inside, rim, landing);
}
export function roomForSpider(): boolean {
  return !!nest && nest.spiders.length < SPIDER.max;
}

// ---------- where she likes to be ----------

/** How far along the bar from its middle she sits on it (west), with the mug she pushes about beside her. */
const BAR_SEAT = 1.7;

export function hallSpots(ceoBusy: boolean): CatSpot[] {
  return [
    { id: 'hearth', kind: 'hearth', x: -HALF_W + HEARTH.d + 0.55, z: HEARTH.z, facing: Math.PI / 2, weight: 3 },
    {
      // the bar's west end, clear of where Wystan wipes it (wipingHand.test.ts measures that)
      id: 'bar',
      kind: 'bar',
      x: RECEPTION.x - BAR_SEAT,
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

// ---------- the great spider's lair ----------

/** The great spider's lair, just inside the gallery's end wall, and how far up the gallery it defends: never as far as the last chamber's door. */
export function lairPlace(slots: number[]): Omit<LairEnv, 'player' | 'cat'> {
  const home = { x: 0, z: galleryEnd(slots) - 1.2 };
  const lastDoor = slots.length ? chamber(Math.max(...slots)).z + ELEVATOR.doorHalf : HALF_D;
  return { home, out: 0, range: Math.min(GREAT.range, home.z - lastDoor - 2), ceiling: WALL_H };
}

/** Where the cat sits to watch the lair (and, as often as not, goes for its spider from). */
export function lairSpot(slots: number[]): CatSpot {
  const { home } = lairPlace(slots);
  return { id: 'lair', kind: 'lair', x: 0.7, z: home.z - 3.5, facing: Math.PI, weight: 0 };
}

/** Whether (x, z) is in the gallery, where the great spider sees you (not the hall, not a doorway or a chamber). */
export function inGallery(x: number, z: number, slots: number[]): boolean {
  return Math.abs(x) <= GALLERY.half && z > HALF_D && z <= galleryEnd(slots);
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

const TAIL = BUILD.tail.n;

function CatBody({ brain }: { brain: React.RefObject<CatState | null> }) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const eyes = useRef<THREE.Group>(null);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const tail = useRef<(THREE.Group | null)[]>([]);
  const mouth = useRef<THREE.Group>(null);
  const pose = useRef<Pose>({ ...POSES.sit });
  const phase = useRef(0);
  const was = useRef({ x: 0, z: 0 });

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
    // her legs go when she's actually going somewhere (stalking, she spends a lot of time quite still)
    const moving = c.action !== 'pounce' && Math.hypot(c.x - was.current.x, c.z - was.current.z) > 1e-4;
    was.current.x = c.x;
    was.current.z = c.z;
    phase.current += dt * (moving ? (c.action === 'follow' ? 11 : c.action === 'stalk' ? 5 : 8) : 0);
    const ph = phase.current;

    mouth.current!.visible = c.carrying !== null;
    poseCat({ body: body.current!, head: head.current!, eyes: eyes.current!, legs: legs.current, tail: tail.current }, p, { t, ph, moving, action: c.action });
  });

  const { torso, haunch, leg, paw, tail: tl } = BUILD;
  return (
    <group ref={root}>
      <group ref={body}>
        {/* torso, chest, haunches */}
        <mesh material={FUR} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[torso.r, torso.len, 6, 12]} />
        </mesh>
        <mesh material={FUR} position={[0, 0.0, haunch.z]} scale={[haunch.wide, 1, 1]}>
          <sphereGeometry args={[haunch.r, 12, 10]} />
        </mesh>
        {/* legs, from the shoulders and hips */}
        {BUILD.legs.map(([x, z], i) => (
          <group key={i} ref={(o) => void (legs.current[i] = o)} position={[x, BUILD.legY, z]}>
            <mesh material={FUR} position={[0, leg.y, 0]}>
              <capsuleGeometry args={[leg.r, leg.len, 4, 6]} />
            </mesh>
            <mesh material={FUR} position={[0, paw.y, paw.z]} scale={[1, paw.flat, paw.long]}>
              <sphereGeometry args={[paw.r, 8, 6]} />
            </mesh>
          </group>
        ))}
        {/* the tail, a chain of segments from the rump */}
        <group position={tl.at} rotation={[tl.tilt, 0, 0]}>
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
        {/* the rat she's carrying, held across her jaws */}
        <group ref={mouth} position={[0, -0.05, -0.085]} visible={false}>
          <DeadRat position={[0, -0.03, 0]} rotation={[0.4, Math.PI / 2, 0]} />
        </group>
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
  const { len, r, taper } = BUILD.tail;
  return (
    <group ref={(o) => void (refs.current[i] = o)}>
      <mesh material={FUR} position={[0, len / 2, 0]}>
        <capsuleGeometry args={[r - i * taper, len, 3, 6]} />
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
    g.current.position.set(RECEPTION.x - BAR_SEAT - 0.25, 1.105, RECEPTION.z - 0.1 + at.current);
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
  const rats = useRef<Warren | null>(null);
  const spiders = useRef<Nest | null>(null);

  const nav = useMemo(() => catNav(slots), [slots]);
  const ratEnv = useMemo<WarrenEnv>(() => ({ nav, player: null, kills: 0, inside: (x, z) => inDungeon(x, z, slots), threats: [] }), [nav, slots]);
  const spiderEnv = useMemo<NestEnv>(() => ({ nav, player: null, inside: (x, z) => inDungeon(x, z, slots), threats: [] }), [nav, slots]);

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
    // she goes to watch the great spider only while there's one alive (its weight is set each frame)
    spots.push(lairSpot(slots));
    return { nav, spots, player: null, corners: corners(slots), rats: [], pile: PILE_DROP };
  }, [nav, repos, slots, busyKey, ceoBusy]);
  const lairEnv = useMemo<LairEnv>(() => ({ ...lairPlace(slots), player: null, cat: null }), [slots]);
  const great = useRef<Lair | null>(null);

  useEffect(() => {
    if (!brain.current) brain.current = living ?? createCat(Math.floor(Math.random() * 1e9), { ...HOME });
    living = brain.current;
    if (!warren) warren = createWarren(Math.floor(Math.random() * 1e9));
    rats.current = warren;
    if (!nest) nest = createNest(Math.floor(Math.random() * 1e9));
    spiders.current = nest;
    if (!lair) lair = createLair(Math.floor(Math.random() * 1e9), { ...lairPlace(slots), player: null, cat: null });
    great.current = lair;
    // window.__dungeonCat: a read-only peek for QA (what she's doing, where, and where she's heading)
    const peek = () => {
      const c = brain.current;
      return (
        c && {
          action: c.action,
          x: c.x,
          y: c.y,
          z: c.z,
          goal: c.goal?.id ?? null,
          nudges: c.nudges,
          left: c.left,
          prey: c.prey,
          carrying: c.carrying,
          kills: c.kills,
          dropped: c.dropped,
          ate: c.ate,
          slain: c.slain,
          great: great.current?.great && { action: great.current.great.action, x: great.current.great.x, y: great.current.great.y, z: great.current.great.z },
          bodies: great.current?.bodies.map((b) => ({ x: b.x, z: b.z, age: b.age, life: b.life })) ?? [],
          respawnIn: great.current?.respawnIn ?? 0,
          rats: rats.current?.rats.map((r) => ({ id: r.id, action: r.action, x: r.x, z: r.z })) ?? [],
          spiders: spiders.current?.spiders.map((s) => ({ id: s.id, action: s.action, x: s.x, y: s.y, z: s.z, age: s.age })) ?? [],
        }
      );
    };
    if (!import.meta.env.DEV) return;
    Object.defineProperty(window, '__dungeonCat', { get: peek, configurable: true });
    // and her brain itself, to put her somewhere for a look (development only)
    (window as unknown as Record<string, unknown>).__catBrain = () => brain.current;
    (window as unknown as Record<string, unknown>).__lair = () => great.current;
    return () => {
      delete (window as unknown as Record<string, unknown>).__dungeonCat;
      delete (window as unknown as Record<string, unknown>).__catBrain;
      delete (window as unknown as Record<string, unknown>).__lair;
    };
  }, []);

  const seenCalls = useRef(calls);
  const threats = useRef<Pt[]>([]);
  const prey = useRef<Prey[]>([]);
  const shown = useRef<THREE.Group>(null);
  const checks = useRef(0);
  useFrame((_, rawDt) => {
    const c = brain.current;
    if (!c) return;
    const dt = Math.min(rawDt, 0.1);
    if (calls !== seenCalls.current) {
      seenCalls.current = calls;
      if (Math.hypot(camera.position.x - c.x, camera.position.z - c.z) < 12) callCat(c);
    }
    if (env.player) {
      env.player.x = camera.position.x;
      env.player.z = camera.position.z;
    } else env.player = { x: camera.position.x, z: camera.position.z };
    // a project removed while she was in its chamber leaves her outside the walls: home to the hearth
    if (++checks.current % 120 === 0 && c.y === 0 && !inDungeon(c.x, c.z, slots)) {
      const dropped = c.dropped + (c.carrying !== null ? 1 : 0); // a rat in her mouth still ends up on the pile
      Object.assign(c, HOME, { y: 0, action: 'sit', left: 3, path: [], goal: null, jump: null, prey: null, carrying: null, dropped });
    }
    // the rats and spiders first (they run from her unless she's stalking), then her
    threats.current.length = 0;
    if (c.action !== 'stalk' && c.action !== 'pounce') threats.current.push(c);
    prey.current.length = 0;
    const w = rats.current;
    if (w) {
      ratEnv.player = env.player;
      ratEnv.kills = c.kills;
      ratEnv.threats = threats.current;
      stepWarren(w, dt, ratEnv);
      for (const r of w.rats) prey.current.push(r);
    }
    const n = spiders.current;
    if (n) {
      spiderEnv.player = env.player;
      spiderEnv.threats = threats.current;
      stepNest(n, dt, spiderEnv);
      // only once they're down on the floor: never off the chest's rim or out of the air
      for (const s of n.spiders) if (s.y === 0 && !s.hop) prey.current.push(s);
    }
    // the great spider: it sees you only in the gallery, and doesn't see her coming when she stalks it
    const l = great.current;
    if (l) {
      const me = env.player!;
      lairEnv.player = inGallery(me.x, me.z, slots) ? me : null;
      lairEnv.cat = c.action === 'stalk' || c.action === 'pounce' || c.y > 0 ? null : c;
      stepLair(l, dt, lairEnv);
      const g = l.great;
      if (g && !g.dead && g.y === 0 && g.action !== 'descend') prey.current.push(g);
      const spot = env.spots.find((s) => s.kind === 'lair');
      if (spot) spot.weight = g ? 0.5 : 0;
    }
    env.rats = prey.current;
    stepCat(c, dt, env);
    // out of sight when she's in a room that isn't drawn (she'd float in the dark), checked a few times a second
    if (checks.current % 10 === 0 && shown.current) shown.current.visible = drawnFor(c.x, c.z, camera.position.x, camera.position.z, slots);
  });

  return (
    <>
      <group ref={shown}>
        <CatBody brain={brain} />
      </group>
      <BarMug brain={brain} />
      <Rats warren={rats} cat={brain} slots={slots} />
      <Spiders nest={spiders} cat={brain} slots={slots} />
      <GreatSpider lair={great} slots={slots} />
    </>
  );
}

export { CAT };
