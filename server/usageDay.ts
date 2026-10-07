// The day's usage at API prices for the gauges: every session since local midnight, kept in state.json so a
// restart doesn't lose it. Only deltas are added, so two jobs finishing at once can't count anything twice.

export interface UsageDay {
  day: string;
  tokens: number;
  costUsd: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-06", in local time. */
export function localDay(now: number) {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ok = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** The day total with a job's latest growth added; a new day starts from 0. */
export function addToDay(d: UsageDay | undefined, tokens: number, costUsd: number, now: number): UsageDay {
  const day = localDay(now);
  const base = d && d.day === day ? d : { day, tokens: 0, costUsd: 0 };
  return { day, tokens: base.tokens + ok(tokens), costUsd: base.costUsd + ok(costUsd) };
}
