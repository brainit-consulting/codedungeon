import type * as THREE from 'three';

// Bones that clips pose and code then nudges by hand (the wolf's breathing, ears, tail, look and eyelids).
//
// The nudges must come off again before the mixer runs, or they pile up frame after frame. They come off by putting
// back the pose the clips left last frame, not the bind pose: three.js's mixer writes a bone only when the blended
// value changed since it last wrote it, so a still clip, or a once clip held on its last frame, leaves the bone alone,
// and a bone reset to its bind pose would stay there (seen in the hall as the head flicking between the bind pose and
// the clip's while the yawn faded into sleep; handPose.test.ts reproduces it).

export class HandPose {
  private saved: { b: THREE.Object3D; q: THREE.Quaternion; s: THREE.Vector3 }[];

  constructor(bones: THREE.Object3D[]) {
    this.saved = bones.map((b) => ({ b, q: b.quaternion.clone(), s: b.scale.clone() }));
  }

  /** Take the hand's nudges off again, before the mixer runs. */
  undo() {
    for (const h of this.saved) {
      h.b.quaternion.copy(h.q);
      h.b.scale.copy(h.s);
    }
  }

  /** Remember the pose the clips left, right after the mixer runs and before the nudges go on. */
  keep() {
    for (const h of this.saved) {
      h.q.copy(h.b.quaternion);
      h.s.copy(h.b.scale);
    }
  }
}
