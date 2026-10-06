import * as THREE from 'three';
import { RAG } from './wipingHand';

// Wystan's bar towel (Tavern.tsx; wipingHand.ts moves it): undyed linen folded in four, a madder stripe near one end,
// lying on the counter with soft edges and a few creases, flat in the middle where his hand goes.

/** The towel's shape, its base on y = 0 and centred on x and z: RAG.w across x, RAG.d along z, RAG.h at the top. */
export function towelGeometry(nx = 24, nz = 18): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const u = i / nx;
      const v = j / nz;
      const x = (u - 0.5) * RAG.w;
      const z = (v - 0.5) * RAG.d;
      // the cloth rounds down to the wood over its last centimetre, and creases a little away from the middle
      const edge = Math.min(u * RAG.w, (1 - u) * RAG.w, v * RAG.d, (1 - v) * RAG.d);
      const away = smooth((Math.hypot(x / 1.3, z) - 0.06) / 0.04);
      const crease = 0.0012 * (Math.sin(x * 41 + z * 23 + 0.6) + 0.6 * Math.sin(x * 17 - z * 57 + 2.1)) * away;
      const y = Math.max(0.0005, RAG.h * (0.05 + 0.95 * smooth(edge / 0.012)) + crease * smooth(edge / 0.02));
      // and its edges aren't ruled straight
      pos.push(x * (1 + 0.025 * Math.sin(z * 21 + 0.5)), y, z * (1 + 0.03 * Math.sin(x * 17 + 2)));
      uv.push(u, v);
    }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const c = a + nx + 1;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

let cloth: THREE.MeshStandardMaterial | null = null;
/** Linen: a fine weave, a hem, and a madder stripe near one end, drawn once. */
export function towelMaterial(): THREE.MeshStandardMaterial {
  if (cloth) return cloth;
  const w = 320;
  const h = 240;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8c7f67';
  ctx.fillRect(0, 0, w, h);
  // the weave: threads one way a shade darker, the other a shade lighter, never quite even
  for (let x = 0; x < w; x += 2) {
    ctx.fillStyle = `rgba(60, 45, 28, ${0.06 + 0.05 * ((x * 37) % 7) / 7})`;
    ctx.fillRect(x, 0, 1, h);
  }
  for (let y = 0; y < h; y += 2) {
    ctx.fillStyle = `rgba(255, 245, 225, ${0.05 + 0.05 * ((y * 53) % 5) / 5})`;
    ctx.fillRect(0, y, w, 1);
  }
  // a madder stripe, two threads wide and one, across the towel near one end
  ctx.fillStyle = 'rgba(125, 52, 36, 0.85)';
  ctx.fillRect(w * 0.12, 0, w * 0.035, h);
  ctx.fillRect(w * 0.175, 0, w * 0.012, h);
  // the hem
  ctx.strokeStyle = 'rgba(70, 55, 38, 0.45)';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cloth = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  return cloth;
}
