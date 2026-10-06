// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RIGGED_CHAIR, SEAT } from './RiggedCharacter';
import { leftPageTop, pageTop, penAt } from './quillRules';
import { palmNormal, findHand } from './twoBoneIk';
import { createWritingHands } from './writingHands';

// A coder sat at their bench as Desk.tsx and RiggedCharacter.tsx seat them (the bench, the chair in it, the body and
// the quill in the chair), writing, measured in the bench's frame (they face -Z, their right is +X). Every outfit, as
// their hands may differ.

type Gltf = { scene: THREE.Group; animations: THREE.AnimationClip[] };
// the outfits carry textures, which the loader reaches through the browser's `self`; their images don't matter here
(globalThis as Record<string, unknown>).self ??= globalThis;
async function load(name: string): Promise<Gltf> {
  const buf = fs.readFileSync(new URL(`../../public/characters/${name}.glb`, import.meta.url));
  return new Promise((ok, bad) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', ok as never, bad),
  );
}

async function seated(outfit: string, clipName = 'Sitting_Writing_Loop') {
  const [body, anims] = await Promise.all([load(outfit), load('animations')]);
  const bench = new THREE.Group();
  bench.position.set(3, 0, -2);
  bench.rotation.y = 0.7; // benches stand every way round
  const chair = new THREE.Group();
  chair.position.set(0, 0, RIGGED_CHAIR);
  bench.add(chair);
  body.scene.position.set(0, SEAT.lift, -SEAT.forward);
  body.scene.rotation.set(0, Math.PI, 0);
  chair.add(body.scene);
  const quill = new THREE.Group();
  chair.add(quill);
  bench.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(body.scene);
  mixer.clipAction(anims.animations.find((c) => c.name === clipName)!).play();
  const hands = createWritingHands(body.scene, 0);
  hands.quill.current = quill;
  const frame = (t: number, dt: number, writing = true) => {
    hands.before();
    mixer.update(dt);
    bench.updateMatrixWorld(true);
    hands.after(t, dt, writing);
    bench.updateMatrixWorld(true);
  };
  const at = (n: string) => bench.worldToLocal(body.scene.getObjectByName(n)!.getWorldPosition(new THREE.Vector3()));
  /** The quill's nib, and which way it runs up from there, in the bench's frame. */
  const pen = () => {
    const nib = bench.worldToLocal(quill.getWorldPosition(new THREE.Vector3()));
    const q = bench.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(quill.getWorldQuaternion(new THREE.Quaternion()));
    return { nib, up: new THREE.Vector3(0, 1, 0).applyQuaternion(q) };
  };
  return { body: body.scene, bench, quill, mixer, frame, at, pen };
}
type Seat = Awaited<ReturnType<typeof seated>>;

/** Settled into writing, then a frame at each moment of a page (writing, dipping, the page turning). */
function overAPage(s: Seat, each: (t: number) => void) {
  for (let t = 0; t < 3; t += 0.1) s.frame(t, 0.1);
  for (let t = 3; t < 48; t += 0.37) {
    s.frame(t, 1 / 60);
    each(t);
  }
}
const along = (p: THREE.Vector3, pen: { nib: THREE.Vector3; up: THREE.Vector3 }) => p.clone().sub(pen.nib).dot(pen.up);
const offLine = (p: THREE.Vector3, pen: { nib: THREE.Vector3; up: THREE.Vector3 }) => {
  const d = p.clone().sub(pen.nib);
  return d.sub(pen.up.clone().multiplyScalar(d.dot(pen.up))).length();
};
const pad = (s: Seat) => s.at('index_03_r').add(s.at('index_04_leaf_r')).multiplyScalar(0.5);

describe.each(['Male_Peasant', 'Male_Ranger', 'Female_Peasant', 'Female_Ranger'])('%s writing at a bench', (outfit) => {
  it('keeps the nib of the quill on the pen path all the time', async () => {
    const s = await seated(outfit);
    overAPage(s, (t) => {
      const p = penAt(t, 0);
      expect(s.pen().nib.distanceTo(new THREE.Vector3(p.x, p.y, p.z))).toBeLessThan(0.001);
      expect(s.quill.visible).toBe(true);
    });
  });

  it('pinches the quill between the thumb and the forefinger, a few centimetres up from the nib', async () => {
    const s = await seated(outfit);
    overAPage(s, () => {
      const pen = s.pen();
      const thumb = s.at('thumb_04_leaf_r');
      for (const p of [pad(s), thumb]) {
        expect(offLine(p, pen)).toBeLessThan(0.013); // touching it: a finger's thickness off its line
        expect(along(p, pen)).toBeGreaterThan(0.02);
        expect(along(p, pen)).toBeLessThan(0.05);
      }
      expect(pad(s).distanceTo(thumb)).toBeLessThan(0.025);
    });
  });

  it('rests the quill in the crook of the hand and slants it back over the writing hand', async () => {
    const s = await seated(outfit);
    overAPage(s, () => {
      const pen = s.pen();
      expect(offLine(s.at('index_01_r'), pen)).toBeLessThan(0.03);
      const slant = (Math.asin(pen.up.y) * 180) / Math.PI;
      expect(slant).toBeGreaterThan(40);
      expect(slant).toBeLessThan(65);
      expect(pen.up.x).toBeGreaterThan(0.2); // towards the right shoulder
      expect(pen.up.z).toBeGreaterThan(0.2);
    });
  });

  it('writes with the hand down by the page: no finger through it, the wrist low, the elbow bent', async () => {
    const s = await seated(outfit);
    let low = Infinity;
    overAPage(s, (t) => {
      if (!penAt(t, 0).writing) return;
      for (const f of ['index', 'middle', 'ring', 'pinky', 'thumb'])
        for (const j of ['02', '03', '04_leaf']) {
          const p = s.at(`${f}_${j}_r`);
          if (p.x < 0.02 || p.x > 0.26) continue; // only over the page
          low = Math.min(low, p.y - pageTop(p.x));
          expect(p.y - pageTop(p.x)).toBeGreaterThan(0.004); // a joint's middle: the skin is a few mm below it
        }
      const p = penAt(t, 0);
      expect(s.at('hand_r').y - p.y).toBeLessThan(0.12);
      const [u, l, h] = ['upperarm_r', 'lowerarm_r', 'hand_r'].map(s.at);
      const elbow = (u.sub(l).angleTo(h.sub(l)) * 180) / Math.PI;
      expect(elbow).toBeGreaterThan(45);
      expect(elbow).toBeLessThan(160);
    });
    expect(low).toBeLessThan(0.012); // and something rests on it
  });

  it('lays the left hand flat on its page, palm down', async () => {
    const s = await seated(outfit);
    overAPage(s, () => {
      const left = findHand(s.body, 'l')!;
      const down = palmNormal(left, new THREE.Vector3()).transformDirection(new THREE.Matrix4().copy(s.bench.matrixWorld).invert());
      expect(down.y).toBeLessThan(-0.9);
      const tips = ['index', 'middle', 'ring', 'pinky'].map((f) => s.at(`${f}_04_leaf_l`));
      const lowest = Math.min(...tips.map((p) => p.y - leftPageTop(p.x)));
      expect(lowest).toBeGreaterThan(0.004);
      expect(lowest).toBeLessThan(0.009);
      expect(s.at('hand_l').y - leftPageTop(s.at('hand_l').x)).toBeLessThan(0.07);
    });
  });

  it('lets go when they stop: the clip has the arms back, and the quill is put down', async () => {
    const s = await seated(outfit);
    for (let t = 0; t < 3; t += 0.1) s.frame(t, 0.1);
    for (let t = 3; t < 9; t += 0.1) s.frame(t, 0.1, false);
    expect(s.quill.visible).toBe(false);
    // the same body with the clip alone, at the same point in it
    const clip = await seated(outfit);
    clip.mixer.update(s.mixer.time);
    clip.bench.updateMatrixWorld(true);
    expect(s.at('hand_r').distanceTo(clip.at('hand_r'))).toBeLessThan(0.01);
    expect(s.at('index_04_leaf_l').distanceTo(clip.at('index_04_leaf_l'))).toBeLessThan(0.01);
  });
});
