import { useMemo } from 'react';
import * as THREE from 'three';
import { HandPose } from './handPose';
import { LEFT_REST, leftPageTop, penAt } from './quillRules';
import { closeFingers, findHand, orientHand, palmNormal, reachThumb, reachWith, type HandBones } from './twoBoneIk';

// A seated coder's hands while they work (RiggedCharacter.tsx): the right holds the quill in a writer's pinch and
// writes in the ledger along quillRules.ts's path, with a dip in the inkwell now and then; the left lies flat on the
// other page, holding the book open. Two-bone IK on top of the sitting clip, the whole hand aimed and each finger
// curled its own amount, blended in as they start work and out when they stop. The quill rides in the hand.

/** The right hand's grip, in the bench's frame (the coder faces -Z there, their right is +X). */
export const GRIP = {
  /** From the wrist to the knuckles: forward, a little down and in (the quill's slant follows from the hand's). */
  fingers: new THREE.Vector3(-0.3, -0.05, -0.95),
  /** How far up the quill from the nib the thumb and forefinger pinch it (m). */
  pinch: 0.035,
  /** Where the quill rests further up: this far from the forefinger's knuckle towards the thumb's middle joint. */
  web: 0.3,
  /** The palm faces down and in, towards the page and the other hand. */
  palm: new THREE.Vector3(-0.4, -0.9, 0),
  /** Radians at each joint: index, middle (its tip resting on the page), ring and pinky (tucked in). */
  curl: [0.8, 0.95, 1.3, 1.4],
  /** The thumb's tip comes this far from the forefinger's pad, on the palm's side: the quill is held between them. */
  thumbGap: 0.015,
};
/** The left hand flat on its page, fingers forward and a little in. */
export const REST = {
  fingers: new THREE.Vector3(0.25, -0.08, -1).normalize(),
  palm: new THREE.Vector3(0, -1, 0),
  curl: [0.12, 0.1, 0.12, 0.15],
  thumb: 0.05,
  /** The fingertips' pads sit this far above the page. */
  pad: 0.006,
};
/** Elbows out to each side and down. */
const POLE_R = new THREE.Vector3(0.6, -1, 0.3);
const POLE_L = new THREE.Vector3(-0.6, -1, 0.3);
const UP = new THREE.Vector3(0, 1, 0);

const tip = (h: HandBones, f: number) => h.fingers[f][3];
const thumbTip = (h: HandBones) => h.thumb[2].children[0] ?? h.thumb[2];
/** The finger and thumb joints, which start each frame from the rig's bind pose (straight), not the clip's. */
const joints = (h: HandBones) => [...h.fingers.flatMap((f) => f.slice(0, 3)), ...h.thumb];

/** The hands of the rigged body `scene`, seated in a chair (its parent) at a bench (the chair's parent). */
export function createWritingHands(scene: THREE.Object3D, seed: number) {
  const get = (n: string) => scene.getObjectByName(n);
  const [upperR, lowerR, upperL, lowerL] = ['upperarm_r', 'lowerarm_r', 'upperarm_l', 'lowerarm_l'].map(get);
  const right = findHand(scene, 'r');
  const left = findHand(scene, 'l');
  const b = upperR && lowerR && upperL && lowerL && right && left ? { upperR, lowerR, upperL, lowerL, right, left } : null;
  const moved = b ? [b.upperR, b.lowerR, b.upperL, b.lowerL, ...b.right.bones, ...b.left.bones] : [];
  const pose = new HandPose(moved);
  const clip = moved.map(() => new THREE.Quaternion());
  // made before any clip has run: the rig as bound
  const straight = b ? [...joints(b.right), ...joints(b.left)].map((j) => [j, j.quaternion.clone()] as const) : [];
  const straighten = (h: HandBones) => {
    for (const [j, q] of straight) if (joints(h).includes(j)) j.quaternion.copy(q);
    h.hand.updateMatrixWorld(true);
  };
  const quill: { current: THREE.Group | null } = { current: null };
  let weight = 0;
  /** Where the wrist sat from the nib last frame (bench frame): the first guess for this one. */
  const offset = new THREE.Vector3(0.05, 0.06, 0.15);
  const v = {
    nib: new THREE.Vector3(),
    pen: new THREE.Vector3(),
    grip: new THREE.Vector3(),
    pinch: new THREE.Vector3(),
    target: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    fingers: new THREE.Vector3(),
    palm: new THREE.Vector3(),
    a: new THREE.Vector3(),
    benchQ: new THREE.Quaternion(),
    q: new THREE.Quaternion(),
    held: new THREE.Matrix4(),
    m: new THREE.Matrix4(),
    one: new THREE.Vector3(1, 1, 1),
  };

  /** The forefinger's pad: the middle of its last bone. */
  const padOf = (h: HandBones, out: THREE.Vector3) => tip(h, 0).getWorldPosition(out).add(h.fingers[0][2].getWorldPosition(v.a)).multiplyScalar(0.5);
  /** The pinch point: between the thumb's tip and the forefinger's pad. */
  const pinchOf = (h: HandBones, out: THREE.Vector3) => padOf(h, out).add(thumbTip(h).getWorldPosition(v.a)).multiplyScalar(0.5);
  /** Where the quill rests further up: in the crook between the thumb and the forefinger's knuckle. */
  const webOf = (h: HandBones, out: THREE.Vector3) => h.fingers[0][0].getWorldPosition(out).lerp(h.thumb[1].getWorldPosition(v.a), GRIP.web);

  return {
    quill,
    /** Before the mixer's update: put back what the hands moved, so the clip poses them afresh. */
    before() {
      pose.undo();
    },
    /** After the mixer's update (and the scene's matrices): write, or let go, at time t. */
    after(t: number, dt: number, writing: boolean) {
      pose.keep();
      weight += ((writing ? 1 : 0) - weight) * (1 - Math.exp(-dt * 3));
      const w = weight;
      const q = quill.current;
      const chair = scene.parent;
      const bench = chair?.parent;
      if (q) q.visible = false;
      if (!b || !chair || !bench || w < 0.002) return;
      moved.forEach((bone, i) => clip[i].copy(bone.quaternion));
      bench.getWorldQuaternion(v.benchQ);
      const dir = (d: THREE.Vector3, out: THREE.Vector3) => out.copy(d).applyQuaternion(v.benchQ);
      const inBench = (x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyMatrix4(bench.matrixWorld);

      // the right hand, in full: aimed, curled round the quill, and moved until the pinch is just up the quill from the nib
      const p = penAt(t, seed);
      inBench(p.x, p.y, p.z, v.nib);
      b.upperR.getWorldPosition(v.pole).add(dir(POLE_R, v.a));
      v.target.copy(offset).applyQuaternion(v.benchQ).add(v.nib);
      for (let pass = 0; pass < 2; pass++) {
        reachWith(b.upperR, b.lowerR, b.right.hand, v.target, v.pole, 1);
        orientHand(b.right, dir(GRIP.fingers, v.fingers), dir(GRIP.palm, v.palm), 1);
        if (pass === 0) {
          // the fingers curled round, and the thumb brought across to the forefinger's pad
          straighten(b.right);
          closeFingers(b.right, GRIP.curl, 0);
          palmNormal(b.right, v.palm);
          padOf(b.right, v.pinch).addScaledVector(v.palm, GRIP.thumbGap);
          b.right.thumb[1].getWorldPosition(v.target).addScaledVector(v.palm, 0.04);
          reachThumb(b.right, v.pinch, v.target);
        }
        // the quill runs from the pinch up through the crook of the thumb; the wrist moves by however far the pinch missed
        pinchOf(b.right, v.pinch);
        webOf(b.right, v.pen).sub(v.pinch).normalize();
        v.grip.copy(v.nib).addScaledVector(v.pen, GRIP.pinch);
        b.right.hand.getWorldPosition(v.target).add(v.grip).sub(v.pinch);
      }
      b.right.hand.getWorldPosition(v.a).sub(v.nib);
      offset.copy(v.a).applyQuaternion(v.q.copy(v.benchQ).invert());
      // the quill, nib down where the pen path says, held fast in the hand from here on
      v.q.setFromUnitVectors(UP, v.pen);
      v.m.compose(v.nib, v.q, v.one);
      v.held.copy(b.right.hand.matrixWorld).invert().multiply(v.m);

      // the left hand flat on its page, then lowered or raised until the fingertips just touch it
      dir(REST.fingers, v.fingers);
      dir(REST.palm, v.palm);
      b.upperL.getWorldPosition(v.pole).add(dir(POLE_L, v.a));
      inBench(LEFT_REST.x, LEFT_REST.y, LEFT_REST.z, v.target);
      for (let pass = 0; pass < 2; pass++) {
        reachWith(b.upperL, b.lowerL, b.left.hand, v.target, v.pole, 1);
        orientHand(b.left, v.fingers, v.palm, 1);
        if (pass === 0) {
          straighten(b.left);
          closeFingers(b.left, REST.curl, REST.thumb);
        }
        let low = Infinity;
        for (let f = 0; f < 4; f++) {
          bench.worldToLocal(tip(b.left, f).getWorldPosition(v.a));
          low = Math.min(low, v.a.y - leftPageTop(v.a.x));
        }
        b.left.hand.getWorldPosition(v.target);
        v.target.y += REST.pad - low;
      }

      // blended in from the clip's pose by the weight, and the quill put where the hand now holds it
      if (w < 1) moved.forEach((bone, i) => bone.quaternion.copy(v.q.copy(clip[i]).slerp(bone.quaternion, w)));
      b.upperR.updateMatrixWorld(true);
      b.upperL.updateMatrixWorld(true);
      if (!q || w < 0.5) return;
      q.visible = true;
      v.m.copy(chair.matrixWorld).invert().multiply(b.right.hand.matrixWorld).multiply(v.held);
      v.m.decompose(q.position, q.quaternion, v.a);
    },
  };
}

export function useWritingHands(scene: THREE.Object3D, seed: number) {
  return useMemo(() => createWritingHands(scene, seed), [scene, seed]);
}
