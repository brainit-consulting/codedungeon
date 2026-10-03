import { memo, useEffect, useMemo } from 'react';
import { CuboidCollider, interactionGroups, Physics, RigidBody, useRapier } from '@react-three/rapier';
import { HALF_D, HALF_W, WALL_H, lobbyColliders, type Rect } from '../layout';
import { HandDarts } from './HandDarts';
import { setToySource } from './probe';

// Loaded lazily by ./index.tsx, so Rapier stays out of the main bundle. The only thing in it is the dart board and
// its darts; the building is here so darts have something to hit.

const STEP = 1 / 60;

const G = { building: 0, darts: 1 };
const BUILDING_GROUPS = interactionGroups(G.building, [G.darts]);
const DART_GROUPS = interactionGroups(G.darts, [G.building, G.darts]);

/** Fixed colliders generated from layout.ts: floor, ceiling, walls and furniture, each at its own height. */
function Building() {
  const rects = useMemo<Rect[]>(() => lobbyColliders(), []);
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[HALF_W + 1, 0.5, HALF_D + 4]} position={[0, -0.5, 2]} friction={0.8} restitution={0.3} collisionGroups={BUILDING_GROUPS} />
      <CuboidCollider args={[HALF_W + 1, 0.5, HALF_D + 4]} position={[0, WALL_H + 0.5, 2]} collisionGroups={BUILDING_GROUPS} />
      {rects.map((r, i) => {
        const h = r.h ?? WALL_H;
        return (
          <CuboidCollider
            key={i}
            args={[(r.maxX - r.minX) / 2, h / 2, (r.maxZ - r.minZ) / 2]}
            position={[(r.minX + r.maxX) / 2, h / 2, (r.minZ + r.maxZ) / 2]}
            friction={0.6}
            restitution={0.3}
            collisionGroups={BUILDING_GROUPS}
          />
        );
      })}
    </RigidBody>
  );
}

function Probe() {
  const { world } = useRapier();
  useEffect(() => {
    setToySource(() => world.bodies.len());
    return () => setToySource(null);
  }, [world]);
  return null;
}

function ToyWorld() {
  return (
    <Physics timeStep={STEP} numSolverIterations={8}>
      <Building />
      <Probe />
      <HandDarts groups={DART_GROUPS} />
    </Physics>
  );
}

export default memo(ToyWorld);
