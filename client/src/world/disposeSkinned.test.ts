import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { disposeSkinned } from './disposeSkinned';

/** A minimal copy of a rigged model: one skinned mesh with a two-bone skeleton. */
function body(material = new THREE.MeshStandardMaterial()) {
  const bones = [new THREE.Bone(), new THREE.Bone()];
  bones[0].add(bones[1]);
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), material);
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, mesh };
}

const watch = (thing: THREE.EventDispatcher<{ dispose: object }>) => {
  const seen = { freed: false };
  thing.addEventListener('dispose', () => (seen.freed = true));
  return seen;
};

describe('disposeSkinned', () => {
  it('frees the bone texture the renderer made for each skeleton', () => {
    const { scene, mesh } = body();
    mesh.skeleton.computeBoneTexture(); // what WebGLRenderer does on the first frame
    const tex = watch(mesh.skeleton.boneTexture!);
    disposeSkinned(scene);
    expect(tex.freed).toBe(true);
    expect(mesh.skeleton.boneTexture).toBeNull();
  });

  it('frees the materials the copy owns and leaves shared ones alone', () => {
    const shared = new THREE.MeshStandardMaterial();
    const own = new THREE.MeshStandardMaterial();
    const a = body(shared);
    const b = body(own);
    a.scene.add(b.scene);
    const sharedSeen = watch(shared);
    const ownSeen = watch(own);
    disposeSkinned(a.scene, (m) => m === own);
    expect(ownSeen.freed).toBe(true);
    expect(sharedSeen.freed).toBe(false);
  });

  it('does nothing to a skeleton that never got a bone texture', () => {
    const { scene, mesh } = body();
    expect(() => disposeSkinned(scene)).not.toThrow();
    expect(mesh.skeleton.boneTexture).toBeNull();
  });
});
