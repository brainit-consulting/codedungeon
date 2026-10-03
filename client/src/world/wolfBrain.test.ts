import { describe, expect, it } from 'vitest';
import { WOLF, createWolf, stepWolf, type Wolf, type WolfAction, type WolfEnv } from './wolfBrain';

const AT = { x: 0, z: 0 };
const DT = 1 / 30;

interface Start {
  t: number;
  action: WolfAction;
  stir: string | null;
}

/** Step the wolf for `seconds`, with the player wherever `player(t)` says; returns every action start and the time asleep. */
function run(w: Wolf, seconds: number, player: (t: number) => { x: number; z: number } | null, cat?: (t: number) => boolean) {
  const starts: Start[] = [];
  let asleep = 0;
  let seen = w.started;
  const env: WolfEnv = { at: AT, player: null };
  const t0 = w.clock;
  for (let t = 0; t < seconds; t += DT) {
    env.player = player(t0 + t);
    env.catNear = cat?.(t0 + t) ?? false;
    stepWolf(w, DT, env);
    if (w.action === 'sleep') asleep += DT;
    if (w.started !== seen) starts.push({ t: w.clock, action: w.action, stir: w.stir });
    seen = w.started;
  }
  return { starts, asleep: asleep / seconds };
}

const nobody = () => null;
const at = (d: number) => () => ({ x: d, z: 0 });

/** A player who wanders the hall: long stretches far off, now and then a visit to the hearth, now and then lingering. */
function wanderer(seed: number) {
  let s = seed;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const legs: { until: number; d: number }[] = [];
  let t = 0;
  while (t < 3 * 3600) {
    const r = rnd();
    const d = r < 0.55 ? 6 + rnd() * 14 : r < 0.75 ? 2.6 + rnd() * 2.5 : 0.9 + rnd() * 1.4;
    t += 5 + rnd() * 90;
    legs.push({ until: t, d });
  }
  return (time: number) => {
    const leg = legs.find((l) => l.until > time) ?? legs[legs.length - 1];
    return { x: leg.d, z: Math.sin(time * 0.3) * 0.2 };
  };
}

/** Non-sleep action starts that follow a stretch of sleep (a rise and everything after it count as one). */
const episodes = (starts: Start[]) => starts.filter((s, i) => s.action !== 'sleep' && (i === 0 || starts[i - 1].action === 'sleep' || s.action === 'stir'));

describe('the hearth wolf', () => {
  it('lives the same night from the same seed, and a different one from another', () => {
    const p = wanderer(7);
    const a = run(createWolf(42), 1800, p).starts;
    const b = run(createWolf(42), 1800, p).starts;
    const c = run(createWolf(43), 1800, p).starts;
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(10);
    expect(c).not.toEqual(a);
  });

  it('left alone, sleeps, stirs every 25 to 70 s, and gets up on its own now and then', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = createWolf(seed);
      const { starts, asleep } = run(w, 20 * 60, nobody);
      expect(asleep).toBeGreaterThan(0.85);
      const rises = starts.filter((s) => s.action === 'rise');
      expect(rises.length).toBeGreaterThanOrEqual(2);
      expect(rises.length).toBeLessThanOrEqual(5);
      // stirs follow each other 25 to 70 s apart (plus the stir itself), unless he got up in between
      const stirs = starts.filter((s) => s.action === 'stir');
      expect(stirs.length).toBeGreaterThan(10);
      for (let i = 1; i < stirs.length; i++) {
        const gap = stirs[i].t - stirs[i - 1].t;
        const roseBetween = rises.some((r) => r.t > stirs[i - 1].t && r.t < stirs[i].t);
        expect(gap).toBeGreaterThanOrEqual(WOLF.stirGap[0]);
        if (!roseBetween) expect(gap).toBeLessThanOrEqual(WOLF.stirGap[1] + 3);
      }
    }
  });

  it('with a player wandering about for two hours: asleep three quarters of the time, calm, never fidgety', () => {
    for (const seed of [11, 12, 13]) {
      const w = createWolf(seed);
      const { starts, asleep } = run(w, 2 * 3600, wanderer(seed));
      expect(asleep).toBeGreaterThan(0.75);
      // at least 8 s of plain sleep between any two things he does
      for (let i = 1; i < starts.length; i++) {
        if (starts[i - 1].action === 'sleep') expect(starts[i].t - starts[i - 1].t).toBeGreaterThanOrEqual(WOLF.calm - 1e-6);
      }
      // a rise at most once every 90 s
      const rises = starts.filter((s) => s.action === 'rise');
      expect(rises.length).toBeGreaterThan(0);
      for (let i = 1; i < rises.length; i++) expect(rises[i].t - rises[i - 1].t).toBeGreaterThanOrEqual(90);
      // never more than four things begun in any minute
      const eps = episodes(starts);
      for (const e of eps) expect(eps.filter((o) => o.t >= e.t && o.t < e.t + 60).length).toBeLessThanOrEqual(4);
      // every time he got up, he lay down again and settled
      const settles = starts.filter((s) => s.action === 'settle').length;
      expect(settles).toBeGreaterThanOrEqual(rises.length - 1);
    }
  });

  it('does not keep looking up at a player hovering at the edge of "near" (hysteresis)', () => {
    for (const seed of [21, 22, 23, 24]) {
      const w = createWolf(seed);
      run(w, 60, nobody);
      const { starts } = run(w, 300, (t) => ({ x: WOLF.near[0] + Math.sin(t * 1.6) * 0.3, z: 0 }));
      const looks = starts.filter((s) => s.action === 'look');
      expect(looks.length).toBeLessThanOrEqual(1);
    }
  });

  it('lifts his head for a player who comes close: soon for most, within 18 s for all', () => {
    let soon = 0;
    for (let seed = 100; seed < 200; seed++) {
      const w = createWolf(seed);
      run(w, 50 + (seed % 7), nobody);
      const t0 = w.clock;
      const { starts } = run(w, 20, at(1.5));
      const head = starts.find((s) => s.action === 'look' || s.action === 'glance' || s.action === 'rise' || s.stir === 'yawn');
      expect(head, `seed ${seed}`).toBeDefined();
      // an ear flick first, then his calm, then the look: never longer than this
      expect(head!.t - t0).toBeLessThanOrEqual(18);
      if (head!.t - t0 <= 6) soon++;
    }
    expect(soon).toBeGreaterThanOrEqual(50);
  });

  it('gets up to stretch and yawn for some visitors, not all', () => {
    let rose = 0;
    for (let seed = 300; seed < 500; seed++) {
      const w = createWolf(seed);
      run(w, 60, nobody);
      const before = w.rises;
      run(w, 30, at(1.4));
      if (w.rises > before) rose++;
    }
    expect(rose).toBeGreaterThan(200 * 0.2);
    expect(rose).toBeLessThan(200 * 0.8);
  });

  it('after a visitor leaves mid-rise he finishes, circles, lies down and is asleep again', () => {
    let checked = 0;
    for (let seed = 500; seed < 600 && checked < 10; seed++) {
      const w = createWolf(seed);
      run(w, 60, nobody);
      // stay close until he starts to get up, then walk away
      const env: WolfEnv = { at: AT, player: { x: 1.4, z: 0 } };
      for (let t = 0; t < 30 && w.action !== 'rise'; t += DT) stepWolf(w, DT, env);
      if (w.action !== 'rise') continue;
      checked++;
      const { starts } = run(w, 25, at(30));
      expect(starts.map((s) => s.action)).toContain('lieDown');
      expect(w.action).toBe('sleep');
      expect(Number.isFinite(w.yaw)).toBe(true);
      // lying either way round, never at an odd angle
      const r = ((w.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      expect(Math.min(Math.abs(r), Math.abs(r - Math.PI), Math.abs(r - Math.PI * 2))).toBeLessThan(1e-6);
    }
    expect(checked).toBe(10);
  });

  it('gives a lingering visitor a bored glance now and then, and otherwise ignores them', () => {
    const w = createWolf(77);
    run(w, 60, nobody);
    const { starts, asleep } = run(w, 600, at(1.3));
    expect(asleep).toBeGreaterThan(0.75);
    const glances = starts.filter((s) => s.action === 'glance');
    expect(glances.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < glances.length; i++) expect(glances[i].t - glances[i - 1].t).toBeGreaterThanOrEqual(60);
  });

  it('flicks an ear when the cat comes to sleep against him', () => {
    let flicked = 0;
    for (let seed = 700; seed < 720; seed++) {
      const w = createWolf(seed);
      run(w, 40, nobody);
      const t0 = w.clock;
      const { starts } = run(w, 12, nobody, (t) => t > t0 + 1);
      if (starts.some((s) => s.action === 'stir' && s.stir === 'ear')) flicked++;
    }
    expect(flicked).toBeGreaterThan(10);
  });
});
