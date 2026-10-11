import { describe, expect, it } from 'vitest';
import { CALM_MS, nextHold, suggestedSessions } from './loadBalance.ts';

const GB = 1024 ** 3;
const MB = 1024 ** 2;

describe('suggestedSessions', () => {
  it('a 32 GB, 20-core laptop runs about 8 sessions at once', () => {
    expect(suggestedSessions(32 * GB, 20)).toBe(8);
  });

  it('memory is the limit on a small machine', () => {
    expect(suggestedSessions(16 * GB, 16)).toBe(5); // (16 - 8) / 1.5
  });

  it('cores are the limit on a big-memory machine with few cores', () => {
    expect(suggestedSessions(64 * GB, 8)).toBe(3); // 8 * 0.4
  });

  it('never suggests fewer than one', () => {
    expect(suggestedSessions(8 * GB, 4)).toBe(1);
    expect(suggestedSessions(4 * GB, 2)).toBe(1);
  });
});

describe('nextHold', () => {
  const calm = { holding: false, calmSince: null };

  it('holds new work when free memory drops below 1 GB', () => {
    expect(nextHold(calm, 900 * MB, 0)).toEqual({ holding: true, calmSince: null });
  });

  it('does not hold with 1 GB or more free', () => {
    expect(nextHold(calm, 1.5 * GB, 0)).toEqual(calm);
  });

  it('keeps holding while memory is between 1 and 2 GB', () => {
    const held = { holding: true, calmSince: null };
    expect(nextHold(held, 1.5 * GB, 0)).toEqual(held);
  });

  it('lets go only after more than 2 GB stayed free for three minutes', () => {
    let h = nextHold({ holding: true, calmSince: null }, 2.5 * GB, 1000);
    expect(h).toEqual({ holding: true, calmSince: 1000 });
    h = nextHold(h, 2.5 * GB, 1000 + CALM_MS - 1);
    expect(h.holding).toBe(true);
    h = nextHold(h, 2.5 * GB, 1000 + CALM_MS);
    expect(h).toEqual({ holding: false, calmSince: null });
  });

  it('a dip during the calm starts the wait again', () => {
    let h = nextHold({ holding: true, calmSince: null }, 2.5 * GB, 0);
    h = nextHold(h, 1.2 * GB, 60_000);
    expect(h).toEqual({ holding: true, calmSince: null });
    h = nextHold(h, 2.5 * GB, 120_000);
    expect(h.calmSince).toBe(120_000);
  });
});
