import { FLOOR_W, HALF_D, HALF_W, ELEVATOR, lobbyColliders, officeColliders, type Rect } from './layout';

// The dungeon's plan: one level. The great hall (the old lobby) sits at the origin. Through the doorway in its south
// wall a gallery runs south, and each project's chamber (the old office floor, unchanged inside) opens off it,
// alternating west and east. A chamber keeps its own local coordinates, as an office floor had: its door is the
// doorway in its local south wall, and it is turned so that wall lies along the gallery. Pure, so it can be tested.

/** Half the gallery's clear width, and how thick its walls are. */
export const GALLERY = { half: 2, wall: 0.4 };
/** Chambers in a row sit this far apart along the gallery (their width, plus both walls). */
const ROW = FLOOR_W + 0.8;
/** The first row's centre: just past the hall's south wall (12.4) and the chamber's own end wall. */
const FIRST_Z = HALF_D + 0.4 + HALF_W + 0.4;
/** How close (m) a chamber's door must be for the chamber to be drawn while you're in the gallery. */
const DRAW_NEAR = 12;
/** How far inside the door a visit puts you. */
const VISIT_IN = 1.6;

export interface Chamber {
  slot: number;
  side: 'west' | 'east';
  /** World position of the chamber's centre, and its turn about Y (local -Z, its back wall, points away from the gallery). */
  x: number;
  z: number;
  rot: number;
}

/** Where chamber `slot` (1-based: the repo's floor number) sits. */
export function chamber(slot: number): Chamber {
  const i = slot - 1;
  const side = i % 2 === 0 ? 'west' : 'east';
  const z = FIRST_Z + Math.floor(i / 2) * ROW;
  const off = GALLERY.half + GALLERY.wall + HALF_D;
  return side === 'west' ? { slot, side, x: -off, z, rot: Math.PI / 2 } : { slot, side, x: off, z, rot: -Math.PI / 2 };
}

/** A chamber-local point in world coordinates. */
export function toWorld(c: Chamber, x: number, z: number) {
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  return { x: c.x + x * cos + z * sin, z: c.z - x * sin + z * cos };
}

/** A world point in chamber-local coordinates. */
export function toLocal(c: Chamber, x: number, z: number) {
  const dx = x - c.x;
  const dz = z - c.z;
  const cos = Math.cos(c.rot);
  const sin = Math.sin(c.rot);
  return { x: dx * cos - dz * sin, z: dx * sin + dz * cos };
}

/** A chamber-local rect in world coordinates (a quarter turn keeps it axis-aligned). */
export function rectToWorld(c: Chamber, r: Rect): Rect {
  const a = toWorld(c, r.minX, r.minZ);
  const b = toWorld(c, r.maxX, r.maxZ);
  return { minX: Math.min(a.x, b.x), maxX: Math.max(a.x, b.x), minZ: Math.min(a.z, b.z), maxZ: Math.max(a.z, b.z), h: r.h };
}

/** Where the gallery ends (its south wall's inner face). */
export function galleryEnd(slots: number[]): number {
  const last = slots.length ? Math.max(...slots) : 0;
  if (!last) return HALF_D + 0.4 + 6;
  return chamber(last).z + HALF_W + 0.4;
}

/** The gallery's walls: both sides, with a doorway into every chamber in use, and its far end. */
export function galleryColliders(slots: number[]): Rect[] {
  const start = HALF_D;
  const end = galleryEnd(slots);
  const { half, wall } = GALLERY;
  const out: Rect[] = [{ minX: -half - wall, maxX: half + wall, minZ: end, maxZ: end + wall }];
  for (const side of ['west', 'east'] as const) {
    const doors = slots.map(chamber).filter((c) => c.side === side).map((c) => c.z).sort((a, b) => a - b);
    const [minX, maxX] = side === 'west' ? [-half - wall, -half] : [half, half + wall];
    let from = start;
    for (const z of doors) {
      out.push({ minX, maxX, minZ: from, maxZ: z - ELEVATOR.doorHalf });
      from = z + ELEVATOR.doorHalf;
    }
    out.push({ minX, maxX, minZ: from, maxZ: end });
  }
  return out;
}

/** Everything the player bumps into: the hall, the gallery and every chamber in use, in world coordinates. */
export function dungeonColliders(slots: number[]): Rect[] {
  const out = [...lobbyColliders(), ...galleryColliders(slots)];
  const local = officeColliders();
  for (const s of slots) {
    const c = chamber(s);
    for (const r of local) out.push(rectToWorld(c, r));
  }
  return out;
}

/** The room at a world point: a chamber's slot, or 0 for the hall and the gallery. */
export function roomAt(x: number, z: number, slots: number[]): number {
  for (const s of slots) {
    const l = toLocal(chamber(s), x, z);
    if (Math.abs(l.x) <= HALF_W && Math.abs(l.z) <= HALF_D) return s;
  }
  return 0;
}

/** Which chambers to draw for someone standing at (x, z): their own, or those with a door close by in the gallery. */
export function chambersToDraw(x: number, z: number, slots: number[]): number[] {
  const room = roomAt(x, z, slots);
  if (room) return [room];
  if (z <= HALF_D) return [];
  return slots.filter((s) => {
    const c = chamber(s);
    const door = toWorld(c, 0, HALF_D);
    return Math.hypot(door.x - x, door.z - z) < DRAW_NEAR;
  });
}

/** Just inside a chamber's door, facing in. yaw follows Player's convention: forward is (-sin yaw, -cos yaw). */
export function visitSpot(slot: number) {
  const c = chamber(slot);
  const p = toWorld(c, 0, HALF_D - VISIT_IN);
  return { x: p.x, z: p.z, yaw: c.rot };
}

/** Whether (x, z) is somewhere in the dungeon: the hall, the gallery, or a chamber in use. */
export function inDungeon(x: number, z: number, slots: number[]): boolean {
  if (Math.abs(x) <= HALF_W && Math.abs(z) <= HALF_D) return true;
  if (Math.abs(x) <= GALLERY.half && z >= HALF_D && z <= galleryEnd(slots)) return true;
  // the doorway through the gallery wall into a chamber belongs to both
  const ax = Math.abs(x);
  if (ax > GALLERY.half && ax < GALLERY.half + GALLERY.wall) {
    const side = x < 0 ? 'west' : 'east';
    if (slots.some((s) => chamber(s).side === side && Math.abs(chamber(s).z - z) <= ELEVATOR.doorHalf)) return true;
  }
  return roomAt(x, z, slots) > 0;
}
