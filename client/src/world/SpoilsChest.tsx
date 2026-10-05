import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useStore } from '../store';
import { noise, tone } from '../ui/sfx';
import { letOutRat } from './Cat';
import { useInteractable } from './interact';
import { chestOpening } from './spoils';
import { onPoke } from './toys/poke';

// The DungeonMaster's chest of spoils, in the hall's trophy corner. E opens it: the lid lifts and the scroll of the
// guild's latest merges comes up (Overlays.tsx, "spoils"); closing that shuts the lid. The very first time it's a mimic
// and snaps at you twice before it opens, and now and then a rat bolts out of it. The rules are in spoils.ts.

const URL = '/models/props/Chest_Wood.gltf';
const ID = 'spoils-chest';
const MIMIC_KEY = 'codedungeon:chest-mimic';

type Clip = 'Chest_Open' | 'Chest_Close' | 'Chest_Closed';
type Phase = 'shut' | 'snapping' | 'opening' | 'open' | 'closing';

function mimicDone(): boolean {
  try {
    return localStorage.getItem(MIMIC_KEY) === 'done';
  } catch {
    return true; // no storage (a private window): skip the joke rather than play it on every visit
  }
}
function markMimicDone() {
  try {
    localStorage.setItem(MIMIC_KEY, 'done');
  } catch {
    // nothing to remember it in
  }
}

/** Old hinges: a short wooden groan. */
function lidCreak() {
  tone({ freq: 190, to: 120, type: 'sawtooth', dur: 0.45, peak: 0.02, attack: 0.05 });
  noise({ dur: 0.4, peak: 0.008, filter: 'bandpass', freq: 1100, q: 5 });
}
/** The lid banging shut: a thump and a clack. */
function lidThump(peak = 1) {
  tone({ freq: 95, to: 45, type: 'sine', dur: 0.22, peak: 0.08 * peak, attack: 0.004 });
  noise({ dur: 0.08, peak: 0.05 * peak, filter: 'lowpass', freq: 900 });
}
/** A rat's squeak as it bolts. */
function squeak() {
  tone({ freq: 2600, to: 3400, type: 'triangle', dur: 0.09, peak: 0.02 });
  tone({ at: 0.13, freq: 3000, to: 2400, type: 'triangle', dur: 0.08, peak: 0.016 });
}

export function SpoilsChest({ position }: { position: [number, number, number] }) {
  const gltf = useGLTF(URL);
  const scene = useMemo(() => {
    const s = cloneSkinned(gltf.scene);
    s.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.frustumCulled = false; // the lid swings outside the bind pose's bounds
    });
    return s;
  }, [gltf]);
  const mixer = useMemo(() => new THREE.AnimationMixer(scene), [scene]);
  const actions = useMemo(() => {
    const out = {} as Record<Clip, THREE.AnimationAction>;
    for (const clip of gltf.animations) {
      const a = mixer.clipAction(clip);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      out[clip.name as Clip] = a;
    }
    return out;
  }, [gltf, mixer]);

  const phase = useRef<Phase>('shut');
  const opens = useRef(0); // this visit
  const ratOut = useRef(false);
  const steps = useRef<{ at: number; run: () => void }[]>([]);
  const clock = useRef(0);
  const shakeUntil = useRef(0);
  const inner = useRef<THREE.Group>(null);

  const play = (clip: Clip, speed = 1) => {
    for (const a of Object.values(actions)) if (a !== actions[clip]) a.stop();
    const a = actions[clip];
    if (!a) return;
    a.reset();
    a.timeScale = speed;
    a.play();
  };
  const later = (sec: number, run: () => void) => steps.current.push({ at: clock.current + sec, run });

  useEffect(() => {
    play('Chest_Closed');
    return () => void mixer.stopAllAction();
    // the clips belong to this mixer for its whole life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer]);

  const ref = useInteractable<THREE.Group>({ id: ID, label: 'Open the chest of spoils', action: { kind: 'poke', toyId: ID } });

  useEffect(() => {
    const openForReal = (rat: boolean) => {
      phase.current = 'opening';
      opens.current++;
      play('Chest_Open');
      lidCreak();
      if (rat) {
        ratOut.current = true;
        later(0.45, () => {
          const at = new THREE.Vector3();
          ref.current?.getWorldPosition(at);
          if (letOutRat({ x: at.x, z: at.z + 1.0 }, { x: at.x, z: at.z })) squeak(); // out of the front (clear of the trophy corner), bolting into the hall
        });
      }
      later(0.8, () => {
        phase.current = 'open';
        useStore.getState().openOverlay({ kind: 'spoils' });
      });
    };
    const open = () => {
      if (phase.current !== 'shut') return;
      const { mimic, rat } = chestOpening({ mimicDone: mimicDone(), opens: opens.current, ratOut: ratOut.current, roll: Math.random() });
      if (!mimic) return openForReal(rat);
      // the mimic: two quick bites, a shake, then it thinks better of it and opens
      markMimicDone();
      phase.current = 'snapping';
      for (const t of [0, 0.5]) {
        later(t, () => play('Chest_Open', 3.5));
        later(t + 0.22, () => {
          play('Chest_Close', 4);
          lidThump(1);
          shakeUntil.current = clock.current + 0.35;
        });
      }
      later(1.4, () => openForReal(false));
    };
    const off = onPoke(ID, open);
    // window.__spoilsChest: a read-only peek for checking it without seeing it (development only)
    if (import.meta.env.DEV) Object.defineProperty(window, '__spoilsChest', { get: () => ({ phase: phase.current, opens: opens.current, ratOut: ratOut.current, pending: steps.current.length }), configurable: true });
    // the scroll of spoils closed: shut the lid
    const unsub = useStore.subscribe((s, p) => {
      if (p.overlay?.kind === 'spoils' && s.overlay?.kind !== 'spoils' && phase.current === 'open') {
        phase.current = 'closing';
        play('Chest_Close');
        later(0.55, () => lidThump(0.4));
        later(0.7, () => (phase.current = 'shut'));
      }
    });
    return () => {
      off();
      unsub();
    };
    // play and later read refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    clock.current = state.clock.elapsedTime; // the steps keep real time, however slowly the frames come
    if (steps.current.length) {
      const due = steps.current.filter((s) => s.at <= clock.current);
      steps.current = steps.current.filter((s) => s.at > clock.current);
      for (const s of due) s.run();
    }
    mixer.update(dt);
    const g = inner.current;
    if (g) g.rotation.z = clock.current < shakeUntil.current ? Math.sin(clock.current * 70) * 0.035 : 0;
  });

  return (
    <group ref={ref} position={position}>
      <group ref={inner}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

useGLTF.preload(URL);
