import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noise, tone } from '../ui/sfx';
import { chamber, doorsOpen } from './dungeon';
import { ELEVATOR, HALF_D } from './layout';

// The chambers' doors: two oak leaves in each doorway off the gallery, swinging into the chamber. A door stands open
// only while its chamber is being drawn (dungeon.ts doorsOpen), so from one chamber you see the shut door of the one
// opposite, not the empty dark where it would be. It opens as you come up the gallery, with a creak, and swings
// shut behind you once you're well past.

const LEAF = { w: ELEVATOR.doorHalf, h: ELEVATOR.doorHeight - 0.05, t: 0.07 };
const OPEN = Math.PI / 2 - 0.08;
const OPEN_S = 0.9; // seconds to swing open
const SHUT_S = 0.35; // and shut: quickly, so it's closed before the chamber goes

let plankTex: THREE.CanvasTexture | null = null;
/** Five upright oak planks with dark seams and a little grain, drawn once. */
function planks() {
  if (plankTex) return plankTex;
  const w = 256;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const shades = ['#4a301b', '#3f2816', '#47301c', '#3a2414', '#44301d'];
  for (let i = 0; i < 5; i++) {
    const x = (i * w) / 5;
    ctx.fillStyle = shades[i];
    ctx.fillRect(x, 0, w / 5, h);
    ctx.strokeStyle = 'rgba(20, 12, 6, 0.35)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 7; g++) {
      const gx = x + 4 + ((g * 37 + i * 11) % (w / 5 - 8));
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.6, gx + 2, h);
      ctx.stroke();
    }
    ctx.fillStyle = '#140c06';
    ctx.fillRect(x, 0, 3, h);
  }
  plankTex = new THREE.CanvasTexture(canvas);
  plankTex.colorSpace = THREE.SRGBColorSpace;
  plankTex.anisotropy = 4;
  return plankTex;
}

const IRON = new THREE.MeshStandardMaterial({ color: '#1f1d1b', roughness: 0.55, metalness: 0.7 });
let oak: THREE.MeshStandardMaterial | null = null;
const oakMaterial = () => (oak ??= new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.9 }));

/** One leaf, hinged at its own origin and reaching `side` (+1 or -1) along x. */
function Leaf({ side, leafRef }: { side: 1 | -1; leafRef: (g: THREE.Group | null) => void }) {
  const mid = (side * LEAF.w) / 2;
  return (
    <group ref={leafRef}>
      <mesh position={[mid, LEAF.h / 2, 0]} material={oakMaterial()}>
        <boxGeometry args={[LEAF.w - 0.01, LEAF.h, LEAF.t]} />
      </mesh>
      {[0.45, LEAF.h - 0.45].map((y) => (
        <mesh key={y} position={[mid, y, 0]} material={IRON}>
          <boxGeometry args={[LEAF.w - 0.06, 0.08, LEAF.t + 0.016]} />
        </mesh>
      ))}
      {/* the ring pull, on the gallery side near the meeting edge */}
      <mesh position={[side * (LEAF.w - 0.16), 1.1, LEAF.t / 2 + 0.02]} material={IRON}>
        <torusGeometry args={[0.065, 0.012, 6, 16]} />
      </mesh>
    </group>
  );
}

/** A low wooden creak, quieter the further off the door is. */
function creak(near: number) {
  tone({ freq: 140, to: 95, type: 'sawtooth', dur: 0.7, peak: 0.025 * near, attack: 0.08 });
  tone({ freq: 210, to: 160, type: 'triangle', at: 0.15, dur: 0.45, peak: 0.015 * near, attack: 0.05 });
  noise({ dur: 0.6, peak: 0.01 * near, filter: 'bandpass', freq: 900, q: 4 });
}

export function ChamberDoors({ slots }: { slots: number[] }) {
  const doors = useMemo(() => slots.map(chamber), [slots]);
  const leaves = useRef(new Map<string, THREE.Group>());
  const swing = useRef(new Map<number, number>()); // slot -> 0 (shut) .. 1 (open)

  useFrame(({ camera }, dt) => {
    const open = doorsOpen(camera.position.x, camera.position.z, slots);
    for (const c of doors) {
      const was = swing.current.get(c.slot) ?? 0;
      const want = open.includes(c.slot) ? 1 : 0;
      if (was === want) continue;
      const now = want ? Math.min(1, was + dt / OPEN_S) : Math.max(0, was - dt / SHUT_S);
      if (want && was === 0) {
        const d = Math.hypot(c.x - camera.position.x, c.z - camera.position.z) - HALF_D;
        creak(Math.max(0, Math.min(1, 1 - d / 12)));
      }
      swing.current.set(c.slot, now);
      const eased = now * now * (3 - 2 * now);
      leaves.current.get(`${c.slot}:-1`)?.rotation.set(0, eased * OPEN, 0);
      leaves.current.get(`${c.slot}:1`)?.rotation.set(0, -eased * OPEN, 0);
    }
  });

  return (
    <>
      {doors.map((c) => (
        // in the chamber's own frame: the doorway is in its south wall (z = HALF_D), the chamber lies towards -z
        <group key={c.slot} position={[c.x, 0, c.z]} rotation={[0, c.rot, 0]}>
          {([-1, 1] as const).map((hinge) => (
            <group key={hinge} position={[hinge * LEAF.w, 0.02, HALF_D + LEAF.t / 2]}>
              <Leaf side={hinge === -1 ? 1 : -1} leafRef={(g) => (g ? leaves.current.set(`${c.slot}:${hinge}`, g) : leaves.current.delete(`${c.slot}:${hinge}`))} />
            </group>
          ))}
        </group>
      ))}
    </>
  );
}
