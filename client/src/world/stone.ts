import * as THREE from 'three';

// The dungeon's stonework: tiling PBR textures (client/public/textures, from the village pack) for floors, walls and
// vaults. One material per surface and size, its texture repeat set so a tile is about `tile` metres whatever the
// wall's size; the images themselves are loaded once and shared.

export type Surface = 'flagstone' | 'brick' | 'plaster';

// Each surface's real-world tile size (m), and how dark and warm it is under the grime.
const LOOK: Record<Surface, { tile: number; tint: string; rough: number }> = {
  flagstone: { tile: 2, tint: '#6e6257', rough: 0.95 },
  brick: { tile: 2.4, tint: '#5f544b', rough: 0.9 },
  plaster: { tile: 3, tint: '#5a5048', rough: 0.95 },
};

const loader = new THREE.TextureLoader();
const images = new Map<string, THREE.Texture>();

function image(file: string, color: boolean): THREE.Texture {
  let t = images.get(file);
  if (!t) {
    t = loader.load(`/textures/${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    images.set(file, t);
  }
  return t;
}

/** The same image with its own repeat (a clone shares the image and its GPU upload). */
function repeated(file: string, color: boolean, rx: number, ry: number) {
  const t = image(file, color).clone();
  t.repeat.set(rx, ry);
  t.needsUpdate = true;
  return t;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/** A stone material for a face `w` by `h` metres (the face's own UVs run 0 to 1 across it). */
export function stone(surface: Surface, w: number, h: number): THREE.MeshStandardMaterial {
  const { tile, tint, rough } = LOOK[surface];
  const rx = Math.max(1, Math.round((w / tile) * 4) / 4);
  const ry = Math.max(1, Math.round((h / tile) * 4) / 4);
  const key = `${surface}|${rx}|${ry}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: tint,
      map: repeated(`${surface}_color.jpg`, true, rx, ry),
      normalMap: repeated(`${surface}_normal.jpg`, false, rx, ry),
      roughnessMap: surface === 'plaster' ? null : repeated(`${surface}_rough.jpg`, false, rx, ry),
      roughness: rough,
      metalness: 0,
    });
    cache.set(key, m);
  }
  return m;
}
