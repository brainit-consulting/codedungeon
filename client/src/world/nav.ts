import { HALF_D, HALF_W, collide, type Rect } from './layout';

// Grid pathfinding over the layout's 2D rects: A* on a grid, string-pulled into a few straight legs. Pure, so it can be
// tested. Kept from cubefarm's roomba; the dungeon's cat walks it across the whole plan (hall, gallery, chambers).

export interface Pt {
  x: number;
  z: number;
}

/** The area a grid covers. A single room by default; the dungeon passes its whole plan's bounding box. */
export interface Bounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export const ROOM: Bounds = { minX: -HALF_W, maxX: HALF_W, minZ: -HALF_D, maxZ: HALF_D };

/** Keep a hair off everything (the roomba's radius plus a little; about a cat's half-width too). */
export const NAV_R = 0.2;
const PLAN_R = NAV_R + 0.1; // paths keep a little further off
const CELL = 0.2;

export interface Nav {
  rects: Rect[];
  bounds: Bounds;
  /** Cell size in metres. */
  cell: number;
  cols: number;
  rows: number;
  /** 1 where a path may not go (too close to something). */
  blocked: Uint8Array;
}

/** Whether a circle of radius r at (x, z) is clear of every rect and inside the bounds. */
export function clear(rects: Rect[], x: number, z: number, r = NAV_R, b: Bounds = ROOM) {
  if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return false;
  const p = collide(x, z, rects, r);
  return p.x === x && p.z === z;
}

/**
 * The grid: a cell is blocked when a circle of PLAN_R at its centre would touch a rect (collide() treats each rect,
 * grown by the radius, as a box, so marking the cells inside each grown rect is the same test, and much faster on a
 * big plan) or the bounds.
 */
export function makeNav(rects: Rect[], bounds: Bounds = ROOM, cell = CELL): Nav {
  const cols = Math.round((bounds.maxX - bounds.minX) / cell);
  const rows = Math.round((bounds.maxZ - bounds.minZ) / cell);
  const blocked = new Uint8Array(cols * rows);
  const nav: Nav = { rects, bounds, cell, cols, rows, blocked };
  const edge = Math.ceil(PLAN_R / cell);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (i < edge || j < edge || i >= cols - edge || j >= rows - edge) {
        const x = cellX(nav, i);
        const z = cellZ(nav, j);
        if (x < bounds.minX + PLAN_R || x > bounds.maxX - PLAN_R || z < bounds.minZ + PLAN_R || z > bounds.maxZ - PLAN_R) blocked[j * cols + i] = 1;
      }
    }
  }
  // Strictly inside the grown rect, as collide() has it: a centre exactly on its edge only touches, and stays clear.
  const first = (edge: number, origin: number) => Math.max(0, Math.floor((edge - origin) / cell - 0.5 + 1e-9) + 1);
  const last = (edge: number, origin: number, n: number) => Math.min(n - 1, Math.ceil((edge - origin) / cell - 0.5 - 1e-9) - 1);
  for (const r of rects) {
    const i0 = first(r.minX - PLAN_R, bounds.minX);
    const i1 = last(r.maxX + PLAN_R, bounds.minX, cols);
    const j0 = first(r.minZ - PLAN_R, bounds.minZ);
    const j1 = last(r.maxZ + PLAN_R, bounds.minZ, rows);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) blocked[j * cols + i] = 1;
  }
  return nav;
}

const cellX = (nav: Nav, i: number) => nav.bounds.minX + (i + 0.5) * nav.cell;
const cellZ = (nav: Nav, j: number) => nav.bounds.minZ + (j + 0.5) * nav.cell;
const toCol = (nav: Nav, x: number) => Math.min(nav.cols - 1, Math.max(0, Math.floor((x - nav.bounds.minX) / nav.cell)));
const toRow = (nav: Nav, z: number) => Math.min(nav.rows - 1, Math.max(0, Math.floor((z - nav.bounds.minZ) / nav.cell)));

/**
 * Line of sight on the grid: every cell the segment a → b passes through, and each of its eight neighbours, is open.
 * The neighbours make it stricter than the per-rect test (a point anywhere in such a cell is further than PLAN_R from
 * everything), and it costs a few array reads per cell instead of a pass over every rect.
 */
function gridClear(nav: Nav, a: Pt, b: Pt): boolean {
  const { cols, rows, blocked, cell } = nav;
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / (cell * 0.5)));
  const startC = toCol(nav, a.x) + toRow(nav, a.z) * cols;
  const endC = toCol(nav, b.x) + toRow(nav, b.z) * cols;
  for (let k = 1; k < n; k++) {
    const i = toCol(nav, a.x + ((b.x - a.x) * k) / n);
    const j = toRow(nav, a.z + ((b.z - a.z) * k) / n);
    if (j * cols + i === startC || j * cols + i === endC) continue;
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows || blocked[jj * cols + ii]) return false;
      }
    }
  }
  return true;
}

/** Whether something can travel the straight line a → b without touching anything. */
export function segmentClear(rects: Rect[], a: Pt, b: Pt, r = NAV_R + 0.04, bounds: Bounds = ROOM) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08));
  for (let k = 1; k <= n; k++) if (!clear(rects, a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n, r, bounds)) return false;
  return true;
}

/** The nearest cell a path may use, searching outwards from (i, j). */
function nearestOpen(nav: Nav, i: number, j: number, avoid: (c: number) => boolean): number {
  const { cols, rows, blocked } = nav;
  for (let ring = 0; ring < 12; ring++) {
    let best = -1;
    let bestD = Infinity;
    for (let dj = -ring; dj <= ring; dj++) {
      for (let di = -ring; di <= ring; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= cols || jj >= rows) continue;
        const c = jj * cols + ii;
        if (blocked[c] || avoid(c)) continue;
        const d = di * di + dj * dj;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/**
 * A* over the grid from `from` to `to`, string-pulled into a few straight legs. Returns the waypoints after `from`
 * (ending at `to`), or null when there's no way through. `avoid` is a circle to keep out of (the player).
 */
export function planPath(nav: Nav, from: Pt, to: Pt, avoid: (Pt & { r: number }) | null = null): Pt[] | null {
  const { cols, rows, blocked } = nav;
  const avoidR = avoid ? avoid.r + PLAN_R : 0;
  const avoided = (c: number) => !!avoid && Math.hypot(cellX(nav, c % cols) - avoid.x, cellZ(nav, Math.floor(c / cols)) - avoid.z) < avoidR;
  const start = nearestOpen(nav, toCol(nav, from.x), toRow(nav, from.z), avoided);
  const goal = nearestOpen(nav, toCol(nav, to.x), toRow(nav, to.z), () => false);
  if (start < 0 || goal < 0) return null;

  const n = cols * rows;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gi = goal % cols;
  const gj = Math.floor(goal / cols);
  const h = (c: number) => {
    const dx = Math.abs((c % cols) - gi);
    const dz = Math.abs(Math.floor(c / cols) - gj);
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
  };
  // binary heap of [f, cell]
  const heap: [number, number][] = [];
  const push = (f: number, c: number) => {
    heap.push([f, c]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top[1];
  };
  const open = (i: number, j: number) => i >= 0 && j >= 0 && i < cols && j < rows && !blocked[j * cols + i] && !avoided(j * cols + i);

  g[start] = 0;
  push(h(start), start);
  let found = false;
  while (heap.length) {
    const c = pop();
    if (closed[c]) continue;
    closed[c] = 1;
    if (c === goal) {
      found = true;
      break;
    }
    const i = c % cols;
    const j = Math.floor(c / cols);
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        if (!open(i + di, j + dj)) continue;
        if (di && dj && (!open(i + di, j) || !open(i, j + dj))) continue; // no cutting corners
        const nb = (j + dj) * cols + i + di;
        const cost = g[c] + (di && dj ? Math.SQRT2 : 1);
        if (cost < g[nb]) {
          g[nb] = cost;
          came[nb] = c;
          push(cost + h(nb), nb);
        }
      }
    }
  }
  if (!found) return null;

  const cells: Pt[] = [];
  for (let c = goal; c >= 0; c = came[c]) cells.push({ x: cellX(nav, c % cols), z: cellZ(nav, Math.floor(c / cols)) });
  cells.reverse();
  cells.push({ x: to.x, z: to.z });

  // String-pulling: from each corner, walk forward along the cells while they stay in a straight line of sight on
  // the grid, and cut the corner to the last one that does. One forward scan, so long paths stay cheap.
  const out: Pt[] = [];
  let at: Pt = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    while (far + 1 < cells.length && gridClear(nav, at, cells[far + 1])) far++;
    at = cells[far];
    out.push(at);
    k = far + 1;
  }
  return out;
}

