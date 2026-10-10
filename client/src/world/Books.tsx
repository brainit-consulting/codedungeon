// The library on the bookcases (bookRules.ts): leather-bound books on each board, their spines lettered in gold on one
// canvas per board, and E on a titled spine opens a page about that book (the 'book' panel). Drawn in code: a model
// pack's books carry no titles.
import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCanvasTexture, useInteractable } from './interact';
import { shelfRow, type PlacedBook } from './bookRules';
import { Model } from './models';
import { SANS, TITLE } from './draw';

type P = [number, number, number];

/** Canvas pixels per metre of spine. */
const PX = 1000;
const PAGES = new THREE.MeshStandardMaterial({ color: '#d8c9a3', roughness: 0.95 });
const leathers = new Map<string, THREE.MeshStandardMaterial>();
const leather = (color: string) => {
  let m = leathers.get(color);
  if (!m) leathers.set(color, (m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 })));
  return m;
};

// Bookcase_2's four shelves (measured from the model's vertices, 10 Oct): board tops at these heights, 1.19 m between
// the sides, the top's front edge at z 0.153, and 0.307 m from one board's top to the underside of the next.
const BOARDS = [0.769, 1.152, 1.536, 1.92];
const BOARD_W = 1.15;
const BOARD_FRONT = 0.15;
const CLEAR = 0.29;

/** A spine's face as it shows on the shelf: width along the board and height. */
const spineSize = (b: PlacedBook) => (b.lying ? { w: b.h, h: b.t } : { w: b.t, h: b.h });

/**
 * One bookcase, filled. `seed` makes it look its own; `offset` is where in the library its titles start; `feature` puts
 * a placed-only book (the glowing Ledger) on the eye-level board.
 */
export function Bookcase({ position, rotationY = 0, seed, offset, feature }: { position: P; rotationY?: number; seed: number; offset: number; feature?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <Model name="props/Bookcase_2" />
      {BOARDS.map((y, i) => (
        <BookRow key={i} seed={seed * 7 + i} offset={offset + i * 5} position={[0, y, 0]} feature={i === EYE_BOARD ? feature : undefined} />
      ))}
    </group>
  );
}

/** The board nearest eye height (1.65 m): where a featured book stands. */
const EYE_BOARD = 2;

function BookRow({ seed, offset, position, feature }: { seed: number; offset: number; position: P; feature?: string }) {
  const row = useMemo(() => shelfRow(seed, BOARD_W, CLEAR, offset, feature), [seed, offset, feature]);
  // every spine side by side on one canvas: where each sits (u along it, in metres)
  const layout = useMemo(() => {
    let u = 0;
    const cells = row.map((b) => {
      const s = spineSize(b);
      const cell = { u, ...s };
      u += s.w + 0.004;
      return cell;
    });
    return { cells, total: u, tall: Math.max(...cells.map((c) => c.h)) };
  }, [row]);
  const W = Math.ceil(layout.total * PX);
  const H = Math.ceil(layout.tall * PX);
  const tex = useCanvasTexture(
    W,
    H,
    (ctx) => {
      row.forEach((b, i) => {
        const c = layout.cells[i];
        const x = c.u * PX;
        const w = c.w * PX;
        const h = c.h * PX;
        const y = H - h;
        ctx.fillStyle = b.color;
        ctx.fillRect(x, y, w, h);
        // gilt bands across the spine, near its ends
        ctx.fillStyle = '#b8913a';
        if (b.lying) {
          for (const bx of [x + w * 0.08, x + w * 0.9]) ctx.fillRect(bx, y + 2, 3, h - 4);
        } else {
          for (const by of [y + h * 0.07, y + h * 0.9]) ctx.fillRect(x + 2, by, w - 4, 3);
        }
        if (!b.book) return;
        // the title in gold, along the spine
        ctx.save();
        ctx.fillStyle = '#e2c271';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const room = b.lying ? w * 0.75 : h * 0.72;
        let size = Math.min(26, (b.lying ? h : w) * 0.62);
        ctx.font = `600 ${size}px ${SANS}`;
        const text = b.book.spine;
        const fit = ctx.measureText(text).width;
        if (fit > room) {
          size *= room / fit;
          ctx.font = `600 ${size}px ${SANS}`;
        }
        if (b.lying) {
          ctx.fillText(text, x + w / 2, y + h / 2);
        } else {
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(text, 0, 0);
        }
        ctx.restore();
      });
    },
    [row, layout],
  );
  return (
    <group position={position}>
      {row.map((b, i) => (
        <Book key={i} b={b} cell={layout.cells[i]} total={layout.total} tall={layout.tall} tex={tex} id={`book-${seed}-${i}`} />
      ))}
    </group>
  );
}

function Book({ b, cell, total, tall, tex, id }: { b: PlacedBook; cell: { u: number; w: number; h: number }; total: number; tall: number; tex: THREE.Texture; id: string }) {
  const glows = b.book?.id === 'ledger';
  const label = glows ? "Read the Overlord's Ledger: the last five days" : `Read "${b.book?.spine}"`;
  const ref = useInteractable<THREE.Group>(b.book ? { id, label, action: { kind: 'book', bookId: b.book.id } } : null, 2.6);
  const cover = leather(b.color);
  // box faces: +x, -x, +y, -y, +z (the spine, under its lettered face), -z
  const materials = useMemo(
    () => (b.lying ? [PAGES, PAGES, cover, cover, cover, PAGES] : [cover, cover, PAGES, PAGES, cover, PAGES]),
    [b.lying, cover],
  );
  const size: P = b.lying ? [b.h, b.t, b.d] : [b.t, b.h, b.d];
  // the lettered face: this spine's cell of the board's canvas
  const face = useMemo(() => {
    const g = new THREE.PlaneGeometry(cell.w, cell.h);
    const u0 = cell.u / total;
    const u1 = (cell.u + cell.w) / total;
    const v1 = cell.h / tall;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u0, v1, u1, v1, u0, 0, u1, 0], 2));
    return g;
  }, [cell, total, tall]);
  const z = BOARD_FRONT - b.d / 2;
  const body = (
    <>
      <mesh material={materials} castShadow>
        <boxGeometry args={size} />
      </mesh>
      <mesh geometry={face} position={[0, 0, b.d / 2 + 0.0008]}>
        <meshStandardMaterial map={tex} roughness={0.6} />
      </mesh>
      {glows && <Glow w={cell.w} h={cell.h} z={b.d / 2 + 0.004} />}
    </>
  );
  if (b.lean) {
    // resting on its corner at the foot of the gap, its top against the book beside it
    const pivot = b.x + b.footprint / 2;
    return (
      <group ref={ref} position={[pivot, 0, z]} rotation={[0, 0, b.lean]}>
        <group position={[-b.t / 2, b.h / 2, 0]}>{body}</group>
      </group>
    );
  }
  return (
    <group ref={ref} position={[b.x, b.y + size[1] / 2, z]}>
      {body}
    </group>
  );
}

/** The Overlord's Daybook (daybook.ts), lying on the stack on your table: E opens today's page. */
export function Daybook({ position, rotationY = 0 }: { position: P; rotationY?: number }) {
  const ref = useInteractable<THREE.Group>({ id: 'daybook', label: "Read the Overlord's Daybook", action: { kind: 'daybook' } }, 3.2);
  const cover = useCanvasTexture(
    480,
    360,
    (ctx) => {
      ctx.fillStyle = '#4a1712';
      ctx.fillRect(0, 0, 480, 360);
      ctx.strokeStyle = '#b8913a';
      ctx.lineWidth = 6;
      ctx.strokeRect(22, 22, 436, 316);
      ctx.fillStyle = '#e2c271';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `64px ${TITLE}`;
      ctx.fillText('Daybook', 240, 160);
      ctx.font = `600 28px ${SANS}`;
      ctx.fillText("of the Overlord", 240, 232);
    },
    [],
  );
  return (
    <group ref={ref} position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.02, 0]} material={[PAGES, PAGES, leather('#4a1712'), leather('#4a1712'), leather('#4a1712'), PAGES]} castShadow>
        <boxGeometry args={[0.24, 0.04, 0.18]} />
      </mesh>
      <mesh position={[0, 0.0405, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.24, 0.18]} />
        <meshStandardMaterial map={cover} roughness={0.6} />
      </mesh>
    </group>
  );
}

/**
 * A gilt rim of light round a spine, in front of it: a soft glowing frame a little larger than the spine, blended so
 * it lights the edges of the books beside it, breathing slowly so the eye finds it.
 */
function Glow({ w, h, z }: { w: number; h: number; z: number }) {
  const pad = 0.028;
  const W = 128;
  const H = Math.round((W * (h + pad * 2)) / (w + pad * 2));
  const tex = useCanvasTexture(
    W,
    H,
    (ctx) => {
      const inset = (pad / (w + pad * 2)) * W;
      ctx.shadowColor = '#ffcf5a';
      ctx.shadowBlur = inset * 0.9;
      ctx.strokeStyle = '#ffd879';
      ctx.lineWidth = inset * 0.35;
      ctx.strokeRect(inset * 0.85, inset * 0.85, W - inset * 1.7, H - inset * 1.7);
      ctx.strokeRect(inset * 0.85, inset * 0.85, W - inset * 1.7, H - inset * 1.7);
    },
    [W, H, w, h],
  );
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), [tex]);
  useFrame(({ clock }) => {
    mat.opacity = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 1.6));
  });
  return (
    <mesh material={mat} position={[0, 0, z]} renderOrder={2}>
      <planeGeometry args={[w + pad * 2, h + pad * 2]} />
    </mesh>
  );
}
