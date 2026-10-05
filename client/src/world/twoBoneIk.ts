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
