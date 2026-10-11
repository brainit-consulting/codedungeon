// How many pull requests are in QA, ready to merge or stuck, for the plaque, the chamber's sign, the great hall's
// board and the scroll. Only open ones count: a merged PR keeps its passed QA record, but it isn't waiting any more.

import type { QaStatus } from '../../shared/types';

export function prCounts(pulls: { number: number; state: string }[], statusOf: (pr: number) => QaStatus | undefined) {
  const open = pulls.filter((p) => p.state === 'OPEN').map((p) => statusOf(p.number));
  return {
    inQa: open.filter((s) => s && s !== 'passed' && s !== 'needs-human').length,
    ready: open.filter((s) => s === 'passed').length,
    stuck: open.filter((s) => s === 'needs-human').length,
  };
}
