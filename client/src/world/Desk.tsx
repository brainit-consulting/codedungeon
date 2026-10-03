import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, type Agent } from '../store';
import { FIRE, Flame, useFireLight } from './lightPool';
import { Model } from './models';
import { Character } from './Character';
import { RIGGED, RIGGED_CHAIR, RIGGED_FULL, RiggedCharacter } from './RiggedCharacter';
import { drawSign, drawTag, drawTerminal } from './draw';
import { useCanvasTexture, useInteractable } from './interact';
import { glow, toon } from './materials';
import { hashId } from './appearance';

const SCREEN = { w: 1.0, h: 0.6, px: 896, py: 538 };

/** The live terminal texture for one agent's laptop. Only repaints when something changed and the player is nearby. */
function useTerminalTexture(agent: Agent, anchor: React.RefObject<THREE.Object3D | null>) {
  const camera = useThree((s) => s.camera);
  const { canvas, tex } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = SCREEN.px;
    canvas.height = SCREEN.py;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return { canvas, tex };
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  const dirty = useRef(true);
  const lastPaint = useRef(0);
  const shot = useRef<HTMLImageElement | null>(null);
  const agentRef = useRef(agent);
  agentRef.current = agent;
  useEffect(() => {
    dirty.current = true;
  }, [agent]);

  useEffect(
    () =>
      useStore.subscribe((s, prev) => {
        if (s.logs[agent.id] !== prev.logs[agent.id]) dirty.current = true;
        if (s.screens[agent.id] !== prev.screens[agent.id]) {
          const img = new Image();
          img.onload = () => {
            shot.current = img;
            dirty.current = true;
          };
          img.src = `/api/agents/${agent.id}/screen?t=${s.screens[agent.id]}`;
        }
      }),
    [agent.id],
  );
  useEffect(() => {
    const at = useStore.getState().screens[agent.id];
    if (!at) return;
    const img = new Image();
    img.onload = () => {
      shot.current = img;
      dirty.current = true;
    };
    img.src = `/api/agents/${agent.id}/screen?t=${at}`;
  }, [agent.id]);
  useEffect(() => {
    document.fonts?.ready.then(() => (dirty.current = true));
  }, []);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const now = performance.now();
    const a = agentRef.current;
    const animating = a.status === 'working' || a.status === 'preparing' || (a.status === 'idle' && (useStore.getState().logs[a.id]?.length ?? 0) <= 1);
    if (!dirty.current && !(animating && now - lastPaint.current > 200)) return;
    if (anchor.current) {
      anchor.current.getWorldPosition(tmp);
      const dist = tmp.distanceTo(camera.position);
      if (dist > 16 && lastPaint.current !== 0) return;
      if (dist > 8 && now - lastPaint.current < 900) return;
    }
    if (now - lastPaint.current < 120) return;
    lastPaint.current = now;
    dirty.current = false;
    const logs = useStore.getState().logs[a.id] ?? [];
    const recentShot = a.screenshotAt != null && Date.now() - a.screenshotAt < 120_000;
    const showBrowser = a.hasScreenshot && a.status !== 'idle' && (a.currentTool?.startsWith('mcp__playwright') || recentShot || a.status === 'done');
    const s = useStore.getState().settings;
    const program = a.role !== 'ceo' && s.runtime === 'terminal' ? a.cli || s.defaultCli : 'claude';
    drawTerminal(canvas.getContext('2d')!, SCREEN.px, SCREEN.py, a, logs, shot.current, !!showBrowser, now, program);
    tex.needsUpdate = true;
  });
  return tex;
}

function NameTag({ agent }: { agent: Agent }) {
  const tex = useCanvasTexture(512, 96, (ctx) => drawTag(ctx, 512, 96, agent), [agent.name, agent.status, agent.issueNumber, agent.currentTool, agent.color]);
  return (
    <Billboard position={[0, 1.98, -0.32]}>
      <mesh>
        <planeGeometry args={[1.15, 0.216]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

const MONITOR = { y: 1.31, z: -0.3, tilt: -0.06 };
const FRAME = new THREE.MeshStandardMaterial({ color: '#2e1f14', roughness: 0.85 });
const BRASS = new THREE.MeshStandardMaterial({ color: '#8a6a32', roughness: 0.45, metalness: 0.8 });
const PARCHMENT = new THREE.MeshStandardMaterial({ color: '#b9a682', roughness: 1 });
const LEATHER = new THREE.MeshStandardMaterial({ color: '#3d2416', roughness: 0.9 });

/** The scrying slate: the agent's live screen in a heavy wooden frame on an easel, readable over the agent's head. */
function Monitor({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <group>
      {/* easel legs */}
      {[-0.32, 0.32].map((x) => (
        <mesh key={x} position={[x, 1.0, MONITOR.z - 0.06]} rotation={[0.08, 0, x < 0 ? 0.06 : -0.06]} material={FRAME}>
          <boxGeometry args={[0.05, 0.5, 0.05]} />
        </mesh>
      ))}
      <group position={[0, MONITOR.y, MONITOR.z]} rotation={[MONITOR.tilt, 0, 0]}>
        <mesh material={FRAME}>
          <boxGeometry args={[SCREEN.w + 0.12, SCREEN.h + 0.12, 0.05]} />
        </mesh>
        {children}
        {/* the house's colour as a brass-ringed seal on top of the frame */}
        <mesh position={[0, SCREEN.h / 2 + 0.06, 0.03]} rotation={[Math.PI / 2, 0, 0]} material={BRASS}>
          <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        </mesh>
        <mesh position={[0, SCREEN.h / 2 + 0.06, 0.041]} material={glow(accent)}>
          <circleGeometry args={[0.035, 16]} />
        </mesh>
      </group>
    </group>
  );
}

function LiveMonitor({ agent, accent }: { agent: Agent; accent: string }) {
  const screenRef = useRef<THREE.Mesh>(null);
  const tex = useTerminalTexture(agent, screenRef);
  return (
    <Monitor accent={accent}>
      <mesh ref={screenRef} position={[0, 0, 0.026]}>
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </Monitor>
  );
}

function VacantMonitor({ accent, qa }: { accent: string; qa: boolean }) {
  const tex = useCanvasTexture(
    640,
    384,
    (ctx) => {
      ctx.fillStyle = '#151621';
      ctx.fillRect(0, 0, 640, 384);
      drawSign(ctx, 640, 384, [
        { text: qa ? '🔍' : '🪑', size: 70 },
        { text: qa ? 'QA STATION' : 'VACANT', size: 70, color: '#ffd6a5' },
        { text: qa ? 'press E or click to hire a tester' : 'press E or click to hire an agent', size: 36, color: '#a9adc6', weight: 500 },
      ], 'rgba(0,0,0,0)');
    },
    [qa],
  );
  return (
    <Monitor accent={accent}>
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[SCREEN.w, SCREEN.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </Monitor>
  );
}

/** An open ledger and a quill in its inkpot, where the agent's hands rest (was: the keyboard and mouse). */
function Ledger() {
  return (
    <group position={[0, 0.745, RIGGED ? 0.31 : 0.27]}>
      <mesh position={[0, 0.01, 0]} material={LEATHER}>
        <boxGeometry args={[0.56, 0.02, 0.36]} />
      </mesh>
      {[-0.135, 0.135].map((x) => (
        <mesh key={x} position={[x, 0.024, 0]} rotation={[0, 0, x < 0 ? 0.04 : -0.04]} material={PARCHMENT}>
          <boxGeometry args={[0.26, 0.012, 0.33]} />
        </mesh>
      ))}
      {/* inkpot and quill */}
      <mesh position={[0.46, 0.035, -0.02]} material={IRON_DARK}>
        <cylinderGeometry args={[0.035, 0.04, 0.07, 10]} />
      </mesh>
      <mesh position={[0.48, 0.15, -0.02]} rotation={[0, 0, -0.35]} material={PARCHMENT}>
        <coneGeometry args={[0.018, 0.22, 6]} />
      </mesh>
    </group>
  );
}

/**
 * What's left lying about on a working bench: always the coder's mug, turned their own way, and one more thing picked
 * by the bench's owner (another mug, a bottle, the remains of a meal, a scroll). Kept to the right of the ledger and
 * clear of the hands; the left is the candle's, or the tester's potions.
 */
function Leftovers({ seed, qa }: { seed: number; qa: boolean }) {
  const turn = (seed % 628) / 100;
  const extra = seed % 5;
  return (
    <group>
      <Model name="props/Mug" position={[0.76, 0.74, 0.12]} rotation={[0, turn, 0]} />
      {extra === 0 && <Model name="props/Mug" position={[0.62, 0.74, -0.2]} rotation={[0, turn + 2, 0]} />}
      {extra === 1 && <Model name="props/Bottle_1" position={[0.66, 0.74, -0.22]} />}
      {extra === 2 && (
        <group position={[0.66, 0.74, -0.18]} rotation={[0, turn, 0]}>
          <Model name="props/Table_Plate" />
          <Model name="props/Table_Knife" position={[0.02, 0.015, 0.02]} rotation={[0, 0.5, 0]} />
        </group>
      )}
      {extra === 3 && <Model name="props/Scroll_1" position={[0.64, 0.75, -0.2]} rotation={[0, turn, 0]} />}
      {extra === 4 && !qa && <Model name="props/SmallBottle" position={[-0.6, 0.74, 0.22]} />}
    </group>
  );
}

const IRON_DARK = new THREE.MeshStandardMaterial({ color: '#1d1c1b', roughness: 0.5, metalness: 0.6 });

/** A short candle on its holder, lit, with its own small light. */
function DeskCandle({ position }: { position: [number, number, number] }) {
  const fire = useRef<THREE.Group>(null);
  useFireLight(fire, FIRE.candle);
  return (
    <group position={position}>
      <Model name="props/CandleStick" />
      <group ref={fire} position={[-0.04, 0.16, 0]}>
        <Flame size={0.6} />
      </group>
    </group>
  );
}

export function Desk({
  agent,
  accent,
  repoId,
  position,
  role = 'dev',
  rotationY = 0,
}: {
  agent: Agent | null;
  accent: string;
  repoId: string;
  position: [number, number, number];
  role?: 'dev' | 'qa';
  rotationY?: number;
}) {
  const qa = role === 'qa';
  const ref = useInteractable<THREE.Group>(
    agent
      ? {
          id: `agent-${agent.id}`,
          label: agent.role === 'ceo' ? `Open ${agent.name}'s bench (DungeonMaster) · P writes to them from anywhere` : `View ${agent.name}'s ${qa ? 'test run' : 'terminal'}`,
          action: { kind: 'terminal', agentId: agent.id },
        }
      : {
          id: `vacant-${role}-${repoId}-${position.join()}`,
          label: qa ? 'Recruit a tester for this testing bench' : 'Recruit a coder for this bench',
          action: { kind: 'hire', repoId, role },
        },
    3.6,
  );
  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]}>
      {/* the workbench, its top at the old desk's height */}
      <Model name="props/Workbench" scale={[0.94, 0.83, 0.93]} />

      {agent ? (
        <>
          <LiveMonitor agent={agent} accent={accent} />
          <Ledger />
          <Leftovers seed={hashId(agent.id)} qa={qa} />
          <NameTag agent={agent} />
        </>
      ) : (
        <>
          <VacantMonitor accent={accent} qa={qa} />
          {/* someone left their mug behind */}
          {hashId(position.join()) % 3 === 0 && <Model name="props/Mug" position={[0.5, 0.74, 0.2]} rotation={[0, 2.4, 0]} />}
        </>
      )}
      {qa ? (
        // the tester's potions: every good QA bench tests something
        <group position={[-0.72, 0.74, -0.2]}>
          <Model name="props/Potion_1" position={[-0.1, 0, 0]} />
          <Model name="props/Potion_2" position={[0.02, 0, 0.04]} />
          <Model name="props/Potion_4" position={[0.13, 0, -0.02]} />
        </group>
      ) : (
        <DeskCandle position={[-0.76, 0.74, -0.22]} />
      )}

      {/* chair */}
      <group position={[0, 0, agent || RIGGED_FULL ? (RIGGED ? RIGGED_CHAIR : 0.8) : 0.6]}>
        <Model name="props/Chair_1" rotation={[0, Math.PI, 0]} />
        {agent && <Character agent={agent} />}
        {/* ?rigged=full: a stand-in at every empty bench, to measure a full chamber */}
        {!agent && RIGGED_FULL && <RiggedCharacter agent={standIn(`${repoId}-${role}-${position.join()}`)} />}
      </group>
    </group>
  );
}

export function DeskFloorMarker({ color }: { color: string }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0.3]} receiveShadow material={toon(color, { opacity: 0.35 })}>
      <planeGeometry args={[2.6, 2.3]} />
    </mesh>
  );
}

/** A pretend coder for the ?rigged=full measurement: working, so they animate like a busy room. */
function standIn(id: string): Agent {
  return { id, name: 'Stand-in', role: 'dev', look: id.length % 2 ? 'feminine' : 'masculine', hair: '#4a3020', status: 'working' } as unknown as Agent;
}
