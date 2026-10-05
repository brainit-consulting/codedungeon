import * as THREE from 'three';
import { reachWith } from './twoBoneIk';

// Hands that rest on a surface instead of sinking into it. After a clip has posed an arm, if the hand or a fingertip
// would be below the top of what it's over, the arm is bent (two-bone IK) just enough to lift it onto the top.
// Wystan's reach over the bar uses it (Tavern.tsx); barReach.test.ts plays his clips at his build to prove it.

export interface Top {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Height of the top (m). */
  top: number;
}

export interface ArmBones {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  hand: THREE.Object3D;
  /** The fingertips and the thumb's tip: what touches first. */
  tips: THREE.Object3D[];
}

/** The rig's arm by side ('l' or 'r'). */
export function findArm(root: THREE.Object3D, side: 'l' | 'r'): ArmBones | null {
  const get = (n: string) => root.getObjectByName(`${n}_${side}`);
  const [upper, lower, hand] = [get('upperarm'), get('lowerarm'), get('hand')];
  const tips = ['index', 'middle', 'ring', 'pinky', 'thumb'].map((f) => get(`${f}_04_leaf`));
  if (!upper || !lower || !hand || tips.some((t) => !t)) return null;
  return { upper, lower, hand, tips: tips as THREE.Object3D[] };
}

/** How far (m) the lowest of these points over the surface is below its top plus `clear`; 0 when they're all clear. */
export function sinkBelow(points: THREE.Vector3[], s: Top, clear = 0.008): number {
  let worst = 0;
  for (const p of points) if (p.x > s.minX && p.x < s.maxX && p.z > s.minZ && p.z < s.maxZ) worst = Math.max(worst, s.top + clear - p.y);
  return worst;
}

const q = new THREE.Quaternion();
const qWorld = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const PLUS_Z = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();

/**
 * Lean a body forward from this spine bone by `angle` (radians) on top of the clip's pose, toward `facing` (world, level;
 * +Z by default, the way the rigged models face): a turn about the axis square to both up and the facing.
 */
export function leanForward(spine: THREE.Object3D, angle: number, facing: THREE.Vector3 = PLUS_Z) {
  if (angle === 0) return;
  q.setFromAxisAngle(axis.crossVectors(UP, facing).normalize(), angle);
  spine.getWorldQuaternion(qWorld).premultiply(q);
  if (spine.parent) qWorld.premultiply(spine.parent.getWorldQuaternion(qParent).invert());
  spine.quaternion.copy(qWorld);
  spine.updateMatrixWorld(true);
}

const pts = Array.from({ length: 6 }, () => new THREE.Vector3());
const target = new THREE.Vector3();
const pole = new THREE.Vector3();

/** Lift the hand onto the surface if it would sink into it, keeping the elbow's bend. Returns how far it was lifted. */
export function keepHandAbove(arm: ArmBones, s: Top): number {
  let lifted = 0;
  // the hand turns a little as the arm bends, so a second pass settles the fingertips
  for (let pass = 0; pass < 3; pass++) {
    [arm.hand, ...arm.tips].forEach((b, i) => b.getWorldPosition(pts[i]));
    const lift = sinkBelow(pts, s);
    if (lift < 0.001) break;
    arm.hand.getWorldPosition(target);
    target.y += lift;
    arm.lower.getWorldPosition(pole);
    pole.y -= 0.3;
    reachWith(arm.upper, arm.lower, arm.hand, target, pole, 1);
    arm.upper.updateMatrixWorld(true);
    lifted += lift;
  }
  return lifted;
}
