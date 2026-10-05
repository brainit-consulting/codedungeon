import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Agent } from '../store';
import { hashId } from './appearance';

// The coders as rigged, animated people (CC0 Quaternius outfits and animations, assembled by
// scripts/build-characters.py), in place of the code-built ones. The default since measuring a full chamber on the
// Overlord's laptop (15 rigged coders: 60 fps, 311 draw calls, 452k triangles at 1919x946). ?cel brings back the
// code-built people; ?rigged=full seats a stand-in at every empty bench, for measuring the worst case.

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
export const RIGGED = !params.has('cel');
export const RIGGED_FULL = params.get('rigged') === 'full';

const VARIANTS = {
  masculine: ['Male_Peasant', 'Male_Ranger'],
  feminine: ['Female_Peasant', 'Female_Ranger'],
} as const;

const url = (name: string) => `/characters/${name}.glb`;

/**
 * Where a rigged coder sits relative to the chair it's drawn in: the animation puts the hips 0.34 m behind the model's
 * origin, so the origin goes this far in front of the chair's centre to put the hips over the seat, and this much
 * lower so the thighs rest on it (measured in Blender: thighs' underside 0.498 m, seat top 0.479 m). The bench is
 * further away than for the code-built people (RIGGED_CHAIR in Desk.tsx) so the knees stay clear of its edge; the
 * writing clip (scripts/build-characters.py) puts the hands on the ledger at exactly this layout.
 */
export const SEAT = { forward: 0.3, lift: -0.015 };
/** How far from the bench's centre the chair goes for rigged coders (code-built ones use 0.8). */
export const RIGGED_CHAIR = 0.95;
const GRIME = new THREE.Color('#8a7c6e');

/** The variants: the coders' and testers' outfits, by look. */
export type Variant = (typeof VARIANTS)[keyof typeof VARIANTS][number];

function variantFor(agent: Agent): string {
  const pool = VARIANTS[agent.look] ?? VARIANTS.masculine;
  // testers and the DungeonMaster wear the ranger's leathers; coders either, by their id
  if (agent.role !== 'dev') return pool[1];
  return pool[hashId(agent.id) % pool.length];
}

/** Materials per variant are shared by every copy; hair is tinted per person, so it gets its own. */
const darkened = new WeakSet<THREE.Material>();
function prepare(scene: THREE.Object3D, hair: string) {
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    m.frustumCulled = false; // animated bones move the mesh outside its bind-pose bounds
    const mat = m.material as THREE.MeshStandardMaterial;
    if (/hair|beard|eyebrow/i.test(mat.name)) {
      const own = mat.clone();
      own.color.set(hair).multiply(GRIME);
      m.material = own;
    } else if (!darkened.has(mat)) {
      mat.color.multiply(GRIME);
      mat.envMapIntensity = 0;
      darkened.add(mat);
    }
  });
}

/**
 * A rigged person's body: their outfit (by look, or the one given), hair tinted, and a mixer for the shared clips
 * (Sitting_Idle_Loop, Sitting_Talking_Loop, Sitting_Writing_Loop, Idle_Loop, Walk_Loop, Interact). Must be inside a
 * Suspense boundary.
 */
export function useRiggedBody(who: { id: string; look: Agent['look']; role: Agent['role']; hair: string }, variant?: Variant) {
  const gltf = useGLTF(url(variant ?? variantFor(who as Agent)));
  const anims = useGLTF(url('animations'));
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    prepare(s, who.hair);
    return s;
  }, [gltf, who.hair]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  useEffect(() => () => void mixer.stopAllAction(), [mixer]);
  return { scene, mixer, clips: anims.animations };
}

function Rigged({ agent }: { agent: Agent }) {
  const { scene, mixer, clips } = useRiggedBody(agent);
  const playing = useRef<THREE.AnimationAction | null>(null);
  const busy = agent.status === 'working' || agent.status === 'preparing';

  useEffect(() => {
    // working: leaning in, writing in the ledger; otherwise sat back, hands in the lap
    const name = busy ? 'Sitting_Writing_Loop' : 'Sitting_Idle_Loop';
    const clip = clips.find((a) => a.name === name);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    // start each person at a different point in the loop, so a room doesn't move in step
    next.reset();
    if (!playing.current) next.time = ((hashId(agent.id) % 1000) / 1000) * clip.duration;
    next.fadeIn(0.4).play();
    playing.current?.fadeOut(0.4);
    playing.current = next;
  }, [busy, clips, mixer, agent.id]);

  useFrame((_, dt) => mixer.update(Math.min(dt, 0.1)));
  // the models face +Z; the coders' chairs face -Z (towards the bench)
  return <primitive object={scene} position={[0, SEAT.lift, -SEAT.forward]} rotation={[0, Math.PI, 0]} />;
}

export function RiggedCharacter({ agent }: { agent: Agent }) {
  return (
    <Suspense fallback={null}>
      <Rigged agent={agent} />
    </Suspense>
  );
}
