import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useStore } from '../store';
import { noise, tone } from '../ui/sfx';
import { letOutRat, letOutSpider, roomForRat, roomForSpider } from './Cat';
import { useInteractable } from './interact';
import type { Spider } from './spiderBrain';
import { chestOpening, type Surprise } from './spoils';
import { onPoke } from './toys/poke';

// The DungeonMaster's chest of spoils, in the hall's trophy corner. E opens it: the lid lifts and the scroll of the
// guild's latest merges comes up (Overlays.tsx, "spoils"); closing that shuts the lid. The very first time it's a mimic
// and snaps at you twice before it opens. Now and then a rat bolts out of it, or a spider climbs out over the rim,
// waits there a moment and jumps down at you (the scroll waits for it). The rules are in spoils.ts.

const URL = '/models/props/Chest_Wood.gltf';
const ID = 'spoils-chest';
const MIMIC_KEY = 'codedungeon:chest-mimic';
/** In the chest's own frame (front +z): where a spider starts, on the gold inside, and the top of the front rim. */
const SPIDER_IN = { y: 0.31, z: 0 };
const SPIDER_RIM = { y: 0.44, z: 0.34 };
/** Where whatever comes out lands, in front of the chest (clear of the trophy corner). */
const OUT_Z = 1.0;

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
  const surpriseOut = useRef(false); // this visit
  /** A spider on its way out, and when it came: the scroll waits until it has landed. */
  const spider = useRef<{ s: Spider; at: number } | null>(null);
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
  const showScroll = () => {
    phase.current = 'open';
    useStore.getState().openOverlay({ kind: 'spoils' });
  };

  useEffect(() => {
    play('Chest_Closed');
    return () => void mixer.stopAllAction();
    // the clips belong to this mixer for its whole life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer]);

  const ref = useInteractable<THREE.Group>({ id: ID, label: 'Open the chest of spoils', action: { kind: 'poke', toyId: ID } });

  useEffect(() => {
    const chestAt = () => {
      const at = new THREE.Vector3();
      ref.current?.getWorldPosition(at);
      return at;
    };
    const openForReal = (surprise: Surprise | null) => {
      phase.current = 'opening';
      opens.current++;
      play('Chest_Open');
      lidCreak();
      if (surprise !== 'spider') later(0.8, showScroll);
      if (surprise === 'rat') {
        surpriseOut.current = true;
        later(0.45, () => {
          const at = chestAt();
          if (letOutRat({ x: at.x, z: at.z + OUT_Z }, { x: at.x, z: at.z })) squeak(); // out of the front, bolting into the hall
        });
      }
      if (surprise === 'spider') {
        surpriseOut.current = true;
        // up over the front rim as the lid lifts, a moment there facing you, then the jump; the scroll waits for it
        later(0.35, () => {
          const at = chestAt();
          const s = letOutSpider({ x: at.x, y: at.y + SPIDER_IN.y, z: at.z + SPIDER_IN.z }, { x: at.x, y: at.y + SPIDER_RIM.y, z: at.z + SPIDER_RIM.z }, { x: at.x, z: at.z + OUT_Z });
          if (s) spider.current = { s, at: clock.current };
          else later(0.45, showScroll);
        });
      }
    };
    const open = () => {
      if (phase.current !== 'shut') return;
      const { mimic, surprise } = chestOpening({
        mimicDone: mimicDone(),
        opens: opens.current,
        surpriseOut: surpriseOut.current,
        roll: Math.random(),
        pick: Math.random(),
        room: { rat: roomForRat(), spider: roomForSpider() },
      });
      if (!mimic) return openForReal(surprise);
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
      later(1.4, () => openForReal(null));
    };
    const off = onPoke(ID, open);
    // window.__spoilsChest: a read-only peek for checking it without seeing it (development only)
    if (import.meta.env.DEV) Object.defineProperty(window, '__spoilsChest', { get: () => ({ phase: phase.current, opens: opens.current, surpriseOut: surpriseOut.current, pending: steps.current.length }), configurable: true });
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
    // play, later and showScroll read refs only
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
    // the spider is down (or, however slowly the frames come, it's been a while): now the scroll
    const sp = spider.current;
    if (sp && ((sp.s.action !== 'climb' && sp.s.action !== 'perch' && sp.s.action !== 'leap') || clock.current - sp.at > 6)) {
      spider.current = null;
      later(0.6, showScroll);
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
