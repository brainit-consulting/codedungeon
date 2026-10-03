import { describe, expect, it } from 'vitest';
import type { Rect } from './layout';
import { clear, makeNav, type Pt } from './nav';
import { PILE_MAX, RAT, createRat, createWarren, pileLayout, stepRat, stepWarren, type Rat, type RatEnv, type WarrenEnv } from './ratBrain';

// The same 32 x 24 room as the cat's tests: a bar, a hearth on the west wall and two tables.
const RECTS: Rect[] = [
  { minX: 0.5, maxX: 5.5, minZ: -4.1, maxZ: -2.9, h: 1.1 },
  { minX: -16, maxX: -15.1, minZ: 2.3, maxZ: 5.7 },
  { minX: -6, maxX: -3, minZ: 4.4, maxZ: 5.6, h: 0.8 },
  { minX: 4.6, maxX: 7.4, minZ: 4.4, maxZ: 5.6, h: 0.8 },
];
const nav = makeNav(RECTS);
const DT = 1 / 30;
const quiet: RatEnv = { nav, threats: [] };

function run(r: Rat, seconds: number, e: RatEnv, each?: (r: Rat) => void) {
  for (let t = 0; t < seconds; t += DT) {
    stepRat(r, DT, e);
    each?.(r);
  }
}

describe('a rat', () => {
  it('scurries the same way from the same seed, and another way from another', () => {
    const trail = (seed: number) => {
      const r = createRat(1, seed, { x: 0, z: 6 });
      const out: string[] = [];
      run(r, 60, quiet, (k) => out.push(`${k.action}:${k.x.toFixed(2)},${k.z.toFixed(2)}`));
      return out.join(' ');
    };
    expect(trail(21)).toBe(trail(21));
    expect(trail(22)).not.toBe(trail(21));
  });

  it('runs in short dashes with pauses between, and never into furniture or a wall', () => {
    const r = createRat(1, 99, { x: 0, z: 6 });
    let dashes = 0;
    let longest = 0;
    let dash = 0;
    let prev = r.action;
    run(r, 120, quiet, (k) => {
      expect(clear(RECTS, k.x, k.z, 0.1)).toBe(true);
      if (k.action === 'dash') dash += DT;
      else {
        longest = Math.max(longest, dash);
        dash = 0;
      }
      if (k.action === 'dash' && prev !== 'dash') dashes++;
      prev = k.action;
    });
    expect(dashes).toBeGreaterThan(15);
    expect(longest).toBeLessThan(1.6);
    expect(Math.hypot(r.x, r.z - 6)).toBeGreaterThan(0); // it went somewhere
  });

  it('bolts away from something that comes close', () => {
    const r = createRat(1, 5, { x: 0, z: 6 });
    r.action = 'pause';
    r.left = 30;
    const threat = { x: 0.8, z: 6 };
    stepRat(r, DT, { nav, threats: [threat] });
    expect(r.action).toBe('dash');
    run(r, 0.6, { nav, threats: [threat] });
    expect(Math.hypot(r.x - threat.x, r.z - threat.z)).toBeGreaterThan(1.5);
  });
});

describe('the warren', () => {
  const env = (o: Partial<WarrenEnv> = {}): WarrenEnv => ({ nav, player: null, kills: 0, inside: () => true, threats: [], ...o });
  function runWarren(seconds: number, e: WarrenEnv, w = createWarren(3), each?: () => void) {
    for (let t = 0; t < seconds; t += DT) {
      stepWarren(w, DT, e);
      each?.();
    }
    return w;
  }

  it('keeps up to three rats about, born on open floor well away from the player', () => {
    const player = { x: 0, z: 0 };
    const w = createWarren(3);
    const born = new Map<number, Pt>();
    let most = 0;
    runWarren(300, env({ player }), w, () => {
      most = Math.max(most, w.rats.length);
      for (const r of w.rats) if (!born.has(r.id)) born.set(r.id, { x: r.x, z: r.z });
    });
    expect(most).toBe(RAT.max);
    expect(born.size).toBe(RAT.max);
    for (const p of born.values()) {
      expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeGreaterThanOrEqual(RAT.spawnClear);
      expect(clear(RECTS, p.x, p.z, 0.3)).toBe(true);
    }
  });

  it('only puts rats where the dungeon is', () => {
    const w = createWarren(4);
    const born = new Map<number, Pt>();
    runWarren(200, env({ inside: (x) => x < -4 }), w, () => {
      for (const r of w.rats) if (!born.has(r.id)) born.set(r.id, { x: r.x, z: r.z });
    });
    expect(born.size).toBeGreaterThan(0);
    for (const p of born.values()) expect(p.x).toBeLessThan(-4);
  });

  it('stops at twelve: never more rats alive than twelve less her kills, and none once she has twelve', () => {
    expect(RAT.cap).toBe(12);
    expect(runWarren(300, env({ kills: 10 }), createWarren(8)).spawned).toBe(2);
    expect(runWarren(300, env({ kills: 12 }), createWarren(8)).spawned).toBe(0);

    // a stand-in cat that kills each rat as soon as it appears
    const w = createWarren(9);
    const e = env();
    runWarren(1200, e, w, () => {
      for (const r of w.rats) {
        if (r.dead) continue;
        r.dead = true;
        e.kills++;
      }
    });
    expect(e.kills).toBe(12);
    expect(w.spawned).toBe(12);
    expect(w.rats).toEqual([]);
  });

  it('moves rats far from the player only every few frames, in bigger steps', () => {
    const w = createWarren(2);
    w.spawnAt = Infinity;
    const near = createRat(1, 11, { x: -12, z: 9 });
    const far = createRat(2, 12, { x: 13, z: -9 });
    w.rats.push(near, far);
    const e = env({ player: { x: -14, z: 10 } });
    let farSteps = 0;
    let nearSteps = 0;
    const frames = 40;
    for (let i = 0; i < frames; i++) {
      stepWarren(w, DT, e);
      if (far.owed === 0) farSteps++;
      if (near.owed === 0) nearSteps++;
    }
    expect(nearSteps).toBe(frames);
    expect(farSteps).toBeGreaterThanOrEqual(frames / RAT.farEvery - 1);
    expect(farSteps).toBeLessThanOrEqual(frames / RAT.farEvery + 1);
  });

  it('drops rats left outside the dungeon (a chamber taken away)', () => {
    const w = createWarren(2);
    w.spawnAt = Infinity;
    w.rats.push(createRat(1, 1, { x: 10, z: 8 }), createRat(2, 2, { x: -10, z: 8 }));
    runWarren(3, env({ inside: (x) => x < 0 }), w);
    expect(w.rats.map((r) => r.id)).toEqual([2]);
  });
});

describe("the cat's pile", () => {
  it('shows at most twelve, lying on their sides, the later ones stacked higher', () => {
    expect(PILE_MAX).toBe(12);
    expect(pileLayout(5)).toHaveLength(5);
    expect(pileLayout(40)).toHaveLength(PILE_MAX);
    const all = pileLayout(12);
    expect(all[11].y).toBeGreaterThan(all[0].y);
    for (const p of all) expect(Math.hypot(p.x, p.z)).toBeLessThan(0.4);
  });
});
