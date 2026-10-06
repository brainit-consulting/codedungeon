// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { CatAction } from './catBrain';
import { BUILD, POSES, poseCat } from './catPose';

// The cat as Cat.tsx draws her (the same shapes from BUILD, in the same groups), posed by poseCat and stood on a
// surface at y = 0: measured from the meshes' own vertices.

function cat() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  const head = new THREE.Group();
  const eyes = new THREE.Group();
  root.add(body, head);
  head.add(eyes);
  const part = (parent: THREE.Object3D, name: string, g: THREE.BufferGeometry, at: [number, number, number], scale: [number, number, number] = [1, 1, 1], turn: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Mesh(g);
    m.name = name;
    m.position.set(...at);
    m.scale.set(...scale);
    m.rotation.set(...turn);
    parent.add(m);
    return m;
  };
  const { torso, haunch, leg, paw, tail: tl } = BUILD;
  const meshes = {
    torso: part(body, 'torso', new THREE.CapsuleGeometry(torso.r, torso.len, 6, 12), [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]),
    haunch: part(body, 'haunch', new THREE.SphereGeometry(haunch.r, 12, 10), [0, 0, haunch.z], [haunch.wide, 1, 1]),
    legs: [] as THREE.Mesh[],
    paws: [] as THREE.Mesh[],
    tail: [] as THREE.Mesh[],
    head: part(head, 'head', new THREE.SphereGeometry(0.072, 14, 12), [0, 0, 0], [1.1, 0.95, 1]),
  };
  const legs = BUILD.legs.map(([x, z], i) => {
    const g = new THREE.Group();
    g.position.set(x, BUILD.legY, z);
    body.add(g);
    meshes.legs.push(part(g, `leg ${i}`, new THREE.CapsuleGeometry(leg.r, leg.len, 4, 6), [0, leg.y, 0]));
    meshes.paws.push(part(g, `paw ${i}`, new THREE.SphereGeometry(paw.r, 8, 6), [0, paw.y, paw.z], [1, paw.flat, paw.long]));
    return g;
  });
  const base = new THREE.Group();
  base.position.set(...tl.at);
  base.rotation.set(tl.tilt, 0, 0);
  body.add(base);
  const tail: THREE.Group[] = [];
  let parent: THREE.Object3D = base;
  for (let i = 0; i < tl.n; i++) {
    const seg = new THREE.Group();
    parent.add(seg);
    tail.push(seg);
    meshes.tail.push(part(seg, `tail ${i}`, new THREE.CapsuleGeometry(tl.r - i * tl.taper, tl.len, 3, 6), [0, tl.len / 2, 0]));
    const next = new THREE.Group();
    next.position.set(0, tl.len, 0);
    seg.add(next);
    parent = next;
  }
  /** Settled in an action's pose, `t` seconds in. */
  const pose = (action: CatAction, t = 0) => {
    poseCat({ body, head, eyes, legs, tail }, POSES[action], { t, ph: 0, moving: false, action });
    root.updateMatrixWorld(true);
  };
  return { root, meshes, pose };
}

/** The lowest and highest point of a mesh (world y), from its vertices. */
function span(m: THREE.Mesh): [number, number] {
  const pos = m.geometry.attributes.position;
  const v = new THREE.Vector3();
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
    lo = Math.min(lo, v.y);
    hi = Math.max(hi, v.y);
  }
  return [lo, hi];
}
const mm = (y: number) => Math.round(y * 1000);

/** The lowest point of all of her (world y). */
const lowest = (c: ReturnType<typeof cat>) => Math.min(...[c.meshes.torso, c.meshes.haunch, c.meshes.head, ...c.meshes.legs, ...c.meshes.paws, ...c.meshes.tail].map((m) => span(m)[0]));

/** How far her head is from her torso: from the head's middle to the torso capsule's spine, less both their radii. */
function neckGap(c: ReturnType<typeof cat>): number {
  const torso = c.meshes.torso;
  const a = new THREE.Vector3(0, -BUILD.torso.len / 2, 0).applyMatrix4(torso.matrixWorld);
  const b = new THREE.Vector3(0, BUILD.torso.len / 2, 0).applyMatrix4(torso.matrixWorld);
  const h = c.meshes.head.getWorldPosition(new THREE.Vector3());
  const on = new THREE.Line3(a, b).closestPointToPoint(h, true, new THREE.Vector3());
  return h.distanceTo(on) - 0.072 * 0.95 - BUILD.torso.r;
}

const SITTING: CatAction[] = ['sit', 'purr', 'ignore', 'wash', 'nudge'];

describe('the cat on a floor, a bench or the bar', () => {
  it('rests on it in every pose she holds still in or walks in: not floating, not sunk into it', () => {
    const c = cat();
    for (const action of [...SITTING, 'sleep', 'walk', 'follow', 'carry', 'stalk'] as CatAction[]) {
      c.pose(action);
      expect(mm(lowest(c)), action).toBeGreaterThanOrEqual(-4);
      expect(mm(lowest(c)), action).toBeLessThanOrEqual(4);
    }
  });

  it('sat, has all four paws and her haunches down on it, the hind feet folded under her rather than stuck out', () => {
    const c = cat();
    for (const action of SITTING) {
      for (const t of [0, 0.4, 1.3]) {
        c.pose(action, t);
        const raised = action === 'wash' || action === 'nudge' ? 0 : -1; // washing or nudging, her front left paw is up
        c.meshes.paws.forEach((p, i) => {
          if (i === raised) return;
          expect(mm(span(p)[0]), `${action} paw ${i}`).toBeLessThanOrEqual(4);
        });
        expect(mm(span(c.meshes.haunch)[0]), `${action} haunch`).toBeLessThanOrEqual(6);
        // folded: no part of a hind leg higher than her haunch's middle
        for (const leg of c.meshes.legs.slice(2)) expect(mm(span(leg)[1]), `${action} hind leg`).toBeLessThanOrEqual(mm(c.meshes.haunch.getWorldPosition(new THREE.Vector3()).y));
      }
    }
  });

  it('sat, has her tail down on it and round her, not sticking up behind her', () => {
    const c = cat();
    for (const action of SITTING) {
      for (const t of [0, 0.4, 1.3]) {
        c.pose(action, t);
        const top = Math.max(...c.meshes.tail.map((m) => span(m)[1]));
        expect(mm(top), `${action} tail's highest`).toBeLessThanOrEqual(110);
        const tip = c.meshes.tail[c.meshes.tail.length - 1];
        expect(mm(span(tip)[0]), `${action} tail's tip`).toBeLessThanOrEqual(15);
      }
    }
  });

  it('has her head on her shoulders, not floating over them', () => {
    const c = cat();
    for (const action of [...SITTING, 'walk', 'stalk', 'carry'] as CatAction[]) {
      c.pose(action);
      expect(mm(neckGap(c)), action).toBeLessThanOrEqual(5);
    }
  });
});
