import { useMemo } from 'react';
import * as THREE from 'three';
import type { RepoView } from '../../../shared/types';
import { kanbanFor, useStore, type Agent, type KanbanCard } from '../store';
import { BOARD } from './layout';
import { drawKanban } from './draw';
import { useCanvasTexture, useInteractable } from './interact';
import { Box, Cyl } from './Toon';

export function KanbanBoard({ repo, agents }: { repo: RepoView; agents: Agent[] }) {
  const qa = useStore((s) => s.qa);
  const cols = useMemo(() => kanbanFor(repo, agents, qa), [repo, agents, qa]);
  // Only repaint the big canvas when what's written on it changes.
  const signature = useMemo(
    () =>
      JSON.stringify([
        repo.fullName,
        repo.autoAssign,
        repo.lastSync ? Math.floor(repo.lastSync / 60000) : 0,
        ...(Object.values(cols) as KanbanCard[][]).map((list) => list.map((c) => [c.key, c.title, c.note, c.agent?.name, c.agent?.color, c.tone])),
      ]),
    [cols, repo],
  );
  const texH = Math.round((2560 * BOARD.h) / BOARD.w);
  const tex = useCanvasTexture(2560, texH, (ctx) => drawKanban(ctx, 2560, texH, repo, cols), [signature]);
  const ref = useInteractable<THREE.Group>({ id: `board-${repo.id}`, label: 'Open the notice board', action: { kind: 'kanban', repoId: repo.id } }, 7);
  const cy = BOARD.y + BOARD.h / 2;
  return (
    <group ref={ref} position={[0, 0, BOARD.z]}>
      <Box size={[BOARD.w + 0.3, BOARD.h + 0.3, 0.08]} position={[0, cy, 0.03]} color="#2e1f14" shadow={false} />
      <mesh position={[0, cy, 0.065]}>
        <planeGeometry args={[BOARD.w, BOARD.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Box size={[3.2, 0.05, 0.16]} position={[3.5, BOARD.y - 0.12, 0.1]} color="#3a2819" />
      {['#e8dcc0', '#d6c8a8', '#c9b893'].map((c, i) => (
        <Cyl key={c} r={0.018} h={0.16} position={[2.6 + i * 0.22, BOARD.y - 0.075, 0.12]} rotation={[0, 0, Math.PI / 2]} color={c} />
      ))}
    </group>
  );
}
