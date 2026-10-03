import { describe, expect, it } from 'vitest';
import { catNav, hallSpots } from './Cat';
import { dungeonColliders } from './dungeon';
import { HALF_W, HEARTH, SPAWN, WOLF, WOLF_RUG, WOLF_SOLID, collide, lobbyColliders, rect, type Rect } from './layout';
import { clear, planPath } from './nav';
import { PILE, PILE_DROP } from './Rats';

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const CHIMNEY = rect(-HALF_W + HEARTH.d / 2, HEARTH.z, HEARTH.d, HEARTH.w);
// the cauldron on the hearthstone (GreatHall.tsx), about 0.6 m across
const CAULDRON = rect(-HALF_W + HEARTH.d + 0.45, HEARTH.z - 1.25, 0.6, 0.6);

describe("the wolf's rug by the hearth", () => {
  const slots = [1, 2, 3];
  const nav = catNav(slots);
  const hearth = hallSpots(false).find((s) => s.id === 'hearth')!;

  it('lies in front of the hearth, clear of the chimney breast, the cauldron and the rat pile', () => {
    const rug = rect(WOLF_RUG.x, WOLF_RUG.z, WOLF_RUG.w, WOLF_RUG.d);
    expect(overlaps(rug, CHIMNEY)).toBe(false);
    expect(overlaps(rug, CAULDRON)).toBe(false);
    expect(overlaps(WOLF_SOLID, CAULDRON)).toBe(false);
    for (const p of [PILE, PILE_DROP]) expect(clear([WOLF_SOLID], p.x, p.z, 0.3)).toBe(true);
    expect(lobbyColliders()).toContain(WOLF_SOLID);
  });

  it("leaves the cat's hearth spot clear and reachable, right against his flank", () => {
    const walls = dungeonColliders(slots);
    expect(clear(walls, hearth.x, hearth.z, 0.2, nav.bounds)).toBe(true);
    expect(planPath(nav, { x: 0, z: 0 }, hearth)).not.toBeNull();
    expect(planPath(nav, hearth, PILE_DROP)).not.toBeNull();
    // she curls up within half a metre of the middle of his back
    expect(Math.hypot(hearth.x - WOLF.x, hearth.z - WOLF.z)).toBeLessThan(0.5);
    // and on the fire side of him, not the room side
    expect(hearth.x).toBeLessThan(WOLF.x);
  });

  it('stops a player walking into him from the hall', () => {
    const p = collide(WOLF_SOLID.maxX + 0.1, WOLF.z, [WOLF_SOLID]);
    expect(p.x).toBeGreaterThanOrEqual(WOLF_SOLID.maxX + 0.3 - 1e-9);
    // and is well off the way from the door to the bar and the Overlord's room
    expect(WOLF_SOLID.maxX).toBeLessThan(-12);
    expect(Math.abs(SPAWN.x - WOLF.x)).toBeGreaterThan(10);
  });
});
