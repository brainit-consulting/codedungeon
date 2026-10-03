import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store';
import { useSystemFeed } from '../systemFeed';
import { drawGauges, gaugeFace, OAK } from './gauges';
import { useCanvasTexture, useInteractable } from './interact';
import { GAUGE_BOARD, HALF_D } from './layout';
import { Box } from './Toon';

// The gauge board on every chamber's north wall, right of the SHIP IT sign. One canvas, one mesh; it repaints only
// when a shown number changes, and the shared feed (systemFeed.ts) polls only while a board or the panel is mounted.

const PX = [1024, 640] as const;
/** The board on the wall; E opens the gauges panel. */
export function GaugeBoard({ repoId }: { repoId: string }) {
  const { latest, failed } = useSystemFeed();
  const usage = useStore((s) => s.usage);
  const face = useMemo(() => gaugeFace(latest, usage, failed), [latest, usage, failed]);
  const signature = JSON.stringify(face);
  const tex = useCanvasTexture(PX[0], PX[1], (ctx) => drawGauges(ctx, PX[0], PX[1], face), [signature]);
  const ref = useInteractable<THREE.Group>({ id: `gauges-${repoId}`, label: 'Read the gauges', action: { kind: 'system' } }, 6);
  const g = GAUGE_BOARD;
  return (
    <group ref={ref} position={[g.x, g.y, -HALF_D]}>
      <Box size={[g.w + 0.12, g.h + 0.12, 0.05]} position={[0, 0, 0.025]} color={OAK} shadow={false} />
      <mesh position={[0, 0, 0.052]}>
        <planeGeometry args={[g.w, g.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}
