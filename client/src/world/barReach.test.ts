// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { findArm, keepHandAbove, leanForward, sinkBelow, type ArmBones } from './barReach';
import { COUNTER_TOP, TAP, TAPSTER_BUILD, WIPE_HAND_Y, WIPE_LEAN, tapsterGesture, wipeAt } from './tavernRules';

describe('sinkBelow', () => {
  const top = { minX: 0, maxX: 1, minZ: 0, maxZ: 1, top: 1 };
  it('is how far the lowest point over the surface is below its top (with a hair of clearance)', () => {
    expect(sinkBelow([new THREE.Vector3(0.5, 0.9, 0.5)], top, 0)).toBeCloseTo(0.1);
    expect(sinkBelow([new THREE.Vector3(0.5, 1.2, 0.5)], top, 0)).toBe(0);
  });
  it("ignores what isn't over the surface", () => {
    expect(sinkBelow([new THREE.Vector3(1.5, 0.2, 0.5), new THREE.Vector3(0.5, 0.5, -0.2)], top, 0)).toBe(0);
  });
});

/** The coders' shared skeleton with its clips (the same file the dungeon loads), standing where Wystan does, at his build. */
async function wystan() {
  const buf = fs.readFileSync(new URL('../../public/characters/animations.glb', import.meta.url));
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, bad) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', ok as never, bad),
  );
  gltf.scene.position.set(TAP.x, 0, TAP.z);
  gltf.scene.scale.set(...TAPSTER_BUILD);
  return gltf;
}

/** The lowest any hand or fingertip gets over the counter top through a clip, sampled at 60 fps, with or without the fix. */
function deepestSink(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }, clipName: string, fixed: boolean) {
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find((c) => c.name === clipName)!;
  const action = mixer.clipAction(clip).play();
  const arms = (['l', 'r'] as const).map((s) => findArm(gltf.scene, s)!) as ArmBones[];
  let worst = 0;
  let lifted = 0;
  for (let t = 0; t <= clip.duration; t += 1 / 60) {
    action.time = t;
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    if (fixed) for (const arm of arms) lifted = Math.max(lifted, keepHandAbove(arm, COUNTER_TOP));
    for (const arm of arms) worst = Math.max(worst, sinkBelow([arm.hand, ...arm.tips].map((b) => b.getWorldPosition(new THREE.Vector3())), COUNTER_TOP, 0));
  }
  mixer.stopAllAction();
  return { worst, lifted };
}

describe("Wystan's hands and the bar counter, at his build and where he stands", () => {
  it('his reach over the bar sinks a hand into the counter without the fix (so this test can see it)', async () => {
    expect(deepestSink(await wystan(), 'Interact', false).worst).toBeGreaterThan(0.1);
  });

  it('with the fix, no hand or fingertip goes into the counter, in any clip he plays', async () => {
    const gltf = await wystan();
    for (const clip of ['Idle_Loop', 'Interact', 'Idle_Talking_Loop']) {
      const { worst, lifted } = deepestSink(gltf, clip, true);
      expect(worst, clip).toBeLessThan(0.004);
      expect(lifted, clip).toBeLessThan(0.3); // his reach over the bar lands on the wood (measured 0.26 m of lift), not a different pose
    }
  });
});

describe('Wystan wiping the bar', () => {
  it('keeps the rag on the counter, in front of him, where his right hand can reach all through the wipe', async () => {
    const gltf = await wystan();
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations.find((c) => c.name === 'Idle_Loop')!).play();
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    leanForward(gltf.scene.getObjectByName('spine_01')!, WIPE_LEAN); // leaning over the bar from the waist, as he does to wipe it
    const arm = findArm(gltf.scene, 'r')!;
    const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const reach = at(arm.upper).distanceTo(at(arm.lower)) + at(arm.lower).distanceTo(at(arm.hand));
    for (let s = 0; s < 6; s += 0.05) {
      const p = wipeAt(s);
      expect(p.x).toBeGreaterThan(COUNTER_TOP.minX);
      expect(p.x).toBeLessThan(COUNTER_TOP.maxX);
      expect(p.z).toBeGreaterThan(COUNTER_TOP.minZ + 0.03);
      expect(at(arm.upper).distanceTo(new THREE.Vector3(p.x, COUNTER_TOP.top + WIPE_HAND_Y, p.z))).toBeLessThan(reach * 0.97);
    }
  });

  it('does all three of his gestures now and then', () => {
    const seen = new Set(Array.from({ length: 100 }, (_, i) => tapsterGesture(i / 100)));
    expect([...seen].sort()).toEqual(['serve', 'talk', 'wipe']);
  });
});
