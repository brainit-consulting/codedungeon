// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { catNav, hallSpots } from './Cat';
import { FIRE_LOGS, bundle, fireLogs, fireTop, logPile, restOn, type Log } from './firewood';
import { FIREWOOD, HALF_W, HEARTH, WOLF_RUG, WOLF_SOLID, lobbyColliders, rect, type Rect } from './layout';
import { planPath } from './nav';
import { PILE, PILE_DROP } from './Rats';

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const CHIMNEY = rect(-HALF_W + HEARTH.d / 2, HEARTH.z, HEARTH.d, HEARTH.w);
// the cauldron on the hearthstone (GreatHall.tsx), about 0.6 m across
const CAULDRON = rect(-HALF_W + HEARTH.d + 0.45, HEARTH.z - 1.25, 0.6, 0.6);
const WOOD = Object.values(FIREWOOD).map((f) => rect(f.x, f.z, f.w, f.d, f.h));
/** How far a point is from a rect (0 inside it). */
const away = (r: Rect, p: { x: number; z: number }) => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ));

/** Every log on the floor (y = base + r) or touching two below it; no two in each other. */
function settled(logs: Log[], base = 0) {
  logs.forEach((a, i) => {
    for (const [j, b] of logs.entries()) if (j > i) expect(Math.hypot(a.z - b.z, a.y - b.y), `logs ${i} and ${j}`).toBeGreaterThanOrEqual(a.r + b.r - 1e-6);
    if (Math.abs(a.y - a.r - base) < 1e-6) return;
    const under = logs.filter((b) => b !== a && b.y < a.y && Math.abs(Math.hypot(a.z - b.z, a.y - b.y) - a.r - b.r) < 1e-6);
    expect(under.length, `log ${i} rests on two`).toBeGreaterThanOrEqual(2);
  });
}

describe('a pile of logs', () => {
  it('rests a log in the hollow between two, touching both', () => {
    const at = restOn({ z: -0.06, y: 0.05, r: 0.05 }, { z: 0.06, y: 0.06, r: 0.06 }, 0.055);
    expect(Math.hypot(at.z + 0.06, at.y - 0.05)).toBeCloseTo(0.105, 9);
    expect(Math.hypot(at.z - 0.06, at.y - 0.06)).toBeCloseTo(0.115, 9);
    expect(at.y).toBeGreaterThan(0.1);
  });

  it('lays every log on the floor or on two below it, none in another', () => {
    settled(logPile('a', [5, 4, 3, 2], { r: 0.06, len: 0.5 }));
    settled(logPile('b', [4, 3, 2, 1], { r: 0.07, len: 0.5 }));
    settled(fireLogs(), FIRE_LOGS.dogs);
  });

  it("ties a bundle's sticks round the middle one, on the floor", () => {
    const { logs, radius } = bundle('x', 0.04, 0.6);
    expect(logs.length).toBe(7);
    expect(Math.min(...logs.map((l) => l.y - l.r))).toBeCloseTo(0, 9);
    for (const l of logs) expect(Math.hypot(l.z - logs[0].z, l.y - logs[0].y) + l.r).toBeLessThanOrEqual(radius + 1e-9);
  });
});

describe('the fire', () => {
  it('has more logs than it had, all inside the firebox', () => {
    const opening = 1.9; // GreatHall.tsx's hearth opening
    for (const l of fireLogs()) {
      expect(Math.abs(l.x) + l.len / 2).toBeLessThan(opening / 2 - 0.03);
      expect(Math.abs(l.z) + l.r).toBeLessThan(HEARTH.d / 2);
    }
    expect(fireLogs().length).toBeGreaterThan(3);
  });

  it('throws two more on top, across, each resting on what is under it and inside the firebox', () => {
    const pile = fireLogs();
    const [a, b] = fireTop(pile);
    expect(a.y - a.r).toBeCloseTo(Math.max(...pile.map((l) => l.y + l.r)), 9);
    expect(b.y - b.r).toBeCloseTo(a.y + a.r, 9);
    for (const l of [a, b]) {
      // the reach of a turned log, along the wall and out from it
      const halfX = (Math.cos(l.yaw) * l.len) / 2 + l.r;
      const halfZ = (Math.abs(Math.sin(l.yaw)) * l.len) / 2 + l.r;
      expect(Math.abs(l.x) + halfX).toBeLessThan(1.9 / 2 - 0.03);
      expect(Math.abs(l.z) + halfZ).toBeLessThan(HEARTH.d / 2);
    }
  });
});

describe('the firewood beside the hearth', () => {
  it('stands against the west wall on the north side, clear of the chimney breast, the cauldron, the wolf and his rug', () => {
    for (const w of WOOD) {
      expect(w.minX).toBeCloseTo(-HALF_W, 2);
      expect(w.maxZ).toBeLessThan(HEARTH.z - HEARTH.w / 2);
      for (const other of [CHIMNEY, CAULDRON, WOLF_SOLID, rect(WOLF_RUG.x, WOLF_RUG.z, WOLF_RUG.w, WOLF_RUG.d)]) expect(overlaps(w, other)).toBe(false);
    }
    expect(overlaps(WOOD[0], WOOD[1])).toBe(false);
  });

  it("keeps well away from the cat's pile of kills, on the other side of the hearth", () => {
    for (const w of WOOD) for (const p of [PILE, PILE_DROP]) expect(away(w, p)).toBeGreaterThan(3);
    expect(PILE.z).toBeGreaterThan(HEARTH.z + HEARTH.w / 2);
  });

  it('is solid, and leaves every way past it open', () => {
    const solid = lobbyColliders();
    for (const w of WOOD) expect(solid).toContainEqual(w);
    const nav = catNav([1, 2]);
    const hearth = hallSpots(false).find((s) => s.id === 'hearth')!;
    // the cat to her hearth spot and her pile, and anyone along the west wall past the hearth
    expect(planPath(nav, { x: 0, z: 0 }, hearth)).not.toBeNull();
    expect(planPath(nav, hearth, PILE_DROP)).not.toBeNull();
    expect(planPath(nav, { x: -14.5, z: -2.5 }, { x: -14.2, z: 8 })).not.toBeNull();
    // and it reaches no further from the wall than a log is long, where nobody walks
    for (const w of WOOD) expect(w.maxX - w.minX).toBeLessThanOrEqual(0.6);
  });
});
