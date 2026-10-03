import { useMemo } from 'react';
import { GALLERY, chamber, galleryColliders, galleryEnd } from './dungeon';
import { ELEVATOR, HALF_D, WALL_H } from './layout';
import { glow, toon } from './materials';
import { Box } from './Toon';

// The gallery: the passage south of the great hall that every chamber opens off. Its side walls double as each
// chamber's door wall (chambers don't draw their own), so a chamber that isn't drawn still has its wall and door
// here. Placeholder looks until the dungeon's models arrive (step 3).

const WALL = '#fbf3e4';
const FLOOR = '#c9a27a';

export function Gallery({ slots }: { slots: number[] }) {
  const walls = useMemo(() => galleryColliders(slots), [slots]);
  const end = galleryEnd(slots);
  const len = end - HALF_D;
  const mid = (HALF_D + end) / 2;
  const lintels = useMemo(() => slots.map(chamber), [slots]);
  const lights = useMemo(() => {
    const out: number[] = [];
    for (let z = HALF_D + 4; z < end - 1; z += 8) out.push(z);
    return out;
  }, [end]);
  const wall = toon(WALL);
  const lintelH = WALL_H - ELEVATOR.doorHeight;

  return (
    <group>
      {/* the floor runs under the side walls too, so each doorway has a threshold */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, mid]} receiveShadow material={toon(FLOOR)}>
        <planeGeometry args={[(GALLERY.half + GALLERY.wall) * 2, len]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, WALL_H, mid]} material={toon('#f3efe6')}>
        <planeGeometry args={[GALLERY.half * 2, len]} />
      </mesh>
      {walls.map((r, i) => (
        <mesh key={i} position={[(r.minX + r.maxX) / 2, WALL_H / 2, (r.minZ + r.maxZ) / 2]} material={wall} receiveShadow>
          <boxGeometry args={[r.maxX - r.minX, WALL_H, r.maxZ - r.minZ]} />
        </mesh>
      ))}
      {/* over each doorway */}
      {lintels.map((c) => {
        const x = (c.side === 'west' ? -1 : 1) * (GALLERY.half + GALLERY.wall / 2);
        return (
          <mesh key={c.slot} position={[x, ELEVATOR.doorHeight + lintelH / 2, c.z]} material={wall}>
            <boxGeometry args={[GALLERY.wall, lintelH, ELEVATOR.doorHalf * 2]} />
          </mesh>
        );
      })}
      {lights.map((z) => (
        <group key={z} position={[0, WALL_H - 0.04, z]}>
          <Box size={[0.5, 0.06, 1.4]} color="#e9ecef" shadow={false} />
          <mesh position={[0, -0.035, 0]} rotation={[Math.PI / 2, 0, 0]} material={glow('#fffbe8')}>
            <planeGeometry args={[0.38, 1.25]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
