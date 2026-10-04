import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { noise, tone } from '../ui/sfx';
import { theCat } from './Cat';
import { HandPose } from './handPose';
import { WOLF, WOLF_RUG } from './layout';
import { Rug } from './Props';
import { createWolf, stepWolf, type Wolf as WolfState, type WolfEnv } from './wolfBrain';
import { wolfSounds } from './wolfSounds';

// The great hall's wolf, asleep on his rug by the hearth (CC0 Quaternius wolf, rigged and given his lying-down clips by
// scripts/build-wolf.py). His brain (wolfBrain.ts) says what he's doing; this plays the matching clip and adds the
// small things on top: his breathing, a sigh, an ear flick, a twitch of the tail, his head turning to look at you, a
// slow blink. His sounds are faint and only heard close by. He has a collider (layout.ts), so you bump into him.

const URL = '/characters/wolf.glb';
/** Lying the first way round, his head points south and a little out into the room; the other way, north. */
const TURN_OUT = 0.25;
const BREATH_HEAR = 2.2;
const SOUND_HEAR = 5;

type ClipName = 'Lie_Sleep' | 'Lie_HeadUp' | 'Lie_Yawn' | 'Stand_Up' | 'Stretch_Yawn' | 'Lie_Down' | 'Idle' | 'Walk';
const ONCE = new Set<ClipName>(['Lie_Yawn', 'Stand_Up', 'Stretch_Yawn', 'Lie_Down']);

/** The clip for what he's doing, and how long (s) to cross-fade into it. */
function clipFor(w: WolfState): [ClipName, number] {
  switch (w.action) {
    case 'stir':
      return w.stir === 'yawn' ? ['Lie_Yawn', 0.4] : ['Lie_Sleep', 0.6];
    case 'look':
      return ['Lie_HeadUp', 0.9];
    case 'glance':
      return ['Lie_HeadUp', 1.1];
    case 'rise':
      return ['Stand_Up', 0.35];
    case 'stretch':
      return ['Stretch_Yawn', 0.3];
    case 'stand':
      return ['Idle', 0.4];
    case 'circle':
      return ['Walk', 0.4];
    case 'lieDown':
      return ['Lie_Down', 0.3];
    default:
      // sleep, settle: head down, a slow fade so lowering it looks unhurried
      return ['Lie_Sleep', 1.3];
  }
}

let living: WolfState | null = null;

/** The world yaw for the brain's yaw: half a turn between his two ways of lying, each turned a little to the room. */
export const wolfHeading = (yaw: number) => yaw + TURN_OUT * Math.cos(yaw);

// ---------- the bones he moves by hand ----------

interface Bones {
  torso: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  ears: [THREE.Bone, THREE.Bone];
  tail: THREE.Bone[];
  eyes: [THREE.Bone, THREE.Bone];
}

function findBones(scene: THREE.Object3D): Bones | null {
  // GLTFLoader drops the dots from Blender's names: Ear1.L is Ear1L
  const get = (n: string) => scene.getObjectByName(n) as THREE.Bone | undefined;
  const need = ['Torso2', 'Torso3', 'Neck3', 'Head', 'Ear1L', 'Ear1R', 'Tail5', 'Tail6', 'Tail7', 'Tail8', 'EyeL', 'EyeR'].map(get);
  if (need.some((b) => !b)) return null;
  const [torso, chest, neck, head, el, er, t5, t6, t7, t8, eyl, eyr] = need as THREE.Bone[];
  return { torso, chest, neck, head, ears: [el, er], tail: [t5, t6, t7, t8], eyes: [eyl, eyr] };
}

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const Z = new THREE.Vector3(0, 0, 1);
const tmpQ = new THREE.Quaternion();
const parentQ = new THREE.Quaternion();
const turnQ = new THREE.Quaternion();

/** Turn a bone about the world's up axis (after the clip has posed it). */
function turnWorld(b: THREE.Bone, angle: number) {
  if (!b.parent || Math.abs(angle) < 1e-5) return;
  b.parent.getWorldQuaternion(parentQ);
  turnQ.setFromAxisAngle(UP, angle);
  tmpQ.copy(parentQ).invert().multiply(turnQ).multiply(parentQ);
  b.quaternion.premultiply(tmpQ);
  b.updateMatrixWorld(true);
}

/** Turn a bone about one of its own axes. */
function turnLocal(b: THREE.Bone, axis: THREE.Vector3, angle: number) {
  if (Math.abs(angle) < 1e-5) return;
  b.quaternion.multiply(tmpQ.setFromAxisAngle(axis, angle));
}

/** 0 -> 1 -> 0 over [a, b] of a 0..1 progress, smoothly. */
const bump = (u: number, a: number, b: number) => (u <= a || u >= b ? 0 : Math.sin(((u - a) / (b - a)) * Math.PI));

// ---------- his sounds (faint; through the shared mixer, so M mutes them) ----------

function breathSound(near: number, deep: boolean) {
  noise({ dur: deep ? 2.2 : 1.6, peak: (deep ? 0.014 : 0.007) * near, filter: 'lowpass', freq: 240, q: 0.7, attack: deep ? 0.9 : 0.6 });
}

function sighSound(near: number, at = 0) {
  noise({ at, dur: 0.7, peak: 0.01 * near, filter: 'lowpass', freq: 300, q: 0.7, attack: 0.5 });
  noise({ at: at + 0.75, dur: 1.3, peak: 0.03 * near, filter: 'lowpass', freq: 520, to: 170, q: 0.8, attack: 0.08 });
}

function yawnSound(near: number, at: number) {
  tone({ at, freq: 520, to: 330, type: 'sine', dur: 0.95, peak: 0.01 * near, attack: 0.15 });
  noise({ at, dur: 0.9, peak: 0.008 * near, filter: 'bandpass', freq: 900, to: 500, q: 0.8, attack: 0.2 });
}

// ---------- the wolf ----------

function WolfBody({ brain }: { brain: React.RefObject<WolfState | null> }) {
  const gltf = useGLTF(URL);
  const camera = useThree((s) => s.camera);
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (!m.isMesh) return;
      m.frustumCulled = false; // the clips move him well outside his bind pose's bounds
      (m.material as THREE.MeshStandardMaterial).envMapIntensity = 0;
    });
    return s;
  }, [gltf]);
  const bones = useMemo(() => findBones(scene), [scene]);
  // The bones nudged by hand on top of the clips (see handPose.ts for why the nudges come off as they do).
  const hand = useMemo(
    () => new HandPose(bones ? [bones.torso, bones.chest, bones.neck, bones.head, ...bones.ears, ...bones.tail, ...bones.eyes] : []),
    [bones],
  );
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const out = {} as Record<ClipName, THREE.AnimationAction>;
    for (const clip of gltf.animations) out[clip.name as ClipName] = mixer.clipAction(clip);
    return out;
  }, [gltf, mixer]);
  const root = useRef<THREE.Group>(null);
  const playing = useRef<{ name: ClipName; started: number } | null>(null);
  useEffect(
    () => () => {
      mixer.stopAllAction();
      playing.current = null; // so whatever mounts next starts its clip afresh
    },
    [mixer],
  );
  const look = useRef({ yaw: 0, weight: 0 });
  const breath = useRef({ phase: 0, next: 0 });
  const heard = useRef(-1); // the brain's started count whose sounds have played
  const at = useMemo(() => new THREE.Vector3(), []);
  const local = useRef(new THREE.Vector3());

  useFrame(({ clock }, rawDt) => {
    const w = brain.current;
    const g = root.current;
    if (!w || !g || !bones) return;
    // nothing to do while the hall isn't drawn
    for (let o: THREE.Object3D | null = g; o; o = o.parent) if (!o.visible) return;
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    g.rotation.y = wolfHeading(w.yaw);

    // the clip: changed when what he's doing changes (a clip played once restarts for each new start)
    const [name, fade] = clipFor(w);
    const was = playing.current;
    if (!was || was.name !== name || (ONCE.has(name) && was.started !== w.started)) {
      const next = actions[name];
      if (next) {
        next.reset();
        if (ONCE.has(name)) {
          next.setLoop(THREE.LoopOnce, 1);
          next.clampWhenFinished = true;
          next.timeScale = next.getClip().duration / Math.max(0.1, w.dur);
        } else {
          next.setLoop(THREE.LoopRepeat, Infinity);
          next.timeScale = name === 'Walk' ? 0.7 : 1;
        }
        next.setEffectiveWeight(1);
        if (was) next.fadeIn(fade);
        next.play();
        if (was && was.name !== name) actions[was.name]?.fadeOut(fade);
        playing.current = { name, started: w.started };
      }
    }
    hand.undo();
    mixer.update(dt);
    hand.keep();
    g.updateMatrixWorld(true);

    const u = w.dur > 0 ? 1 - Math.max(0, w.left) / w.dur : 0;
    // turning round, he steps out from the hearth a little, so his nose clears the chimney breast (and the cat)
    g.position.x = w.action === 'circle' ? 0.3 * bump(u, 0, 1) : 0;
    const lying = w.action === 'sleep' || w.action === 'stir' || w.action === 'look' || w.action === 'glance' || w.action === 'settle';

    // breathing: slow and deep asleep, quicker awake; a sigh is one big breath
    const sighing = (w.action === 'stir' && w.stir === 'sigh') || (w.action === 'glance' && u > 0.65) || w.action === 'settle';
    const period = w.action === 'sleep' || w.action === 'settle' ? 5 : 3.2;
    breath.current.phase += dt / period;
    let swell = Math.sin(breath.current.phase * Math.PI * 2) * (lying ? 0.022 : 0.012);
    if (sighing) swell += bump(w.action === 'glance' ? (u - 0.65) / 0.35 : u, 0, 0.55) * 0.07 - bump(w.action === 'glance' ? (u - 0.65) / 0.35 : u, 0.55, 1) * 0.02;
    const s = 1 + swell;
    bones.torso.scale.x *= s;
    bones.torso.scale.z *= s;
    bones.chest.scale.x /= s;
    bones.chest.scale.z /= s;
    // the sigh's out-breath lowers his head a little
    if (sighing) turnLocal(bones.head, X, bump(w.action === 'glance' ? (u - 0.65) / 0.35 : u, 0.5, 1) * 0.12);

    // stirs: an ear flick (twice, quickly), a twitch of the tail, a shift of the head
    if (w.action === 'stir') {
      if (w.stir === 'ear') {
        const ear = bones.ears[w.started % 2];
        turnLocal(ear, X, -(bump(u, 0.1, 0.35) + bump(u, 0.45, 0.7)) * 0.55);
      } else if (w.stir === 'tail') {
        const k = bump(u, 0, 1);
        bones.tail.forEach((b, i) => turnLocal(b, Z, Math.sin(t * 9 - i * 0.8) * 0.22 * k));
      } else if (w.stir === 'shift') {
        turnLocal(bones.head, Z, bump(u, 0.1, 0.9) * 0.18);
        turnLocal(bones.neck, X, -bump(u, 0.1, 0.9) * 0.1);
      }
    }
    // an ear turns at the sound of footsteps while you're about
    if (w.action === 'look' || (w.band !== 'far' && lying)) turnLocal(bones.ears[1], X, -0.15);

    // looking at you: the head and neck turn towards the camera, so far and no further
    const target = local.current.copy(camera.position);
    g.worldToLocal(target);
    let want = Math.atan2(target.x, target.z);
    let weight = 0;
    if (w.action === 'look' || w.action === 'stand' || (w.action === 'glance' && u < 0.45)) weight = 1;
    if (w.action === 'glance' && u >= 0.45) {
      // ... then away, to the fire (on his fire side), with a sigh
      want = wolfHeading(w.yaw) < Math.PI / 2 ? -0.9 : 0.9;
      weight = 1;
    }
    want = THREE.MathUtils.clamp(want, -1.0, 1.0);
    const L = look.current;
    L.weight += (weight - L.weight) * (1 - Math.exp(-dt * 2.5));
    const step = 1.6 * dt;
    L.yaw += THREE.MathUtils.clamp(want - L.yaw, -step, step);
    turnWorld(bones.neck, L.yaw * L.weight * 0.4);
    turnWorld(bones.head, L.yaw * L.weight * 0.6);

    // eyes: half shut while he glances, a slow blink, and an ordinary blink now and then while awake
    let lid = 1;
    if (w.action === 'glance') lid = 0.55 - bump(u, 0.3, 0.5) * 0.45;
    else if (!lying || w.action === 'look') lid = (t * 0.23) % 1 > 0.97 ? 0.15 : 1;
    for (const e of bones.eyes) e.scale.y *= lid;

    // his breathing, heard only close up (g sits inside the hall's group: measure from where he is in the world)
    const d = camera.position.distanceTo(g.getWorldPosition(at));
    if (w.started !== heard.current) {
      heard.current = w.started;
      const near = Math.max(0, 1 - d / SOUND_HEAR);
      if (near > 0) for (const s of wolfSounds(w)) (s.sound === 'sigh' ? sighSound : yawnSound)(near, s.at);
    }
    if (lying && t >= breath.current.next) {
      breath.current.next = t + period;
      const near = Math.max(0, 1 - d / BREATH_HEAR);
      if (near > 0) breathSound(near, w.action === 'sleep');
    }
  });

  return (
    <group ref={root}>
      <primitive object={scene} />
    </group>
  );
}

export function Wolf() {
  const camera = useThree((s) => s.camera);
  const brain = useRef<WolfState | null>(null);
  const env = useMemo<WolfEnv>(() => ({ at: { x: WOLF.x, z: WOLF.z }, player: { x: 0, z: 0 }, catNear: false }), []);

  useEffect(() => {
    if (!brain.current) brain.current = living ?? createWolf(Math.floor(Math.random() * 1e9));
    living = brain.current;
    if (!import.meta.env.DEV) return;
    // window.__dungeonWolf: a read-only peek for QA; __wolfBrain: his brain itself, to set him doing something (dev only)
    Object.defineProperty(window, '__dungeonWolf', {
      get: () => {
        const w = brain.current;
        return w && { action: w.action, stir: w.stir, left: w.left, band: w.band, yaw: w.yaw, rises: w.rises };
      },
      configurable: true,
    });
    (window as unknown as Record<string, unknown>).__wolfBrain = () => brain.current;
    return () => {
      delete (window as unknown as Record<string, unknown>).__dungeonWolf;
      delete (window as unknown as Record<string, unknown>).__wolfBrain;
    };
  }, []);

  useFrame((_, rawDt) => {
    const w = brain.current;
    if (!w) return;
    env.player!.x = camera.position.x;
    env.player!.z = camera.position.z;
    // the cat asleep at her hearth spot is curled against him
    const c = theCat();
    env.catNear = !!c && c.action === 'sleep' && c.goal?.id === 'hearth' && Math.hypot(c.x - WOLF.x, c.z - WOLF.z) < 1;
    stepWolf(w, Math.min(rawDt, 0.1), env);
  });

  return (
    <>
      <Rug position={[WOLF_RUG.x, 0.006, WOLF_RUG.z]} size={[WOLF_RUG.w, WOLF_RUG.d]} color="#6b4a2e" />
      <group position={[WOLF.x, 0, WOLF.z]}>
        <Suspense fallback={null}>
          <WolfBody brain={brain} />
        </Suspense>
      </group>
    </>
  );
}
