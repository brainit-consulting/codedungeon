import { describe, expect, it } from 'vitest';
import { CAT, callCat, createCat, stepCat, type Cat, type CatEnv, type CatSpot } from './catBrain';
import type { Rect } from './layout';
import { clear, makeNav } from './nav';

// A 32 x 24 room with a bar, a hearth on the west wall and a couple of tables: enough to walk round.
const RECTS: Rect[] = [
  { minX: 0.5, maxX: 5.5, minZ: -4.1, maxZ: -2.9, h: 1.1 }, // bar
  { minX: -16, maxX: -15.1, minZ: 2.3, maxZ: 5.7 }, // hearth
  { minX: -6, maxX: -3, minZ: 4.4, maxZ: 5.6, h: 0.8 }, // table
  { minX: 4.6, maxX: 7.4, minZ: 4.4, maxZ: 5.6, h: 0.8 }, // table
];
const nav = makeNav(RECTS);

const SPOTS: CatSpot[] = [
  { id: 'hearth', kind: 'hearth', x: -14.4, z: 4, facing: -Math.PI / 2, weight: 3 },
  { id: 'bar', kind: 'bar', x: 2.2, z: -3.5, y: 1.1, approach: { x: 2.2, z: -2.3 }, facing: 0, weight: 2 },
  { id: 'coder', kind: 'coder', x: 9, z: -6, facing: 0, weight: 3 },
  { id: 'throne', kind: 'throne', x: 12, z: -8, facing: 0, weight: 1 },
];
const CORNERS = [
  { x: -10, z: -8 },
  { x: 10, z: 9 },
  { x: -8, z: 9 },
];
const env = (player: { x: number; z: number } | null = null): CatEnv => ({ nav, spots: SPOTS, player, corners: CORNERS });

const DT = 1 / 30;
function run(c: Cat, seconds: number, e: CatEnv, each?: (c: Cat) => void) {
  for (let t = 0; t < seconds; t += DT) {
    stepCat(c, DT, e);
    each?.(c);
  }
}

describe('the cat', () => {
  it('lives the same routine from the same seed, and a different one from another', () => {
    const a = createCat(42, { x: 0, z: 6 });
    const b = createCat(42, { x: 0, z: 6 });
    const c = createCat(7, { x: 0, z: 6 });
    const trail = (cat: Cat) => {
      const out: string[] = [];
      run(cat, 400, env(), (k) => out.push(`${k.action}:${k.goal?.id ?? '-'}`));
      return out.filter((s, i, all) => s !== all[i - 1]).join(' ');
    };
    const ta = trail(a);
    expect(trail(b)).toBe(ta);
    expect(trail(c)).not.toBe(ta);
  });

  it('never stands inside furniture or a wall while on the floor, and visits several favourite spots', () => {
    const cat = createCat(3, { x: 0, z: 6 });
    const visited = new Set<string>();
    run(cat, 900, env(), (k) => {
      if (k.y === 0 && k.action !== 'jumpDown' && k.action !== 'jumpUp') expect(clear(RECTS, k.x, k.z, 0.15)).toBe(true);
      if (k.goal && k.action !== 'walk') visited.add(k.goal.kind);
    });
    expect(visited.size).toBeGreaterThanOrEqual(3);
  });

  it('jumps up onto the bar counter and sits there at its height', () => {
    const cat = createCat(11, { x: 2.2, z: -1.5 });
    const bar = SPOTS[1];
    const onlyBar: CatEnv = { ...env(), spots: [bar], corners: [] };
    let perched = false;
    run(cat, 30, onlyBar, (k) => {
      if (k.y === bar.y && (k.action === 'sit' || k.action === 'nudge' || k.action === 'wash')) perched = true;
    });
    expect(perched).toBe(true);
  });

  it('sleeps a long while at the hearth', () => {
    const cat = createCat(5, { x: -12, z: 4 });
    const onlyHearth: CatEnv = { ...env(), spots: [SPOTS[0]], corners: [] };
    let slept = 0;
    run(cat, 200, onlyHearth, (k) => {
      if (k.action === 'sleep') slept += DT;
    });
    expect(slept).toBeGreaterThan(CAT.stay.hearth[0]);
  });

  it('ignores the Overlord for a few seconds when called, then follows, keeping a little behind', () => {
    const cat = createCat(9, { x: 0, z: 6 });
    run(cat, 3, env());
    const player = { x: -8, z: 8 };
    callCat(cat);
    expect(cat.action).toBe('ignore');
    let ignored = 0;
    while (cat.action === 'ignore') {
      stepCat(cat, DT, env(player));
      ignored += DT;
    }
    expect(ignored).toBeGreaterThanOrEqual(CAT.ignore[0] - DT);
    expect(ignored).toBeLessThanOrEqual(CAT.ignore[1] + DT);
    expect(cat.action).toBe('follow');
    let closest = Infinity;
    run(cat, 8, env(player), (k) => {
      if (k.action === 'follow') closest = Math.min(closest, Math.hypot(k.x - player.x, k.z - player.z));
    });
    expect(closest).toBeLessThan(CAT.followGap + 0.4); // she got there
    expect(closest).toBeGreaterThan(CAT.followGap - 0.3); // but not underfoot
  });

  it('called while up on the bar, comes down first and then follows', () => {
    const cat = createCat(11, { x: 2.2, z: -1.5 });
    const onlyBar: CatEnv = { ...env({ x: 0, z: 6 }), spots: [SPOTS[1]], corners: [] };
    run(cat, 30, onlyBar);
    expect(cat.y).toBe(SPOTS[1].y);
    callCat(cat);
    const seen: string[] = [];
    run(cat, 12, onlyBar, (k) => {
      if (seen[seen.length - 1] !== k.action) seen.push(k.action);
    });
    expect(seen.slice(0, 3)).toEqual(['ignore', 'jumpDown', 'follow']);
    expect(cat.y).toBe(0);
  });

  it('does something else once the following is over', () => {
    const cat = createCat(9, { x: 0, z: 6 });
    callCat(cat);
    run(cat, CAT.ignore[1] + CAT.followFor + 2, env({ x: 4, z: 8 }));
    expect(cat.action).not.toBe('follow');
    expect(cat.action).not.toBe('ignore');
  });
});
