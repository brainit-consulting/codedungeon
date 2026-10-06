import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noise } from '../ui/sfx';
import { GALLERY, galleryEnd } from './dungeon';
import { GREAT, bodyShrivel, type Lair } from './lairBrain';
import { WALL_H } from './layout';
import { STRIDE, SpiderModel, legRefs, poseLegs, type LegRefs, type Stance } from './Spiders';

// The great spider in the gallery's dead end (lairBrain.ts): the chest's tarantula three times over, with rust-red
// bands below its knees, drawn from the same body and legs (Spiders.tsx). Its dead lie on their backs with their legs
// curled in, and shrivel away in time; the next lets itself down from the ceiling on a thread. Old webs hang in the
// end wall's corners. Its hiss, its heavier feet and its death are made here too. No colliders, nothing to aim at.

const SIZE = 3.9;
/** Drawn only while you're this close to its lair. */
const DRAW_WITHIN = 30;
const HISS_HEAR = 16;
const TICK_HEAR = 10;
const DEATH_HEAR = 20;
/** On its back, the body rests this high (before SIZE), and the flip takes this long (s). */
const ON_BACK = 0.11;
const FLIP_S = 0.7;

const KNEES = new THREE.MeshStandardMaterial({ color: '#4e2412', roughness: 0.85 });
const SILK = new THREE.LineBasicMaterial({ color: '#cfc8b8', transparent: true, opacity: 0.3, depthWrite: false });

const ease = (now: number, target: number, k: number) => now + (target - now) * k;
function easeAngle(now: number, target: number, k: number) {
  let d = target - now;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return now + d * k;
}

// ---------- the one alive ----------

function Live({ lair, near }: { lair: React.RefObject<Lair | null>; near: React.RefObject<boolean> }) {
  const g = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const legs = useRef<LegRefs[]>(legRefs());
  const palps = useRef<(THREE.Group | null)[]>([]);
  const thread = useRef<THREE.Line>(null);
  const threadGeo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)), []);
  const st = useRef({ id: 0, x: 0, z: 0, heading: 0, phase: 0, moving: 0, rear: 0, spread: 0 });
  useFrame(({ clock }, rawDt) => {
    const s = lair.current?.great;
    const o = g.current;
    if (!o) return;
    o.visible = !!s && !s.dead && near.current;
    if (thread.current) thread.current.visible = o.visible && s!.action === 'descend';
    if (!s || !o.visible) return;
    const dt = Math.min(rawDt, 0.1);
    const p = st.current;
    if (p.id !== s.id) Object.assign(p, { id: s.id, x: s.x, z: s.z, heading: s.heading, phase: 0, moving: 0, rear: 0, spread: 0 });
    const k = 1 - Math.exp(-dt * 12);
    const turned = Math.abs(easeAngle(p.heading, s.heading, k) - p.heading);
    p.heading = easeAngle(p.heading, s.heading, k);
    // the legs go as far as it moved, backwards when it backs off home facing you
    const dx = s.x - p.x;
    const dz = s.z - p.z;
    const ahead = -Math.sin(p.heading) * dx - Math.cos(p.heading) * dz;
    const moved = Math.hypot(dx, dz);
    p.x = s.x;
    p.z = s.z;
    p.phase += ((Math.sign(ahead || 1) * moved + turned * 0.08) / (STRIDE * SIZE)) * Math.PI * 2;
    p.moving = ease(p.moving, moved > 1e-5 ? 1 : 0, 1 - Math.exp(-dt * 10));
    // tensed before a charge, reared at the end of one
    const rear = s.action === 'rear' ? 1 : s.action === 'alert' ? 0.3 : 0;
    p.rear = ease(p.rear, rear, 1 - Math.exp(-dt * 9));
    p.spread = ease(p.spread, s.action === 'descend' ? 0.7 : 0, 1 - Math.exp(-dt * 6));

    o.position.set(s.x, s.y, s.z);
    o.rotation.y = p.heading;
    tilt.current!.rotation.x = p.rear * 0.5;
    const t = clock.elapsedTime;
    const twitch = s.action === 'lurk' ? Math.max(0, Math.sin(t * 1.7)) ** 8 * 0.35 : 0;
    poseLegs(legs.current, palps.current, p as Stance, twitch);
    // the thread it comes down on, from the ceiling to the top of its back
    if (s.action === 'descend') {
      const a = threadGeo.attributes.position as THREE.BufferAttribute;
      a.setXYZ(0, s.x, WALL_H, s.z);
      a.setXYZ(1, s.x, s.y + 0.1 * SIZE, s.z);
      a.needsUpdate = true;
      threadGeo.computeBoundingSphere();
    }
  });
  return (
    <>
      <group ref={g} visible={false}>
        <group scale={SIZE}>
          <SpiderModel legs={legs.current} tilt={tilt} palps={palps} knees={KNEES} />
        </group>
      </group>
      <lineSegments ref={thread} geometry={threadGeo} material={SILK} visible={false} frustumCulled={false} />
    </>
  );
}

// ---------- the dead ----------

/** One body: flipped onto its back as it dies, legs curling in, then shrivelling away. */
function Dead({ lair, i, near }: { lair: React.RefObject<Lair | null>; i: number; near: React.RefObject<boolean> }) {
  const g = useRef<THREE.Group>(null);
  const flip = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const legs = useRef<LegRefs[]>(legRefs());
  const palps = useRef<(THREE.Group | null)[]>([]);
  const still: Stance = { phase: 0, moving: 0, rear: 0, spread: 0 };
  useFrame(() => {
    const b = lair.current?.bodies[i];
    const o = g.current;
    if (!o) return;
    o.visible = !!b && near.current;
    if (!b || !o.visible) return;
    const f = Math.min(1, b.age / FLIP_S);
    const u = bodyShrivel(b);
    o.position.set(b.x, 0, b.z);
    o.rotation.y = b.heading;
    // over onto its back with a kick, then lying there
    const fl = flip.current!;
    fl.rotation.z = f * Math.PI;
    fl.position.y = (ON_BACK * f + Math.sin(f * Math.PI) * 0.06) * (1 - u * 0.8);
    fl.scale.setScalar(1 - u * 0.8);
    tilt.current!.rotation.x = 0;
    // the legs fold in over its belly as it dies, and tighter as it shrivels
    poseLegs(legs.current, palps.current, still);
    const curl = Math.min(1, b.age / 2.5) + u * 0.5;
    for (const L of legs.current) {
      if (!L.femur || !L.knee || !L.ankle) continue;
      L.femur.rotation.z = ease(L.femur.rotation.z, -0.35, Math.min(1, curl));
      L.knee.rotation.z = ease(L.knee.rotation.z, -2.1, Math.min(1, curl)) - u * 0.3;
      L.ankle.rotation.z = ease(L.ankle.rotation.z, -1.2, Math.min(1, curl));
    }
  });
  return (
    <group ref={g} visible={false}>
      <group scale={SIZE}>
        <group ref={flip}>
          <SpiderModel legs={legs.current} tilt={tilt} palps={palps} knees={KNEES} />
        </group>
      </group>
    </group>
  );
}

// ---------- old webs ----------

/**
 * A web across a corner: threads from a hub out to points along the corner's three edges (`a`, `b`, `c`, pointing out
 * of it) and the faces between them, crossed by rings that sag a little. Old, so some rings are broken.
 */
function cornerWeb(corner: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, size: number, seed: number) {
  let r = seed;
  const rand = () => (r = (r * 16807) % 2147483647) / 2147483647;
  const at = (...parts: [THREE.Vector3, number][]) => parts.reduce((p, [d, k]) => p.addScaledVector(d, k * size), corner.clone());
  const anchors = [
    at([a, 0.8 + rand() * 0.3]),
    at([a, 0.5], [b, 0.5]),
    at([b, 0.8 + rand() * 0.3]),
    at([b, 0.45], [c, 0.45]),
    at([c, 0.8 + rand() * 0.3]),
    at([c, 0.5], [a, 0.5]),
  ];
  const hub = at([a, 0.22], [b, 0.22], [c, 0.22]);
  const pts: number[] = [];
  const line = (p: THREE.Vector3, q: THREE.Vector3) => pts.push(p.x, p.y, p.z, q.x, q.y, q.z);
  for (const an of anchors) line(hub, an);
  for (let k = 1; k <= 6; k++) {
    const f = k / 7;
    for (let n = 0; n < anchors.length; n++) {
      if (rand() < 0.15) continue;
      const p = hub.clone().lerp(anchors[n], f);
      const q = hub.clone().lerp(anchors[(n + 1) % anchors.length], f);
      const mid = p.clone().add(q).multiplyScalar(0.5);
      mid.y -= 0.025 * f * size;
      line(p, mid);
      line(mid, q);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

function Webs({ end }: { end: number }) {
  const webs = useMemo(() => {
    const x = GALLERY.half - 0.01;
    const z = end - 0.01;
    const v = (vx: number, vy: number, vz: number) => new THREE.Vector3(vx, vy, vz);
    return [
      cornerWeb(v(-x, WALL_H - 0.01, z), v(1, 0, 0), v(0, -1, 0), v(0, 0, -1), 0.9, 7),
      cornerWeb(v(x, WALL_H - 0.01, z), v(-1, 0, 0), v(0, -1, 0), v(0, 0, -1), 1.2, 13),
      cornerWeb(v(x, 0.01, z), v(-1, 0, 0), v(0, 1, 0), v(0, 0, -1), 0.6, 29),
    ];
  }, [end]);
  return (
    <>
      {webs.map((w, i) => (
        <lineSegments key={i} geometry={w} material={SILK} />
      ))}
    </>
  );
}

// ---------- sounds ----------

/** Reared up: a long, low hiss, the bristles rasping. */
function hiss(near: number) {
  noise({ dur: 0.9, peak: 0.06 * near, filter: 'bandpass', freq: 2200, to: 1500, q: 1.2, attack: 0.06 });
  noise({ at: 0.08, dur: 0.6, peak: 0.02 * near, filter: 'highpass', freq: 4500, attack: 0.04 });
}

/** One of its feet on the flagstones: heavier than the little ones' ticks. */
function tick(near: number) {
  noise({ dur: 0.014, peak: (0.008 + Math.random() * 0.006) * near, filter: 'bandpass', freq: 900 + Math.random() * 700, q: 4 });
}

/** It dies: a hiss that rises and breaks off, and the thump of it going over onto its back. */
function death(near: number) {
  noise({ dur: 0.6, peak: 0.06 * near, filter: 'bandpass', freq: 1800, to: 3400, q: 2, attack: 0.03 });
  noise({ at: 0.35, dur: 0.22, peak: 0.12 * near, filter: 'lowpass', freq: 260 });
}

/** The great spider, its dead, its webs and its sounds. The lair is stepped by Cat.tsx, together with the cat. */
export function GreatSpider({ lair, slots }: { lair: React.RefObject<Lair | null>; slots: number[] }) {
  const end = galleryEnd(slots);
  const near = useRef(false);
  const root = useRef<THREE.Group>(null);
  const reared = useRef<number | null>(null);
  const dead = useRef(new Set<number>());
  const nextTick = useRef(0);
  useFrame(({ camera, clock }) => {
    const l = lair.current;
    const { x, z } = camera.position;
    near.current = Math.hypot(x, z - end) < DRAW_WITHIN;
    if (root.current) root.current.visible = near.current;
    if (!l) return;
    const g = l.great;
    const hear = (px: number, pz: number, range: number) => Math.max(0, 1 - Math.hypot(px - x, pz - z) / range);
    // a hiss as it rears up
    if (g?.action === 'rear') {
      if (reared.current !== g.id) {
        reared.current = g.id;
        const n = hear(g.x, g.z, HISS_HEAR);
        if (n > 0) hiss(n);
      }
    } else reared.current = null;
    // its death, once for each body
    for (const b of l.bodies) {
      if (dead.current.has(b.id)) continue;
      dead.current.add(b.id);
      const n = b.age < 1 ? hear(b.x, b.z, DEATH_HEAR) : 0;
      if (n > 0) death(n);
    }
    // its feet, faster the faster it goes
    const t = clock.elapsedTime;
    if (g && t >= nextTick.current) {
      const moving = g.action === 'charge' || g.action === 'retreat' || g.action === 'shift';
      const n = moving ? hear(g.x, g.z, TICK_HEAR) : 0;
      if (n > 0) tick(n);
      nextTick.current = t + (g.action === 'charge' ? 1 / 22 : g.action === 'retreat' ? 1 / 12 : 1 / 6);
    }
  });
  return (
    <group ref={root}>
      <Webs end={end} />
      <Live lair={lair} near={near} />
      {Array.from({ length: GREAT.maxBodies }, (_, i) => (
        <Dead key={i} lair={lair} i={i} near={near} />
      ))}
    </group>
  );
}
