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


describe('makeNav', () => {
  it('blocks exactly the cells the slow per-cell test (clear) would block', async () => {
    const { officeColliders } = await import('./layout');
    const { clear, ROOM } = await import('./nav');
    const rects = officeColliders();
    const nav = makeNav(rects);
    const cell = (ROOM.maxX - ROOM.minX) / nav.cols;
    let differ = 0;
    for (let j = 0; j < nav.rows; j++) {
      for (let i = 0; i < nav.cols; i++) {
        const x = ROOM.minX + (i + 0.5) * cell;
        const z = ROOM.minZ + (j + 0.5) * cell;
        // a centre exactly on a grown rect's edge is a floating-point tie either way: skip those
        const grown = NAV_R + 0.1;
        const tie = rects.some((r) => [r.minX - grown, r.maxX + grown].some((e) => Math.abs(e - x) < 1e-6) || [r.minZ - grown, r.maxZ + grown].some((e) => Math.abs(e - z) < 1e-6));
        if (!tie && (nav.blocked[j * nav.cols + i] === 1) !== !clear(rects, x, z, grown)) differ++;
      }
    }
    expect(differ).toBe(0);
  });

  it('covers any bounds, e.g. the whole dungeon plan', () => {
    const bounds = { minX: -30, maxX: 30, minZ: -12, maxZ: 60 };
    const walls: Rect[] = [{ minX: -2, maxX: 2, minZ: -0.2, maxZ: 0.2 }];
    const nav = makeNav(walls, bounds);
    expect(nav.cols).toBe(300);
    expect(nav.rows).toBe(360);
    expect(planPath(nav, { x: -20, z: 40 }, { x: 25, z: -5 })).not.toBeNull();
  });
});
