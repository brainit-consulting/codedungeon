import { useMemo } from 'react';
import * as THREE from 'three';
import { HandPose } from './handPose';
import { leanForward } from './barReach';
import { leanFor, restTargets, type Drink, type Seat } from './tavernRules';
import { closeFingers, curlFinger, facePalm, findHand, orientHand, palmNormal, reachThumb, reachWith, type HandBones } from './twoBoneIk';

// A drinker's hands at the bar or a table (Tavern.tsx's Patron): they lean in from the waist, the left hand lies flat on
// the wood, and the right holds the mug by its handle, the fingers curled round its bar and the thumb on top. The mug is
// placed from the hand every frame, so it can never drift or tip on its own: to drink, the hand brings the rim to the
// lips (read from each body's own face) and tips it back, the rim pivoting on the lower lip.

/**
 * The mug (props/Mug, measured from its mesh): its body's radius, the rim's height and radius, and the handle's bar,
 * the straight part the fingers close round (its centre line; 2 cm thick, with a 2.5 cm gap between it and the body).
 */
export const MUG = { r: 0.072, rim: 0.179, rimR: 0.0718, bar: { x: 0.109, z: -0.002, bottom: 0.073, top: 0.15 }, handleTop: 0.169 };

/** How the right hand holds it, and how far it tips. */
export const HOLD = {
  /**
   * Radians at each finger's three joints (index, middle, ring, pinky): a little at the knuckle so the finger runs along
   * the bar's outside, then round in front of it and back through the gap behind it. The pinky, shorter and set further
   * back, bends less at the knuckle to get round. Measured: every middle joint 1.5 to 3.2 cm from the bar's centre line
   * (it is 1 cm thick each side), so snug without going through it.
   */
  curl: [
    [0.65, 1.7, 1.4],
    [0.65, 1.7, 1.4],
    [0.65, 1.7, 1.4],
    [0.45, 1.75, 1.45],
  ] as readonly (readonly number[])[],
  /** Where up the bar the grip closes (mug frame, m). */
  gripY: 0.12,
  /** The tip (rad) as the rim reaches the lips, and at the deepest of the sip. */
  lipTilt: 0.35,
  sipTilt: 1.05,
};

/** Where the lips are in the head bone's frame when a body's face can't be read: between the men's and the women's. */
const LIPS_FALLBACK = new THREE.Vector3(0, 0.03, 0.106);

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const X = new THREE.Vector3(1, 0, 0);

/** The finger and thumb joints, which start each frame from the rig's bind pose (straight), not the clip's. */
const joints = (h: HandBones) => [...h.fingers.flatMap((f) => f.slice(0, 3)), ...h.thumb];

/**
 * The lips, in the head bone's frame, from the body's own face: the front-most vertex near the midline below the nose,
 * among those the head moves (its bind pose, so it holds for any pose). Measured on the four outfits: about 11 cm in
 * front of the bone for the men, 10 for the women.
 */
export function lipsOf(scene: THREE.Object3D, head: THREE.Object3D): THREE.Vector3 {
  let best: THREE.Vector3 | null = null;
  const v = new THREE.Vector3();
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const hi = m.skeleton.bones.indexOf(head as THREE.Bone);
    if (hi < 0) return;
    const pos = m.geometry.attributes.position;
    const si = m.geometry.attributes.skinIndex;
    const sw = m.geometry.attributes.skinWeight;
    const toHead = m.skeleton.boneInverses[hi].clone().multiply(m.bindMatrix);
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
      if (w < 0.5) continue;
      v.fromBufferAttribute(pos, i).applyMatrix4(toHead);
      if (Math.abs(v.x) > 0.015 || v.y < 0.01 || v.y > 0.04) continue;
      if (!best || v.z > best.z) best = v.clone();
    }
  });
  return best ?? LIPS_FALLBACK.clone();
}

/** The hands of the rigged body `scene`, seated (its parent is the seat's frame), and the mug they drink from. */
export function createDrinkingHands(scene: THREE.Object3D, seat: Seat) {
  const get = (n: string) => scene.getObjectByName(n);
  const [upperL, lowerL, upperR, lowerR, head, waist] = ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'Head', 'spine_01'].map(get);
  const left = findHand(scene, 'l');
  const right = findHand(scene, 'r');
  const b = upperL && lowerL && upperR && lowerR && head && waist && left && right ? { upperL, lowerL, upperR, lowerR, head, waist, left, right } : null;
  const pose = new HandPose(b ? [b.waist, b.upperL, b.lowerL, b.upperR, b.lowerR, ...b.left.bones, ...b.right.bones] : []);
  // made before any clip has run: the rig as bound
  const straight = b ? joints(b.right).map((j) => [j, j.quaternion.clone()] as const) : [];
  const lips = b ? lipsOf(scene, b.head) : LIPS_FALLBACK.clone();
  const rest = restTargets(seat);
  const fwd = new THREE.Vector3(-Math.sin(seat.yaw), 0, -Math.cos(seat.yaw));
  const rt = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, seat.yaw);
  const mug: { current: THREE.Object3D | null } = { current: null };
  let settled = 0;
  /** Where the wrist was sent from the grip last frame, in the mug's frame: the first guess for this one. */
  const offset = new THREE.Vector3(0.05, -0.02, 0.07);
  const v = {
    target: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    shoulder: new THREE.Vector3(),
    q: new THREE.Quaternion(),
    o: new THREE.Vector3(),
    rimNear: new THREE.Vector3(0, MUG.rim, MUG.rimR),
    cRest: new THREE.Vector3(),
    cLip: new THREE.Vector3(),
    c: new THREE.Vector3(),
    grip: new THREE.Vector3(),
    g: new THREE.Vector3(),
    x: new THREE.Vector3(),
    u: new THREE.Vector3(),
    f: new THREE.Vector3(),
    n: new THREE.Vector3(),
    a: new THREE.Vector3(),
    thumb: new THREE.Vector3(),
    thumbPole: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    basis: new THREE.Matrix4(),
    one: new THREE.Vector3(1, 1, 1),
  };

  /** Inside the curled fingers, where the bar runs: the middle of the index, middle and ring fingers' joints. */
  const gripOf = (h: HandBones, out: THREE.Vector3) => {
    out.set(0, 0, 0);
    for (let f = 0; f < 3; f++) for (const j of h.fingers[f]) out.add(j.getWorldPosition(v.a));
    return out.multiplyScalar(1 / 12);
  };
  /** A point in the mug's frame (rotation q, base at o) in the world. */
  const onMug = (q: THREE.Quaternion, o: THREE.Vector3, x: number, y: number, z: number, out: THREE.Vector3) => out.set(x, y, z).applyQuaternion(q).add(o);

  return {
    mug,
    before() {
      pose.undo();
    },
    /** After the mixer's update (and the scene's matrices): this frame of drinking (tavernRules' drinkAt). */
    after(dt: number, d: Drink) {
      pose.keep();
      const m = mug.current;
      if (!b || !m) return;
      // the arms settle onto the bar or table as they sit down
      settled = Math.min(1, settled + dt / 0.6);
      const w = settled;

      // They lean in on the bar or the table from the waist: sat upright, their arms would have to go straight to reach it.
      leanForward(b.waist, leanFor(seat) * w, fwd);

      // The left forearm rests on the bar or the table, hand flat, beside the mug.
      b.upperL.getWorldPosition(v.shoulder);
      v.target.set(rest.left.x, rest.left.y, rest.left.z);
      v.pole.copy(v.shoulder).addScaledVector(UP, -1).addScaledVector(rt, -0.6).addScaledVector(fwd, -0.3);
      reachWith(b.upperL, b.lowerL, b.left.hand, v.target, v.pole, w);
      facePalm(b.left, DOWN, w);
      closeFingers(b.left, 0.12 * w, 0.05 * w);

      // Where the mug should be: on the wood, or its near rim on its way to the lips, tipping back as it goes and
      // pivoting on the lower lip for the sip.
      const tilt = d.toMouth * HOLD.lipTilt + d.tilt * (HOLD.sipTilt - HOLD.lipTilt);
      v.q.copy(yawQ).multiply(new THREE.Quaternion().setFromAxisAngle(X, tilt));
      v.o.set(seat.mug.x, seat.mug.y, seat.mug.z);
      onMug(yawQ, v.o, 0, MUG.rim, MUG.rimR, v.cRest);
      v.cLip.copy(lips).applyMatrix4(b.head.matrixWorld).addScaledVector(fwd, 0.003);
      v.c.lerpVectors(v.cRest, v.cLip, d.toMouth);
      v.o.copy(v.c).sub(v.rimNear.clone().applyQuaternion(v.q));

      // The hand that holds it: palm to the mug, fingers through the handle round its bar, thumb up along it.
      v.x.copy(X).applyQuaternion(v.q);
      v.u.copy(UP).applyQuaternion(v.q);
      v.n.copy(v.x).negate();
      v.f.crossVectors(v.u, v.x);
      onMug(v.q, v.o, MUG.bar.x, HOLD.gripY, MUG.bar.z, v.grip);
      onMug(v.q, v.o, MUG.bar.x - 0.005, MUG.handleTop + 0.01, MUG.bar.z, v.thumb);
      b.upperR.getWorldPosition(v.shoulder);
      v.pole.copy(v.shoulder).addScaledVector(UP, -1).addScaledVector(rt, 0.6).addScaledVector(fwd, -0.3);
      v.target.copy(offset).applyQuaternion(v.q).add(v.grip);
      for (let pass = 0; pass < 2; pass++) {
        reachWith(b.upperR, b.lowerR, b.right.hand, v.target, v.pole, w);
        orientHand(b.right, v.f, v.n, w);
        if (pass === 0) {
          for (const [j, q] of straight) j.quaternion.copy(q);
          b.right.hand.updateMatrixWorld(true);
          HOLD.curl.forEach((c, f) => curlFinger(b.right, f, c.map((a) => a * w)));
          b.right.thumb[1].getWorldPosition(v.thumbPole).addScaledVector(v.x, 0.04).addScaledVector(v.u, 0.02);
          reachThumb(b.right, v.thumb, v.thumbPole);
        }
        // the wrist is sent on by however far the grip missed the bar (added to where it was sent, not to where it got,
        // so a reach that always falls a little short is made up for)
        gripOf(b.right, v.g);
        v.target.add(v.grip).sub(v.g);
      }
      offset.copy(v.target).sub(v.grip).applyQuaternion(v.q.clone().invert());
      b.upperR.updateMatrixWorld(true);

      // The mug from the hand as it is: settled, it goes wherever the hand has it (so the two can't drift apart).
      if (w < 1) {
        m.position.set(seat.mug.x, seat.mug.y, seat.mug.z);
        m.quaternion.copy(yawQ);
      } else {
        palmNormal(b.right, v.n);
        v.x.copy(v.n).negate();
        b.right.fingers[1][0].getWorldPosition(v.f).sub(b.right.hand.getWorldPosition(v.a)).normalize();
        v.u.crossVectors(v.f, v.n); // the thumb's side
        v.u.addScaledVector(v.x, -v.u.dot(v.x)).normalize();
        v.a.crossVectors(v.x, v.u);
        v.basis.makeBasis(v.x, v.u, v.a);
        gripOf(b.right, v.g);
        m.quaternion.setFromRotationMatrix(v.basis);
        m.position.copy(v.g).sub(new THREE.Vector3(MUG.bar.x, HOLD.gripY, MUG.bar.z).applyQuaternion(m.quaternion));
      }
      // the mug is drawn in the world: given its parent, the pose in its parent's frame
      if (m.parent) {
        v.m.compose(m.position, m.quaternion, v.one).premultiply(v.basis.copy(m.parent.matrixWorld).invert());
        v.m.decompose(m.position, m.quaternion, v.a);
      }
      m.updateMatrixWorld(true);
    },
  };
}

export function useDrinkingHands(scene: THREE.Object3D, seat: Seat) {
  return useMemo(() => createDrinkingHands(scene, seat), [scene, seat]);
}
