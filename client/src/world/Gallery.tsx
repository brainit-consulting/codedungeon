import { useMemo } from 'react';
import { ChamberDoors } from './Doors';
import { GALLERY, chamber, galleryColliders, galleryEnd } from './dungeon';
import { ELEVATOR, HALF_D, WALL_H } from './layout';
import { WallTorch } from './lightPool';
import { TORCH_Y } from './Shell';
import { stone } from './stone';

// The gallery: the passage south of the great hall that every chamber opens off. Its side walls double as each
// chamber's door wall (chambers don't draw their own), so a chamber that isn't drawn still has its wall and door
// here. Torches alternate sides, kept clear of the doorways.

const TORCH_EVERY = 8;

export function Gallery({ slots }: { slots: number[] }) {
  const walls = useMemo(() => galleryColliders(slots), [slots]);
  const end = galleryEnd(slots);
  const len = end - HALF_D;
  const mid = (HALF_D + end) / 2;
  const doors = useMemo(() => slots.map(chamber), [slots]);
  const torches = useMemo(() => {
    const out: { z: number; side: 1 | -1 }[] = [];
    let side: 1 | -1 = -1;
    for (let z = HALF_D + 4; z < end - 1; z += TORCH_EVERY) {
      const s = side;
      const clear = (zz: number) => !doors.some((c) => (c.side === 'west' ? -1 : 1) === s && Math.abs(c.z - zz) < ELEVATOR.doorHalf + 1);
      const at = clear(z) ? z : clear(z + 2.5) ? z + 2.5 : null;
      if (at !== null) out.push({ z: at, side: s });
      side = side === -1 ? 1 : -1;
    }
    return out;
  }, [end, doors]);
  const lintelH = WALL_H - ELEVATOR.doorHeight;
  const width = (GALLERY.half + GALLERY.wall) * 2;

  return (
    <group>
      {/* the floor runs under the side walls too, so each doorway has a threshold */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} material={stone('flagstone', width, len)}>
        <planeGeometry args={[width, len]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, mid]} material={stone('brick', GALLERY.half * 2, len)}>
        <planeGeometry args={[GALLERY.half * 2, len]} />
      </mesh>
      {walls.map((r, i) => {
        const w = r.maxX - r.minX;
        const d = r.maxZ - r.minZ;
        // brick runs along the wall's length, so long walls are turned to put their length on the box's x
        const along = d > w;
        return (
          <mesh
            key={i}
            position={[(r.minX + r.maxX) / 2, WALL_H / 2, (r.minZ + r.maxZ) / 2]}
            rotation={[0, along ? Math.PI / 2 : 0, 0]}
            material={stone('brick', along ? d : w, WALL_H)}
          >
            <boxGeometry args={[along ? d : w, WALL_H, along ? w : d]} />
          </mesh>
        );
      })}
      {/* over each doorway */}
      {doors.map((c) => {
        const x = (c.side === 'west' ? -1 : 1) * (GALLERY.half + GALLERY.wall / 2);
        return (
          <mesh key={c.slot} position={[x, ELEVATOR.doorHeight + lintelH / 2, c.z]} rotation={[0, Math.PI / 2, 0]} material={stone('brick', ELEVATOR.doorHalf * 2, lintelH)}>
            <boxGeometry args={[ELEVATOR.doorHalf * 2, lintelH, GALLERY.wall]} />
          </mesh>
        );
      })}
      <ChamberDoors slots={slots} />
      {torches.map(({ z, side }) => (
        <WallTorch key={z} position={[side * (GALLERY.half - 0.02), TORCH_Y, z]} rotationY={side === -1 ? Math.PI / 2 : -Math.PI / 2} />
      ))}
    </group>
  );
}
