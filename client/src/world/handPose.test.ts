import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HandPose } from './handPose';

// The wolf's clips pose his bones; Wolf.tsx then nudges a few by hand (breathing, ears, the look). three.js only
// writes a bone when the mixed value changed since the last frame, so what the hand added must be taken off by
// putting back the clip's own last pose, never the bind pose.

const DT = 1 / 60;
// the bind pose is off the path between the two clips' poses, so landing on it can't be mistaken for blending
const BIND = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.8);
const SLEEP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.4);
const YAWN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.0);

function rig() {
  const root = new THREE.Object3D();
  const head = new THREE.Bone();
  head.name = 'Head';
  head.quaternion.copy(BIND);
  root.add(head);
  const track = (q: THREE.Quaternion, times: number[]) =>
    new THREE.QuaternionKeyframeTrack('Head.quaternion', times, times.flatMap(() => q.toArray()));
  // a still clip, as Lie_Sleep is: the same pose at both ends
  const sleep = new THREE.AnimationClip('Lie_Sleep', 2, [track(SLEEP, [0, 2])]);
  // a once clip that ends on the yawn's pose, as Lie_Yawn does
  const yawn = new THREE.AnimationClip('Lie_Yawn', 1, [
    new THREE.QuaternionKeyframeTrack('Head.quaternion', [0, 1], [...SLEEP.toArray(), ...YAWN.toArray()]),
  ]);
  const mixer = new THREE.AnimationMixer(root);
  return { head, mixer, sleep: mixer.clipAction(sleep), yawn: mixer.clipAction(yawn) };
}

/** One frame as Wolf.tsx runs it: take the hand off, let the clips pose, remember that, add the hand. */
function frame(hand: HandPose, mixer: THREE.AnimationMixer, head: THREE.Bone, nudge: number) {
  hand.undo();
  mixer.update(DT);
  hand.keep();
  head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), nudge));
}

describe('bones nudged by hand on top of a clip', () => {
  it('stay in the still clip\'s pose, frame after frame, and the nudges never pile up', () => {
    const { head, mixer, sleep } = rig();
    const hand = new HandPose([head]);
    sleep.play();
    for (let i = 0; i < 120; i++) {
      frame(hand, mixer, head, 0.05);
      hand.undo();
      expect(head.quaternion.angleTo(SLEEP), `frame ${i}`).toBeLessThan(1e-3);
      hand.keep();
    }
  });

  it('fade smoothly from the end of a once clip into a still one: no jumps back to the bind pose', () => {
    const { head, mixer, sleep, yawn } = rig();
    const hand = new HandPose([head]);
    yawn.setLoop(THREE.LoopOnce, 1);
    yawn.clampWhenFinished = true;
    yawn.play();
    for (let i = 0; i < 90; i++) frame(hand, mixer, head, 0);
    expect(head.quaternion.angleTo(YAWN)).toBeLessThan(1e-3); // keyframes are stored as float32
    // the yawn is over: back to sleep over 1.3 s
    sleep.reset().fadeIn(1.3).play();
    yawn.fadeOut(1.3);
    let last = head.quaternion.angleTo(SLEEP);
    for (let i = 0; i < 100; i++) {
      frame(hand, mixer, head, 0);
      const d = head.quaternion.angleTo(SLEEP);
      expect(d, `frame ${i}`).toBeLessThanOrEqual(last + 1e-6);
      expect(head.quaternion.angleTo(BIND), `frame ${i}`).toBeGreaterThan(0.1);
      last = d;
    }
    expect(last).toBeLessThan(1e-3);
  });
});
