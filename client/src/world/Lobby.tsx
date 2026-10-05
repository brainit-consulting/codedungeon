import { useMemo } from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { pendingRequests, useStore, type Agent } from '../store';
import { CEO_ID, type HireRequestView } from '../../../shared/types';
import { Character } from './Character';
import { Desk } from './Desk';
import { Bar, FeastTables, Hearth } from './GreatHall';
import { drawCandidateTag, drawSign, roundRect, SANS, TITLE } from './draw';
import { useCanvasTexture, useInteractable } from './interact';
import { CEO_DESK, CEO_ROOM, HALF_D, HALF_W, MANAGER_DESK, MANAGER_ROOM, OFFICE_CANDELABRUM, WAITING, WAITING_ROTATION } from './layout';
import { Model } from './models';
import { WallSign } from './OfficeFloor';
import { FIRE } from './lightPool';
import { Bookshelf, Couch, CoffeeTable, GlassWall, Plant, Rug, WallClock } from './Props';
import { Shell, torchesOn } from './Shell';

// Torches where the walls are clear: not over the bookshelf, the trophy cabinet, the CEO's board, the waiting-room
// sign, the directory or the dart board.
const HALL_TORCHES = [...torchesOn.west([-1.2, 9.2]), ...torchesOn.east([1.5]), ...torchesOn.north([-3.2, 14.7]), ...torchesOn.south([-8, 8])];
import { Box } from './Toon';
import { Toys } from './toys';
import { Wolf } from './Wolf';
import { SpoilsChest } from './SpoilsChest';
import { Tavern } from './Tavern';

/** The tops of the two trophy shelves above the chest of spoils, four chalices each. */
const SHELVES = [1.12, 1.5];

const SLATE_FRAME = new THREE.MeshStandardMaterial({ color: '#2e1f14', roughness: 0.85 });

const ACCENT = '#a0441c'; // rust, the dungeon's one accent
const CEO_ACCENT = '#5e3a63'; // purpure, the DungeonMaster's tincture

function useOfficeStats() {
  const repos = useStore((s) => s.repos);
  const agents = useStore((s) => s.agents);
  const settings = useStore((s) => s.settings);
  const qa = useStore((s) => s.qa);
  const requests = useStore((s) => s.requests);
  return useMemo(() => {
    const list = Object.values(agents);
    const working = list.filter((a) => a.status === 'working' || a.status === 'preparing').length;
    const openPrs = repos.reduce((n, r) => n + r.pulls.filter((p) => p.state === 'OPEN').length, 0);
    const merged = repos.reduce((n, r) => n + r.pulls.filter((p) => p.state === 'MERGED').length, 0);
    const issues = repos.reduce((n, r) => n + r.issues.length, 0);
    const floors = repos.map((r) => ({
      floor: r.floor,
      name: r.fullName,
      color: r.color,
      team: list.filter((a) => a.repoId === r.id).length,
      working: list.filter((a) => a.repoId === r.id && (a.status === 'working' || a.status === 'preparing')).length,
      prs: r.pulls.filter((p) => p.state === 'OPEN').length,
    }));
    const qaList = Object.values(qa);
    const inQa = qaList.filter((q) => q.status !== 'passed').length;
    const readyToMerge = qaList.filter((q) => q.status === 'passed').length;
    const pending = pendingRequests(requests).length;
    return { repos: repos.length, agents: list.length, working, openPrs, inQa, readyToMerge, merged, issues, floors, max: settings.sessionLimit, pending };
  }, [repos, agents, settings, qa, requests]);
}

function ManagerComputer() {
  const stats = useOfficeStats();
  const ref = useInteractable<THREE.Group>({ id: 'manager-console', label: "Open the Overlord's ledger", action: { kind: 'manager' } }, 3.2);
  const tex = useCanvasTexture(
    1024,
    640,
    (ctx) => {
      ctx.fillStyle = '#221e1b';
      ctx.fillRect(0, 0, 1024, 640);
      ctx.fillStyle = '#e8a96a';
      ctx.font = `700 54px ${SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText("The Overlord's Ledger", 50, 70);
      const rows: [string, string][] = [
        ['Chambers (repos)', `${stats.repos}`],
        ['Guild members', `${stats.agents}`],
        ['Sessions running', stats.max ? `${stats.working} / ${stats.max}` : `${stats.working}`],
        ['Open issues', `${stats.issues}`],
        ['PRs in QA / ready to merge', `${stats.inQa} / ${stats.readyToMerge}`],
        ['Recruits waiting for you', `${stats.pending}`],
      ];
      rows.forEach(([k, v], i) => {
        const y = 150 + i * 68;
        roundRect(ctx, 50, y - 30, 924, 60, 16);
        ctx.fillStyle = 'rgba(236, 223, 194, 0.06)';
        ctx.fill();
        ctx.fillStyle = '#a99f90';
        ctx.font = `500 34px ${SANS}`;
        ctx.fillText(k, 76, y);
        ctx.fillStyle = '#e6dfcf';
        ctx.font = `700 38px ${SANS}`;
        ctx.textAlign = 'right';
        ctx.fillText(v, 948, y);
        ctx.textAlign = 'left';
      });
      ctx.fillStyle = '#9fbf7a';
      ctx.font = `600 32px ${SANS}`;
      ctx.fillText('Press E or click to manage chambers, guild & issues', 50, 592);
    },
    [stats],
  );
  return (
    <group ref={ref} position={[MANAGER_DESK.x, 0, MANAGER_DESK.z]}>
      {/* the Overlord's table, a great slate on it facing the door */}
      <Model name="props/Table_Large" scale={[0.91, 0.94, 1]} />
      <mesh position={[0, 1.55, -0.18]} material={SLATE_FRAME}>
        <boxGeometry args={[1.5, 1.0, 0.07]} />
      </mesh>
      <mesh position={[0, 1.55, -0.145]}>
        <planeGeometry args={[1.34, 0.84]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <Model name="props/Scroll_1" position={[-0.6, 0.77, 0.25]} rotation={[0, 0.4, 0]} />
      <Model name="props/Chalice" position={[0.95, 0.77, 0.15]} />
      <Model name="props/Book_Stack_1" position={[-1.0, 0.77, -0.25]} />
      {/* your chair: the high-backed one */}
      <Model name="props/Chair_1" position={[0, 0, -1.1]} scale={1.2} />
    </group>
  );
}

function Directory() {
  const stats = useOfficeStats();
  const ref = useInteractable<THREE.Group>({ id: 'directory', label: 'Open the Roll of Chambers to walk to a chamber', action: { kind: 'elevator' } }, 4);
  const tex = useCanvasTexture(
    768,
    560,
    (ctx) => {
      ctx.fillStyle = '#d8c7a0';
      ctx.fillRect(0, 0, 768, 560);
      ctx.strokeStyle = 'rgba(42, 29, 20, 0.6)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, 762, 554);
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 18, 732, 524);
      ctx.fillStyle = '#2a1d14';
      ctx.font = `700 46px ${SANS}`;
      ctx.textBaseline = 'middle';
      ctx.fillText('Roll of Chambers', 36, 52);
      const floors = [...stats.floors].sort((a, b) => b.floor - a.floor).slice(0, 7);
      floors.forEach((f, i) => {
        const y = 118 + i * 58;
        ctx.fillStyle = f.color;
        roundRect(ctx, 36, y - 22, 54, 44, 12);
        ctx.fill();
        ctx.fillStyle = '#2a1d14';
        ctx.font = `700 30px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(String(f.floor), 63, y + 1);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#2a1d14';
        ctx.font = `600 28px ${SANS}`;
        const name = f.name.length > 24 ? `${f.name.slice(0, 23)}…` : f.name;
        ctx.fillText(name, 108, y);
        ctx.fillStyle = '#5a4632';
        ctx.font = `500 24px ${SANS}`;
        ctx.textAlign = 'right';
        ctx.fillText(`${f.working}/${f.team} busy · ${f.prs} PR`, 740, y);
        ctx.textAlign = 'left';
      });
      const gy = 118 + floors.length * 58;
      ctx.fillStyle = ACCENT;
      roundRect(ctx, 36, gy - 22, 54, 44, 12);
      ctx.fill();
      ctx.fillStyle = '#ecdfc2';
      ctx.font = `700 30px ${SANS}`;
      ctx.textAlign = 'center';
      ctx.fillText('G', 63, gy + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#2a1d14';
      ctx.font = `600 28px ${SANS}`;
      ctx.fillText('Great hall & your study', 108, gy);
      if (stats.floors.length === 0) {
        ctx.fillStyle = '#5a4632';
        ctx.font = `500 26px ${SANS}`;
        ctx.fillText('No chambers yet: connect a repo in', 36, gy + 80);
        ctx.fillText('your study (back left corner).', 36, gy + 116);
      }
    },
    [stats],
  );
  return (
    <group ref={ref} position={[4.4, 1.75, HALF_D - 0.03]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[2.6, 1.9]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function TrophyCabinet() {
  const stats = useOfficeStats();
  const tex = useCanvasTexture(
    512,
    160,
    (ctx) => drawSign(ctx, 512, 160, [{ text: `🏆 ${stats.merged} PRs merged`, size: 50, color: '#2a1d14' }], '#b8862b'),
    [stats.merged],
  );
  const cups = Math.min(8, stats.merged);
  return (
    <group position={[12, 0, -HALF_D + 0.55]}>
      {/* the DungeonMaster's trophies: a weapon stand, the chest of spoils (it opens: SpoilsChest.tsx), and a chalice per
          merged PR (up to eight) on two shelves on the wall above the chest, where its lid can't knock them off */}
      <Model name="props/WeaponStand" position={[-1.2, 0, 0]} />
      <SpoilsChest position={[1.2, 0, 0.45]} />
      {SHELVES.map((y) => (
        <Box key={y} size={[1.32, 0.05, 0.24]} position={[1.2, y - 0.025, -0.43]} color="#3f2816" />
      ))}
      {Array.from({ length: cups }, (_, i) => (
        <Model key={i} name="props/Chalice" position={[0.75 + (i % 4) * 0.3, SHELVES[Math.floor(i / 4)], -0.43]} />
      ))}
      <Model name="props/Banner_1" position={[-2.0, 2.6, -0.48]} />
      <Model name="props/Banner_2" position={[-0.6, 2.6, -0.48]} />
      <mesh position={[0, 2.45, 0.02]}>
        <planeGeometry args={[2.4, 0.75]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The CEO's wall screen: what they're doing, what's next, and who's waiting to be hired. */
function CeoBoard() {
  const ceo = useStore((s) => s.agents[CEO_ID]);
  const info = useStore((s) => s.ceo);
  const requests = useStore((s) => s.requests);
  const pending = pendingRequests(requests).length;
  const now = ceo?.status === 'working' ? (info.job?.label ?? 'Working') : 'Free to talk (press P)';
  const next = info.queue.length ? `${info.queue[0].label}${info.queue.length > 1 ? ` (+${info.queue.length - 1})` : ''}` : 'nothing queued';
  return (
    <WallSign
      position={[HALF_W - 0.03, 2.05, CEO_DESK.z]}
      rotationY={-Math.PI / 2}
      size={[3.4, 1.9]}
      px={[816, 456]}
      draw={(ctx) =>
        drawSign(
          ctx,
          816,
          456,
          [
            { text: `🧠 ${ceo?.name ?? 'The DungeonMaster'}'s board`, size: 54 },
            { text: `Now: ${now}`, size: 36, weight: 600 },
            { text: `Next: ${next}`, size: 32, weight: 500 },
            { text: pending ? `📄 ${pending} recruit${pending === 1 ? '' : 's'} waiting for you` : '📄 no recruits waiting', size: 34, weight: 600 },
          ],
          '#3c2a63',
        )
      }
      deps={[ceo?.name, now, next, pending]}
    />
  );
}

function CeoOffice() {
  const c = CEO_ROOM;
  const ceo = useStore((s) => s.agents[CEO_ID]);
  return (
    <group>
      <Rug position={[(c.minX + c.maxX) / 2, 0.005, (c.minZ + c.maxZ) / 2]} size={[c.maxX - c.minX, c.maxZ - c.minZ]} color="#8a6a8e" />
      <GlassWall from={[c.minX, c.minZ]} to={[c.minX, c.maxZ]} />
      <GlassWall from={[c.minX, c.maxZ]} to={[c.doorMinX, c.maxZ]} />
      <GlassWall from={[c.doorMaxX, c.maxZ]} to={[c.maxX, c.maxZ]} />
      <Box size={[c.doorMaxX - c.doorMinX, 0.5, 0.1]} position={[(c.doorMinX + c.doorMaxX) / 2, 2.55, c.maxZ]} color="#2e1f14" />
      <WallSign
        position={[(c.doorMinX + c.doorMaxX) / 2, 3.1, c.maxZ + 0.06]}
        rotationY={0}
        size={[3.4, 0.5]}
        px={[816, 120]}
        draw={(ctx) => drawSign(ctx, 816, 120, [{ text: `DUNGEONMASTER${ceo ? ` · ${ceo.name}` : ''}`, size: 44 }], CEO_ACCENT)}
        deps={[ceo?.name]}
      />
      {ceo && <Desk agent={ceo} accent={CEO_ACCENT} repoId="" position={[CEO_DESK.x, 0, CEO_DESK.z]} />}
      <CeoBoard />
      <Plant position={[c.maxX - 0.7, 0, c.maxZ - 0.7]} scale={1.1} pot={CEO_ACCENT} />
      <Plant position={[c.minX + 0.6, 0, c.maxZ - 0.6]} scale={0.9} />
    </group>
  );
}

/** A pending hire as a person: the look they'll have once hired, sitting in the waiting room. */
function candidateAgent(r: HireRequestView): Agent {
  return {
    id: r.id,
    name: r.name,
    repoId: r.repoId,
    role: r.role,
    title: r.title,
    specialty: r.specialty,
    brief: r.brief,
    hiredBy: 'ceo',
    look: r.look,
    task: null,
    desk: 0,
    color: r.color,
    hair: r.hair,
    skin: r.skin,
    model: r.model,
    effort: r.effort,
    cli: '',
    terminal: false,
    status: 'idle',
    issueNumber: null,
    issueTitle: null,
    branch: null,
    prNumber: null,
    prUrl: null,
    currentTool: null,
    startedAt: null,
    endedAt: null,
    costUsd: 0,
    turns: 0,
    browserUrl: null,
    hasScreenshot: false,
    screenshotAt: null,
    lastError: null,
    resumable: false,
    asks: null,
  };
}

function CandidateTag({ req }: { req: HireRequestView }) {
  const floor = useStore((s) => s.repos.find((r) => r.id === req.repoId)?.floor ?? null);
  const tex = useCanvasTexture(512, 128, (ctx) => drawCandidateTag(ctx, 512, 128, req.name, req.title, floor, req.color), [req.name, req.title, floor, req.color]);
  return (
    <Billboard position={[0, 1.95, -0.1]}>
      <mesh>
        <planeGeometry args={[1.15, 0.29]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

function WaitingChair({ z, req }: { z: number; req: HireRequestView | null }) {
  const ref = useInteractable<THREE.Group>(
    req ? { id: `candidate-${req.id}`, label: `Read ${req.name}'s credentials (${req.title})`, action: { kind: 'phone', tab: 'hires', requestId: req.id } } : null,
    3.2,
  );
  const agent = useMemo(() => (req ? candidateAgent(req) : null), [req]);
  return (
    <group ref={ref} position={[WAITING.x, 0, z]} rotation={[0, WAITING_ROTATION, 0]}>
      <Model name="props/Chair_1" rotation={[0, Math.PI, 0]} />
      {agent && <Character agent={agent} />}
      {req && <CandidateTag req={req} />}
    </group>
  );
}

function WaitingRoom() {
  const requests = useStore((s) => s.requests);
  const waiting = useMemo(() => pendingRequests(requests).filter((r) => r.kind === 'hire'), [requests]);
  const n = waiting.length;
  return (
    <group>
      {WAITING.seats.map((z, i) => (
        <WaitingChair key={z} z={z} req={waiting[i] ?? null} />
      ))}
      <WallSign
        position={[HALF_W - 0.03, 2.5, (WAITING.seats[0] + WAITING.seats[WAITING.seats.length - 1]) / 2]}
        rotationY={-Math.PI / 2}
        size={[3.6, 0.62]}
        px={[864, 150]}
        draw={(ctx) =>
          drawSign(ctx, 864, 150, [{ text: n ? `🪑 Antechamber · ${n} recruit${n === 1 ? '' : 's'}${n > WAITING.seats.length ? ` (${n - WAITING.seats.length} more outside)` : ''}` : '🪑 Antechamber', size: 50 }], '#3d6332')
        }
        deps={[n]}
      />
    </group>
  );
}

export function Lobby() {
  const m = MANAGER_ROOM;
  const user = useStore((s) => s.user);
  const managerName = useStore((s) => s.settings.managerName);
  const company = useStore((s) => s.settings.companyName);
  const boss = managerName || user;
  return (
    <group>
      {/* east windows clear of the CEO's board (z -9.1 to -5.7) and the waiting room sign (from z 6.7) */}
      <Shell torches={HALL_TORCHES} />

      {/* manager's office */}
      <Rug position={[(m.minX + m.maxX) / 2, 0.005, (m.minZ + m.maxZ) / 2]} size={[m.maxX - m.minX, m.maxZ - m.minZ]} color="#7d8a5c" />
      <GlassWall from={[m.maxX, m.minZ]} to={[m.maxX, m.maxZ]} />
      <GlassWall from={[m.minX, m.maxZ]} to={[m.doorMinX, m.maxZ]} />
      <GlassWall from={[m.doorMaxX, m.maxZ]} to={[m.maxX, m.maxZ]} />
      <Box size={[m.doorMaxX - m.doorMinX, 0.5, 0.1]} position={[(m.doorMinX + m.doorMaxX) / 2, 2.55, m.maxZ]} color="#2e1f14" />
      <WallSign
        position={[(m.doorMinX + m.doorMaxX) / 2, 3.1, m.maxZ + 0.06]}
        rotationY={0}
        size={[3.4, 0.5]}
        px={[816, 120]}
        draw={(ctx) => drawSign(ctx, 816, 120, [{ text: `OVERLORD${boss ? ` · ${boss}` : ''}`, size: 52 }], '#2a1d14')}
        deps={[boss]}
      />
      <ManagerComputer />
      <Bookshelf position={[-HALF_W + 0.4, 0, -8]} rotationY={Math.PI / 2} />
      {/* the Overlord's office is lit by candelabra: one by the ledger table and one in each corner */}
      <Plant position={[OFFICE_CANDELABRUM.x, 0, OFFICE_CANDELABRUM.z]} scale={1.2} look={FIRE.candelabrum} />
      <Plant position={[m.maxX - 0.6, 0, m.minZ + 0.6]} scale={1.1} pot="#8a4b2a" look={FIRE.candelabrum} />
      <Plant position={[m.minX + 0.6, 0, m.maxZ - 0.6]} scale={0.9} look={FIRE.candelabrum} />
      <WallSign
        position={[MANAGER_DESK.x, 2.3, -HALF_D + 0.03]}
        rotationY={0}
        size={[2.4, 1.2]}
        px={[512, 256]}
        draw={(ctx) =>
          drawSign(ctx, 512, 256, [
            { text: '⭐', size: 70 },
            { text: 'The Realm’s Best', size: 44, weight: 600 },
            { text: 'Overlord', size: 50 },
          ], CEO_ACCENT)
        }
        deps={[]}
      />

      {/* the tavern */}
      <Bar />
      <Hearth />
      <Wolf />
      <FeastTables />
      <Tavern />
      <WallSign
        position={[3, 2.25, -HALF_D + 0.03]}
        rotationY={0}
        size={[7, 1.6]}
        px={[1400, 320]}
        draw={(ctx) =>
          drawSign(ctx, 1400, 320, [
            { text: company || 'Code Dungeon', size: 132, weight: 400, font: TITLE },
            { text: company ? 'worked by a guild of AI coders' : 'a guild of AI coders', size: 48, weight: 500 },
          ], ACCENT)
        }
        deps={[company]}
      />

      <CeoOffice />
      <WaitingRoom />
      <Toys />
      <Directory />
      <TrophyCabinet />
      <WallClock position={[8.4, 2.8, -HALF_D + 0.05]} />
      <Couch position={[11.5, 0, 4]} rotationY={Math.PI} color="#4cc9f0" />
      <CoffeeTable position={[11.5, 0, 6.2]} />
      <Plant position={[HALF_W - 0.7, 0, HALF_D - 0.7]} scale={1.2} />
      <Plant position={[-HALF_W + 0.7, 0, HALF_D - 0.7]} scale={1.2} pot="#7a5236" />
      <Plant position={[-3, 0, HALF_D - 0.6]} />
      <Plant position={[3, 0, -HALF_D + 0.7]} scale={0.8} />
    </group>
  );
}
