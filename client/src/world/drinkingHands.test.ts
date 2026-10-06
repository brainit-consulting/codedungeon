// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MUG, createDrinkingHands } from './drinkingHands';
import { SEAT } from './RiggedCharacter';
import { TAVERN_SEATS, drinkAt, restTargets, type Drink, type Seat } from './tavernRules';
import { findHand, palmNormal } from './twoBoneIk';

// A drinker sat as Tavern.tsx's Patron sits them (the seat's frame, the body in it facing -Z there, the mug in the
// world), measured against what the mesh really is: the face from the vertices that move with the head, the body from
// every vertex but the drinking hand's. Every outfit, at a bar stool and at a feasting bench.

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };
// the outfits carry textures, which the loader reaches through the browser's `self`; their images don't matter here
(globalThis as Record<string, unknown>).self ??= globalThis;
const cache = new Map<string, ArrayBuffer>();
async function load(name: string): Promise<Gltf> {
  if (!cache.has(name)) {
    const buf = fs.readFileSync(new URL(`../../public/characters/${name}.glb`, import.meta.url));
    cache.set(name, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  }
  return new Promise((ok, bad) => new GLTFLoader().parse(cache.get(name)!, '', ok as never, bad));
}

const REST: Drink = { weight: 0, toMouth: 0, holding: false, tilt: 0 };

async function seated(outfit: string, seat: Seat) {
  const [body, anims] = await Promise.all([load(outfit), load('animations')]);
  const world = new THREE.Group();
  const frame = new THREE.Group();
  frame.position.set(seat.x, seat.lift, seat.z);
  frame.rotation.set(0, seat.yaw, 0);
  body.scene.position.set(0, SEAT.lift, -SEAT.forward);
  body.scene.rotation.set(0, Math.PI, 0);
  frame.add(body.scene);
  world.add(frame);
  const mug = new THREE.Group();
  world.add(mug);
  world.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(body.scene);
  mixer.clipAction(anims.animations.find((c) => c.name === 'Sitting_Idle_Loop')!).play();
  const hands = createDrinkingHands(body.scene, seat);
  hands.mug.current = mug;
  const frameAt = (dt: number, drink: Drink) => {
    hands.before();
    mixer.update(dt);
    world.updateMatrixWorld(true);
    hands.after(dt, drink);
    world.updateMatrixWorld(true);
  };
  // settled at the seat (the arms take over from the clip as they sit down)
  for (let i = 0; i < 12; i++) frameAt(0.1, REST);
  const bone = (n: string) => body.scene.getObjectByName(n)!;
  const at = (n: string) => bone(n).getWorldPosition(new THREE.Vector3());
  const hand = findHand(body.scene, 'r')!;
  return { body: body.scene, world, mug, mixer, frameAt, bone, at, hand, seat };
}
type Sat = Awaited<ReturnType<typeof seated>>;

/** A point given in the mug's own frame (its base's middle at the origin, the handle on +x), in the world. */
const onMug = (s: Sat, x: number, y: number, z: number) => s.mug.localToWorld(new THREE.Vector3(x, y, z));
/** A world point in the mug's own frame. */
const inMug = (s: Sat, p: THREE.Vector3) => s.mug.worldToLocal(p.clone());

/** The skinned vertices of the body (world), with the bone that moves each most. */
function vertices(s: Sat): { p: THREE.Vector3; bone: string }[] {
  const out: { p: THREE.Vector3; bone: string }[] = [];
  s.body.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const si = m.geometry.attributes.skinIndex;
    const sw = m.geometry.attributes.skinWeight;
    for (let i = 0; i < m.geometry.attributes.position.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
      const bone = m.skeleton.bones[si.getComponent(i, best)].name;
      out.push({ p: m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(m.matrixWorld), bone });
    }
  });
  return out;
}

/** The lips, from the face itself: the front-most head vertex near the midline, below the nose (head bone's frame). */
function lips(s: Sat): THREE.Vector3 {
  const head = s.bone('Head');
  const toHead = head.matrixWorld.clone().invert();
  let best: THREE.Vector3 | null = null;
  for (const v of vertices(s)) {
    if (v.bone !== 'Head') continue;
    const h = v.p.clone().applyMatrix4(toHead);
    if (Math.abs(h.x) > 0.015 || h.y < 0.01 || h.y > 0.04) continue;
    if (!best || h.z > best.z) best = h;
  }
  return best!.applyMatrix4(head.matrixWorld);
}

/** The drinking hand and arm: allowed round the handle, so not counted as the body. */
const DRINKING = /^(hand|lowerarm|index|middle|ring|pinky|thumb)_.*r$|^(hand|lowerarm)_r$/;

/** How far a point is from the handle's bar (mug frame: its centre line, a few centimetres out on +x). */
function fromBar(p: THREE.Vector3) {
  const y = Math.min(MUG.bar.top, Math.max(MUG.bar.bottom, p.y));
  return Math.hypot(p.x - MUG.bar.x, p.y - y, p.z - MUG.bar.z);
}

/** One drink of theirs: frames from reaching for the mug to letting it go, as Patron runs them. */
function aDrink(s: Sat, each: (d: Drink) => void) {
  const seed = 7; // a drink starts within the first 16 s
  let t = 0;
  while (drinkAt(t, seed).weight === 0) t += 0.05;
  for (; drinkAt(t, seed).weight > 0 || drinkAt(t + 0.05, seed).weight > 0; t += 1 / 30) {
    const d = drinkAt(t, seed);
    s.frameAt(1 / 30, d);
    each(d);
  }
}

const SIP: Drink = { weight: 1, toMouth: 1, holding: true, tilt: 1 };

describe.each(['Male_Peasant', 'Male_Ranger', 'Female_Peasant', 'Female_Ranger'])('%s drinking', (outfit) => {
  const stool = TAVERN_SEATS.find((x) => x.kind === 'stool')!;
  const bench = TAVERN_SEATS.find((x) => x.kind === 'bench')!;

  for (const seat of [stool, bench]) {
    const where = seat.kind === 'stool' ? 'at the bar' : 'at a table';

    it(`${where}: holds the mug fast in the hand all through a drink, never tipping it on its own`, async () => {
      const s = await seated(outfit, seat);
      let first: THREE.Matrix4 | null = null;
      aDrink(s, (d) => {
        if (!d.holding) return;
        const rel = s.hand.hand.matrixWorld.clone().invert().multiply(s.mug.matrixWorld);
        if (!first) first = rel;
        const p = new THREE.Vector3().setFromMatrixPosition(rel);
        const q = new THREE.Quaternion().setFromRotationMatrix(rel);
        expect(p.distanceTo(new THREE.Vector3().setFromMatrixPosition(first))).toBeLessThan(0.002);
        expect(q.angleTo(new THREE.Quaternion().setFromRotationMatrix(first))).toBeLessThan(0.01);
      });
      expect(first).not.toBeNull();
    });

    it(`${where}: grips the handle, fingers round its bar and the thumb on top, none of them in the mug`, async () => {
      const s = await seated(outfit, seat);
      for (const d of [REST, SIP]) {
        for (let i = 0; i < 3; i++) s.frameAt(1 / 30, d);
        for (const f of s.hand.fingers) {
          // round the bar, snug: the middle joints within a finger's thickness of it, never through it (1 cm each side)
          for (const j of [f[1], f[2]]) {
            const d = fromBar(inMug(s, j.getWorldPosition(new THREE.Vector3())));
            expect(d, j.name).toBeGreaterThan(0.015);
            expect(d, j.name).toBeLessThan(0.032);
          }
          for (const j of f) {
            const p = inMug(s, j.getWorldPosition(new THREE.Vector3()));
            expect(Math.hypot(p.x, p.z) > MUG.r || p.y < 0 || p.y > MUG.rim, `${j.name} inside the mug`).toBe(true);
          }
        }
        const thumb = inMug(s, (s.hand.thumb[2].children[0] ?? s.hand.thumb[2]).getWorldPosition(new THREE.Vector3()));
        expect(thumb.distanceTo(new THREE.Vector3(MUG.bar.x - 0.005, MUG.handleTop + 0.01, MUG.bar.z))).toBeLessThan(0.035);
      }
    });

    it(`${where}: the mug stands upright on the wood where it's kept while they aren't drinking`, async () => {
      const s = await seated(outfit, seat);
      const base = onMug(s, 0, 0, 0);
      expect(Math.abs(base.y - seat.mug.y)).toBeLessThan(0.004);
      expect(Math.hypot(base.x - seat.mug.x, base.z - seat.mug.z)).toBeLessThan(0.015);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.mug.getWorldQuaternion(new THREE.Quaternion()));
      expect(up.y).toBeGreaterThan(Math.cos((3 * Math.PI) / 180));
    });

    it(`${where}: brings the rim to the lips and tips the mug back for the sip`, async () => {
      const s = await seated(outfit, seat);
      for (let i = 0; i < 4; i++) s.frameAt(1 / 30, SIP);
      const rim = onMug(s, 0, MUG.rim, MUG.rimR);
      expect(rim.distanceTo(lips(s))).toBeLessThan(0.02);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.mug.getWorldQuaternion(new THREE.Quaternion()));
      const tilt = (Math.acos(up.y) * 180) / Math.PI;
      expect(tilt).toBeGreaterThan(45);
      expect(tilt).toBeLessThan(75);
      const [u, l, h] = ['upperarm_r', 'lowerarm_r', 'hand_r'].map(s.at);
      const elbow = (u.sub(l).angleTo(h.sub(l)) * 180) / Math.PI;
      expect(elbow).toBeGreaterThan(25);
      expect(elbow).toBeLessThan(165);
    });

    it(`${where}: the mug never goes through their face, hood or body, from the wood to the sip and back`, async () => {
      const s = await seated(outfit, seat);
      let worst = { depth: 0, bone: '', frame: -1 };
      let frame = 0;
      aDrink(s, () => {
        frame++;
        if (frame % 3) return; // every tenth of a second
        for (const v of vertices(s)) {
          if (DRINKING.test(v.bone)) continue;
          const p = inMug(s, v.p);
          const depth = Math.min(MUG.r - Math.hypot(p.x, p.z), p.y - 0.002, MUG.rim - 0.005 - p.y);
          if (depth > worst.depth) worst = { depth, bone: v.bone, frame };
        }
      });
      expect(worst.depth, `${(worst.depth * 1000).toFixed(1)} mm into the mug (${worst.bone}, frame ${worst.frame})`).toBe(0);
    });

    it(`${where}: the other hand lies flat on the wood beside the mug`, async () => {
      const s = await seated(outfit, seat);
      const left = findHand(s.body, 'l')!;
      expect(palmNormal(left, new THREE.Vector3()).y).toBeLessThan(-0.85);
      const want = restTargets(seat).left;
      expect(s.at('hand_l').distanceTo(new THREE.Vector3(want.x, want.y, want.z))).toBeLessThan(0.02);
    });
  }
});
