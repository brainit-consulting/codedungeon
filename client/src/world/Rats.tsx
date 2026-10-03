import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noise, tone } from '../ui/sfx';
import type { Cat as CatState, CatSpot } from './catBrain';
import { chambersToDraw, roomAt } from './dungeon';
import { HALF_W, HEARTH } from './layout';
import type { Pt } from './nav';
import { PILE_MAX, RAT, pileLayout, type Warren } from './ratBrain';

// The rats the cat hunts (ratBrain.ts), drawn from a few primitives: the ones about, the one in her mouth, and her
// pile of kills by the hearth. Their squeak when she catches one and the patter of their feet near you are made
// here too. No colliders, nothing to aim at: they never block the player or a click.

/** Her pile: on the floor in the corner where the hearth's chimney breast meets the west wall, south side. */
export const PILE: Pt = { x: -HALF_W + 0.5, z: HEARTH.z + HEARTH.w / 2 + 0.55 };
const DROP = { x: PILE.x + 0.55, z: PILE.z + 0.3 };
/** Where she stands to lay a rat on the pile, facing it. */
export const PILE_DROP: CatSpot = {
  id: 'pile',
  kind: 'corner',
  ...DROP,
  facing: Math.atan2(-(PILE.x - DROP.x), -(PILE.z - DROP.z)),
  weight: 0,
};

/** Rats further than this from you aren't drawn. */
const DRAW_WITHIN = 25;
const PATTER_HEAR = 5;
const SQUEAK_HEAR = 14;

// ---------- the body ----------

const FUR = new THREE.MeshStandardMaterial({ color: '#3a322b', roughness: 0.85 });
const PINK = new THREE.MeshStandardMaterial({ color: '#c98d88', roughness: 0.7 });
const EYE = new THREE.MeshBasicMaterial({ color: '#080606' });
const G = {
  body: new THREE.SphereGeometry(0.045, 10, 8),
  head: new THREE.ConeGeometry(0.03, 0.075, 8).rotateX(-Math.PI / 2),
  nose: new THREE.SphereGeometry(0.008, 6, 4),
  ear: new THREE.SphereGeometry(0.014, 6, 4),
  eye: new THREE.SphereGeometry(0.0055, 5, 4),
  tail: new THREE.CylinderGeometry(0.004, 0.007, 0.17, 5).rotateX(Math.PI / 2).translate(0, 0, 0.085),
};

/** One rat, facing -Z, paws at y = 0. The refs let the scurry move its head and tail. */
function RatModel({ head, tail }: { head?: React.Ref<THREE.Group>; tail?: React.Ref<THREE.Group> }) {
  return (
    <>
      <mesh geometry={G.body} material={FUR} position={[0, 0.04, 0]} scale={[1, 0.8, 1.9]} />
      <group ref={head} position={[0, 0.045, -0.075]}>
        <mesh geometry={G.head} material={FUR} position={[0, 0, -0.03]} />
        <mesh geometry={G.nose} material={PINK} position={[0, -0.002, -0.068]} />
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={G.ear} material={PINK} position={[s * 0.021, 0.024, 0.004]} scale={[1, 1, 0.35]} />
            <mesh geometry={G.eye} material={EYE} position={[s * 0.017, 0.012, -0.026]} />
          </group>
        ))}
      </group>
      <group ref={tail} position={[0, 0.03, 0.08]} rotation={[0.25, 0, 0]}>
        <mesh geometry={G.tail} material={PINK} />
      </group>
    </>
  );
}

/** A dead rat on its side, for the pile and her mouth. */
export function DeadRat(props: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group {...props}>
      <group rotation={[0, 0, Math.PI / 2]} position={[0.04, 0.045, 0]}>
        <RatModel />
      </group>
    </group>
  );
}

// ---------- the rats about ----------

/** A fixed set of slots (at most three rats live at once), each posed from whichever rat it holds this frame. */
function RatSlot({ warren, i, show }: { warren: React.RefObject<Warren | null>; i: number; show: React.RefObject<Set<number>> }) {
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const phase = useRef(Math.random() * 10);
  useFrame(({ clock }, dt) => {
    const r = warren.current?.rats[i];
    const o = g.current;
    if (!o) return;
    o.visible = !!r && !r.dead && show.current.has(r.id);
    if (!r || !o.visible) return;
    const t = clock.elapsedTime;
    const running = r.action === 'dash';
    phase.current += dt * (running ? 38 : 0);
    o.position.set(r.x, running ? Math.abs(Math.sin(phase.current)) * 0.012 : 0, r.z);
    o.rotation.set(0, r.heading, running ? Math.sin(phase.current) * 0.08 : 0);
    // paused, it sniffs: the head bobs and turns; running, the tail streams and whips
    head.current!.rotation.set(running ? 0.1 : Math.sin(t * 11 + i) * 0.12 - 0.05, running ? 0 : Math.sin(t * 1.3 + i * 2) * 0.4, 0);
    tail.current!.rotation.set(running ? 0.05 : 0.25, Math.sin(t * (running ? 22 : 2.5) + i) * (running ? 0.35 : 0.2), 0);
  });
  return (
    <group ref={g} visible={false}>
      <RatModel head={head} tail={tail} />
    </group>
  );
}

/** Her kills, laid by the hearth: at most twelve shown. */
function Pile({ cat }: { cat: React.RefObject<CatState | null> }) {
  const [n, setN] = useState(0);
  useFrame(() => {
    const d = Math.min(PILE_MAX, cat.current?.dropped ?? 0);
    if (d !== n) setN(d);
  });
  return (
    <group position={[PILE.x, 0, PILE.z]}>
      {pileLayout(n).map((p, k) => (
        <DeadRat key={k} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]} />
      ))}
    </group>
  );
}

// ---------- sounds ----------

/** A short squeal, cut off: the cat has caught one. */
function squeak(near: number) {
  tone({ freq: 2500, to: 3500, type: 'triangle', dur: 0.08, peak: 0.05 * near, attack: 0.005 });
  tone({ freq: 3300, to: 2100, type: 'triangle', at: 0.09, dur: 0.11, peak: 0.04 * near, attack: 0.005 });
  noise({ dur: 0.05, peak: 0.015 * near, filter: 'bandpass', freq: 4200, q: 3 });
}

/** One tick of tiny claws on stone. */
function patter(near: number) {
  noise({ dur: 0.01 + Math.random() * 0.008, peak: (0.006 + Math.random() * 0.006) * near, filter: 'bandpass', freq: 3500 + Math.random() * 2500, q: 4 });
}

/** The rats, the pile and their sounds. The warren is stepped by Cat.tsx, together with the cat. */
export function Rats({ warren, cat, slots }: { warren: React.RefObject<Warren | null>; cat: React.RefObject<CatState | null>; slots: number[] }) {
  const show = useRef(new Set<number>());
  const pile = useRef<THREE.Group>(null);
  const frame = useRef(0);
  const kills = useRef<number | null>(null);
  const nextPatter = useRef(0);
  useFrame(({ camera, clock }) => {
    const w = warren.current;
    const c = cat.current;
    if (!w || !c) return;
    const { x, z } = camera.position;
    // which rats to draw: near you, and not in a chamber that isn't drawn (re-checked a few times a second)
    if (++frame.current % 10 === 1) {
      const drawn = chambersToDraw(x, z, slots);
      show.current.clear();
      for (const r of w.rats) {
        if (Math.hypot(r.x - x, r.z - z) > DRAW_WITHIN) continue;
        const room = roomAt(r.x, r.z, slots);
        if (room === 0 || drawn.includes(room)) show.current.add(r.id);
      }
      pile.current!.visible = Math.hypot(PILE.x - x, PILE.z - z) < DRAW_WITHIN && roomAt(x, z, slots) === 0;
    }
    // her catch squeaks
    if (kills.current !== null && c.kills > kills.current) {
      const near = Math.max(0, 1 - Math.hypot(c.x - x, c.z - z) / SQUEAK_HEAR);
      if (near > 0) squeak(near);
    }
    kills.current = c.kills;
    // and their feet patter when they run near you, quietly
    const t = clock.elapsedTime;
    if (t >= nextPatter.current) {
      let near = 0;
      for (const r of w.rats) if (r.action === 'dash' && !r.dead) near = Math.max(near, 1 - Math.hypot(r.x - x, r.z - z) / PATTER_HEAR);
      if (near > 0) patter(near);
      nextPatter.current = t + 1 / 14;
    }
  });
  return (
    <>
      {Array.from({ length: RAT.max }, (_, i) => (
        <RatSlot key={i} warren={warren} i={i} show={show} />
      ))}
      <group ref={pile}>
        <Pile cat={cat} />
      </group>
    </>
  );
}
