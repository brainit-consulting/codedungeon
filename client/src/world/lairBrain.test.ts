import { describe, expect, it } from 'vitest';
import { GREAT, bodyShrivel, createLair, stepLair, type Lair, type LairEnv } from './lairBrain';
import type { Pt } from './nav';

// The gallery's dead end runs south (+z) to its end wall; the great spider's lair is just inside it, facing back up
// the gallery (-z, heading 0).
const HOME = { x: 0, z: 30 };
const DT = 1 / 30;
const env = (player: Pt | null, cat: Pt | null = null): LairEnv => ({ home: HOME, out: 0, range: GREAT.range, ceiling: 3.6, player, cat });

function run(l: Lair, seconds: number, e: LairEnv, each?: (l: Lair, t: number) => void) {
  for (let t = 0; t < seconds; t += DT) {
    stepLair(l, DT, e);
    each?.(l, t);
  }
}
const fromHome = (p: Pt) => Math.hypot(p.x - HOME.x, p.z - HOME.z);
/** The order of what it did, each action once per spell. */
function actions(l: Lair, seconds: number, e: LairEnv) {
  const seen: string[] = [];
  run(l, seconds, e, (k) => {
    const a = k.great?.action ?? 'none';
    if (seen[seen.length - 1] !== a) seen.push(a);
  });
  return seen;
}

describe('the great spider in its lair', () => {
  it('starts at home, facing up the gallery, and stays about there while nobody comes near', () => {
    const l = createLair(7, env(null));
    expect(l.great).not.toBeNull();
    expect(l.great!.action).toBe('lurk');
    expect(fromHome(l.great!)).toBeLessThan(0.01);
    expect(l.great!.heading).toBe(0);
    let furthest = 0;
    run(l, 120, env({ x: 0, z: 10 }), (k) => {
      furthest = Math.max(furthest, fromHome(k.great!));
      expect(k.great!.action).not.toBe('charge');
    });
    expect(furthest).toBeGreaterThan(0); // it shifts about a little
    expect(furthest).toBeLessThan(0.8);
  });

  it('runs at you when you come into its end of the gallery, stops short, rears up, then backs off home', () => {
    const l = createLair(7, env(null));
    const you = { x: 0.5, z: HOME.z - 6 };
    let closest = Infinity;
    let fastest = 0;
    let was = { ...l.great! };
    const seen: string[] = [];
    run(l, 9, env(you), (k) => {
      const g = k.great!;
      if (seen[seen.length - 1] !== g.action) seen.push(g.action);
      closest = Math.min(closest, Math.hypot(g.x - you.x, g.z - you.z));
      fastest = Math.max(fastest, Math.hypot(g.x - was.x, g.z - was.z) / DT);
      was = { ...g };
    });
    expect(seen.slice(0, 5)).toEqual(['alert', 'charge', 'rear', 'retreat', 'lurk']);
    expect(closest).toBeGreaterThan(GREAT.stop - 0.1);
    expect(closest).toBeLessThan(GREAT.stop + 0.2);
    expect(fastest).toBeGreaterThan(2.5);
    expect(fromHome(l.great!)).toBeLessThan(0.8);
  });

  it('faces you while it backs off', () => {
    const l = createLair(7, env(null));
    const you = { x: 0, z: HOME.z - 6 };
    let backing = 0;
    run(l, 10, env(you), (k) => {
      const g = k.great!;
      if (g.action !== 'retreat') return;
      backing++;
      const f = { x: -Math.sin(g.heading), z: -Math.cos(g.heading) };
      const d = Math.hypot(you.x - g.x, you.z - g.z);
      expect((f.x * (you.x - g.x) + f.z * (you.z - g.z)) / d).toBeGreaterThan(0.95);
    });
    expect(backing).toBeGreaterThan(30);
  });

  it("doesn't come for you outside its end of the gallery", () => {
    const l = createLair(7, env(null));
    const seen = actions(l, 60, env({ x: 0, z: HOME.z - GREAT.range - 0.5 }));
    expect(seen).not.toContain('alert');
    expect(seen).not.toContain('charge');
  });

  it('never leaves its end of the gallery, even when you back off as it comes', () => {
    const l = createLair(7, env(null));
    const you = { x: 0, z: HOME.z - GREAT.range + 0.3 };
    let furthest = 0;
    run(l, 20, env(you), (k, t) => {
      if (t > 0.5) you.z = Math.max(HOME.z - 30, you.z - 5 * DT); // you turn and go
      furthest = Math.max(furthest, fromHome(k.great!));
    });
    expect(furthest).toBeLessThanOrEqual(GREAT.range);
    expect(furthest).toBeGreaterThan(GREAT.range - 2);
  });

  it('keeps defending it: while you stay, it runs at you again after a pause', () => {
    const l = createLair(7, env(null));
    const starts: number[] = [];
    let was = l.great!.action;
    run(l, 60, env({ x: 0, z: HOME.z - 5 }), (k, t) => {
      if (k.great!.action === 'charge' && was !== 'charge') starts.push(t);
      was = k.great!.action;
    });
    expect(starts.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < starts.length; i++) expect(starts[i] - starts[i - 1]).toBeGreaterThan(GREAT.cool[0]);
  });

  it('rears up at the cat when she comes close, but never runs at her', () => {
    const l = createLair(7, env(null));
    const g = l.great!;
    const seen = actions(l, 8, env(null, { x: g.x, z: g.z - 1.2 }));
    expect(seen).toContain('rear');
    expect(seen).not.toContain('charge');
  });

  it('a stranded one (the gallery changed) is back home at once', () => {
    const l = createLair(7, env(null));
    Object.assign(l.great!, { x: 0, z: HOME.z - 40, action: 'lurk' });
    stepLair(l, DT, env(null));
    expect(fromHome(l.great!)).toBeLessThan(0.01);
  });
});

describe('when the cat kills it', () => {
  it('leaves its body where it died, and only one is ever alive', () => {
    const l = createLair(7, env(null));
    const g = l.great!;
    Object.assign(g, { x: 0.4, z: HOME.z - 2 });
    g.dead = true;
    stepLair(l, DT, env(null));
    expect(l.great).toBeNull();
    expect(l.bodies).toHaveLength(1);
    expect(l.bodies[0]).toMatchObject({ x: 0.4, z: HOME.z - 2 });
  });

  it('lets a new one down from the ceiling after a while: a different wait each time, always under 20 minutes', () => {
    const waits: number[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const l = createLair(seed, env(null));
      l.great!.dead = true;
      stepLair(l, 1, env(null));
      let t = 1;
      for (; !l.great && t < 1500; t += 1) stepLair(l, 1, env(null));
      waits.push(t);
    }
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(GREAT.respawn[0]);
    expect(Math.max(...waits)).toBeLessThan(20 * 60);
    expect(Math.max(...waits) - Math.min(...waits)).toBeGreaterThan(5 * 60);
  });

  it('the new one comes down on its thread to the floor of its lair, and settles there', () => {
    const l = createLair(3, env(null));
    l.great!.dead = true;
    stepLair(l, 1, env(null));
    while (!l.great) stepLair(l, 1, env(null));
    const g = l.great!;
    expect(g.action).toBe('descend');
    expect(g.y).toBeGreaterThan(3);
    expect(fromHome(g)).toBeLessThan(0.01);
    let lowest = g.y;
    run(l, GREAT.descendS + 1, env(null), (k) => {
      expect(k.great!.y).toBeLessThanOrEqual(lowest + 1e-9);
      lowest = k.great!.y;
    });
    expect(g.y).toBe(0);
    expect(g.action).toBe('lurk');
  });

  it("the new one isn't distracted from coming down: it doesn't run at you on its thread", () => {
    const l = createLair(3, env(null));
    l.great!.dead = true;
    stepLair(l, 1, env(null));
    while (!l.great) stepLair(l, 1, env(null));
    const seen = actions(l, 1, env({ x: 0, z: HOME.z - 3 }));
    expect(seen).toEqual(['descend']);
  });

  it('its dead bodies go at random times, each shrivelling away slowly', () => {
    const l = createLair(11, env(null));
    const lives: number[] = [];
    for (let k = 0; k < 3; k++) {
      while (!l.great || l.great.y > 0) stepLair(l, 1, env(null));
      l.great.dead = true;
      stepLair(l, 1, env(null));
      lives.push(l.bodies[l.bodies.length - 1].life);
    }
    expect(new Set(lives).size).toBe(3);
    for (const v of lives) {
      expect(v).toBeGreaterThanOrEqual(GREAT.bodyLife[0]);
      expect(v).toBeLessThanOrEqual(GREAT.bodyLife[1]);
    }
    // one body, followed to the end: whole until its time, then shrivelling over GREAT.shrivelS, then gone
    const b = l.bodies[l.bodies.length - 1];
    const seen: number[] = [];
    while (l.bodies.includes(b)) {
      seen.push(bodyShrivel(b));
      stepLair(l, 1, env(null));
      if (l.great) l.great.dead = false;
    }
    const shrivelling = seen.filter((v) => v > 0 && v < 1).length;
    expect(seen[0]).toBe(0);
    expect(shrivelling).toBeGreaterThan(GREAT.shrivelS - 3);
    expect(b.age).toBeLessThanOrEqual(b.life + GREAT.shrivelS + 1);
  });

  it('keeps no more than a few bodies about', () => {
    const l = createLair(5, env(null));
    for (let k = 0; k < GREAT.maxBodies + 3; k++) {
      while (!l.great || l.great.y > 0) stepLair(l, 5, env(null));
      l.great.dead = true;
      stepLair(l, DT, env(null));
      expect(l.bodies.length).toBeLessThanOrEqual(GREAT.maxBodies);
    }
  });
});
