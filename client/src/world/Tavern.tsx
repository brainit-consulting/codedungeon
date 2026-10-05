import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Agent } from '../store';
import { theCat } from './Cat';
import { SANS, roundRect, wrap } from './draw';
import { useCanvasTexture, useInteractable } from './interact';
import { RECEPTION } from './layout';
import { Model } from './models';
import { HandPose } from './handPose';
import { RIGGED, SEAT, useRiggedBody } from './RiggedCharacter';
import {
  COUNTER_TOP,
  GREETINGS,
  TAP,
  TAPSTER,
  TAPSTER_BUILD,
  TAPSTER_PAUSE,
  TAVERN_SEATS,
  WIPE_HAND_Y,
  WIPE_LEAN,
  WIPE_S,
  assignSeats,
  chatter,
  drinkAt,
  drinkSeed,
  offDuty,
  tapsterGesture,
  wipeAt,
  type ChatterContext,
  type Seat,
  type TapsterGesture,
} from './tavernRules';
import { findArm, keepHandAbove, leanForward, type ArmBones } from './barReach';
import { onPoke } from './toys/poke';
import { closeFingers, facePalm, findHand, reachWith } from './twoBoneIk';

// The tavern after hours: guild members with nothing on sit at the bar and the feasting tables with a mug, talk, and
// now and then drink, until work calls them back to their benches (Desk.tsx leaves their chair empty meanwhile). Wystan
// the Tapster keeps the bar. When the Overlord is close, one of them says something now and then in a speech bubble;
// E on any of them gets a word straight to you. The rules are in tavernRules.ts; the arm that lifts the mug in twoBoneIk.ts.

// ---------- who sits where ----------

let seated = new Map<string, number>();

/** Off-duty guild members and their seats, kept where they sat as others come and go. Shared with the benches. */
export function useTavernSeats(): Map<string, number> {
  const agents = useStore((s) => s.agents);
  const ids = useMemo(
    () =>
      RIGGED
        ? Object.values(agents)
            .filter(offDuty)
            .map((a) => a.id)
            .sort()
        : [],
    [agents],
  );
  const key = ids.join();
  return useMemo(() => {
    seated = assignSeats(seated, ids);
    return seated;
    // ids is the same list whenever key is
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

// ---------- the speech bubble ----------

const BUBBLE_W = 1.5;
const BUBBLE_H = 0.5;

function Bubble({ text, at }: { text: string; at: [number, number, number] }) {
  const tex = useCanvasTexture(
    600,
    200,
    (ctx) => {
      ctx.fillStyle = '#efe2c4';
      ctx.strokeStyle = '#2a1d14';
      ctx.lineWidth = 6;
      roundRect(ctx, 6, 6, 588, 160, 18);
      ctx.fill();
      ctx.stroke();
      // the tail, down towards the speaker
      ctx.beginPath();
      ctx.moveTo(270, 163);
      ctx.lineTo(300, 196);
      ctx.lineTo(330, 163);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#efe2c4';
      ctx.fillRect(268, 158, 64, 8);
      ctx.fillStyle = '#2a1d14';
      ctx.font = `600 40px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = wrap(ctx, text, 540, 3);
      const top = 86 - ((lines.length - 1) * 46) / 2;
      lines.forEach((l, i) => ctx.fillText(l, 300, top + i * 46));
    },
    [text],
  );
  return (
    <Billboard position={at}>
      {/* drawn over everything (a chandelier in the way would cut the words off); only shown with the Overlord close */}
      <mesh renderOrder={10}>
        <planeGeometry args={[BUBBLE_W, BUBBLE_H]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} depthTest={false} />
      </mesh>
    </Billboard>
  );
}

// ---------- a drinker ----------

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const v = () => new THREE.Vector3();

function Patron({ agent, seat, talking, drinks }: { agent: Agent; seat: Seat; talking: boolean; drinks: boolean }) {
  const { scene, mixer, clips } = useRiggedBody(agent);
  const bones = useMemo(() => {
    const get = (n: string) => scene.getObjectByName(n);
    const [upperL, lowerL, upperR, lowerR, head] = ['upperarm_l', 'lowerarm_l', 'upperarm_r', 'lowerarm_r', 'Head'].map(get);
    const left = findHand(scene, 'l');
    const right = findHand(scene, 'r');
    return upperL && lowerL && upperR && lowerR && head && left && right ? { upperL, lowerL, upperR, lowerR, head, left, right } : null;
  }, [scene]);
  // everything the arms and hands move by hand, put back to the clip's pose before each frame's mixer update
  const pose = useMemo(() => new HandPose(bones ? [bones.upperL, bones.lowerL, bones.upperR, bones.lowerR, ...bones.left.bones, ...bones.right.bones] : []), [bones]);
  const settled = useRef(0);
  const mug = useRef<THREE.Group>(null);
  const seed = useMemo(() => drinkSeed(agent.id), [agent.id]);
  const playing = useRef<{ name: string; action: THREE.AnimationAction } | null>(null);
  const tmp = useMemo(() => ({ target: v(), pole: v(), shoulder: v(), mouth: v(), rest: v(), mug: v(), palm: v() }), []);

  // which way they face, and their right, in the world
  const fwd = useMemo(() => new THREE.Vector3(-Math.sin(seat.yaw), 0, -Math.cos(seat.yaw)), [seat.yaw]);
  const right = useMemo(() => new THREE.Vector3(-fwd.z, 0, fwd.x), [fwd]);
  // the mug turned so its handle (its +x) is on their right
  const mugYaw = seat.yaw;

  useEffect(() => {
    const name = talking ? 'Sitting_Talking_Loop' : 'Sitting_Idle_Loop';
    if (playing.current?.name === name) return;
    const clip = clips.find((c) => c.name === name);
    if (!clip) return;
    const next = mixer.clipAction(clip);
    next.reset();
    if (!playing.current) next.time = (seed % 1000) / 1000 * clip.duration;
    next.fadeIn(0.5).play();
    playing.current?.action.fadeOut(0.5);
    playing.current = { name, action: next };
  }, [talking, clips, mixer, seed]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    pose.undo();
    mixer.update(dt);
    pose.keep();
    scene.updateMatrixWorld(true);
    const m = mug.current;
    if (!bones || !m) return;
    // the arms settle onto the bar or table as they sit down
    settled.current = Math.min(1, settled.current + dt / 0.6);
    const w = settled.current;
    const d = drinks ? drinkAt(clock.elapsedTime, seed) : { weight: 0, toMouth: 0, holding: false, tilt: 0 };

    // The left forearm rests on the bar or the table, hand flat, beside the mug.
    bones.upperL.getWorldPosition(tmp.shoulder);
    tmp.target.set(seat.mug.x, seat.mug.y + 0.03, seat.mug.z).addScaledVector(right, -0.26).addScaledVector(fwd, -0.02);
    tmp.pole.copy(tmp.shoulder).addScaledVector(UP, -1).addScaledVector(right, -0.6).addScaledVector(fwd, -0.3);
    reachWith(bones.upperL, bones.lowerL, bones.left.hand, tmp.target, tmp.pole, w);
    facePalm(bones.left, DOWN, w);
    closeFingers(bones.left, 0.12 * w, 0.05 * w);

    // The right hand keeps hold of the mug's handle: the mug goes from its place to just under the lips (its base, rim
    // at the mouth) and back, and the hand goes with it, palm to the mug and fingers closed round the handle.
    tmp.rest.set(seat.mug.x, seat.mug.y, seat.mug.z);
    tmp.mug.copy(tmp.rest);
    if (d.toMouth > 0) {
      bones.head.getWorldPosition(tmp.mouth).addScaledVector(fwd, 0.18).addScaledVector(UP, -0.17);
      tmp.mug.lerp(tmp.mouth, d.toMouth);
    }
    bones.upperR.getWorldPosition(tmp.shoulder);
    tmp.target.copy(tmp.mug).addScaledVector(UP, 0.085).addScaledVector(right, 0.13).addScaledVector(fwd, -0.06); // the wrist, just behind the handle
    tmp.pole.copy(tmp.shoulder).addScaledVector(UP, -1).addScaledVector(right, 0.6).addScaledVector(fwd, -0.3);
    reachWith(bones.upperR, bones.lowerR, bones.right.hand, tmp.target, tmp.pole, w);
    tmp.palm.copy(right).negate(); // towards the mug
    facePalm(bones.right, tmp.palm, w);
    closeFingers(bones.right, 0.85 * w, 0.45 * w);

    m.position.copy(tmp.mug);
    m.rotation.set(d.tilt * 1.1, mugYaw, 0, 'YXZ'); // tipped back towards them for the sip
  });

  return (
    <>
      <group position={[seat.x, seat.lift, seat.z]} rotation={[0, seat.yaw, 0]}>
        {/* the models face +Z; seated people face -Z in their seat's frame, as at the benches */}
        <primitive object={scene} position={[0, SEAT.lift, -SEAT.forward]} rotation={[0, Math.PI, 0]} />
      </group>
      <group ref={mug}>
        <Model name="props/Mug" />
      </group>
    </>
  );
}

/** Something to aim at: a patron or the tapster, for E. */
function Talkable({ id, label, at, h }: { id: string; label: string; at: [number, number, number]; h: number }) {
  const ref = useInteractable<THREE.Mesh>({ id, label, action: { kind: 'poke', toyId: id } }, 3.6);
  return (
    <mesh ref={ref} position={[at[0], at[1] + h / 2, at[2]]} visible={false}>
      <boxGeometry args={[0.6, h, 0.6]} />
    </mesh>
  );
}

// ---------- the tapster ----------

// a big man with a big red beard (the ranger's body, which has one, without his hood and pauldron), broad and tall
const TAPSTER_LOOK = { id: 'wystan-the-tapster', look: 'masculine' as const, role: 'dev' as const, hair: '#a04a22' };
const NOT_ON_A_TAPSTER = /hood|pauldron/i;

const RAG = new THREE.MeshStandardMaterial({ color: '#8f7d62', roughness: 1 });

/**
 * Wystan: idle behind the bar, and every few seconds a gesture: a reach over the bar, a wipe of it with a rag (leaning
 * over from the waist), or a word with his hands; he talks with them too whenever the Overlord speaks to him. His
 * hands rest on the counter rather than sinking into it (barReach.ts), at his size.
 */
function Tapster({ talking }: { talking: boolean }) {
  const { scene, mixer, clips } = useRiggedBody(TAPSTER_LOOK, 'Male_Ranger');
  useEffect(() => {
    scene.traverse((o) => {
      if (NOT_ON_A_TAPSTER.test(o.name)) o.visible = false;
    });
  }, [scene]);
  const rig = useMemo(
    () => ({ arms: [findArm(scene, 'l'), findArm(scene, 'r')].filter((a): a is ArmBones => !!a), right: findArm(scene, 'r'), hand: findHand(scene, 'r'), waist: scene.getObjectByName('spine_01') ?? null }),
    [scene],
  );
  const acts = useMemo(() => {
    const clip = (name: string) => clips.find((c) => c.name === name);
    const [idle, serve, talk] = [clip('Idle_Loop'), clip('Interact'), clip('Idle_Talking_Loop')].map((c) => (c ? mixer.clipAction(c) : null));
    idle?.play();
    if (serve) {
      serve.setLoop(THREE.LoopOnce, 1);
      serve.clampWhenFinished = false;
    }
    return { idle, serve, talk };
  }, [clips, mixer]);
  const rag = useRef<THREE.Mesh>(null);
  const now = useRef<{ gesture: TapsterGesture | null; since: number; until: number; nextAt: number; wipe: number }>({ gesture: null, since: 0, until: 0, nextAt: 6, wipe: 0 });
  const target = useMemo(() => new THREE.Vector3(), []);
  const pole = useMemo(() => new THREE.Vector3(), []);
  // window.__tapster('wipe' | 'serve' | 'talk', seconds?): a gesture on demand, for checking them (development only)
  const forced = useRef<TapsterGesture | null>(null);
  const forcedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as Record<string, unknown>;
    w.__tapster = (next?: TapsterGesture, seconds?: number) => {
      forcedFor.current = seconds ?? null;
      if (next) Object.assign(now.current, { nextAt: 0, until: 0 }, (forced.current = next) && {});
      return { ...now.current };
    };
    return () => void delete w.__tapster;
  }, []);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const t = clock.elapsedTime;
    const g = now.current;
    const { idle, serve, talk } = acts;
    const to = (from: THREE.AnimationAction | null, next: THREE.AnimationAction | null) => {
      if (!next || !from) return;
      next.reset().fadeIn(0.35).play();
      from.fadeOut(0.35);
    };
    // what he's doing: the Overlord talking to him comes first, then whatever's due
    if (talking && g.gesture !== 'talk' && talk) {
      if (g.gesture === 'serve') to(serve, idle);
      to(idle, talk);
      Object.assign(g, { gesture: 'talk', since: t, until: t + 4 });
    } else if (g.gesture && t >= g.until && !(g.gesture === 'talk' && talking)) {
      if (g.gesture === 'serve') to(serve, idle);
      if (g.gesture === 'talk') to(talk, idle);
      Object.assign(g, { gesture: null, nextAt: forced.current ? t : t + TAPSTER_PAUSE[0] + Math.random() * (TAPSTER_PAUSE[1] - TAPSTER_PAUSE[0]) });
    } else if (!g.gesture && t >= g.nextAt) {
      const next = forced.current ?? tapsterGesture(Math.random());
      forced.current = null;
      if (next === 'serve' && serve) to(idle, serve);
      if (next === 'talk' && talk) to(idle, talk);
      const long = forcedFor.current ?? (next === 'serve' ? (serve?.getClip().duration ?? 2) - 0.35 : next === 'talk' ? (talk?.getClip().duration ?? 3) * 2 : WIPE_S);
      forcedFor.current = null;
      Object.assign(g, { gesture: next, since: t, until: t + long });
    }
    mixer.update(dt);
    scene.updateMatrixWorld(true);

    // wiping: lean over from the waist and scrub along the counter's near edge, palm down on the rag
    g.wipe += ((g.gesture === 'wipe' ? 1 : 0) - g.wipe) * (1 - Math.exp(-dt * 4));
    const arm = rig.right;
    if (g.wipe > 0.002 && arm && rig.waist) {
      leanForward(rig.waist, WIPE_LEAN * g.wipe);
      const p = wipeAt(t - g.since);
      target.set(p.x, COUNTER_TOP.top + WIPE_HAND_Y, p.z);
      arm.lower.getWorldPosition(pole);
      pole.x -= 0.3; // the elbow out to his right
      reachWith(arm.upper, arm.lower, arm.hand, target, pole, g.wipe);
      if (rig.hand) facePalm(rig.hand, DOWN, g.wipe);
    }
    // whatever the clip and the wipe did, his hands rest on the wood rather than in it
    for (const a of rig.arms) keepHandAbove(a, COUNTER_TOP);
    const r = rag.current;
    if (r && arm) {
      r.visible = g.wipe > 0.5;
      arm.hand.getWorldPosition(r.position);
      r.position.y = COUNTER_TOP.top + 0.006;
    }
  });
  // the models face +Z: he faces the room, over the bar
  return (
    <>
      <primitive object={scene} position={[TAP.x, 0, TAP.z]} scale={TAPSTER_BUILD} />
      <mesh ref={rag} material={RAG} visible={false} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.16, 0.012, 0.11]} />
      </mesh>
    </>
  );
}

// ---------- the tavern ----------

const NEAR = 10; // the Overlord this close to the bar hears them
const SAY_S = 5;

function useChatter(): ChatterContext {
  const repos = useStore((s) => s.repos);
  const agents = useStore((s) => s.agents);
  return useMemo(() => {
    const today = new Date().toDateString();
    const all = Object.values(agents);
    return {
      mergedToday: repos.reduce((n, r) => n + r.pulls.filter((p) => p.mergedAt && new Date(p.mergedAt).toDateString() === today).length, 0),
      testing: all.filter((a) => a.role === 'qa' && a.status === 'working' && a.prNumber != null).map((a) => ({ tester: a.name, pr: a.prNumber! })),
      backlog: repos.reduce((n, r) => n + r.issues.length, 0),
      idleChambers: repos.filter((r) => !r.autoAssign && r.issues.length > 0).map((r) => r.fullName.split('/').pop() ?? r.fullName),
      catKills: 0,
    };
  }, [repos, agents]);
}

export function Tavern() {
  const seats = useTavernSeats();
  const agents = useStore((s) => s.agents);
  const ctx = useChatter();
  const [say, setSay] = useState<{ who: string; text: string; until: number } | null>(null);
  const next = useRef(4);
  const last = useRef('');
  const near = useRef(false);
  const clock = useRef(0);
  const sitters = [...seats].filter(([id]) => agents[id]);

  // E on someone: a word straight to the Overlord
  useEffect(() => {
    const offs = sitters.map(([id]) => onPoke(`patron:${id}`, () => setSay({ who: id, text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)], until: clock.current + SAY_S })));
    offs.push(onPoke('tapster', () => setSay({ who: 'tapster', text: TAPSTER.lines[0], until: clock.current + SAY_S })));
    return () => offs.forEach((off) => off());
    // re-registered when who is sitting changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sitters.map(([id]) => id).join()]);

  useFrame(({ clock: c, camera }) => {
    clock.current = c.elapsedTime;
    near.current = Math.hypot(camera.position.x - RECEPTION.x, camera.position.z - (RECEPTION.z + 3)) < NEAR;
    if (say && clock.current > say.until) setSay(null);
    if (!near.current || clock.current < next.current || (say && clock.current < say.until)) return;
    next.current = clock.current + 6 + Math.random() * 5;
    // someone at the tables or the bar says something, now and then the tapster
    const who = sitters.length && Math.random() > 0.2 ? sitters[Math.floor(Math.random() * sitters.length)][0] : 'tapster';
    const pool = who === 'tapster' ? TAPSTER.lines : chatter({ ...ctx, catKills: theCat()?.kills ?? 0 });
    let text = pool[Math.floor(Math.random() * pool.length)];
    if (text === last.current) text = pool[(pool.indexOf(text) + 1) % pool.length];
    last.current = text;
    setSay({ who, text, until: clock.current + SAY_S });
  });

  const bubbleAt = (who: string): [number, number, number] | null => {
    if (who === 'tapster') return [TAP.x, 2.45, TAP.z];
    const s = seats.get(who);
    if (s === undefined) return null;
    const seat = TAVERN_SEATS[s];
    return [seat.x, seat.lift + 1.75, seat.z];
  };
  const at = say ? bubbleAt(say.who) : null;

  if (!RIGGED) return null;
  return (
    <Suspense fallback={null}>
      <Tapster talking={say?.who === 'tapster'} />
      <Talkable id="tapster" label={`Talk to ${TAPSTER.name}`} at={[TAP.x, 0, TAP.z]} h={1.8} />
      {sitters.map(([id, s]) => {
        const seat = TAVERN_SEATS[s];
        return (
          <group key={id}>
            <Patron agent={agents[id]} seat={seat} talking={say?.who === id || (s + Math.floor(clock.current / 9)) % 3 === 0} drinks />
            <Talkable id={`patron:${id}`} label={`Talk to ${agents[id].name}`} at={[seat.x, seat.lift + 0.45, seat.z]} h={0.9} />
          </group>
        );
      })}
      {say && at && <Bubble text={say.text} at={at} />}
    </Suspense>
  );
}
