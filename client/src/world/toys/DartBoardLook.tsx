import { useMemo } from 'react';
import * as THREE from 'three';
import { useCanvasTexture } from '../interact';
import { toon, toonMap } from '../materials';
import { Box, Cyl } from '../Toon';
import { BOARD, DARTS_PER_ROUND, SEGMENTS, type Score } from './dartboard';

// What the darts, the board and the chalk tally look like. Placeholders until the dungeon's models arrive (step 3):
// the rules in dartboard.ts don't depend on any of this. Local +Z faces the thrower; the board's centre is the origin.

// A worn tavern board: dark sisal and bone, oxblood and old green rings, an iron number ring.
const C = { black: '#1d1a17', bone: '#c9b994', red: '#6e1f1a', green: '#2f4a2c', ring: '#141210', wire: '#8a8273', wood: '#3b2a1c', woodDark: '#2a1d13', chalk: '#e9e4d6', slate: '#23262a' };

function drawBoard(ctx: CanvasRenderingContext2D, size: number) {
  const c = size / 2;
  const k = c / BOARD.radius; // pixels per metre
  ctx.fillStyle = C.ring;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  const wedge = (r0: number, r1: number, i: number, color: string) => {
    // canvas angles run clockwise from +x; segment 0 (the 20) is centred straight up
    const a0 = -Math.PI / 2 + (i - 0.5) * (Math.PI / 10);
    const a1 = a0 + Math.PI / 10;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(c, c, r1 * k, a0, a1);
    ctx.arc(c, c, r0 * k, a1, a0, true);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < 20; i++) {
    const dark = i % 2 === 0;
    wedge(BOARD.outerBull, BOARD.double[1], i, dark ? C.black : C.bone);
    wedge(BOARD.treble[0], BOARD.treble[1], i, dark ? C.red : C.green);
    wedge(BOARD.double[0], BOARD.double[1], i, dark ? C.red : C.green);
  }
  ctx.fillStyle = C.green;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.outerBull * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(c, c, BOARD.bull * k, 0, Math.PI * 2);
  ctx.fill();
  // the wire: rings and spokes
  ctx.strokeStyle = C.wire;
  ctx.lineWidth = Math.max(1, size / 512);
  for (const r of [BOARD.outerBull, BOARD.treble[0], BOARD.treble[1], BOARD.double[0], BOARD.double[1]]) {
    ctx.beginPath();
    ctx.arc(c, c, r * k, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 + (i - 0.5) * (Math.PI / 10);
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * BOARD.outerBull * k, c + Math.sin(a) * BOARD.outerBull * k);
    ctx.lineTo(c + Math.cos(a) * BOARD.double[1] * k, c + Math.sin(a) * BOARD.double[1] * k);
    ctx.stroke();
  }
  // the numbers, round the outside
  ctx.fillStyle = C.bone;
  ctx.font = `600 ${Math.round(size * 0.045)}px "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const rn = ((BOARD.double[1] + BOARD.radius) / 2) * k;
  SEGMENTS.forEach((n, i) => {
    const a = -Math.PI / 2 + i * (Math.PI / 10);
    ctx.fillText(String(n), c + Math.cos(a) * rn, c + Math.sin(a) * rn);
  });
}

let boardTex: THREE.CanvasTexture | null = null;
function boardTexture() {
  if (boardTex) return boardTex;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  drawBoard(canvas.getContext('2d')!, 1024);
  boardTex = new THREE.CanvasTexture(canvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = 8;
  return boardTex;
}

/** One dart, point up its local +Y (so it can be turned to face along a flight), centred on its middle. */
export function DartLook() {
  return (
    <group>
      <Cyl r={0.004} rTop={0.0015} h={0.05} position={[0, 0.065, 0]} color="#9a9a96" shadow={false} />
      <Cyl r={0.0075} h={0.06} position={[0, 0.015, 0]} color="#5b4630" shadow={false} />
      <Cyl r={0.003} h={0.04} position={[0, -0.03, 0]} color="#3a2c1e" shadow={false} />
      {/* goose-feather flights */}
      <Box size={[0.032, 0.04, 0.001]} position={[0, -0.058, 0]} color="#d8d0bd" shadow={false} />
      <Box size={[0.001, 0.04, 0.032]} position={[0, -0.058, 0]} color="#d8d0bd" shadow={false} />
    </group>
  );
}

/** The board on its plank backing, with the ledge below holding the darts that are on it. */
export function DartBoardLook({ ledge }: { ledge: number }) {
  const face = useMemo(() => toonMap('dartboard', boardTexture()), []);
  return (
    <group>
      <Box size={[0.62, 0.7, 0.03]} position={[0, -0.03, -0.035]} color={C.wood} />
      {/* the dark rim behind the face: a cylinder stands on end by default, so it is turned to face out of the wall */}
      <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} material={toon(C.ring)}>
        <cylinderGeometry args={[BOARD.radius, BOARD.radius, 0.04, 48]} />
      </mesh>
      <mesh position={[0, 0, 0.0155]} material={face}>
        <circleGeometry args={[BOARD.radius, 64]} />
      </mesh>
      {/* the ledge */}
      <Box size={[0.4, 0.025, 0.07]} position={[0, -0.33, 0.0]} color={C.woodDark} />
      {Array.from({ length: Math.min(ledge, DARTS_PER_ROUND) }, (_, i) => (
        <group key={i} position={[-0.08 + i * 0.08, -0.31, 0.01]} rotation={[0, 0, Math.PI / 2]}>
          <DartLook />
        </group>
      ))}
    </group>
  );
}

/** The chalk tally: this round's throws and total, and the best round thrown here. */
export function TallyLook({ throws, total, best }: { throws: Score[]; total: number; best: number }) {
  const key = `${throws.map((t) => t.label).join(',')}|${total}|${best}`;
  const tex = useCanvasTexture(
    384,
    512,
    (ctx) => {
      ctx.fillStyle = C.slate;
      ctx.fillRect(0, 0, 384, 512);
      ctx.fillStyle = C.chalk;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = 'italic 600 44px "Times New Roman", serif';
      ctx.fillText('Darts', 28, 24);
      ctx.font = '500 40px "Times New Roman", serif';
      for (let i = 0; i < DARTS_PER_ROUND; i++) ctx.fillText(`${i + 1}.  ${throws[i]?.label ?? '—'}`, 36, 96 + i * 56);
      ctx.fillRect(28, 274, 328, 3);
      ctx.fillText(`Round  ${total}`, 36, 292);
      ctx.font = 'italic 500 36px "Times New Roman", serif';
      ctx.fillText(`Best round  ${best}`, 36, 380);
    },
    [key],
  );
  return (
    <group>
      <Box size={[0.5, 0.64, 0.03]} position={[0, 0, -0.015]} color={C.woodDark} />
      <mesh position={[0, 0, 0.002]}>
        <planeGeometry args={[0.42, 0.56]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
    </group>
  );
}
