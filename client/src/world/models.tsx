import { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

// The dungeon's models (client/public/models, built by scripts/build-models.py from the CC0 Quaternius packs).
// Every model in a pack shares a few texture sets, but each .gltf loads its own copy; materials are swapped for one
// shared material per name, so each texture reaches the GPU once. Copies are clones of the loaded scene: cheap,
// sharing geometry and materials.

export type ModelName = `${'props' | 'village'}/${string}`;

const shared = new Map<string, THREE.Material>();

// Grim and moody: the painted textures are bright, so every model's base colour is pulled down and warmed.
const GRIME = new THREE.Color('#7d6f62');

function share(m: THREE.Material): THREE.Material {
  const key = m.name || m.uuid;
  const have = shared.get(key);
  if (have) {
    if (have !== m) m.dispose();
    return have;
  }
  if (m instanceof THREE.MeshStandardMaterial) {
    m.color.multiply(GRIME);
    m.envMapIntensity = 0;
    // glass and the like keep their blending; everything else is opaque, which is cheaper
    if (!m.transparent) m.alphaTest = m.alphaTest || 0;
  }
  shared.set(key, m);
  return m;
}

function prepare(scene: THREE.Object3D): THREE.Object3D {
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(share) : share(mesh.material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  return scene;
}

const url = (name: ModelName) => `/models/${name}.gltf`;

/** A fresh copy of a model's scene, sharing geometry and materials with every other copy. */
export function useModel(name: ModelName): THREE.Object3D {
  const gltf = useGLTF(url(name));
  return useMemo(() => {
    if (!gltf.scene.userData.prepared) {
      prepare(gltf.scene);
      gltf.scene.userData.prepared = true;
    }
    return gltf.scene.clone(true);
  }, [gltf]);
}

/** Load models ahead of time, e.g. everything a room uses, so they don't pop in one by one. */
export const preloadModels = (names: ModelName[]) => names.forEach((n) => useGLTF.preload(url(n)));

type Vec3 = [number, number, number];

function Loaded({ name, position, rotation, scale }: { name: ModelName; position?: Vec3; rotation?: Vec3; scale?: number | Vec3 }) {
  const obj = useModel(name);
  return <primitive object={obj} position={position} rotation={rotation} scale={scale} />;
}

/** One model placed in the world. It pops in when loaded, without holding up anything around it. */
export function Model(props: { name: ModelName; position?: Vec3; rotation?: Vec3; scale?: number | Vec3 }) {
  return (
    <Suspense fallback={null}>
      <Loaded {...props} />
    </Suspense>
  );
}
