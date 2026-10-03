import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AdaptiveResolution, FrameWhilePaused, MAX_DPR, StatsProbe, statsEnabled, useRenderPaused } from '../perf';
import { repoOnFloor, useStore } from '../store';
import { Ambience } from './Ambience';
import { Cat } from './Cat';
import { chamber, chambersToDraw, dungeonColliders, hallDrawn } from './dungeon';
import { Gallery } from './Gallery';
import { Lobby } from './Lobby';
import { OfficeFloor } from './OfficeFloor';
import { Player } from './Player';
import { Lights } from './Shell';

/** Which rooms to draw for where the player stands, re-checked a few times a second. */
function useVisibleRooms(slots: number[]) {
  const [seen, setSeen] = useState<{ hall: boolean; chambers: number[] }>({ hall: true, chambers: [] });
  const frame = useRef(0);
  const last = useRef({ x: 0, z: 0 });
  useFrame(({ camera }) => {
    // re-check at once after a walk-in (the directory, a Visit button: a jump of metres in one frame), so you never
    // arrive in empty space
    const jumped = Math.hypot(camera.position.x - last.current.x, camera.position.z - last.current.z) > 3;
    last.current = { x: camera.position.x, z: camera.position.z };
    if (++frame.current % 15 && !jumped) return;
    const { x, z } = camera.position;
    const chambers = chambersToDraw(x, z, slots);
    const hall = hallDrawn(x, z, slots);
    setSeen((cur) => (cur.hall === hall && cur.chambers.join() === chambers.join() ? cur : { hall, chambers }));
  });
  return seen;
}

/** The great hall when it's in view, the gallery always, and the chambers near you, each turned into its place. */
function Dungeon({ slots }: { slots: number[] }) {
  const repos = useStore((s) => s.repos);
  const seen = useVisibleRooms(slots);
  return (
    <>
      {/* hidden rather than unmounted when you're away: rebuilding it (models, signs, the darts' physics) stutters */}
      <group visible={seen.hall}>
        <Lobby />
      </group>
      <Gallery slots={slots} />
      <Cat slots={slots} />
      <Ambience />
      {seen.chambers.map((slot) => {
        const repo = repoOnFloor(repos, slot);
        if (!repo) return null;
        const c = chamber(slot);
        return (
          <group key={repo.id} position={[c.x, 0, c.z]} rotation={[0, c.rot, 0]}>
            <OfficeFloor repo={repo} />
          </group>
        );
      })}
    </>
  );
}

export function Game() {
  const repos = useStore((s) => s.repos);
  const slotKey = repos.map((r) => r.floor).sort((a, b) => a - b).join();
  const slots = useMemo(() => (slotKey ? slotKey.split(',').map(Number) : []), [slotKey]);
  const colliders = useMemo(() => dungeonColliders(slots), [slots]);
  // Stop drawing while nobody can see the office; switching back to 'always' draws a fresh frame at once.
  const paused = useRenderPaused();
  const [maxDpr, setMaxDpr] = useState(MAX_DPR);

  return (
    <Canvas
      frameloop={paused ? 'never' : 'always'}
      dpr={[1, maxDpr]}
      camera={{ fov: 72, near: 0.05, far: 60, position: [0, 1.65, 10] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <color attach="background" args={['#050403']} />
      <fog attach="fog" args={['#0a0705', 8, 34]} />
      <Lights />
      <Suspense fallback={null}>
        <Dungeon slots={slots} />
      </Suspense>
      <Player colliders={colliders} slots={slots} />
      <FrameWhilePaused paused={paused} />
      <AdaptiveResolution onChange={setMaxDpr} />
      {statsEnabled && <StatsProbe paused={paused} />}
    </Canvas>
  );
}
