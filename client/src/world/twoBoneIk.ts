import * as THREE from 'three';

// Two-bone reaching (shoulder, elbow, hand) for a rigged arm: the tavern's drinkers lift their mugs with it. It works
// in world space, aiming each bone at where its child should be, so it doesn't care how the rig's bones are oriented.

const A = new THREE.Vector3();
const B = new THREE.Vector3();
const C = new THREE.Vector3();
const T = new THREE.Vector3();
const E = new THREE.Vector3();
const toT = new THREE.Vector3();
const bend = new THREE.Vector3();
const from = new THREE.Vector3();
const to = new THREE.Vector3();
const q = new THREE.Quaternion();
const qWorld = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const start = new THREE.Quaternion();
const startLower = new THREE.Quaternion();

/** Turn `bone` (in world space) so the direction from it to `child`'s current position points along `dir`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  bone.getWorldPosition(from);
  child.getWorldPosition(to);
  to.sub(from).normalize();
  q.setFromUnitVectors(to, dir);
  bone.getWorldQuaternion(qWorld);
  qWorld.premultiply(q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(qParent);
    qWorld.premultiply(qParent.invert());
  }
  bone.quaternion.copy(qWorld);
  bone.updateMatrixWorld(true);
}

/**
 * Move the arm so the hand reaches `target`, with the elbow bending towards `pole` (both in world space). `weight`
 * blends from the arm's current pose (0) to the full reach (1). A target out of reach gets a straight arm pointing at it.
 */
export function reachWith(upper: THREE.Object3D, lower: THREE.Object3D, hand: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, weight: number) {
  if (weight <= 0) return;
  start.copy(upper.quaternion);
  startLower.copy(lower.quaternion);
  upper.updateMatrixWorld(true);
  upper.getWorldPosition(A);
  lower.getWorldPosition(B);
  hand.getWorldPosition(C);
  T.copy(target);
  const a = A.distanceTo(B);
  const b = B.distanceTo(C);
  toT.subVectors(T, A);
  const d = Math.min(Math.max(toT.length(), Math.abs(a - b) + 1e-4), a + b - 1e-4);
  toT.normalize();

  // where the elbow goes: on the circle the two bone lengths allow, on the pole's side of the line to the target
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  bend.subVectors(pole, A);
  bend.addScaledVector(toT, -bend.dot(toT));
  if (bend.lengthSq() < 1e-8) bend.set(0, -1, 0).addScaledVector(toT, -toT.y); // pole on the line: elbow down
  bend.normalize();
  E.copy(A).addScaledVector(toT, cosA * a).addScaledVector(bend, sinA * a);

  aim(upper, lower, E.sub(A).normalize());
  lower.getWorldPosition(B);
  aim(lower, hand, T.sub(B).normalize());

  if (weight < 1) {
    upper.quaternion.copy(start.slerp(upper.quaternion, weight));
    lower.quaternion.copy(startLower.slerp(lower.quaternion, weight));
    upper.updateMatrixWorld(true);
  }
}

// ---------- the hand: which way the palm faces, turning it, closing the fingers ----------

export interface HandBones {
  hand: THREE.Object3D;
  /** index, middle, ring, pinky: three joints each, then the tip. */
  fingers: THREE.Object3D[][];
  /** The thumb's three joints (its tip is the third's child). */
  thumb: THREE.Object3D[];
  /** Every bone the hand moves, for putting the clip's pose back each frame (HandPose). */
  bones: THREE.Object3D[];
}

/** The rig's hand by side ('l' or 'r'): hand_r, index_01_r … pinky_04_leaf_r, thumb_01_r …. */
export function findHand(root: THREE.Object3D, side: 'l' | 'r'): HandBones | null {
  const get = (n: string) => root.getObjectByName(`${n}_${side}`);
  const hand = get('hand');
  const chain = (f: string) => ['01', '02', '03', '04_leaf'].map((i) => get(`${f}_${i}`));
  const fingers = ['index', 'middle', 'ring', 'pinky'].map(chain);
  const thumb = chain('thumb');
  if (!hand || fingers.some((c) => c.some((b) => !b)) || thumb.some((b) => !b)) return null;
  const f = fingers as THREE.Object3D[][];
  const t = thumb as THREE.Object3D[];
  return { hand, fingers: f, thumb: t.slice(0, 3), bones: [hand, ...f.flatMap((c) => c.slice(0, 3)), ...t.slice(0, 3)] };
}

const P1 = new THREE.Vector3();
const P2 = new THREE.Vector3();
const P3 = new THREE.Vector3();
const F = new THREE.Vector3();
const axis = new THREE.Vector3();

/** Out of the palm, the way the fingers close: the side the thumb is on, square to the fingers. */
export function palmNormal(h: HandBones, out: THREE.Vector3): THREE.Vector3 {
  h.hand.getWorldPosition(P1);
  h.fingers[0][0].getWorldPosition(P2);
  h.fingers[3][0].getWorldPosition(P3);
  P2.sub(P3); // across the knuckles, index to pinky
  h.fingers[1][0].getWorldPosition(P3);
  F.subVectors(P3, P1).normalize(); // along the hand
  out.crossVectors(P2, F).normalize();
  h.thumb[2].getWorldPosition(P3);
  if (P3.sub(P1).dot(out) < 0) out.negate();
  return out;
}

/** Turn the bone about a world axis through its own origin by `angle`, in world space. */
function turn(bone: THREE.Object3D, worldAxis: THREE.Vector3, angle: number) {
  q.setFromAxisAngle(worldAxis, angle);
  bone.getWorldQuaternion(qWorld);
  qWorld.premultiply(q);
  if (bone.parent) {
    bone.parent.getWorldQuaternion(qParent);
    qWorld.premultiply(qParent.invert());
  }
  bone.quaternion.copy(qWorld);
  bone.updateMatrixWorld(true);
}

/** Roll the hand about the line of its fingers so the palm faces `want` (world) as nearly as it can, by `weight`. */
export function facePalm(h: HandBones, want: THREE.Vector3, weight: number) {
  if (weight <= 0) return;
  h.hand.updateMatrixWorld(true);
  h.hand.getWorldPosition(P1);
  h.fingers[1][0].getWorldPosition(F);
  F.sub(P1).normalize();
  palmNormal(h, P2);
  P3.copy(want).addScaledVector(F, -want.dot(F));
  if (P3.lengthSq() < 1e-8) return;
  P3.normalize();
  axis.crossVectors(P2, P3);
  const angle = Math.atan2(axis.dot(F), P2.dot(P3));
  turn(h.hand, F, angle * weight);
}

/** Close the fingers by `amount` radians at each joint (the thumb by `thumbAmount`), each bending towards the palm. */
export function closeFingers(h: HandBones, amount: number, thumbAmount: number) {
  if (amount <= 0 && thumbAmount <= 0) return;
  h.hand.updateMatrixWorld(true);
  const n = palmNormal(h, new THREE.Vector3());
  const bend = (chain: THREE.Object3D[], tip: THREE.Object3D, a: number) => {
    for (let i = 0; i < chain.length; i++) {
      const next = i + 1 < chain.length ? chain[i + 1] : tip;
      chain[i].getWorldPosition(P1);
      next.getWorldPosition(F);
      F.sub(P1).normalize();
      axis.crossVectors(F, n);
      if (axis.lengthSq() < 1e-8) continue;
      turn(chain[i], axis.normalize(), a);
    }
  };
  for (const f of h.fingers) bend(f.slice(0, 3), f[3], amount);
  const thumbTip = h.thumb[2].children[0] ?? h.thumb[2];
  bend(h.thumb, thumbTip, thumbAmount);
}
