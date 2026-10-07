import { describe, expect, it } from 'vitest';
import { addToDay, localDay } from './usageDay.ts';

describe('the day total', () => {
  const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).getTime();
  it('names the local day', () => expect(localDay(at(2026, 10, 6, 23))).toBe('2026-10-06'));
  it('adds within a day', () => {
    const d = addToDay(addToDay(undefined, 1000, 0.5, at(2026, 10, 6, 9)), 500, 0.25, at(2026, 10, 6, 18));
    expect(d).toEqual({ day: '2026-10-06', tokens: 1500, costUsd: 0.75 });
  });
  it('starts again after local midnight', () => {
    const d = addToDay({ day: '2026-10-06', tokens: 9000, costUsd: 4 }, 100, 0.1, at(2026, 10, 7, 0));
    expect(d).toEqual({ day: '2026-10-07', tokens: 100, costUsd: 0.1 });
  });
  it('ignores negative or broken deltas', () => {
    expect(addToDay(undefined, -5, NaN, at(2026, 10, 6, 9))).toEqual({ day: '2026-10-06', tokens: 0, costUsd: 0 });
  });
});
