// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { oneAtATime } from './oneAtATime.ts';

describe('oneAtATime', () => {
  it('never runs two at once: a call made while one runs waits for it, and they run in the order called', async () => {
    let running = 0;
    let most = 0;
    const order: number[] = [];
    let n = 0;
    const job = oneAtATime(async () => {
      const me = ++n;
      running++;
      most = Math.max(most, running);
      await new Promise((r) => setTimeout(r, 5));
      order.push(me);
      running--;
    });
    await Promise.all([job(), job(), job()]);
    expect(most).toBe(1);
    expect(order).toEqual([1, 2, 3]);
  });

  it('carries on after one fails, and tells only that caller', async () => {
    let calls = 0;
    const job = oneAtATime(async () => {
      if (++calls === 1) throw new Error('disk gone');
    });
    const [first, second] = await Promise.allSettled([job(), job()]);
    expect(first.status).toBe('rejected');
    expect(second.status).toBe('fulfilled');
    expect(calls).toBe(2);
  });
});
