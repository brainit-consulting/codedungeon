// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { hallSpots } from './Cat';
import { COUNTER_TOP, TAP, TAPSTER_BUILD, WIPE_S } from './tavernRules';
import { findHand, palmNormal } from './twoBoneIk';
import { RAG, createWipingHand, scrubAt } from './wipingHand';

// Wystan as Tavern.tsx draws him (his outfit at his build, where he stands behind the bar, the clip playing), wiping:
// measured on his right hand's own skin (the vertices that move with it) against the towel, and the towel against the
// counter, through whole wipes eased in and out as Tavern.tsx eases them.

(globalThis as Record<string, unknown>).self ??= globalThis;
const load = (name: string) =>
  new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, bad) => {
    const buf = fs.readFileSync(new URL(`../../public/characters/${name}.glb`, import.meta.url));
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', ok as never, bad);
  });

const DT = 1 / 30;

async function wystan() {
  const [body, anims] = await Promise.all([load('Male_Ranger'), load('animations')]);
  const world = new THREE.Group();
  body.scene.position.set(TAP.x, 0, TAP.z);
  body.scene.scale.set(...TAPSTER_BUILD);
  world.add(body.scene);
  const rag = new THREE.Group();
  world.add(rag);
  world.updateMatrixWorld(true);
  const hand = findHand(body.scene, 'r')!;
  // which way the palm faces, in the hand's own frame, taken as bound (the thumb on the palm's side, where palmNormal
  // looks for it): once he lays his thumb flat, palmNormal can't tell the palm from the back of the hand
  const palmIn = palmNormal(hand, new THREE.Vector3()).transformDirection(hand.hand.matrixWorld.clone().invert());
  const mixer = new THREE.AnimationMixer(body.scene);
  mixer.clipAction(anims.animations.find((c) => c.name === 'Idle_Loop')!).play();
  const wiping = createWipingHand(body.scene);
  wiping.rag.current = rag;
  const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
  let weight = 0;
  let s = 0;
  /** One frame on: `on` while he's wiping (a new gesture starts the clock again, as Tavern.tsx does). */
  const frame = (on: boolean) => {
    weight += ((on ? 1 : 0) - weight) * (1 - Math.exp(-DT * 4));
    wiping.before();
    mixer.update(DT);
    world.updateMatrixWorld(true);
    wiping.after(s, weight, on);
    world.updateMatrixWorld(true);
    s += DT;
    return weight;
  };
  /** A wipe of `long` seconds, then `rest` seconds of something else, `each` called every frame. */
  const wipe = (long: number, rest: number, each: (on: boolean, weight: number) => void = () => {}) => {
    s = 0;
    for (let k = 0; k < long / DT; k++) each(true, frame(true));
    s = 0;
    for (let k = 0; k < rest / DT; k++) each(false, frame(false));
  };
  return { body: body.scene, rag, hand, at, wipe, palmIn };
}
type Wystan = Awaited<ReturnType<typeof wystan>>;

/** The middle of his palm: halfway from the wrist to the middle finger's knuckle. */
const palm = (w: Wystan) => w.at(w.hand.hand).add(w.at(w.hand.fingers[1][0])).multiplyScalar(0.5);
/** Whether a point (world) is over the towel, at least `margin` in from its edges. */
const overTowel = (w: Wystan, p: THREE.Vector3, margin: number) => {
  const local = w.rag.worldToLocal(p.clone());
  return Math.abs(local.x) <= RAG.w / 2 - margin && Math.abs(local.z) <= RAG.d / 2 - margin;
};
const RAG_TOP = COUNTER_TOP.top + RAG.h;
const PARTS = ['palm', "palm, little finger's edge", 'index', 'middle', 'ring', 'pinky', 'thumb'] as const;
type Part = (typeof PARTS)[number];

/**
 * The lowest point of each part of his right hand's skin (world y): the palm with the ball of the thumb, and the palm's
 * outer edge on the little finger's side (more than 15 mm out from the line from his wrist to his middle knuckle), so a
 * hand rolled up onto the ball of its thumb fails; each finger; the rest of the thumb.
 */
function lowest(w: Wystan): Record<Part, number> {
  const low = Object.fromEntries(PARTS.map((p) => [p, Infinity])) as Record<Part, number>;
  const wrist = w.at(w.hand.hand);
  const along = w.at(w.hand.fingers[1][0]).sub(wrist).normalize();
  const towardThumb = w.at(w.hand.fingers[0][0]).sub(w.at(w.hand.fingers[3][0]));
  towardThumb.addScaledVector(along, -towardThumb.dot(along)).normalize();
  const v = new THREE.Vector3();
  w.body.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.visible) return;
    const si = m.geometry.attributes.skinIndex;
    const sw = m.geometry.attributes.skinWeight;
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
      const name = m.skeleton.bones[si.getComponent(i, best)].name;
      if (!/_r$/.test(name)) continue;
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld);
      if (name === 'hand_r' && v.clone().sub(wrist).dot(towardThumb) < -0.015) low["palm, little finger's edge"] = Math.min(low["palm, little finger's edge"], v.y);
      const part = name === 'hand_r' || name === 'thumb_01_r' ? 'palm' : PARTS.find((p) => name.startsWith(`${p}_`));
      if (part) low[part] = Math.min(low[part], v.y);
    }
  });
  return low;
}

describe('Wystan wiping the bar', () => {
  it('uses a bar towel, not a scrap', () => {
    expect(Math.max(RAG.w, RAG.d)).toBeGreaterThanOrEqual(0.3);
    expect(Math.min(RAG.w, RAG.d)).toBeGreaterThanOrEqual(0.2);
  });

  it('lays his open hand flat on the towel: palm, every finger and the thumb on it, not rolled up off its edge, none in it', async () => {
    const w = await wystan();
    let seen = 0;
    w.wipe(WIPE_S, 1, (on, weight) => {
      if (!on || weight < 0.99) return;
      seen++;
      const n = w.palmIn.clone().transformDirection(w.hand.hand.matrixWorld);
      expect(n.y).toBeLessThan(-0.9); // palm down, rolled no more than a hand resting on a table rolls
      const low = lowest(w);
      for (const part of PARTS) {
        const mm = (low[part] - RAG_TOP) * 1000;
        expect(mm, part).toBeGreaterThan(-4);
        expect(mm, part).toBeLessThan(part === 'palm' ? 3 : part === 'thumb' ? 4 : 5);
      }
    });
    expect(seen).toBeGreaterThan(60);
  });

  it('keeps the towel flat on the counter, and once his palm is down on it, it goes where his palm goes', async () => {
    const w = await wystan();
    let before: { x: number; z: number; yaw: number } | null = null;
    let held = 0;
    for (const long of [WIPE_S, 2.3, WIPE_S + 1.7]) {
      w.wipe(long, 1.5, (on, weight) => {
        const r = w.rag.getWorldPosition(new THREE.Vector3());
        expect(Math.abs(r.y - COUNTER_TOP.top)).toBeLessThan(0.001);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(w.rag.getWorldQuaternion(new THREE.Quaternion()));
        expect(up.y).toBeGreaterThan(0.999);
        for (const [dx, dz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
          const c = w.rag.localToWorld(new THREE.Vector3((dx * RAG.w) / 2, 0, (dz * RAG.d) / 2));
          expect(c.x).toBeGreaterThan(COUNTER_TOP.minX);
          expect(c.x).toBeLessThan(COUNTER_TOP.maxX);
          expect(c.z).toBeGreaterThan(COUNTER_TOP.minZ);
          expect(c.z).toBeLessThan(COUNTER_TOP.maxZ);
        }
        const p = palm(w);
        if (on && weight > 0.99) {
          // his palm well inside the towel, his fingertips and thumb on it too (not over the wood)
          expect(overTowel(w, p, 0.04)).toBe(true);
          for (const tip of [...w.hand.fingers.map((f) => f[3]), w.hand.thumb[2].children[0]]) expect(overTowel(w, w.at(tip), 0.005), tip.name).toBe(true);
          // and the two moving as one: the towel where it was from his hand, and turned as it was (in his hand's turn)
          const f = w.at(w.hand.fingers[1][0]).sub(w.at(w.hand.hand));
          const handYaw = Math.atan2(f.x, f.z);
          const towelYaw = new THREE.Euler().setFromQuaternion(w.rag.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
          const off = new THREE.Vector3(r.x - p.x, 0, r.z - p.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -handYaw);
          const now = { x: off.x, z: off.z, yaw: towelYaw - handYaw };
          if (before) {
            expect(Math.hypot(now.x - before.x, now.z - before.z)).toBeLessThan(0.0015);
            expect(Math.abs(now.yaw - before.yaw)).toBeLessThan(0.005); // his hand turns up to 0.009 a frame; the towel settles slower
          }
          before = now;
          held++;
        } else before = null;
      });
    }
    expect(held).toBeGreaterThan(150);
  });

  it('leaves the towel where he stops, and puts his hand down on it there the next time', async () => {
    const w = await wystan();
    for (const long of [WIPE_S, 2.3, 3.9]) {
      let left: THREE.Vector3 | null = null;
      let landed: THREE.Vector3 | null = null;
      let lying: THREE.Vector3 | null = null;
      w.wipe(long, 2, (on, weight) => {
        const r = w.rag.getWorldPosition(new THREE.Vector3());
        lying ??= r; // as the wipe begins, before his hand is on it
        if (on && weight > 0.99 && !landed) {
          landed = palm(w);
          expect(overTowel(w, landed, 0.04)).toBe(true);
          // and the towel hasn't been pushed about to get there
          expect(Math.hypot(r.x - lying.x, r.z - lying.z)).toBeLessThan(0.02);
        }
        if (!on) {
          left ??= r;
          expect(r.distanceTo(left)).toBeLessThan(0.001);
        }
      });
      expect(landed).not.toBeNull();
    }
  });

  it("keeps the towel clear of the cat's place on the bar, wherever he wipes and leaves it", async () => {
    const w = await wystan();
    const bar = hallSpots(false).find((s) => s.kind === 'bar')!;
    // sat there, she reaches about 0.25 m from her spot (front paws, haunches, the tail round her side)
    const her = 0.25 + 0.03;
    let nearest = Infinity;
    for (const long of [WIPE_S, 2.3, WIPE_S + 1.7, 3.1])
      w.wipe(long, 1, () => {
        for (let u = -1; u <= 1; u += 0.25)
          for (const [a, b] of [[u, -1], [u, 1], [-1, u], [1, u]]) {
            const p = w.rag.localToWorld(new THREE.Vector3((a * RAG.w) / 2, 0, (b * RAG.d) / 2));
            nearest = Math.min(nearest, Math.hypot(p.x - bar.x, p.z - bar.z));
          }
      });
    expect(nearest).toBeGreaterThan(her);
  });

  it('scrubs round in ovals over the wood, not just to and fro', () => {
    const xs: number[] = [];
    const zs: number[] = [];
    for (let s = 0; s < WIPE_S; s += 0.02) {
      const p = scrubAt(s);
      xs.push(p.x);
      zs.push(p.z);
    }
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.25);
    expect(Math.max(...zs) - Math.min(...zs)).toBeGreaterThan(0.08);
  });

  it('reaches it with his elbow bent, from where he stands', async () => {
    const w = await wystan();
    w.wipe(WIPE_S, 0, (_on, weight) => {
      if (weight < 0.99) return;
      const [u, l, h] = ['upperarm_r', 'lowerarm_r', 'hand_r'].map((n) => w.at(w.body.getObjectByName(n)!));
      const elbow = (u.sub(l).angleTo(h.sub(l)) * 180) / Math.PI;
      expect(elbow).toBeGreaterThan(60);
      expect(elbow).toBeLessThan(172);
    });
  });
});
