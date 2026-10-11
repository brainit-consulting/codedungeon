import { describe, expect, it } from 'vitest';
import type { QaStatus } from '../../shared/types';
import { prCounts } from './prCounts';

describe('counting pull requests for the plaque, the signs and the scroll', () => {
  it("counts only open pull requests: a merged PR's passed QA is not still ready to merge", () => {
    const pulls = [
      { number: 1, state: 'MERGED' },
      { number: 2, state: 'MERGED' },
      { number: 3, state: 'OPEN' },
      { number: 4, state: 'OPEN' },
      { number: 5, state: 'OPEN' },
      { number: 6, state: 'OPEN' },
    ];
    const status: Record<number, QaStatus> = { 1: 'passed', 2: 'passed', 3: 'passed', 4: 'testing', 5: 'needs-human' };
    expect(prCounts(pulls, (n) => status[n])).toEqual({ inQa: 1, ready: 1, stuck: 1 });
  });
});
