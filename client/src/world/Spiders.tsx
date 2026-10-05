import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { noise } from '../ui/sfx';
import type { Cat as CatState } from './catBrain';
import { chambersToDraw, roomAt } from './dungeon';
import { SPIDER, type Nest } from './spiderBrain';

// The chest's spiders (spiderBrain.ts): black tarantulas drawn from primitives, bristly all over, on eight jointed
// legs that step in the alternating gait real spiders use (four legs down while the other four swing), with a
// cluster of red eyes. Rearing, the front legs go up and the fangs show. Their hiss, the tick of their feet and the
// cat's crunch when she eats one are made here too. No colliders, nothing to aim at.

/** Spiders further than this from you aren't drawn. */
const DRAW_WITHIN = 25;
const TICK_HEAR = 5;
const HISS_HEAR = 8;
const CRUNCH_HEAR = 14;
/** The model is built a little under life size and drawn at this scale: a leg span of about 30 cm. */
const SIZE = 1.3;
/** How far it moves (m) for one full cycle of its legs. */
const STRIDE = 0.075;

// ---------- the body, built once ----------

const BODY = new THREE.MeshStandardMaterial({ color: '#0f0b0a', roughness: 0.7, metalness: 0.12 });
const HAIR = new THREE.MeshStandardMaterial({ color: '#3a322e', roughness: 1 });
const FANG = new THREE.MeshStandardMaterial({ color: '#2b0c0a', roughness: 0.3, metalness: 0.25 });
const EYE = new THREE.MeshBasicMaterial({ color: '#e3161e', toneMapped: false });

const UP = new THREE.Vector3(0, 1, 0);
const qTmp = new THREE.Quaternion();

/** A seeded little generator, so every spider has the same coat. */
function seeded(seed: number) {
  let r = seed;
  return () => (r = (r * 16807) % 2147483647) / 2147483647;
}

/** One bristle: a thin three-sided cone, its base at the origin, pointing up, one unit long. */
const BRISTLE = new THREE.ConeGeometry(0.0016, 1, 3, 1, true).translate(0, 0.5, 0);

function bristle(at: THREE.Vector3, dir: THREE.Vector3, len: number) {
  return BRISTLE.clone()
    .scale(1, len, 1)
    .applyQuaternion(qTmp.setFromUnitVectors(UP, dir))
    .translate(at.x, at.y, at.z);
}

/** Bristles over an ellipsoid (centre, radii), raked back, none underneath. */
function coat(count: number, centre: THREE.Vector3, radii: THREE.Vector3, len: [number, number], seed: number) {
  const rand = seeded(seed);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    if (y < -0.3) continue;
    const r = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const n = new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
    const at = new THREE.Vector3(n.x * radii.x, n.y * radii.y, n.z * radii.z).add(centre);
    const dir = n.clone().add(new THREE.Vector3((rand() - 0.5) * 0.5, 0.1, 0.45 + (rand() - 0.5) * 0.3)).normalize();
    parts.push(bristle(at, dir, len[0] + (len[1] - len[0]) * rand()));
  }
  return mergeGeometries(parts);
}

/** A leg segment along +X from 0 to `len`, tapering from `r0` to `r1`, with bristles standing out along it. */
function segment(len: number, r0: number, r1: number, seed: number) {
  const tube = new THREE.CylinderGeometry(r1, r0, len, 6).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0);
  const rand = seeded(seed);
  const parts: THREE.BufferGeometry[] = [tube.toNonIndexed()];
  const n = Math.round(len / 0.006);
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    const a = rand() * Math.PI * 2;
    const r = r0 + (r1 - r0) * u;
    const out = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
    const dir = out.clone().add(new THREE.Vector3(0.6, 0, 0)).normalize();
    parts.push(bristle(new THREE.Vector3(u * len, out.y * r, out.z * r), dir, 0.006 + rand() * 0.006).toNonIndexed());
  }
  return mergeGeometries(parts);
}

const G = {
  thorax: new THREE.SphereGeometry(0.034, 14, 10),
  abdomen: new THREE.SphereGeometry(0.05, 16, 12),
  thoraxCoat: coat(90, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.034, 0.019, 0.039), [0.004, 0.008], 11),
  abdomenCoat: coat(300, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.0475, 0.04, 0.06), [0.007, 0.016], 23),
  knob: new THREE.SphereGeometry(0.0078, 8, 6),
  chelicera: new THREE.SphereGeometry(0.011, 10, 8),
  fang: new THREE.ConeGeometry(0.0028, 0.016, 6).translate(0, -0.008, 0),
  eye: new THREE.SphereGeometry(0.0042, 8, 6),
  eyeSmall: new THREE.SphereGeometry(0.0026, 6, 5),
  palp: segment(0.028, 0.0045, 0.0038, 91),
};

/** The legs, front to back: how far forward each points (rad), and how long it is. */
const LEGS = [
  { ahead: 0.78, scale: 1.12, z: -0.034 },
  { ahead: 0.26, scale: 1.0, z: -0.02 },
  { ahead: -0.2, scale: 0.95, z: -0.006 },
  { ahead: -0.66, scale: 1.15, z: 0.008 },
];
/** Each leg's three segments by pair, shared by both sides. */
const SEGMENTS = LEGS.map((l, k) => [segment(0.07 * l.scale, 0.0094, 0.0078, 100 + k), segment(0.065 * l.scale, 0.0076, 0.006, 200 + k), segment(0.06 * l.scale, 0.0058, 0.003, 300 + k)]);
/** The resting pose: thigh up, knee down, foot to the floor. */
const LIFT = 0.86;
const KNEE = -1.48;
const ANKLE = -0.7;

interface LegRefs {
  hip: THREE.Group | null;
  femur: THREE.Group | null;
  knee: THREE.Group | null;
  ankle: THREE.Group | null;
}

/** One spider, facing -Z, feet at y = 0 (before SIZE). Its legs and its tilt are posed by SpiderSlot. */
function SpiderModel({ legs, tilt, palps }: { legs: LegRefs[]; tilt: React.Ref<THREE.Group>; palps: React.RefObject<(THREE.Group | null)[]> }) {
  return (
    // tipped back about the rear legs' hips, so rearing lifts the front and leaves the back on the floor
    <group ref={tilt} position={[0, 0, 0.012]}>
      <group position={[0, 0, -0.012]}>
        <group position={[0, 0.05, -0.012]} scale={[1, 0.55, 1.15]}>
          <mesh geometry={G.thorax} material={BODY} />
        </group>
        <mesh geometry={G.thoraxCoat} material={HAIR} position={[0, 0.05, -0.012]} />
        <group position={[0, 0.064, 0.074]} scale={[0.95, 0.8, 1.2]}>
          <mesh geometry={G.abdomen} material={BODY} />
        </group>
        <mesh geometry={G.abdomenCoat} material={HAIR} position={[0, 0.064, 0.074]} />
        {/* the eyes: two big ones in front, three small a side */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={G.eye} material={EYE} position={[s * 0.0046, 0.0705, -0.041]} />
            <mesh geometry={G.eyeSmall} material={EYE} position={[s * 0.0098, 0.068, -0.04]} />
            <mesh geometry={G.eyeSmall} material={EYE} position={[s * 0.0085, 0.0705, -0.034]} />
            <mesh geometry={G.eyeSmall} material={EYE} position={[s * 0.0035, 0.0725, -0.035]} />
            {/* jaws and fangs, under the eyes */}
            <mesh geometry={G.chelicera} material={BODY} position={[s * 0.0075, 0.047, -0.05]} scale={[0.85, 1.1, 1.2]} />
            <mesh geometry={G.fang} material={FANG} position={[s * 0.0075, 0.039, -0.058]} rotation={[0.5, 0, s * 0.25]} />
            {/* the feelers in front */}
            <group ref={(o) => void (palps.current[s < 0 ? 0 : 1] = o)} position={[s * 0.012, 0.045, -0.046]} rotation={[0, s < 0 ? Math.PI - 1.25 : 1.25, -0.5]}>
              <mesh geometry={G.palp} material={BODY} />
              <group position={[0.028, 0, 0]} rotation={[0, 0, -0.9]}>
                <mesh geometry={G.palp} material={BODY} />
              </group>
            </group>
          </group>
        ))}
        {/* the eight legs */}
        {LEGS.flatMap((l, k) =>
          [-1, 1].map((s) => {
            const i = k * 2 + (s < 0 ? 0 : 1);
            const [femur, tibia, tarsus] = SEGMENTS[k];
            const len = 0.07 * l.scale;
            return (
              <group key={i} ref={(o) => void (legs[i].hip = o)} position={[s * 0.022, 0.045, l.z]}>
                <group ref={(o) => void (legs[i].femur = o)}>
                  <mesh geometry={femur} material={BODY} />
                  <group ref={(o) => void (legs[i].knee = o)} position={[len, 0, 0]}>
                    <mesh geometry={G.knob} material={BODY} />
                    <mesh geometry={tibia} material={BODY} />
                    <group ref={(o) => void (legs[i].ankle = o)} position={[0.065 * l.scale, 0, 0]}>
                      <mesh geometry={tarsus} material={BODY} />
                    </group>
                  </group>
                </group>
              </group>
            );
          }),
        )}
      </group>
    </group>
  );
}

// ---------- the spiders about ----------

const ease = (now: number, target: number, k: number) => now + (target - now) * k;
function easeAngle(now: number, target: number, k: number) {
  let d = target - now;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return now + d * k;
}

/** A fixed set of slots (at most three spiders at once), each posed from whichever spider it holds this frame. */
function SpiderSlot({ nest, i, show }: { nest: React.RefObject<Nest | null>; i: number; show: React.RefObject<Set<number>> }) {
  const g = useRef<THREE.Group>(null);
  const tilt = useRef<THREE.Group>(null);
  const legs = useRef<LegRefs[]>(Array.from({ length: 8 }, () => ({ hip: null, femur: null, knee: null, ankle: null })));
  const palps = useRef<(THREE.Group | null)[]>([]);
  const st = useRef({ id: 0, x: 0, z: 0, heading: 0, phase: 0, moving: 0, rear: 0, spread: 0 });
  useFrame(({ clock }, rawDt) => {
    const s = nest.current?.spiders[i];
    const o = g.current;
    if (!o) return;
    o.visible = !!s && !s.dead && show.current.has(s.id);
    if (!s || !o.visible) return;
    const dt = Math.min(rawDt, 0.1);
    const p = st.current;
    if (p.id !== s.id) Object.assign(p, { id: s.id, x: s.x, z: s.z, heading: s.heading, phase: 0, moving: 0, rear: 0, spread: 0 });
    const k = 1 - Math.exp(-dt * 12);
    const turned = Math.abs(easeAngle(p.heading, s.heading, k) - p.heading);
    p.heading = easeAngle(p.heading, s.heading, k);
    // the legs go as far as it actually moved (and a little when it turns on the spot)
    const moved = Math.hypot(s.x - p.x, s.z - p.z) + turned * 0.03;
    p.x = s.x;
    p.z = s.z;
    p.phase += (moved / STRIDE) * Math.PI * 2;
    p.moving = ease(p.moving, moved > 1e-5 || s.action === 'climb' ? 1 : 0, 1 - Math.exp(-dt * 10));
    p.rear = ease(p.rear, s.action === 'rear' ? 1 : s.action === 'perch' ? 0.55 : 0, 1 - Math.exp(-dt * 9));
    p.spread = ease(p.spread, s.action === 'leap' ? 1 : 0, 1 - Math.exp(-dt * 14));
    if (s.action === 'climb') p.phase += dt * 30;

    o.position.set(s.x, s.y, s.z);
    o.rotation.y = p.heading;
    tilt.current!.rotation.x = p.rear * 0.5 - p.spread * 0.1;
    const t = clock.elapsedTime;
    for (let leg = 0; leg < 8; leg++) {
      const L = legs.current[leg];
      if (!L.hip || !L.femur || !L.knee || !L.ankle) continue;
      const pair = leg >> 1;
      const right = leg & 1;
      // two sets of four, each the other's opposite: front-left with second-right, third-left, back-right, and so on
      const phi = p.phase + ((pair + right) % 2) * Math.PI;
      const swing = Math.sin(phi) * 0.32 * p.moving;
      const lift = Math.max(0, Math.cos(phi)) * 0.5 * p.moving;
      const ahead = LEGS[pair].ahead + swing + (pair < 2 ? p.rear * 0.25 : 0);
      L.hip.rotation.y = right ? ahead : Math.PI - ahead;
      // reared, the front two pairs go up and straighten, the back ones push
      const up = pair === 0 ? 1.15 : pair === 1 ? 0.6 : -0.12;
      L.femur.rotation.z = LIFT + lift + p.rear * up + p.spread * 0.3;
      L.knee.rotation.z = KNEE + (pair < 2 ? p.rear * 0.75 : 0) + p.spread * 0.5;
      L.ankle.rotation.z = ANKLE + (pair < 2 ? p.rear * 0.35 : 0) + p.spread * 0.25;
    }
    // the feelers twitch while it waits, and wave when it rears
    const twitch = s.action === 'freeze' ? Math.max(0, Math.sin(t * 2.3 + i * 4)) ** 8 * 0.35 : 0;
    for (const [side, palp] of palps.current.entries()) if (palp) palp.rotation.z = -0.5 + twitch * (side ? 1 : 0.7) + p.rear * 0.6;
  });
  return (
    <group ref={g} visible={false}>
      <group scale={SIZE}>
        <SpiderModel legs={legs.current} tilt={tilt} palps={palps} />
      </group>
    </group>
  );
}

// ---------- sounds ----------

/** A dry hiss, the bristles rubbing: it has reared up at you. */
function hiss(near: number) {
  noise({ dur: 0.5, peak: 0.03 * near, filter: 'bandpass', freq: 3600, to: 2600, q: 1.4, attack: 0.04 });
  noise({ at: 0.06, dur: 0.3, peak: 0.012 * near, filter: 'highpass', freq: 6000, attack: 0.02 });
}

/** One tick of hard little feet on stone. */
function tick(near: number) {
  noise({ dur: 0.006, peak: (0.003 + Math.random() * 0.003) * near, filter: 'bandpass', freq: 2400 + Math.random() * 1800, q: 6 });
}

/** The cat eats one: three short crunches. */
function crunch(near: number) {
  for (const at of [0, 0.12, 0.27]) noise({ at, dur: 0.035, peak: (0.035 + Math.random() * 0.02) * near, filter: 'lowpass', freq: 2200 + Math.random() * 800 });
}

/** The spiders and their sounds. The nest is stepped by Cat.tsx, together with the cat and the rats. */
export function Spiders({ nest, cat, slots }: { nest: React.RefObject<Nest | null>; cat: React.RefObject<CatState | null>; slots: number[] }) {
  const show = useRef(new Set<number>());
  const frame = useRef(0);
  const ate = useRef<number | null>(null);
  const reared = useRef(new Set<number>());
  const nextTick = useRef(0);
  useFrame(({ camera, clock }) => {
    const n = nest.current;
    const c = cat.current;
    if (!n || !c) return;
    const { x, z } = camera.position;
    // which to draw: near you, and not in a chamber that isn't drawn (re-checked a few times a second)
    if (++frame.current % 10 === 1) {
      const drawn = chambersToDraw(x, z, slots);
      show.current.clear();
      for (const s of n.spiders) {
        if (Math.hypot(s.x - x, s.z - z) > DRAW_WITHIN) continue;
        const room = roomAt(s.x, s.z, slots);
        if (room === 0 || drawn.includes(room)) show.current.add(s.id);
      }
    }
    // her crunch when she eats one
    if (ate.current !== null && c.ate > ate.current) {
      const near = Math.max(0, 1 - Math.hypot(c.x - x, c.z - z) / CRUNCH_HEAR);
      if (near > 0) crunch(near);
    }
    ate.current = c.ate;
    // a hiss as one rears up
    for (const s of n.spiders) {
      if (s.action !== 'rear') {
        reared.current.delete(s.id);
        continue;
      }
      if (reared.current.has(s.id)) continue;
      reared.current.add(s.id);
      const near = Math.max(0, 1 - Math.hypot(s.x - x, s.z - z) / HISS_HEAR);
      if (near > 0) hiss(near);
    }
    // and their feet tick when they scuttle or climb near you, very quietly
    const t = clock.elapsedTime;
    if (t >= nextTick.current) {
      let near = 0;
      for (const s of n.spiders) if (s.action === 'scuttle' || s.action === 'climb') near = Math.max(near, 1 - Math.hypot(s.x - x, s.z - z) / TICK_HEAR);
      if (near > 0) tick(near);
      nextTick.current = t + 1 / 24;
    }
  });
  return (
    <>
      {Array.from({ length: SPIDER.max }, (_, i) => (
        <SpiderSlot key={i} nest={nest} i={i} show={show} />
      ))}
    </>
  );
}
