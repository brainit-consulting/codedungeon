import * as THREE from 'three';

// A development check that no placed prop floats above, or sinks into, what it stands on (window.__propAudit() in a
// dev build: Player.tsx). Every model placed with <Model> carries its name (models.tsx); for each, rays are cast
// straight down from a few points of its footprint against everything else, and the gap between the model's lowest
// point and the highest surface under it is reported. Only what's mounted is checked: run it in the hall and in a
// chamber.

/** More air than this under a prop and it floats; deeper than SUNK into the surface and it's sunk (m). */
export const FLOAT = 0.012;
export const SUNK = -0.03;

export interface PropGap {
  model: string;
  /** Where it is (world). */
  at: [number, number, number];
  /** Its lowest point, and the gap to the surface under it (null: nothing under it). */
  bottom: number;
  gap: number | null;
  /** What the highest surface under it belongs to: the model it's part of, or the mesh's name. */
  under: string | null;
}

/** The gap between a prop's lowest point and the highest of the surfaces found under it. */
export function restingGap(bottom: number, hits: (number | null)[]): number | null {
  const ys = hits.filter((h): h is number => h !== null);
  return ys.length ? bottom - Math.max(...ys) : null;
}

export function verdict(gap: number | null): 'ok' | 'floats' | 'sunk' | 'nothing under' {
  if (gap === null) return 'nothing under';
  if (gap > FLOAT) return 'floats';
  if (gap < SUNK) return 'sunk';
  return 'ok';
}

const box = new THREE.Box3();
const ray = new THREE.Raycaster();
const DOWN = new THREE.Vector3(0, -1, 0);
const from = new THREE.Vector3();

/** The model an object is part of (its nearest tagged ancestor), else its own name or type. */
function ownerName(o: THREE.Object3D): string {
  for (let x: THREE.Object3D | null = o; x; x = x.parent) if (x.userData.model) return x.userData.model;
  return o.name || o.type;
}

export function auditProps(scene: THREE.Object3D): PropGap[] {
  const props: THREE.Object3D[] = [];
  scene.traverse((o) => {
    if (o.userData.model) props.push(o);
  });
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const out: PropGap[] = [];
  for (const p of props) {
    box.setFromObject(p);
    if (box.isEmpty()) continue;
    const own = new Set<THREE.Object3D>();
    p.traverse((o) => own.add(o));
    const others = meshes.filter((m) => !own.has(m));
    const { min, max } = box;
    const cx = (min.x + max.x) / 2;
    const cz = (min.z + max.z) / 2;
    const hx = (max.x - min.x) * 0.3;
    const hz = (max.z - min.z) * 0.3;
    // from just above its bottom, so a surface it sinks into a little is still found
    const hits = [
      [cx, cz],
      [cx - hx, cz - hz],
      [cx + hx, cz - hz],
      [cx - hx, cz + hz],
      [cx + hx, cz + hz],
    ].map(([x, z]) => {
      ray.set(from.set(x, min.y + 0.05, z), DOWN);
      ray.far = 3;
      return ray.intersectObjects(others, false)[0] ?? null;
    });
    const top = hits.reduce<THREE.Intersection | null>((m, h) => (h && (!m || h.point.y > m.point.y) ? h : m), null);
    out.push({
      model: p.userData.model,
      at: [p.getWorldPosition(from).x, from.y, from.z],
      bottom: min.y,
      gap: restingGap(min.y, hits.map((h) => (h ? h.point.y : null))),
      under: top ? ownerName(top.object) : null,
    });
  }
  return out;
}
