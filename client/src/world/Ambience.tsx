import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { noise } from '../ui/sfx';
import { theCat } from './Cat';
import { FIRE, nearestFire } from './lightPool';

// The dungeon's sound: fire crackling (louder and busier near the hearth than a torch, nothing far from any flame),
// and the cat's purr when you're close to her while she purrs or sleeps. Short noise bursts through the same mixer
// as every other sound, so M mutes it all.

const HEAR = 7; // metres: past this a fire is silent
const PURR_HEAR = 2.6;

export function Ambience() {
  const next = useRef(0);
  const rumble = useRef(0);
  const purr = useRef(0);
  const tmp = useRef(new THREE.Vector3());
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const p = tmp.current.copy(camera.position);
    const fire = nearestFire(p, HEAR * 2.5);
    if (fire) {
      const big = fire.look.intensity >= FIRE.hearth.intensity;
      const near = Math.max(0, 1 - fire.d / (big ? HEAR * 2 : HEAR));
      if (near > 0 && t >= next.current) {
        // crackles: tiny bright clicks, now and then a pop
        const pop = Math.random() < 0.12;
        noise(
          pop
            ? { dur: 0.07, peak: 0.05 * near, filter: 'bandpass', freq: 700, q: 1.2 }
            : { dur: 0.012 + Math.random() * 0.03, peak: (0.018 + Math.random() * 0.03) * near, filter: 'bandpass', freq: 1800 + Math.random() * 3500, q: 2.5 },
        );
        const rate = big ? 10 : 3.5;
        next.current = t + (-Math.log(1 - Math.random()) / rate) / Math.max(0.35, near);
      }
      if (big && near > 0 && t >= rumble.current) {
        // the hearth's low roar, overlapping bursts
        noise({ dur: 0.5, peak: 0.035 * near, filter: 'lowpass', freq: 160, q: 0.7, attack: 0.2 });
        rumble.current = t + 0.35;
      }
    }
    const cat = theCat();
    if (cat && (cat.action === 'purr' || cat.action === 'sleep') && t >= purr.current) {
      const d = Math.hypot(cat.x - p.x, cat.z - p.z, cat.y + 0.2 - p.y);
      const near = Math.max(0, 1 - d / PURR_HEAR);
      if (near > 0) {
        // one breath of purring: ~25 soft low pulses a second, louder breathing out
        const len = 1.5;
        for (let i = 0; i < len * 25; i++) {
          const s = i / (len * 25);
          const swell = s < 0.45 ? s / 0.45 : (1 - s) / 0.55;
          noise({ at: i / 25, dur: 0.035, peak: 0.004 + 0.03 * near * swell, filter: 'lowpass', freq: 140, q: 0.9, attack: 0.008 });
        }
      }
      purr.current = t + 1.9;
    }
  });
  return null;
}
