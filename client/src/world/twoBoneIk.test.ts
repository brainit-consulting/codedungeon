// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { reachWith } from './twoBoneIk';

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
