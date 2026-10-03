import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody, useBeforePhysicsStep, useRapier, type RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useStore } from '../../store';
import { noise } from '../../ui/sfx';
import { useInteractable } from '../interact';
import { DART_BOARD, HALF_D, HALF_W } from '../layout';
import { DartBoardLook, DartLook, TallyLook } from './DartBoardLook';
import { BOARD, DARTS_PER_ROUND, MISS, bestRound, emptyRound, roundTotal, scoreAt, throwInto, type Round, type Score } from './dartboard';
import { collectDarts, takeCollect, takeThrows } from './hands';
import { setDartsSource } from './probe';

// The dungeon's darts, inside the toy world's <Physics> (ToyWorld.tsx): three darts that live on the board's ledge,
// in your hand, in flight, stuck in the board, or loose wherever they fell. Only the board holds a dart; anything
// else (stone, wood, people) knocks it down. Each dart scores once, when it sticks or falls.

const STEP = 1 / 60;
const UP = new THREE.Vector3(0, 1, 0);
const ZERO = { x: 0, y: 0, z: 0 };
// Capsule radius and half-length, the tip's reach from the centre, flight damping, how deep a stuck tip sinks in,
// and below what speed or past what turn a dart in flight counts as having hit something.
const DART = { r: 0.012, half: 0.06, tip: 0.085, embed: 0.02, slow: 1.5 };
/** Speed of a tapped and of a fully charged throw (m/s). */
const SPEED = { tap: 4, full: 12 };
/** A dart sticks if it meets the board this square-on (cosine against the board's normal) and this fast. */
const STICK = { minCos: Math.cos((55 * Math.PI) / 180), minSpeed: 2.5 };
const COLLECT_RANGE = 4;
// Where the darts leave from: a little right of and below your eye.
const HAND = new THREE.Vector3(0.18, -0.16, -0.35);
const BOARD_Z = DART_BOARD.wall - 0.05; // the board's face; it sits on a 5 cm backing against the wall
const BEST_KEY = 'codedungeon:darts-best';

type Where = 'ledge' | 'hand' | 'flying' | 'stuck' | 'loose';

interface Dart {
  slot: number;
  where: Where;
  body: RapierRigidBody | null;
  dir: THREE.Vector3;
}

/** Board coordinates (+x right, +y up as you face it) of a world point on the board's face. Facing south, right is -x. */
export const toBoard = (p: { x: number; y: number }) => ({ x: -(p.x - DART_BOARD.x), y: p.y - BOARD.height });

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(n: number) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    // private window or blocked storage: the best lasts until reload
  }
}

const escaped = (p: { x: number; y: number; z: number }) => Math.abs(p.x) > HALF_W + 1 || Math.abs(p.z) > HALF_D + 1 || p.y < -0.5 || p.y > 6;

export function HandDarts({ groups }: { groups: number }) {
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera);
  const darts = useRef<Dart[]>(Array.from({ length: DARTS_PER_ROUND }, (_, slot) => ({ slot, where: 'ledge' as Where, body: null, dir: new THREE.Vector3() })));
  const boardBody = useRef<RapierRigidBody>(null);
  const [round, setRound] = useState<Round>(emptyRound);
  const [best, setBest] = useState(loadBest);
  const roundRef = useRef(round);
  roundRef.current = round;
  const [ledge, setLedge] = useState(DARTS_PER_ROUND); // re-renders the ledge when darts come back to it
  const tmp = useMemo(() => ({ fwd: new THREE.Vector3(), from: new THREE.Vector3(), aim: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), p: new THREE.Vector3() }), []);
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }), [rapier]);
  const meshes = useRef<(THREE.Group | null)[]>([]);

  const count = (w: Where) => darts.current.filter((d) => d.where === w).length;

  const score = useCallback((s: Score) => {
    const next = throwInto(roundRef.current, s);
    roundRef.current = next;
    setRound(next);
    setBest((b) => {
      const nb = bestRound(b, next);
      if (nb !== b) saveBest(nb);
      return nb;
    });
  }, []);

  const removeBody = useCallback(
    (d: Dart) => {
      if (d.body) world.removeRigidBody(d.body);
      d.body = null;
    },
    [world],
  );

  // Registered for window.__swarmToys.
  useEffect(() => {
    setDartsSource(() => ({
      hand: count('hand'),
      ledge: count('ledge'),
      flying: count('flying'),
      stuck: count('stuck'),
      loose: count('loose'),
      board: { throws: roundRef.current.throws.map((t) => t.label), total: roundTotal(roundRef.current), best: loadBest() },
    }));
    return () => {
      setDartsSource(null);
      for (const d of darts.current) d.body = null; // the world (and every body in it) goes with <Physics>
      if (useStore.getState().held) useStore.getState().setHeld(null);
    };
  }, []);

  const tumble = useCallback(
    (d: Dart) => {
      d.where = 'loose';
      d.body?.setGravityScale(1, true);
      d.body?.setLinearDamping(0.4);
      d.body?.setAngularDamping(0.8);
      noise({ dur: 0.05, peak: 0.03, filter: 'bandpass', freq: 2400, q: 3 });
      score(MISS);
    },
    [score],
  );

  const stick = useCallback(
    (d: Dart, point: THREE.Vector3) => {
      const b = d.body;
      if (!b) return;
      b.setBodyType(rapier.RigidBodyType.Fixed, false);
      // A stuck dart is decoration: no collider, so later darts and aim rays never land on it.
      world.removeCollider(b.collider(0), false);
      // Keep the dart's own angle, sunk a little into the board.
      b.setTranslation(point.clone().addScaledVector(d.dir, DART.embed - DART.tip), false);
      d.where = 'stuck';
      noise({ dur: 0.06, peak: 0.07, filter: 'lowpass', freq: 900, q: 1 });
      score(scoreAt(toBoard(point).x, toBoard(point).y));
    },
    [rapier, score, world],
  );

  const spawn = useCallback(
    (d: Dart, power: number) => {
      const { fwd, from, aim, v, q } = tmp;
      fwd.set(0, 0, -1).applyQuaternion(camera.quaternion);
      from.copy(HAND).applyQuaternion(camera.quaternion).add(camera.position);
      // Aim from the hand at whatever the crosshair is on, so darts fly where you point.
      ray.origin = camera.position;
      ray.dir = fwd;
      const hit = world.castRay(ray, 40, true, undefined, groups);
      const dist = hit ? hit.timeOfImpact : 30;
      if (dist > 0.8) aim.copy(camera.position).addScaledVector(fwd, dist);
      else aim.copy(from).add(fwd);
      v.subVectors(aim, from).normalize();
      q.setFromUnitVectors(UP, v);
      const speed = SPEED.tap + (SPEED.full - SPEED.tap) * power;
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.dynamic()
          .setTranslation(from.x, from.y, from.z)
          .setRotation(q)
          .setLinvel(v.x * speed, v.y * speed, v.z * speed)
          .setLinearDamping(0.02)
          .setAngularDamping(1.5)
          .setCcdEnabled(true)
          .setUserData({ toy: 'dart' }),
      );
      world.createCollider(rapier.ColliderDesc.capsule(DART.half, DART.r).setDensity(400).setRestitution(0.3).setFriction(0.9).setCollisionGroups(groups), body);
      d.body = body;
      d.dir.copy(v);
      d.where = 'flying';
    },
    [camera, groups, rapier, ray, tmp, world],
  );

  const step = useCallback(() => {
    const list = darts.current;
    const held = useStore.getState().held;

    if (takeCollect()) {
      // Every dart back into your hand; a round cut short doesn't count.
      for (const d of list) {
        removeBody(d);
        d.where = 'hand';
      }
      if (roundRef.current.throws.length < DARTS_PER_ROUND && roundRef.current.throws.length) {
        roundRef.current = emptyRound();
        setRound(roundRef.current);
      }
      setLedge(0);
      useStore.getState().setHeld({ kind: 'darts', count: list.length });
      return;
    }

    for (const power of takeThrows()) {
      const d = list.find((x) => x.where === 'hand');
      if (d) spawn(d, power);
    }

    // Darts put down (Esc, a panel opening) go back on the ledge.
    const want = held?.kind === 'darts' ? held.count : 0;
    let inHand = list.filter((d) => d.where === 'hand');
    if (inHand.length > want) {
      for (const d of inHand.slice(want)) d.where = 'ledge';
      inHand = inHand.slice(0, want);
      setLedge(count('ledge'));
    }

    const { v, p } = tmp;
    for (const d of list) {
      const b = d.body;
      if (!b) continue;
      if (d.where === 'flying') {
        const lv = b.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);
        v.set(lv.x, lv.y, lv.z).divideScalar(speed || 1);
        // Turned or slowed this sharply: it hit something that wasn't the board.
        if (speed < DART.slow || v.dot(d.dir) < 0.9) {
          tumble(d);
          continue;
        }
        d.dir.copy(v);
        b.setRotation(tmp.q.setFromUnitVectors(UP, v), true);
        b.setAngvel(ZERO, true);
        // Look ahead one step: only the board holds a dart, and only one that arrives point first.
        const at = b.translation();
        ray.origin = at;
        ray.dir = v;
        const hit = world.castRayAndGetNormal(ray, speed * STEP + DART.tip, true, undefined, groups, undefined, b);
        if (!hit) continue;
        const onBoard = hit.collider.parent()?.handle === boardBody.current?.handle;
        if (!onBoard) continue; // the physics bounce, then the check above, tumbles it
        p.set(at.x, at.y, at.z).addScaledVector(v, hit.timeOfImpact);
        const square = -(v.x * hit.normal.x + v.y * hit.normal.y + v.z * hit.normal.z);
        if (speed >= STICK.minSpeed && square >= STICK.minCos && Math.hypot(toBoard(p).x, toBoard(p).y) <= BOARD.radius) stick(d, p);
      } else if (d.where === 'loose' && escaped(b.translation())) {
        // Safety net: a dart that left the dungeon goes back on the ledge.
        removeBody(d);
        d.where = 'ledge';
        setLedge(count('ledge'));
      }
    }
  }, [ray, removeBody, spawn, stick, tmp, tumble, world, groups]);
  useBeforePhysicsStep(step);

  // Draw each dart where its body is.
  useFrame(() => {
    for (const d of darts.current) {
      const g = meshes.current[d.slot];
      if (!g) continue;
      const show = !!d.body && d.where !== 'hand' && d.where !== 'ledge';
      g.visible = show;
      if (!show) continue;
      const t = d.body!.translation();
      const r = d.body!.rotation();
      g.position.set(t.x, t.y, t.z);
      g.quaternion.set(r.x, r.y, r.z, r.w);
    }
  });

  const out = DARTS_PER_ROUND - ledge;
  const target = useInteractable<THREE.Group>({ id: 'toy:darts', label: out ? 'Collect the darts' : 'Take the darts', action: { kind: 'pickup', toyId: 'darts' } }, COLLECT_RANGE);

  return (
    <>
      {/* the board, facing north, on its backing against the south wall */}
      <RigidBody ref={boardBody} type="fixed" colliders={false} position={[DART_BOARD.x, BOARD.height, BOARD_Z]}>
        <CuboidCollider args={[BOARD.radius, BOARD.radius, 0.025]} position={[0, 0, 0.025]} friction={0.9} restitution={0.1} collisionGroups={groups} />
      </RigidBody>
      <group ref={target} position={[DART_BOARD.x, BOARD.height, BOARD_Z]} rotation={[0, Math.PI, 0]}>
        <DartBoardLook ledge={ledge} />
      </group>
      <group position={[DART_BOARD.tallyX, BOARD.height - 0.05, DART_BOARD.wall - 0.02]} rotation={[0, Math.PI, 0]}>
        <TallyLook throws={round.throws} total={roundTotal(round)} best={best} />
      </group>
      {darts.current.map((d) => (
        <group key={d.slot} ref={(g) => void (meshes.current[d.slot] = g)} visible={false}>
          <DartLook />
        </group>
      ))}
      <HeldDart />
    </>
  );
}

/** The dart you're holding, low on the right of the view; it draws back as you charge. */
function HeldDart() {
  const root = useRef<THREE.Group>(null);
  const held = useStore((s) => s.held);
  useFrame(({ camera }) => {
    const r = root.current;
    if (!r) return;
    r.position.copy(camera.position);
    r.quaternion.copy(camera.quaternion);
    const at = useStore.getState().chargeAt;
    const pull = at === null ? 0 : Math.min(1, (performance.now() - at) / 1000) * 0.08;
    const g = r.children[0];
    if (g) g.position.set(HAND.x, HAND.y, HAND.z + pull);
  });
  if (!held) return null;
  return (
    <group ref={root}>
      <group rotation={[-Math.PI / 2 + 0.25, 0, 0.1]}>
        <DartLook />
      </group>
    </group>
  );
}

export { collectDarts };
