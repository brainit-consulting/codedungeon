import { describe, expect, it } from 'vitest';
import { CAT, callCat, createCat, stepCat, type Cat, type CatEnv, type CatSpot, type Prey } from './catBrain';
import { jumpPoint } from './catBrain';
import type { Rect } from './layout';
import { clear, makeNav } from './nav';
import { RAT, createWarren, stepWarren } from './ratBrain';

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

describe('the cat, when things are out of reach', () => {
  // a spot walled in on all sides
  const BOX: Rect[] = [
    { minX: 8, maxX: 12, minZ: 8, maxZ: 8.2 },
    { minX: 8, maxX: 12, minZ: 11.8, maxZ: 12 },
    { minX: 8, maxX: 8.2, minZ: 8, maxZ: 12 },
    { minX: 11.8, maxX: 12, minZ: 8, maxZ: 12 },
  ];
  const walled = makeNav([...RECTS, ...BOX]);
  const shut: CatSpot = { id: 'shut', kind: 'throne', x: 10, z: 10, facing: 0, weight: 50 };

  it("stops trying a spot she can't reach for a while, instead of planning to it again and again", () => {
    const cat = createCat(4, { x: 0, z: 6 });
    const e: CatEnv = { nav: walled, spots: [shut, SPOTS[0]], player: null, corners: [] };
    let reached = 0;
    run(cat, 120, e, (k) => {
      if (k.goal?.id === 'hearth' && k.action !== 'walk') reached++;
    });
    expect(reached).toBeGreaterThan(0); // she gave up on the shut spot and went to the hearth
    expect(cat.unreachable.shut).toBeGreaterThan(cat.clock - 60);
  });

  it("waits a second between tries when she can't find a way to the person she follows", () => {
    const cat = createCat(9, { x: 0, z: 6 });
    callCat(cat);
    const inside = { x: 10, z: 10 };
    const e: CatEnv = { nav: walled, spots: SPOTS, player: inside, corners: [] };
    while (cat.action === 'ignore') stepCat(cat, DT, e);
    let tries = 0;
    let prev = cat.retryAt;
    for (let t = 0; t < 3; t += DT) {
      stepCat(cat, DT, e);
      if (cat.retryAt !== prev) tries++; // each failed search sets a new retry time
      prev = cat.retryAt;
    }
    expect(tries).toBeGreaterThan(0);
    expect(tries).toBeLessThanOrEqual(4); // about once a second over three seconds, not every frame
  });

  it('called mid-leap, lands first and then ignores you', () => {
    const cat = createCat(11, { x: 2.2, z: -1.5 });
    const onlyBar: CatEnv = { ...env(), spots: [SPOTS[1]], corners: [] };
    while (cat.action !== 'jumpUp') stepCat(cat, DT, onlyBar);
    callCat(cat);
    expect(cat.action).toBe('jumpUp');
    while (cat.action === 'jumpUp') stepCat(cat, DT, onlyBar);
    expect(cat.y).toBe(SPOTS[1].y);
    expect(cat.action).toBe('ignore');
  });
});

describe('the cat and the rats', () => {
  // her pile: on the floor just south of the hearth, against the west wall
  const PILE: CatSpot = { id: 'pile', kind: 'corner', x: -15.2, z: 7, facing: Math.PI / 2, weight: 0 };
  const rat = (x: number, z: number, id = 1): Prey => ({ id, x, z, dead: false });
  /** Nowhere to go but after rats: no favourite spots, no corners. */
  const hunting = (rats: Prey[], player: { x: number; z: number } | null = null, n = nav): CatEnv => ({ nav: n, spots: [], corners: [], player, rats, pile: PILE });
  const actions = (c: Cat, seconds: number, e: CatEnv, each?: (c: Cat) => void) => {
    const seen: string[] = [];
    run(c, seconds, e, (k) => {
      if (seen[seen.length - 1] !== k.action) seen.push(k.action);
      each?.(k);
    });
    return seen;
  };

  it('notices a rat close by, stalks it low and slow, pounces, kills it and carries it to her pile', () => {
    const cat = createCat(1, { x: 0, z: 7 });
    const r = rat(3, 8.5);
    const e = hunting([r]);
    let fastest = 0;
    let prev = { x: cat.x, z: cat.z };
    let carried = false;
    const seen = actions(cat, 60, e, (k) => {
      if (k.action === 'stalk') fastest = Math.max(fastest, Math.hypot(k.x - prev.x, k.z - prev.z) / DT);
      if (k.action === 'carry') carried ||= k.carrying === r.id;
      prev = { x: k.x, z: k.z };
    });
    const at = (a: string) => seen.indexOf(a);
    expect(at('stalk')).toBeGreaterThanOrEqual(0);
    expect(at('pounce')).toBeGreaterThan(at('stalk'));
    expect(at('carry')).toBeGreaterThan(at('pounce'));
    expect(CAT.stalk).toBeLessThan(CAT.walk);
    expect(fastest).toBeGreaterThan(CAT.stalk * 0.5); // she did creep
    expect(fastest).toBeLessThanOrEqual(CAT.stalk + 1e-6);
    expect(carried).toBe(true);
    expect(r.dead).toBe(true);
    expect(cat.kills).toBe(1);
    expect(cat.dropped).toBe(1);
    expect(cat.carrying).toBeNull();
    expect(Math.hypot(cat.x - PILE.x, cat.z - PILE.z)).toBeLessThan(0.3);
  });

  it('pays no heed to a rat too far off, or one behind a wall', () => {
    const far = createCat(2, { x: 0, z: 7 });
    expect(actions(far, 10, hunting([rat(0, 7 - CAT.notice - 1)]))).not.toContain('stalk');

    const box: Rect[] = [
      { minX: 8, maxX: 12, minZ: 8, maxZ: 8.2 },
      { minX: 8, maxX: 12, minZ: 11.8, maxZ: 12 },
      { minX: 8, maxX: 8.2, minZ: 8, maxZ: 12 },
      { minX: 11.8, maxX: 12, minZ: 8, maxZ: 12 },
    ];
    const walled = makeNav([...RECTS, ...box]);
    const outside = createCat(2, { x: 10, z: 6.5 });
    expect(actions(outside, 10, hunting([rat(10, 10)], null, walled))).not.toContain('stalk');
  });

  it('gets up for a rat: hunting comes before an idle stay, even sleep', () => {
    const cat = createCat(3, { x: -13.5, z: 4 });
    cat.action = 'sleep';
    cat.left = 100;
    run(cat, 0.6, hunting([rat(-10, 5)]));
    expect(cat.action).toBe('stalk');
  });

  it('never breaks off a leap: jumping onto the bar she lands first, then comes down for the rat', () => {
    const bar = SPOTS[1];
    const cat = createCat(11, { x: 2.2, z: -1.5 });
    const e: CatEnv = { ...env(), spots: [bar], corners: [], pile: PILE, rats: [] };
    while (cat.action !== 'jumpUp') stepCat(cat, DT, e);
    e.rats = [rat(2.2, 1.0)];
    while (cat.action === 'jumpUp') stepCat(cat, DT, e);
    expect(cat.y).toBe(bar.y);
    const seen = actions(cat, 10, e);
    expect(seen).toContain('jumpDown');
    expect(seen.indexOf('stalk')).toBeGreaterThan(seen.indexOf('jumpDown'));
  });

  it("lets rats be while she's answering a call, and hunts once she's done following", () => {
    const cat = createCat(9, { x: 0, z: 7 });
    const player = { x: -2, z: 8 };
    const e = hunting([rat(1, 9.5)], player);
    callCat(cat);
    const busy: string[] = [];
    while (cat.action === 'ignore' || cat.action === 'follow') {
      busy.push(cat.action);
      stepCat(cat, DT, e);
    }
    expect(busy).toContain('follow');
    expect(busy.length * DT).toBeGreaterThan(CAT.followFor); // the rat in plain sight didn't cut it short
    expect(cat.action === 'stalk' || actions(cat, 1, e).includes('stalk')).toBe(true);
  });

  it('called mid-hunt, she carries on hunting', () => {
    const cat = createCat(4, { x: 0, z: 7 });
    const e = hunting([rat(4, 9)]);
    while (cat.action !== 'stalk') stepCat(cat, DT, e);
    callCat(cat);
    expect(cat.action).toBe('stalk');
  });

  it('gives up on a rat that gets away, and lets it be a while', () => {
    const cat = createCat(5, { x: 0, z: 7 });
    const r = rat(3, 8);
    const e = hunting([r]);
    while (cat.action !== 'stalk') stepCat(cat, DT, e);
    Object.assign(r, { x: -12, z: -9 }); // gone across the room
    const seen = actions(cat, 1.5, e);
    expect(cat.action).not.toBe('stalk');
    expect(cat.prey).toBeNull();
    Object.assign(r, { x: 3, z: 8 }); // and back, close by: not again just yet
    expect(actions(cat, 2, e)).not.toContain('stalk');
    expect(seen).not.toContain('pounce');
  });

  it('with a warren to hunt, kills twelve, piles all twelve, and then the rats stop coming', () => {
    const cat = createCat(6, { x: 0, z: 7 });
    const warren = createWarren(6);
    const e: CatEnv = { ...env(), pile: PILE, rats: warren.rats };
    const DT2 = 1 / 15;
    let most = 0;
    let t = 0;
    for (; t < 3600 && cat.dropped < RAT.cap; t += DT2) {
      const stealthy = cat.action === 'stalk' || cat.action === 'pounce';
      stepWarren(warren, DT2, { nav, player: null, kills: cat.kills, inside: () => true, threats: stealthy ? [] : [cat] });
      e.rats = warren.rats;
      stepCat(cat, DT2, e);
      most = Math.max(most, warren.rats.filter((r) => !r.dead).length);
    }
    expect(cat.kills).toBe(RAT.cap);
    expect(cat.dropped).toBe(RAT.cap);
    expect(most).toBeLessThanOrEqual(RAT.max);
    for (let k = 0; k < 120 / DT2; k++) {
      stepWarren(warren, DT2, { nav, player: null, kills: cat.kills, inside: () => true, threats: [] });
      e.rats = warren.rats;
      stepCat(cat, DT2, e);
    }
    expect(warren.spawned).toBe(RAT.cap);
    expect(warren.rats).toEqual([]);
    expect(cat.kills).toBe(RAT.cap);
  });
});

describe('the cat and the spiders', () => {
  const PILE: CatSpot = { id: 'pile', kind: 'corner', x: -15.2, z: 7, facing: Math.PI / 2, weight: 0 };
  const spider = (x: number, z: number, id = -1): Prey => ({ id, x, z, dead: false, kind: 'spider' });
  const hunting = (prey: Prey[]): CatEnv => ({ nav, spots: [], corners: [], player: null, rats: prey, pile: PILE });
  /** Whether she goes for a spider close by in her first second, and what she did. */
  const firstLook = (seed: number) => {
    const cat = createCat(seed, { x: 0, z: 7 });
    const s = spider(2, 8);
    const e = hunting([s]);
    let stalked = false;
    run(cat, 1, e, (k) => (stalked ||= k.action === 'stalk'));
    return { cat, s, e, stalked };
  };

  it('goes for a spider only now and then, and leaves one she passed over alone a while', () => {
    const N = 300;
    let went = 0;
    for (let seed = 1; seed <= N; seed++) {
      const { cat, e, stalked } = firstLook(seed);
      if (stalked) {
        went++;
        continue;
      }
      let again = false;
      run(cat, 3, e, (k) => (again ||= k.action === 'stalk'));
      expect(again).toBe(false);
    }
    expect(went / N).toBeGreaterThan(CAT.spiderChance - 0.1);
    expect(went / N).toBeLessThan(CAT.spiderChance + 0.1);
    expect(CAT.spiderChance).toBeLessThan(0.5);
  });

  it("eats a spider where she catches it, then washes: it isn't carried to the pile or counted with her rats", () => {
    let seed = 1;
    while (!firstLook(seed).stalked) seed++;
    const { cat, s, e } = firstLook(seed);
    const seen: string[] = [];
    run(cat, 30, e, (k) => {
      if (seen[seen.length - 1] !== k.action) seen.push(k.action);
    });
    expect(s.dead).toBe(true);
    expect(cat.ate).toBe(1);
    expect(cat.kills).toBe(0);
    expect(cat.dropped).toBe(0);
    expect(cat.carrying).toBeNull();
    expect(seen).not.toContain('carry');
    expect(seen.indexOf('wash')).toBeGreaterThan(seen.indexOf('pounce'));
  });
});

describe('the cat and the great spider', () => {
  const PILE: CatSpot = { id: 'pile', kind: 'corner', x: -15.2, z: 7, facing: Math.PI / 2, weight: 0 };
  const great = (x: number, z: number): Prey => ({ id: -1_000_001, x, z, dead: false, kind: 'great' });
  const firstLook = (seed: number) => {
    const cat = createCat(seed, { x: 0, z: 7 });
    const g = great(2, 8);
    const e: CatEnv = { nav, spots: [], corners: [], player: null, rats: [g], pile: PILE };
    let stalked = false;
    run(cat, 1, e, (k) => (stalked ||= k.action === 'stalk'));
    return { cat, g, e, stalked };
  };

  it('goes for the great spider more often than for a little one', () => {
    const N = 300;
    let went = 0;
    for (let seed = 1; seed <= N; seed++) if (firstLook(seed).stalked) went++;
    expect(went / N).toBeGreaterThan(CAT.greatChance - 0.1);
    expect(went / N).toBeLessThan(CAT.greatChance + 0.1);
    expect(CAT.greatChance).toBeGreaterThan(CAT.spiderChance);
  });

  it('kills it where she catches it and leaves it there: not eaten, not carried, then a wash', () => {
    let seed = 1;
    while (!firstLook(seed).stalked) seed++;
    const { cat, g, e } = firstLook(seed);
    const seen: string[] = [];
    run(cat, 30, e, (k) => {
      if (seen[seen.length - 1] !== k.action) seen.push(k.action);
    });
    expect(g.dead).toBe(true);
    expect(cat.slain).toBe(1);
    expect(cat.ate).toBe(0);
    expect(cat.kills).toBe(0);
    expect(cat.carrying).toBeNull();
    expect(seen).not.toContain('carry');
    expect(seen.indexOf('wash')).toBeGreaterThan(seen.indexOf('pounce'));
  });

  it('has a stay for sitting by its lair', () => {
    const [a, b] = CAT.stay.lair;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
  });
});

describe('jumpPoint', () => {
  // off the bar: from its top (1.1 m) to the floor 1.75 m out; the bar's front edge is 0.66 m from where she sat
  const down = { from: { x: 0, z: 0, y: 1.1 }, to: { x: 0, z: 1.75, y: 0 } };
  const up = { from: { x: 0, z: 1.75, y: 0 }, to: { x: 0, z: 0, y: 1.1 } };
  const heightAt = (j: typeof down, z: number) => {
    let best = { dz: Infinity, y: 0 };
    for (let t = 0; t <= 1; t += 0.001) {
      const p = jumpPoint(j, t);
      if (Math.abs(p.z - z) < best.dz) best = { dz: Math.abs(p.z - z), y: p.y };
    }
    return best.y;
  };

  it('clears the edge of what she jumps down from', () => {
    expect(heightAt(down, 0.66)).toBeGreaterThan(1.1);
  });

  it('is over the edge before she lands on top when she jumps up', () => {
    expect(heightAt(up, 0.66)).toBeGreaterThan(1.1);
  });

  it('starts and ends where it should', () => {
    expect(jumpPoint(down, 0)).toEqual({ x: 0, z: 0, y: 1.1 });
    const end = jumpPoint(down, 1);
    expect([end.x, end.z, end.y]).toEqual([0, 1.75, 0]);
  });
});
