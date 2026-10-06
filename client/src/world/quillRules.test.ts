// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RIGGED_CHAIR, SEAT } from './RiggedCharacter';
import { INKPOT, LEFT_REST, PAGE, WRIST_ABOVE_NIB, pageTop, penAt } from './quillRules';
import { reachWith } from './twoBoneIk';

describe('the quill on the page', () => {
  it('writes along the lines of the right-hand page, nib down, and lifts it to go back for the next line', () => {
    let lifted = 0;
    let wrote = 0;
    for (let t = 0; t < 200; t += 0.05) {
      const p = penAt(t, 0);
      if (p.dipping) continue;
      expect(p.x).toBeGreaterThanOrEqual(PAGE.minX - 0.01);
      expect(p.x).toBeLessThanOrEqual(PAGE.maxX + 0.01);
      expect(p.z).toBeGreaterThanOrEqual(PAGE.minZ - 0.01);
      expect(p.z).toBeLessThanOrEqual(PAGE.maxZ + 0.01);
      if (p.writing) {
        wrote++;
        expect(p.y - pageTop(p.x)).toBeLessThan(0.004); // on the page (it tips a little toward its outer edge)
        expect(p.y).toBeGreaterThanOrEqual(pageTop(p.x));
      } else lifted++;
    }
    expect(wrote).toBeGreaterThan(lifted * 3);
    expect(lifted).toBeGreaterThan(0);
  });

  it('goes down the page line by line and starts again at the top', () => {
    const zs = new Set<number>();
    for (let t = 0; t < 400; t += 0.1) {
      const p = penAt(t, 0);
      if (p.writing) zs.add(Math.round(p.z * 50) / 50);
    }
    expect(zs.size).toBeGreaterThan(8);
  });

  it('now and then dips the nib in the inkpot', () => {
    let dips = 0;
    let was = false;
    for (let t = 0; t < 120; t += 0.05) {
      const p = penAt(t, 0);
      if (p.dipping && !was && Math.hypot(p.x - INKPOT.x, p.z - INKPOT.z) < 0.02) dips++;
      was = p.dipping && Math.hypot(p.x - INKPOT.x, p.z - INKPOT.z) < 0.02;
    }
    expect(dips).toBeGreaterThan(2);
  });

  it('moves smoothly: no jump of more than a few centimetres between frames', () => {
    let prev = penAt(0, 3);
    for (let t = 1 / 60; t < 120; t += 1 / 60) {
      const p = penAt(t, 3);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)).toBeLessThan(0.03);
      prev = p;
    }
  });

  it("writes at each coder's own pace", () => {
    expect(JSON.stringify(penAt(10, 1))).not.toBe(JSON.stringify(penAt(10, 2)));
  });
});

/** The shared skeleton sat at a bench (Desk.tsx: the chair at RIGGED_CHAIR, the body set back and turned to face the bench), writing. */
async function atTheBench() {
  const buf = fs.readFileSync(new URL('../../public/characters/animations.glb', import.meta.url));
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, bad) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', ok as never, bad),
  );
  const chair = new THREE.Group();
  chair.position.set(0, 0, RIGGED_CHAIR);
  gltf.scene.position.set(0, SEAT.lift, -SEAT.forward);
  gltf.scene.rotation.set(0, Math.PI, 0);
  chair.add(gltf.scene);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find((c) => c.name === 'Sitting_Writing_Loop')!).play();
  mixer.update(0);
  chair.updateMatrixWorld(true);
  return gltf.scene;
}
const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
function elbow(body: THREE.Object3D, side: 'l' | 'r') {
  const [u, l, h] = ['upperarm', 'lowerarm', 'hand'].map((n) => at(body.getObjectByName(`${n}_${side}`)!));
  return (u.sub(l).angleTo(h.sub(l)) * 180) / Math.PI;
}
/** Put a hand's wrist on a target (bench frame), elbow out to that side and down; how far it missed. */
function reach(body: THREE.Object3D, side: 'l' | 'r', target: THREE.Vector3) {
  const [upper, lower, hand] = ['upperarm', 'lowerarm', 'hand'].map((n) => body.getObjectByName(`${n}_${side}`)!);
  const pole = at(upper).add(new THREE.Vector3(side === 'r' ? 0.6 : -0.6, -1, 0.3)); // they face -Z: their right is +X
  reachWith(upper, lower, hand, target, pole, 1);
  return at(hand).distanceTo(target);
}

describe('a coder writing at the bench, on the shared skeleton', () => {
  it('reaches every point of the writing (and the inkpot) with the right hand, the elbow bent', async () => {
    const body = await atTheBench();
    let widest = 0;
    let tightest = 180;
    for (let t = 0; t < 60; t += 0.25) {
      const p = penAt(t, 0);
      const wrist = new THREE.Vector3(p.x + WRIST_ABOVE_NIB.x, p.y + WRIST_ABOVE_NIB.y, p.z + WRIST_ABOVE_NIB.z);
      expect(reach(body, 'r', wrist), `t=${t}`).toBeLessThan(0.01);
      const a = elbow(body, 'r');
      widest = Math.max(widest, a);
      tightest = Math.min(tightest, a);
    }
    expect(widest).toBeLessThan(160);
    expect(tightest).toBeGreaterThan(45);
  });

  it('rests the left hand flat on the left-hand page, the elbow bent', async () => {
    const body = await atTheBench();
    expect(reach(body, 'l', new THREE.Vector3(LEFT_REST.x, LEFT_REST.y, LEFT_REST.z))).toBeLessThan(0.01);
    const a = elbow(body, 'l');
    expect(a).toBeGreaterThan(45);
    expect(a).toBeLessThan(160);
  });
});
