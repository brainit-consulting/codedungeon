import { useMemo } from 'react';
import type { RepoView } from '../../../shared/types';
import { agentsOnRepo, useStore } from '../store';
import { AppMonitor } from './AppMonitor';
import { Desk } from './Desk';
import { drawSign } from './draw';
import { GaugeBoard } from './GaugeBoard';
import * as THREE from 'three';
import { signStatus } from '../../../shared/ship';
import { useCanvasTexture, useInteractable } from './interact';
import { KanbanBoard } from './KanbanBoard';
import { CHAMBER_BOOKCASE, DESK_ROWS, HALF_D, HALF_W, MAX_DESKS, QA_LAB, QA_ROTATION, WALL_H, deskPosition, qaDeskPosition } from './layout';
import { Bookcase } from './Books';
import { shade } from './materials';
import { Chandelier, CoffeeTable, Couch, Kitchenette, Plant, WallClock, WaterCooler } from './Props';
import { Shell, torchesOn } from './Shell';

// Torches where the chamber's walls are clear: not over the app screen, the clock, the whiteboard, the QA lab or
// the signs either side of the door.
const CHAMBER_TORCHES = [...torchesOn.west([-8, 0, 9]), ...torchesOn.east([-9, 3]), ...torchesOn.north([-8.5]), ...torchesOn.south([-10, 10])];

export function WallSign({
  position,
  size,
  px,
  draw,
  deps,
  rotationY = Math.PI,
}: {
  position: [number, number, number];
  size: [number, number];
  px: [number, number];
  draw: (ctx: CanvasRenderingContext2D) => void;
  deps: unknown[];
  rotationY?: number;
}) {
  const tex = useCanvasTexture(px[0], px[1], draw, deps);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

/** The SHIP IT sign: where this chamber's app stands on Vercel, and E opens the panel. */
function ShipSign({ repo }: { repo: RepoView }) {
  const s = repo.ship;
  const status = signStatus({ method: s.method, busy: s.busy, lastFailed: s.log[0]?.ok === false, autoAssign: s.autoAssign, live: s.live, waiting: s.waiting.length });
  const ref = useInteractable<THREE.Group>({ id: `ship-${repo.id}`, label: 'Open SHIP IT', action: { kind: 'ship', repoId: repo.id } }, 6);
  return (
    <group ref={ref}>
      <WallSign
        position={[10, 2.2, -HALF_D + 0.03]}
        rotationY={0}
        size={[2.2, 1.4]}
        px={[512, 326]}
        draw={(ctx) =>
          drawSign(ctx, 512, 326, [
            { text: '⚔️', size: 80 },
            { text: 'SHIP IT', size: 64 },
            { text: status, size: 28, weight: 500 },
          ], '#2f4d7a')
        }
        deps={[status]}
      />
    </group>
  );
}

export function OfficeFloor({ repo }: { repo: RepoView }) {
  const allAgents = useStore((s) => s.agents);
  const agents = useMemo(() => agentsOnRepo(allAgents, repo.id), [allAgents, repo.id]);
  const devBySlot = useMemo(() => new Map(agents.filter((a) => a.role === 'dev').map((a) => [a.desk, a])), [agents]);
  const qaBySlot = useMemo(() => new Map(agents.filter((a) => a.role === 'qa').map((a) => [a.desk, a])), [agents]);
  const working = agents.filter((a) => a.status === 'working' || a.status === 'preparing').length;
  const qaRecords = useStore((s) => s.qa);
  const inQa = Object.values(qaRecords).filter((q) => q.repoId === repo.id && q.status !== 'passed').length;
  const ready = Object.values(qaRecords).filter((q) => q.repoId === repo.id && q.status === 'passed').length;

  return (
    <group>
      <Shell southWall={false} torches={CHAMBER_TORCHES} />
      {/* a chandelier over each row, between the desk columns */}
      {DESK_ROWS.flatMap((z) => [-7, 7].map((x) => <Chandelier key={`${x},${z}`} position={[x, WALL_H, z + 0.3]} />))}

      {Array.from({ length: MAX_DESKS }, (_, slot) => {
        const { x, z } = deskPosition(slot);
        return <Desk key={slot} agent={devBySlot.get(slot) ?? null} accent={repo.color} repoId={repo.id} position={[x, 0, z]} />;
      })}

      {/* QA lab */}
      {QA_LAB.stations.map((_, slot) => {
        const { x, z } = qaDeskPosition(slot);
        return <Desk key={`qa${slot}`} role="qa" rotationY={QA_ROTATION} agent={qaBySlot.get(slot) ?? null} accent={repo.color} repoId={repo.id} position={[x, 0, z]} />;
      })}
      <WallSign
        position={[HALF_W - 0.03, 3.2, -2]}
        rotationY={-Math.PI / 2}
        size={[3.2, 0.55]}
        px={[768, 132]}
        draw={(ctx) => drawSign(ctx, 768, 132, [{ text: `🔍 ASSAY ROOM · ${inQa} in testing`, size: 56 }], '#a5512a')}
        deps={[inQa]}
      />

      <KanbanBoard repo={repo} agents={agents} />
      <AppMonitor repo={repo} agents={agents} />

      <WallSign
        position={[-4.6, 1.95, HALF_D - 0.03]}
        size={[4.2, 1.3]}
        px={[1024, 317]}
        draw={(ctx) =>
          drawSign(
            ctx,
            1024,
            317,
            [
              { text: `CHAMBER ${repo.floor}`, size: 58, color: 'rgba(255,255,255,0.85)', weight: 600 },
              { text: repo.fullName, size: 74 },
              { text: repo.description || 'no description', size: 36, weight: 500, color: 'rgba(255,255,255,0.85)' },
            ],
            repo.color,
          )
        }
        deps={[repo.floor, repo.fullName, repo.description, repo.color]}
      />
      <WallSign
        position={[4.6, 1.95, HALF_D - 0.03]}
        size={[4.2, 1.3]}
        px={[1024, 317]}
        draw={(ctx) =>
          drawSign(
            ctx,
            1024,
            317,
            [
              { text: `⚒️ ${agents.length} in the guild`, size: 54 },
              { text: `⚙️ ${working} busy · 🔍 ${inQa} in QA · ✅ ${ready} to merge`, size: 46, weight: 600 },
              { text: `📋 ${repo.issues.length} open issue${repo.issues.length === 1 ? '' : 's'}${repo.autoAssign ? ' · ⚡ auto' : ''}`, size: 44, weight: 500 },
            ],
            '#fffdf5',
          )
        }
        deps={[agents.length, working, inQa, ready, repo.issues.length, repo.autoAssign]}
      />

      <Plant position={[-7.1, 0, -HALF_D + 0.7]} />
      <Plant position={[7.1, 0, -HALF_D + 0.7]} />
      <Plant position={[-HALF_W + 0.7, 0, HALF_D - 0.8]} scale={1.2} />
      <Plant position={[-11, 0, -HALF_D + 0.7]} scale={1.1} />
      <Plant position={[HALF_W - 0.7, 0, HALF_D - 0.7]} scale={0.9} pot="#6e4a30" />
      <Couch position={[-HALF_W + 0.9, 0, 6.5]} rotationY={-Math.PI / 2} color={shade(repo.color, -0.05)} />
      <Bookcase position={[CHAMBER_BOOKCASE.x, 0, CHAMBER_BOOKCASE.z]} rotationY={Math.PI / 2} seed={10 + repo.floor} offset={repo.floor * 7} />
      <CoffeeTable position={[-HALF_W + 2.6, 0, 6.5]} rotationY={Math.PI / 2} />
      <Kitchenette position={[HALF_W - 0.45, 0, 7]} />
      <WaterCooler position={[HALF_W - 0.5, 0, -9.5]} />
      <WallClock position={[-10, 2.75, -HALF_D + 0.05]} />
      <ShipSign repo={repo} />
      <GaugeBoard repoId={repo.id} />
    </group>
  );
}
