import * as THREE from 'three';
import { findArm, keepHandAbove, leanForward } from './barReach';
import { HandPose } from './handPose';
import { COUNTER_TOP, TAP, WIPE_LEAN } from './tavernRules';
import { curlFinger, findHand, orientHand, reachThumb, reachWith, type HandBones } from './twoBoneIk';

// Wystan wiping the bar (Tavern.tsx's Tapster). A folded bar towel lies on the counter. To wipe, he leans over from the
// waist, lays his right hand flat on the towel (palm, fingers and thumb on the cloth, placed by his hand's own skin)
// and scrubs the wood in ovals, the towel going where his palm goes; done, he lifts his hand off and the towel stays
// where he left it, for next time. Two-bone IK on top of his idle clip, blended in and out by the wipe's weight.

/** The towel: a bar cloth folded in four (m), lying flat; its length (d) runs the way his fingers point. */
export const RAG = { w: 0.26, d: 0.36, h: 0.012 };

/** The scrub: ovals this wide and deep, centred this far in from the counter's near edge, round this fast (rad/s). */
export const SCRUB = { x: TAP.x - 0.2, z: COUNTER_TOP.minZ + 0.21, across: 0.15, deep: 0.042, speed: 2.6 };

/** Where the middle of his palm (and the towel) is, `s` seconds into a wipe: round and round in an oval. */
export function scrubAt(s: number): { x: number; z: number } {
  return { x: SCRUB.x + Math.sin(s * SCRUB.speed) * SCRUB.across, z: SCRUB.z + Math.cos(s * SCRUB.speed) * SCRUB.deep };
}

/**
 * His hand on the towel: fingers forward over the bar and a little in (heading, radians from +z) and a little down,
 * swinging a little with the strokes; an easy bend at each finger joint; the thumb out from them; how far the skin
 * presses into the cloth (m). Under his hand the towel settles (seconds) a little squarer to the counter than his hand
 * and reaching this far further forward than his palm's middle, so his fingers lie on it too.
 */
const FLAT = { heading: Math.atan2(0.3, 0.95), dip: -0.06, swing: 0.1, curl: [0.05, 0.07, 0.04], thumbOut: 0.45, press: 0.001, edge: 0.015 };
const GRIP = { yaw: -0.08, ahead: 0.06, settle: 1 };
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const RAG_TOP = COUNTER_TOP.top + RAG.h;
/** Where his skin goes on the cloth: pressed into it a touch, so no light shows between them. */
const ON_CLOTH = RAG_TOP - FLAT.press;

/** The finger and thumb joints, which start each pass from the rig's bind pose (straight), not the clip's. */
const joints = (h: HandBones) => [...h.fingers.flatMap((f) => f.slice(0, 3)), ...h.thumb];
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** (x, z) turned by `a` about the vertical, as three.js turns a point by rotation.y = a. */
const turnY = (x: number, z: number, a: number): [number, number] => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];

/** A vertex of the skin: each bone that moves it, where the vertex is in that bone's own frame, and by how much. */
type SkinPoint = { mesh: THREE.Object3D; by: { bone: THREE.Object3D; at: THREE.Vector3; w: number }[] };

/** The skin each of these bones moves (the vertices it moves most). */
function skinOf(scene: THREE.Object3D, bones: THREE.Object3D[]): Map<THREE.Object3D, SkinPoint[]> {
  const skin = new Map<THREE.Object3D, SkinPoint[]>(bones.map((b) => [b, []]));
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const pos = m.geometry.attributes.position;
    const si = m.geometry.attributes.skinIndex;
    const sw = m.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
      const list = skin.get(m.skeleton.bones[si.getComponent(i, best)]);
      if (!list) continue;
      const bound = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
      const by: SkinPoint['by'] = [];
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        const bone = si.getComponent(i, k);
        if (w > 0) by.push({ bone: m.skeleton.bones[bone], at: bound.clone().applyMatrix4(m.skeleton.boneInverses[bone]), w });
      }
      list.push({ mesh: m, by });
    }
  });
  return skin;
}

/** Wystan's wiping hand, for his rigged body `scene`, and the towel it lays on and moves about. */
export function createWipingHand(scene: THREE.Object3D) {
  const arm = findArm(scene, 'r');
  const left = findArm(scene, 'l');
  const hand = findHand(scene, 'r');
  const waist = scene.getObjectByName('spine_01') ?? null;
  const b = arm && hand && waist ? { arm, hand, waist, thumbTip: hand.thumb[2].children[0] ?? hand.thumb[2] } : null;
  const pose = new HandPose(b ? [b.waist, b.arm.upper, b.arm.lower, ...b.hand.bones] : []);
  // made before any clip has run: the rig as bound
  const straight = b ? joints(b.hand).map((j) => [j, j.quaternion.clone()] as const) : [];
  const skin = b ? skinOf(scene, [b.hand.hand, ...b.hand.fingers.flat(), ...b.hand.thumb, b.thumbTip]) : new Map<THREE.Object3D, SkinPoint[]>();
  const rag: { current: THREE.Object3D | null } = { current: null };

  /** Where the towel lies (its middle, world), and while his hand has it, where that is from his palm (in his hand's turn). */
  const towel = { x: SCRUB.x, z: SCRUB.z, yaw: FLAT.heading + GRIP.yaw };
  const grip = { held: false, x: 0, z: 0, yaw: 0 };
  /** This wipe: where the towel lay when it began, when his palm came down on it, where his hand is sent. */
  const wipe = { fromX: towel.x, fromZ: towel.z, downAt: null as number | null, x: towel.x, z: towel.z, heading: FLAT.heading, lastS: Infinity };
  /**
   * Last frame's, the first guesses for this one: where the wrist was sent from the scrub point, the thumb's tip's
   * height, and how the hand lies (rolled onto its little finger's side, fingers up from the heel; radians).
   */
  const offset = new THREE.Vector3(0, 0.03, -0.07);
  let thumbY = RAG_TOP + 0.01;
  const lie = { roll: 0, pitch: 0 };
  const v = {
    want: new THREE.Vector3(),
    target: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    fingers: new THREE.Vector3(),
    palm: new THREE.Vector3(),
    wrist: new THREE.Vector3(),
    along: new THREE.Vector3(),
    pc: new THREE.Vector3(),
    p: new THREE.Vector3(),
    by: new THREE.Vector3(),
    k: new THREE.Vector3(),
    a: new THREE.Vector3(),
    f: new THREE.Vector3(),
    side: new THREE.Vector3(),
    tip: new THREE.Vector3(),
    thumbPole: new THREE.Vector3(),
    m: new THREE.Matrix4(),
    inv: new THREE.Matrix4(),
    one: new THREE.Vector3(1, 1, 1),
    q: new THREE.Quaternion(),
  };
  /** The middle of the palm: halfway from the wrist to the middle finger's knuckle. */
  const palmOf = (h: HandBones, out: THREE.Vector3) => h.hand.getWorldPosition(out).add(h.fingers[1][0].getWorldPosition(v.a)).multiplyScalar(0.5);
  /** Where a vertex of the skin is now (world): its bones' moves, blended as the renderer blends them. */
  const place = (s: SkinPoint, out: THREE.Vector3) => {
    out.set(0, 0, 0);
    for (const i of s.by) out.addScaledVector(v.by.copy(i.at).applyMatrix4(i.bone.matrixWorld), i.w);
    return out;
  };
  /** The lowest point of these bones' skin (world y), and where it is. */
  const lowest = (bones: THREE.Object3D[], out: THREE.Vector3) => {
    let low = Infinity;
    for (const bone of bones)
      for (const s of skin.get(bone) ?? []) {
        if (!s.mesh.visible) continue;
        place(s, v.p);
        if (v.p.y < low) {
          low = v.p.y;
          out.copy(v.p);
        }
      }
    return low;
  };

  return {
    rag,
    /** Before the mixer's update: put back what the wipe moved, so the clip poses it afresh. */
    before() {
      pose.undo();
    },
    /**
     * After the mixer's update (and the scene's matrices): `s` seconds into his gesture, at the wipe's weight `w` (0 not
     * wiping), `on` while the gesture is a wipe.
     */
    after(s: number, w: number, on: boolean) {
      pose.keep();
      const ds = s >= wipe.lastS ? s - wipe.lastS : 0;
      if (s < wipe.lastS) {
        // a new gesture: if it's a wipe, his palm goes down on the towel's near half, where it lies
        const [ax, az] = turnY(0, GRIP.ahead, towel.yaw);
        Object.assign(wipe, { fromX: towel.x - ax, fromZ: towel.z - az, downAt: null });
      }
      wipe.lastS = s;
      if (!on) grip.held = false; // done: he lifts his hand straight off and the towel stays
      else {
        // to the towel where it lies, and once his palm is down on it, round into the strokes
        const e = wipe.downAt === null ? 0 : smooth(s - wipe.downAt);
        const p = scrubAt(s);
        wipe.x = wipe.fromX + (p.x - wipe.fromX) * e;
        wipe.z = wipe.fromZ + (p.z - wipe.fromZ) * e;
        wipe.heading = FLAT.heading + FLAT.swing * e * Math.cos(s * SCRUB.speed);
      }

      if (b && w > 0.002) {
        const h = b.hand;
        leanForward(b.waist, WIPE_LEAN * w);
        v.want.set(wipe.x, RAG_TOP, wipe.z);
        b.arm.lower.getWorldPosition(v.pole);
        v.pole.x -= 0.3; // the elbow out to his right
        v.pole.y -= 0.2;
        v.target.copy(v.want).add(offset);
        // only with his hand all but down are the misses learned: on its way it is partly the clip's
        const learn = w > 0.95;
        const settle = smooth((w - 0.7) / 0.3); // the fingers and thumb settle onto the cloth as the hand comes down
        for (let pass = 0; pass < 3; pass++) {
          reachWith(b.arm.upper, b.arm.lower, b.arm.hand, v.target, v.pole, w);
          // fingers straight and the thumb by the palm, as bound: where palmNormal looks for the thumb to know the palm
          for (const [j, q] of straight) j.quaternion.copy(q);
          h.hand.updateMatrixWorld(true);
          const pitch = FLAT.dip + lie.pitch * w;
          v.fingers.set(Math.sin(wipe.heading) * Math.cos(pitch), Math.sin(pitch), Math.cos(wipe.heading) * Math.cos(pitch));
          v.palm.copy(DOWN).applyAxisAngle(v.fingers, lie.roll * w);
          orientHand(h, v.fingers, v.palm, w);
          // each finger in an easy bend, then turned at the knuckle till the pad of its tip is on the cloth
          h.fingers.forEach((f, i) => {
            curlFinger(h, i, FLAT.curl.map((a) => a * w));
            for (let k = 0; k < 2; k++) {
              const low = lowest([f[2], f[3]], v.k);
              const out = Math.hypot(v.k.x - f[0].getWorldPosition(v.a).x, v.k.z - v.a.z);
              curlFinger(h, i, [THREE.MathUtils.clamp(Math.atan2(low - ON_CLOTH, out), -0.35, 0.5) * settle, 0, 0]);
            }
          });
          // the thumb out beside them along the cloth, resting on it as they do: its tip as far out and forward from its
          // root as it reaches, at the height that puts the lowest of it on the cloth
          if (settle > 0) {
            const [t1, t2, t3] = h.thumb;
            const long = t1.getWorldPosition(v.a).distanceTo(t2.getWorldPosition(v.k)) + v.k.distanceTo(t3.getWorldPosition(v.p)) + v.p.distanceTo(b.thumbTip.getWorldPosition(v.tip));
            h.fingers[0][0].getWorldPosition(v.side).sub(h.fingers[3][0].getWorldPosition(v.k)).setY(0).normalize();
            v.f.set(Math.sin(wipe.heading), 0, Math.cos(wipe.heading));
            v.k.copy(v.f).multiplyScalar(Math.cos(FLAT.thumbOut)).addScaledVector(v.side, Math.sin(FLAT.thumbOut));
            v.k.multiplyScalar(long * 0.92).add(v.a).setY(thumbY);
            v.tip.lerp(v.k, settle); // from its own place, bound
            t2.getWorldPosition(v.thumbPole).addScaledVector(UP, 0.05).addScaledVector(v.side, 0.03);
            reachThumb(h, v.tip, v.thumbPole);
            h.hand.updateMatrixWorld(true);
            if (learn) thumbY = THREE.MathUtils.clamp(thumbY + ON_CLOTH - lowest([t1, t2, t3, b.thumbTip], v.k), RAG_TOP - 0.02, RAG_TOP + 0.04);
          }
          if (learn) {
            // the palm settles as a hand's does on a table: as low at the ball of the thumb as at the little finger's edge
            // (the middle of this hand's palm bulges, so the middle is left out), and at the pads below the knuckles as at
            // its heel; rolled and tipped by half of what's left, each pass
            h.hand.getWorldPosition(v.wrist);
            const len = h.fingers[1][0].getWorldPosition(v.along).sub(v.wrist).length();
            v.along.normalize();
            h.fingers[0][0].getWorldPosition(v.side).sub(h.fingers[3][0].getWorldPosition(v.k));
            v.side.addScaledVector(v.along, -v.side.dot(v.along)).normalize();
            const thumbSide = { y: Infinity, at: 0 };
            const littleSide = { y: Infinity, at: 0 };
            const heel = { y: Infinity, at: 0 };
            const knuckles = { y: Infinity, at: 0 };
            let low = Infinity;
            for (const bone of [h.hand, h.thumb[0]])
              for (const p of skin.get(bone) ?? []) {
                if (!p.mesh.visible) continue;
                place(p, v.p);
                low = Math.min(low, v.p.y);
                v.k.subVectors(v.p, v.wrist);
                const across = v.k.dot(v.side);
                const side = bone !== h.hand || across > FLAT.edge ? thumbSide : across < -FLAT.edge ? littleSide : null;
                if (side && v.p.y < side.y) Object.assign(side, { y: v.p.y, at: across });
                if (bone !== h.hand) continue;
                const lengthwise = v.k.dot(v.along);
                const end = lengthwise < len / 2 ? heel : knuckles;
                if (v.p.y < end.y) Object.assign(end, { y: v.p.y, at: lengthwise });
              }
            if (thumbSide.at > littleSide.at) lie.roll = THREE.MathUtils.clamp(lie.roll - 0.5 * Math.atan2(thumbSide.y - littleSide.y, thumbSide.at - littleSide.at), -0.5, 0.5);
            if (knuckles.at > heel.at) lie.pitch = THREE.MathUtils.clamp(lie.pitch + 0.5 * Math.atan2(heel.y - knuckles.y, knuckles.at - heel.at), -0.3, 0.3);
            // the palm's middle over the scrub point and its underside on the cloth: each miss added to where the wrist
            // is sent (not to where it got), so a reach that always falls a little short is made up for
            palmOf(h, v.pc);
            v.target.x += v.want.x - v.pc.x;
            v.target.z += v.want.z - v.pc.z;
            v.target.y += ON_CLOTH - low;
          }
        }
        offset.copy(v.target).sub(v.want);
        b.arm.upper.updateMatrixWorld(true);
      }
      // whatever the clip did, his other hand rests on the wood rather than in it (and so does this one, not wiping)
      if (left) keepHandAbove(left, COUNTER_TOP);
      if (arm && !(b && w > 0.002)) keepHandAbove(arm, COUNTER_TOP);

      // the towel: his palm picks it up once it's down on it, and it goes where the palm goes, settling square under it
      if (b) {
        palmOf(b.hand, v.pc);
        b.hand.fingers[1][0].getWorldPosition(v.f).sub(b.hand.hand.getWorldPosition(v.a));
        const yaw = Math.atan2(v.f.x, v.f.z);
        if (on && !grip.held && w > 0.97) {
          [grip.x, grip.z] = turnY(towel.x - v.pc.x, towel.z - v.pc.z, -yaw);
          Object.assign(grip, { held: true, yaw: towel.yaw - yaw });
          wipe.downAt = s;
        }
        if (grip.held) {
          const k = 1 - Math.exp(-ds / GRIP.settle);
          grip.x -= grip.x * k;
          grip.z += (GRIP.ahead - grip.z) * k;
          grip.yaw += (GRIP.yaw - grip.yaw) * k;
          const [dx, dz] = turnY(grip.x, grip.z, yaw);
          Object.assign(towel, { x: v.pc.x + dx, z: v.pc.z + dz, yaw: yaw + grip.yaw });
        }
      }
      const r = rag.current;
      if (!r) return;
      v.m.compose(v.a.set(towel.x, COUNTER_TOP.top, towel.z), v.q.setFromAxisAngle(UP, towel.yaw), v.one);
      if (r.parent) v.m.premultiply(v.inv.copy(r.parent.matrixWorld).invert());
      v.m.decompose(r.position, r.quaternion, v.a);
      r.updateMatrixWorld(true);
    },
  };
}
