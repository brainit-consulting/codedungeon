// The Overlord's Daybook, the book on top of the stack on your table (Lobby.tsx): today in the dungeon, from the live
// figures. Pure: the page's date and lines from the chambers, the guild and today's work at API prices.
import { formatTokens, formatUsd } from '../../../shared/usage';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "A", "A and B", "A, B and C". */
const listed = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export interface DaybookInput {
  now: number;
  repos: { fullName: string; pulls: { state: string; mergedAt: string | null }[] }[];
  agents: { name: string; status: string; role: string }[];
  /** Every session since midnight (the gauges' figures); null before they arrive. */
  today: { tokens: number; costUsd: number } | null;
}

export function daybook({ now, repos, agents, today }: DaybookInput): { date: string; lines: string[] } {
  const d = new Date(now);
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const merged = repos
    .map((r) => ({ name: r.fullName.split('/').pop() ?? r.fullName, n: r.pulls.filter((p) => p.state === 'MERGED' && p.mergedAt && Date.parse(p.mergedAt) >= midnight).length }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const total = merged.reduce((s, c) => s + c.n, 0);
  const prs = (n: number) => `${n} pull request${n === 1 ? '' : 's'}`;
  const mergedLine =
    total === 0
      ? 'No pull request has been merged yet today.'
      : merged.length === 1
        ? `The guild has merged ${prs(total)} today, in ${merged[0].name}.`
        : `The guild has merged ${prs(total)} today: ${listed(merged.map((c) => `${c.n} in ${c.name}`))}.`;
  const working = agents.filter((a) => a.status === 'working' || a.status === 'preparing').map((a) => a.name);
  const workLine = working.length ? `At work now: ${listed(working)}.` : 'Nobody is at work just now.';
  const spent = today && (today.tokens > 0 || today.costUsd > 0);
  const spendLine = spent ? `Today's work so far: ${formatTokens(today.tokens)} tokens, worth ${formatUsd(today.costUsd)} at API prices.` : "Today's work so far: nothing yet.";
  return { date: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, lines: [mergedLine, workLine, spendLine] };
}
