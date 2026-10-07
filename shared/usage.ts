// How tokens and cost at API prices are written, the same on the gauge board, its panel and the terminal header.
// The dungeon runs on a subscription: these say what the work would cost at API list prices, not what is paid.

export interface TokenCounts {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

/** "950", "12.4k", "812k", "4.2M". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return n < 100_000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n / 1000)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** "$0.04", "$18.40". */
export const formatUsd = (n: number) => `$${(Number.isFinite(n) && n > 0 ? n : 0).toFixed(2)}`;

const total = (t: TokenCounts) => t.input + t.cacheRead + t.cacheWrite + t.output;

/** The gauges' line for every session since midnight. */
export function todayLine(today: { tokens: number; costUsd: number } | null | undefined) {
  if (!today || (today.tokens <= 0 && today.costUsd <= 0)) return 'Today at API prices: nothing yet';
  return `Today at API prices: ${formatTokens(today.tokens)} tokens · ${formatUsd(today.costUsd)}`;
}

/** An agent's current job. tokens null: their CLI reports no figures. */
export function jobLine(tokens: TokenCounts | null, costUsd: number, contextPct: number | null, cliName: string) {
  if (!tokens) return `No figures from ${cliName}`;
  const ctx = contextPct === null ? '' : ` · context ${contextPct}% full`;
  return `This job: ${formatTokens(total(tokens))} tokens · ${formatUsd(costUsd)} at API prices${ctx}`;
}

/** Where a job's tokens went: cache reads are most of them and the cheapest. */
export function splitLine(tokens: TokenCounts | null) {
  if (!tokens) return '';
  return `${formatTokens(tokens.input)} fresh in · ${formatTokens(tokens.cacheRead)} cache reads · ${formatTokens(tokens.cacheWrite)} cache writes · ${formatTokens(tokens.output)} out`;
}
