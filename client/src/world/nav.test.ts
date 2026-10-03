import { describe, expect, it } from 'vitest';
import type { Rect } from './layout';
import { NAV_R, makeNav, planPath, segmentClear } from './nav';

describe('planPath', () => {
  const walls: Rect[] = [{ minX: -2, maxX: 2, minZ: -0.2, maxZ: 0.2 }];
  it('goes round an obstacle instead of through it', () => {
    const nav = makeNav(walls);
    const path = planPath(nav, { x: 0, z: 2 }, { x: 0, z: -2 })!;
    expect(path.length).toBeGreaterThan(1);
    let at = { x: 0, z: 2 };
    for (const p of path) {
      expect(segmentClear(walls, at, p, NAV_R)).toBe(true);
      at = p;
    }
  });

  it('returns null when the goal is walled off', () => {
    const box: Rect[] = [
      { minX: -3, maxX: 3, minZ: -3, maxZ: -2.8 },
      { minX: -3, maxX: 3, minZ: 2.8, maxZ: 3 },
      { minX: -3, maxX: -2.8, minZ: -3, maxZ: 3 },
      { minX: 2.8, maxX: 3, minZ: -3, maxZ: 3 },
    ];
    expect(planPath(makeNav(box), { x: 10, z: 0 }, { x: 0, z: 0 })).toBeNull();
  });
});

