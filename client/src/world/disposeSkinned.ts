// Cleaning up a copy of a rigged model when it leaves the scene. three.js gives every copied skeleton its own bone
// texture on the graphics card and never frees it by itself, so each body that went (a coder walking from the tavern
// to their bench, say) left one behind: about 70 a minute in a busy demo, and gigabytes over an evening.
import type * as THREE from 'three';

/** Frees each skeleton's bone texture in `scene`, and the materials `owns` says belong to this copy alone. */
export function disposeSkinned(scene: THREE.Object3D, owns: (m: THREE.Material) => boolean = () => false) {
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh) m.skeleton.dispose(); // the renderer makes a new one if the body is drawn again
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) if (owns(mat)) mat.dispose();
  });
}
