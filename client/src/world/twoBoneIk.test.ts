// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { closeFingers, facePalm, findHand, palmNormal, reachWith } from './twoBoneIk';

/** A shoulder with an upper arm 0.3 long and a forearm 0.27 long, hanging straight down, under a turned parent. */
function arm() {
  const body = new THREE.Object3D();
  body.rotation.set(0.2, 1.1, -0.1); // the rig's bones are never axis-aligned
  body.position.set(1, 1.2, -2);
  const upper = new THREE.Object3D();
  const lower = new THREE.Object3D();
  const hand = new THREE.Object3D();
  body.add(upper);
  upper.add(lower);
  lower.add(hand);
  lower.position.set(0, -0.3, 0);
  hand.position.set(0, -0.27, 0);
  body.updateMatrixWorld(true);
  return { body, upper, lower, hand };
}
const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());

describe('reachWith', () => {
  it('puts the hand on a target within reach', () => {
    const a = arm();
    const shoulder = world(a.upper);
    const target = shoulder.clone().add(new THREE.Vector3(0.25, 0.2, -0.2));
    reachWith(a.upper, a.lower, a.hand, target, shoulder.clone().add(new THREE.Vector3(0, -1, 0)), 1);
    expect(world(a.hand).distanceTo(target)).toBeLessThan(0.005);
  });

  it('keeps the bones their length', () => {
    const a = arm();
    const shoulder = world(a.upper);
    reachWith(a.upper, a.lower, a.hand, shoulder.clone().add(new THREE.Vector3(0.1, 0.35, -0.15)), shoulder.clone().add(new THREE.Vector3(0.3, -1, 0)), 1);
    expect(world(a.upper).distanceTo(world(a.lower))).toBeCloseTo(0.3, 3);
    expect(world(a.lower).distanceTo(world(a.hand))).toBeCloseTo(0.27, 3);
  });

  it('bends the elbow towards the pole', () => {
    const a = arm();
    const shoulder = world(a.upper);
    const pole = shoulder.clone().add(new THREE.Vector3(0, -1, 0));
    reachWith(a.upper, a.lower, a.hand, shoulder.clone().add(new THREE.Vector3(0, 0.3, -0.3)), pole, 1);
    expect(world(a.lower).y).toBeLessThan(shoulder.y + 0.05);
  });

  it('points a straight arm at a target out of reach', () => {
    const a = arm();
    const shoulder = world(a.upper);
    const far = shoulder.clone().add(new THREE.Vector3(2, 0, 0));
    reachWith(a.upper, a.lower, a.hand, far, shoulder.clone().add(new THREE.Vector3(0, -1, 0)), 1);
    const dir = world(a.hand).sub(shoulder).normalize();
    expect(dir.x).toBeGreaterThan(0.99);
  });

  it('leaves the arm as it was at weight 0', () => {
    const a = arm();
    const before = world(a.hand);
    reachWith(a.upper, a.lower, a.hand, before.clone().add(new THREE.Vector3(0.3, 0.3, 0)), before, 0);
    expect(world(a.hand).distanceTo(before)).toBeLessThan(1e-6);
  });
});

/**
 * A right hand: fingers along the hand's +y, spread across x, the thumb set forward (+z) on the palm side, under a
 * turned forearm. Returns the bones by name, as findHand would.
 */
function handRig() {
  const arm = new THREE.Object3D();
  arm.rotation.set(0.4, -0.7, 0.3);
  arm.position.set(0.5, 1.1, -2.4);
  const hand = new THREE.Object3D();
  hand.name = 'hand_r';
  arm.add(hand);
  const finger = (name: string, x: number, z: number) => {
    let parent: THREE.Object3D = hand;
    const bones: THREE.Object3D[] = [];
    for (let i = 1; i <= 4; i++) {
      const b = new THREE.Object3D();
      b.name = i === 4 ? `${name}_04_leaf_r` : `${name}_0${i}_r`;
      b.position.set(i === 1 ? x : 0, i === 1 ? 0.09 : 0.03, i === 1 ? z : 0);
      parent.add(b);
      bones.push(b);
      parent = b;
    }
    return bones;
  };
  finger('index', 0.03, 0);
  finger('middle', 0.01, 0);
  finger('ring', -0.01, 0);
  finger('pinky', -0.03, 0);
  finger('thumb', 0.035, 0.03);
  arm.updateMatrixWorld(true);
  return { arm, hand: findHand(arm, 'r')! };
}
const toWorldDir = (o: THREE.Object3D, v: THREE.Vector3) => v.clone().applyQuaternion(o.getWorldQuaternion(new THREE.Quaternion())).normalize();

describe('the hand', () => {
  it('finds every finger', () => {
    const { hand } = handRig();
    expect(hand.fingers).toHaveLength(4);
    expect(hand.thumb).toHaveLength(3);
  });

  it('knows which way the palm faces: the thumb side', () => {
    const { hand } = handRig();
    const n = palmNormal(hand, new THREE.Vector3());
    expect(n.dot(toWorldDir(hand.hand, new THREE.Vector3(0, 0, 1)))).toBeGreaterThan(0.95);
  });

  it('turns the palm to face a direction, keeping the fingers pointing the same way', () => {
    const { hand } = handRig();
    const knuckle = hand.fingers[1][0]; // the line the hand is turned about
    const fingersBefore = knuckle.getWorldPosition(new THREE.Vector3()).sub(hand.hand.getWorldPosition(new THREE.Vector3())).normalize();
    const want = new THREE.Vector3(1, -0.2, 0.3).normalize();
    facePalm(hand, want, 1);
    const n = palmNormal(hand, new THREE.Vector3());
    const flat = want.clone().addScaledVector(fingersBefore, -want.dot(fingersBefore)).normalize();
    expect(n.dot(flat)).toBeGreaterThan(0.98);
    const fingersAfter = knuckle.getWorldPosition(new THREE.Vector3()).sub(hand.hand.getWorldPosition(new THREE.Vector3())).normalize();
    expect(fingersAfter.dot(fingersBefore)).toBeGreaterThan(0.999);
  });

  it('closes the fingers towards the palm', () => {
    const { hand } = handRig();
    const n = palmNormal(hand, new THREE.Vector3());
    const palm = hand.hand.getWorldPosition(new THREE.Vector3());
    const tip = () => hand.fingers[2][3].getWorldPosition(new THREE.Vector3()).sub(palm).dot(n);
    const open = tip();
    closeFingers(hand, 0.6, 0.3);
    expect(tip()).toBeGreaterThan(open + 0.03);
  });
});
