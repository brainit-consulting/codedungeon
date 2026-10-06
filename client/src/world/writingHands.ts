import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HandPose } from './handPose';
import { LEFT_REST, WRIST_ABOVE_NIB, penAt } from './quillRules';
import { closeFingers, facePalm, findHand, reachWith } from './twoBoneIk';

// A seated coder's hands while they work (RiggedCharacter.tsx): the right holds the quill and writes in the ledger
// along quillRules.ts's path, with a dip in the inkwell now and then; the left lies flat on the other page, holding
// the book open. Two-bone IK on top of the sitting clip, blended in as they start work and out when they stop. The
// quill rides in the hand from the nib up through the gap between thumb and forefinger.

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
/** In the bench's frame (the coder faces -Z there, their right is +X): elbows out to each side and down. */
const POLE_R = new THREE.Vector3(0.6, -1, 0.3);
const POLE_L = new THREE.Vector3(-0.6, -1, 0.3);
/** A quill is held with the palm down and turned in a little. */
const PEN_PALM = new THREE.Vector3(-0.5, -1, 0.15).normalize();

export function useWritingHands(scene: THREE.Object3D, seed: number) {
  const bones = useMemo(() => {
    const get = (n: string) => scene.getObjectByName(n);
    const [upperR, lowerR, upperL, lowerL] = ['upperarm_r', 'lowerarm_r', 'upperarm_l', 'lowerarm_l'].map(get);
    const right = findHand(scene, 'r');
    const left = findHand(scene, 'l');
    return upperR && lowerR && upperL && lowerL && right && left ? { upperR, lowerR, upperL, lowerL, right, left } : null;
  }, [scene]);
  const pose = useMemo(() => new HandPose(bones ? [bones.upperR, bones.lowerR, bones.upperL, bones.lowerL, ...bones.right.bones, ...bones.left.bones] : []), [bones]);
  const quill = useRef<THREE.Group>(null);
  const weight = useRef(0);
  const v = useMemo(
    () => ({ nib: new THREE.Vector3(), wrist: new THREE.Vector3(), pole: new THREE.Vector3(), dir: new THREE.Vector3(), grip: new THREE.Vector3(), a: new THREE.Vector3(), q: new THREE.Quaternion(), benchQ: new THREE.Quaternion(), parentQ: new THREE.Quaternion() }),
    [],
  );

  return {
    quill,
    /** Before the mixer's update: put back what the hands moved, so the clip poses them afresh. */
    before() {
      pose.undo();
    },
    /** After the mixer's update (and the scene's matrices): write, or let go, at time t. */
    after(t: number, dt: number, writing: boolean) {
      pose.keep();
      weight.current += ((writing ? 1 : 0) - weight.current) * (1 - Math.exp(-dt * 3));
      const w = weight.current;
      const q = quill.current;
      const chair = scene.parent;
      const bench = chair?.parent;
      if (q) q.visible = w > 0.6;
      if (!bones || !chair || !bench || w < 0.002) return;
      bench.getWorldQuaternion(v.benchQ);
      const inBench = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyMatrix4(bench.matrixWorld);

      // the right hand: the wrist up and back from the nib, as a quill is held; fingers closed round it
      const p = penAt(t, seed);
      inBench(p.x, p.y, p.z, v.nib);
      inBench(p.x + WRIST_ABOVE_NIB.x, p.y + WRIST_ABOVE_NIB.y, p.z + WRIST_ABOVE_NIB.z, v.wrist);
      bones.upperR.getWorldPosition(v.pole).add(v.a.copy(POLE_R).applyQuaternion(v.benchQ));
      reachWith(bones.upperR, bones.lowerR, bones.right.hand, v.wrist, v.pole, w);
      facePalm(bones.right, v.a.copy(PEN_PALM).applyQuaternion(v.benchQ), w);
      closeFingers(bones.right, 0.5 * w, 0.4 * w);

      // the left hand flat on the other page
      inBench(LEFT_REST.x, LEFT_REST.y, LEFT_REST.z, v.wrist);
      bones.upperL.getWorldPosition(v.pole).add(v.a.copy(POLE_L).applyQuaternion(v.benchQ));
      reachWith(bones.upperL, bones.lowerL, bones.left.hand, v.wrist, v.pole, w);
      facePalm(bones.left, DOWN, w);
      closeFingers(bones.left, 0.08 * w, 0.05 * w);

      // the quill: from the nib up through the grip, between the thumb and the forefinger
      if (!q) return;
      bones.right.fingers[0][1].getWorldPosition(v.grip);
      bones.right.thumb[1].getWorldPosition(v.a);
      v.grip.add(v.a).multiplyScalar(0.5);
      v.dir.subVectors(v.grip, v.nib).normalize();
      v.q.setFromUnitVectors(UP, v.dir);
      chair.getWorldQuaternion(v.parentQ);
      q.quaternion.copy(v.parentQ.invert().multiply(v.q));
      q.position.copy(chair.worldToLocal(v.a.copy(v.nib)));
    },
  };
}
