import { useMemo } from 'react';
import * as THREE from 'three';
import { ELEVATOR, HALF_D, HALF_W, WALL_H } from './layout';
import { LightPool, WallTorch } from './lightPool';
import { stone } from './stone';

// Every room's stonework: flagstone floor, brick walls, a brick vault crossed by dark beams, and torches on the walls.
// No windows: the dungeon is underground. `accent` and `floorColor` are kept for the rooms' callers (rugs, signs) and
// no longer colour the shell.

const BEAM = new THREE.MeshStandardMaterial({ color: '#2b1e15', roughness: 0.9 });
const BEAM_EVERY = 4;

/** A torch on a wall: x, z on the wall's face, and the turn that points it into the room. */
export type TorchSpot = [x: number, z: number, rotY: number];

/** Torches for walls facing into a room: west (x = -HALF_W), east, north (z = -HALF_D) and south. */
export const torchesOn = {
  west: (zs: number[]): TorchSpot[] => zs.map((z) => [-HALF_W + 0.02, z, Math.PI / 2]),
  east: (zs: number[]): TorchSpot[] => zs.map((z) => [HALF_W - 0.02, z, -Math.PI / 2]),
  north: (xs: number[]): TorchSpot[] => xs.map((x) => [x, -HALF_D + 0.02, 0]),
  south: (xs: number[]): TorchSpot[] => xs.map((x) => [x, HALF_D - 0.02, Math.PI]),
};

export const TORCH_Y = 2.25;

export function Shell({
  southWall = true,
  torches = [],
}: {
  accent?: string;
  floorColor?: string;
  westWindows?: number[];
  eastWindows?: number[];
  seed?: number;
  /** A chamber's south wall is the gallery's wall (Gallery.tsx), so the chamber leaves it out. */
  southWall?: boolean;
  torches?: TorchSpot[];
}) {
  const t = 0.3;
  const { doorHalf, doorHeight } = ELEVATOR;
  const W = HALF_W * 2;
  const D = HALF_D * 2;
  const southSeg = HALF_W - doorHalf;
  const beams = useMemo(() => {
    const out: number[] = [];
    for (let z = -HALF_D + BEAM_EVERY; z < HALF_D - 0.5; z += BEAM_EVERY) out.push(z);
    return out;
  }, []);

  return (
    <group>
      {/* floor + vault */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={stone('flagstone', W, D)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, 0]} material={stone('brick', W, D)}>
        <planeGeometry args={[W, D]} />
      </mesh>
      {beams.map((z) => (
        <mesh key={z} position={[0, WALL_H - 0.18, z]} material={BEAM}>
          <boxGeometry args={[W, 0.36, 0.3]} />
        </mesh>
      ))}

      {/* walls */}
      <mesh position={[0, WALL_H / 2, -HALF_D - t / 2]} material={stone('brick', W + t * 2, WALL_H)}>
        <boxGeometry args={[W + t * 2, WALL_H, t]} />
      </mesh>
      <mesh position={[-HALF_W - t / 2, WALL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={stone('brick', D, WALL_H)}>
        <boxGeometry args={[D, WALL_H, t]} />
      </mesh>
      <mesh position={[HALF_W + t / 2, WALL_H / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={stone('brick', D, WALL_H)}>
        <boxGeometry args={[D, WALL_H, t]} />
      </mesh>
      {southWall &&
        [-1, 1].map((s) => (
          <mesh key={s} position={[s * (doorHalf + southSeg / 2), WALL_H / 2, HALF_D + t / 2]} material={stone('brick', southSeg, WALL_H)}>
            <boxGeometry args={[southSeg, WALL_H, t]} />
          </mesh>
        ))}
      {southWall && (
        <mesh position={[0, (WALL_H + doorHeight) / 2, HALF_D + t / 2]} material={stone('brick', doorHalf * 2, WALL_H - doorHeight)}>
          <boxGeometry args={[doorHalf * 2, WALL_H - doorHeight, t]} />
        </mesh>
      )}

      {torches.map(([x, z, r]) => (
        <WallTorch key={`${x},${z}`} position={[x, TORCH_Y, z]} rotationY={r} />
      ))}
    </group>
  );
}

/** Underground: no sun. A faint warm fill so nothing is pitch black, and the firelight pool does the rest. */
export function Lights() {
  return (
    <>
      <hemisphereLight args={['#6b5040', '#1a120c', 1.1]} />
      <ambientLight color="#4a382a" intensity={0.45} />
      <LightPool />
    </>
  );
}
