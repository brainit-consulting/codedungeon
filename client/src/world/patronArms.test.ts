// Run with `npm test` (Vitest).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { leanForward } from './barReach';
import { SEAT } from './RiggedCharacter';
import { TAVERN_SEATS, leanFor, restTargets, type Seat } from './tavernRules';
import { reachWith } from './twoBoneIk';

/** The shared skeleton, sat the way a drinker is (Tavern.tsx's Patron): the seat's frame, then the seated offset, facing -Z in it. */
async function seated(seat: Seat) {
  const buf = fs.readFileSync(new URL('../../public/characters/animations.glb', import.meta.url));
  const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((ok, bad) =>
    new GLTFLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, '', ok as never, bad),
  );
  const world = new THREE.Group();
  const frame = new THREE.Group();
  frame.position.set(seat.x, seat.lift, seat.z);
  frame.rotation.set(0, seat.yaw, 0);
  gltf.scene.position.set(0, SEAT.lift, -SEAT.forward);
  gltf.scene.rotation.set(0, Math.PI, 0);
  frame.add(gltf.scene);
  world.add(frame);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations.find((c) => c.name === 'Sitting_Idle_Loop')!).play();
  mixer.update(0);
  world.updateMatrixWorld(true);
  return gltf.scene;
}

const at = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
/** The angle at the elbow: 180° is a straight arm. */
function elbow(body: THREE.Object3D, side: 'l' | 'r') {
  const [u, l, h] = ['upperarm', 'lowerarm', 'hand'].map((n) => at(body.getObjectByName(`${n}_${side}`)!));
  return (u.sub(l).angleTo(h.sub(l)) * 180) / Math.PI;
}

/** Sat, leaning in as they do, both arms put to rest: left hand flat by the mug, right hand on its handle. */
async function atRest(seat: Seat) {
  const body = await seated(seat);
  const fwd = new THREE.Vector3(-Math.sin(seat.yaw), 0, -Math.cos(seat.yaw));
  const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  leanForward(body.getObjectByName('spine_01')!, leanFor(seat), fwd);
  const { left, wrist } = restTargets(seat);
  const errors: number[] = [];
  for (const [side, target, out] of [['l', left, -1], ['r', wrist, 1]] as const) {
    const [upper, lower, hand] = ['upperarm', 'lowerarm', 'hand'].map((n) => body.getObjectByName(`${n}_${side}`)!);
    const t = new THREE.Vector3(target.x, target.y, target.z);
    const pole = at(upper).addScaledVector(new THREE.Vector3(0, 1, 0), -1).addScaledVector(right, 0.6 * out).addScaledVector(fwd, -0.3);
    reachWith(upper, lower, hand, t, pole, 1);
    errors.push(at(hand).distanceTo(t));
  }
  return { body, errors };
}

describe('a drinker at rest, leaning on the bar or the table', () => {
  const stool = TAVERN_SEATS.find((s) => s.kind === 'stool')!;
  const bench = TAVERN_SEATS.find((s) => s.kind === 'bench')!;

  for (const seat of [stool, bench]) {
    it(`at a ${seat.kind}: both hands get where they're put, with the elbows bent, not arms held out straight`, async () => {
      const { body, errors } = await atRest(seat);
      for (const e of errors) expect(e).toBeLessThan(0.02);
      for (const side of ['l', 'r'] as const) {
        const a = elbow(body, side);
        expect(a, `${side} elbow`).toBeGreaterThan(70);
        expect(a, `${side} elbow`).toBeLessThan(150);
      }
    });
  }

  it('sat upright, as before, the arms had to go straight to reach (so this test can see the fault)', async () => {
    const body = await seated(stool);
    const { left } = restTargets(stool);
    const upper = body.getObjectByName('upperarm_l')!;
    const reach = at(upper).distanceTo(at(body.getObjectByName('lowerarm_l')!)) + at(body.getObjectByName('lowerarm_l')!).distanceTo(at(body.getObjectByName('hand_l')!));
    expect(at(upper).distanceTo(new THREE.Vector3(left.x, left.y, left.z))).toBeGreaterThan(reach * 0.97);
  });
});
