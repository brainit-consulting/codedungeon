import { describe, expect, it } from 'vitest';
import type { Rect } from './layout';
import { clear, makeNav, type Pt } from './nav';
import { SPIDER, createNest, releaseSpider, stepNest, stepSpider, type Nest, type NestEnv, type Spider, type SpiderEnv } from './spiderBrain';

// The same 32 x 24 room as the rats' and the cat's tests: a bar, a hearth on the west wall and two tables.
const RECTS: Rect[] = [
  { minX: 0.5, maxX: 5.5, minZ: -4.1, maxZ: -2.9, h: 1.1 },
  { minX: -16, maxX: -15.1, minZ: 2.3, maxZ: 5.7 },
  { minX: -6, maxX: -3, minZ: 4.4, maxZ: 5.6, h: 0.8 },
  { minX: 4.6, maxX: 7.4, minZ: 4.4, maxZ: 5.6, h: 0.8 },
];
const nav = makeNav(RECTS);
const DT = 1 / 30;
const quiet: SpiderEnv = { nav, threats: [] };

// a chest against the north wall at z = -8, its front facing into the room (+z)
const INSIDE = { x: 0, y: 0.31, z: -8 };
const RIM = { x: 0, y: 0.44, z: -7.66 };
const LANDING = { x: 0, z: -7 };

function run(s: Spider, seconds: number, e: SpiderEnv, each?: (s: Spider) => void) {
  for (let t = 0; t < seconds; t += DT) {
    stepSpider(s, DT, e);
    each?.(s);
  }
}
const forward = (s: Spider) => ({ x: -Math.sin(s.heading), z: -Math.cos(s.heading) });
/** How squarely it faces a point: 1 straight at it. */
const facing = (s: Spider, p: Pt) => {
  const f = forward(s);
  const d = Math.hypot(p.x - s.x, p.z - s.z);
  return (f.x * (p.x - s.x) + f.z * (p.z - s.z)) / d;
};
/** A spider sat still on open floor. */
function sitting(at: Pt, seed = 5): Spider {
  const s = releaseSpider(createNest(seed), INSIDE, RIM, LANDING)!;
  Object.assign(s, { x: at.x, z: at.z, y: 0, action: 'freeze', left: 30, hop: null });
  return s;
}

describe('a spider let out of the chest', () => {
  it('climbs up onto the rim, waits there facing out, then jumps down in front of the chest', () => {
    const s = releaseSpider(createNest(1), INSIDE, RIM, LANDING)!;
    expect(s.action).toBe('climb');
    expect(s.y).toBeCloseTo(INSIDE.y);
    let t = 0;
    while (s.action === 'climb') {
      stepSpider(s, DT, quiet);
      t += DT;
    }
    expect(s.action).toBe('perch');
    expect([s.x, s.y, s.z].map((v) => +v.toFixed(3))).toEqual([RIM.x, RIM.y, RIM.z]);
    expect(facing(s, LANDING)).toBeGreaterThan(0.99);
    let highest = 0;
    const seen: string[] = [];
    while (s.action === 'perch' || s.action === 'leap') {
      if (seen[seen.length - 1] !== s.action) seen.push(s.action);
      stepSpider(s, DT, quiet);
      t += DT;
      if (s.action === 'leap') highest = Math.max(highest, s.y);
    }
    expect(seen).toEqual(['perch', 'leap']);
    expect(highest).toBeGreaterThan(RIM.y); // it jumps, rather than dropping off
    expect(s.y).toBe(0);
    expect([s.x, s.z]).toEqual([LANDING.x, LANDING.z]);
    expect(s.action).toBe('freeze');
    expect(t).toBeCloseTo(SPIDER.climbS + SPIDER.perchS + SPIDER.leapS, 0);
  });

  it("pays nobody any heed until it's down: you standing right at the chest don't cut its jump short", () => {
    const s = releaseSpider(createNest(2), INSIDE, RIM, LANDING)!;
    const you = { x: 0.3, z: -6.6 };
    const seen: string[] = [];
    run(s, SPIDER.climbS + SPIDER.perchS + SPIDER.leapS + 0.2, { nav, threats: [you] }, (k) => {
      if (seen[seen.length - 1] !== k.action) seen.push(k.action);
    });
    expect(seen.slice(0, 3)).toEqual(['climb', 'perch', 'leap']);
    expect(s.y).toBe(0);
  });
});

describe('a spider on the floor', () => {
  it('rears up at you when you come close, facing you, then scuttles off fast', () => {
    const s = sitting({ x: 0, z: 6 });
    const you = { x: 0.9, z: 6.3 };
    stepSpider(s, DT, { nav, threats: [you] });
    expect(s.action).toBe('rear');
    expect(facing(s, you)).toBeGreaterThan(0.99);
    run(s, SPIDER.rear + 2 * DT, { nav, threats: [you] });
    expect(s.action).toBe('scuttle');
    expect(s.speed).toBe(SPIDER.scuttle);
    run(s, 1.5, { nav, threats: [you] });
    expect(Math.hypot(s.x - you.x, s.z - you.z)).toBeGreaterThan(1.8);
  });

  it('creeps slowly, freezes for long spells, skitters now and then, and never walks into furniture or a wall', () => {
    const s = sitting({ x: 0, z: 6 }, 17);
    s.left = 0;
    let still = 0;
    let moving = 0;
    let fastest = 0;
    let skitters = 0;
    let prev = { x: s.x, z: s.z };
    let was = s.action;
    run(s, 400, quiet, (k) => {
      expect(clear(RECTS, k.x, k.z, 0.1)).toBe(true);
      const v = Math.hypot(k.x - prev.x, k.z - prev.z) / DT;
      prev = { x: k.x, z: k.z };
      fastest = Math.max(fastest, v);
      if (k.action === 'freeze') still += DT;
      else moving += DT;
      if (k.action === 'scuttle' && was !== 'scuttle') skitters++;
      was = k.action;
    });
    expect(still).toBeGreaterThan(moving);
    expect(skitters).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(SPIDER.scuttle + 1e-6);
    expect(SPIDER.creep).toBeLessThan(SPIDER.scuttle / 3);
  });

  it('walks the same way from the same seed, and another way from another', () => {
    const trail = (seed: number) => {
      const s = sitting({ x: 0, z: 6 }, seed);
      s.left = 0;
      const out: string[] = [];
      run(s, 60, quiet, (k) => out.push(`${k.action}:${k.x.toFixed(2)},${k.z.toFixed(2)}`));
      return out.join(' ');
    };
    expect(trail(21)).toBe(trail(21));
    expect(trail(22)).not.toBe(trail(21));
  });
});

describe('the nest', () => {
  const env = (o: Partial<NestEnv> = {}): NestEnv => ({ nav, player: null, inside: () => true, threats: [], ...o });
  const steps = (n: Nest, seconds: number, e: NestEnv) => {
    for (let t = 0; t < seconds; t += DT) stepNest(n, DT, e);
  };

  it('holds at most three: a fourth is not let out', () => {
    const n = createNest(3);
    for (let k = 0; k < SPIDER.max; k++) expect(releaseSpider(n, INSIDE, RIM, LANDING)).not.toBeNull();
    expect(releaseSpider(n, INSIDE, RIM, LANDING)).toBeNull();
    expect(n.spiders).toHaveLength(SPIDER.max);
    expect(SPIDER.max).toBe(3);
  });

  it('gives spiders ids of their own, below zero, so the cat never takes one for a rat', () => {
    const n = createNest(3);
    const ids = [releaseSpider(n, INSIDE, RIM, LANDING)!.id, releaseSpider(n, INSIDE, RIM, LANDING)!.id];
    expect(ids).toEqual([-1, -2]);
    expect(n.spiders.every((s) => s.kind === 'spider')).toBe(true);
  });

  it('clears away one the cat has caught, which makes room for another', () => {
    const n = createNest(4);
    for (let k = 0; k < SPIDER.max; k++) releaseSpider(n, INSIDE, RIM, LANDING);
    n.spiders[1].dead = true;
    steps(n, DT, env());
    expect(n.spiders).toHaveLength(SPIDER.max - 1);
    expect(releaseSpider(n, INSIDE, RIM, LANDING)).not.toBeNull();
  });

  it('lets an old spider slip away only once you are well away from it, never under your nose', () => {
    const n = createNest(5);
    const s = releaseSpider(n, INSIDE, RIM, LANDING)!;
    Object.assign(s, { x: 0, z: 6, y: 0, action: 'freeze', left: 1000, hop: null, age: s.life + 1 });
    steps(n, 2, env({ player: { x: 1.4, z: 7.4 } }));
    expect(n.spiders).toContain(s);
    steps(n, 2, env({ player: { x: 0, z: 6 + SPIDER.vanishBeyond + 1 } }));
    expect(n.spiders).not.toContain(s);
  });

  it('keeps a young spider however far away you are', () => {
    const n = createNest(6);
    const s = releaseSpider(n, INSIDE, RIM, LANDING)!;
    steps(n, 30, env({ player: { x: 0, z: 100 } }));
    expect(n.spiders).toContain(s);
    expect(s.life).toBeGreaterThanOrEqual(SPIDER.life[0]);
  });

  it('drops spiders left outside the dungeon (a chamber taken away)', () => {
    const n = createNest(7);
    const a = releaseSpider(n, INSIDE, RIM, LANDING)!;
    const b = releaseSpider(n, INSIDE, RIM, LANDING)!;
    Object.assign(a, { x: 10, z: 8, y: 0, action: 'freeze', hop: null });
    Object.assign(b, { x: -10, z: 8, y: 0, action: 'freeze', hop: null });
    steps(n, 3, env({ inside: (x) => x < 0 }));
    expect(n.spiders.map((s) => s.id)).toEqual([b.id]);
  });
});
