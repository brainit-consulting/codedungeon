// Handing work to a developer safely. A developer's CLI stays at its prompt after a job, and it can start a turn on
// its own there (Claude Code wakes it when a background command it left running finishes). Until that turn stops, the
// developer isn't free: on 11 October a fix for one PR was handed to a CLI still finishing another, and the end of that
// other turn was taken for the fix. And a fix round that left the commit QA failed hasn't fixed anything.

/** Whether a CLI waiting at its prompt is working on its own after this hook event. */
export function workingAloneAfter(busy: boolean, event: string): boolean {
  if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure') return true;
  if (event === 'Stop' || event === 'StopFailure') return false;
  return busy;
}

/** Whether a fix round changed the PR: its head is no longer the commit QA failed. Unknown commits count as changed. */
export function fixChangedPr(testedSha: string | null, headSha: string | null): boolean {
  if (!testedSha || !headSha) return true;
  const [a, b] = [testedSha.toLowerCase(), headSha.toLowerCase()];
  return !(a.startsWith(b) || b.startsWith(a));
}

/** How long a turn that ends with background work still running is held open, at most. */
export const BACKGROUND_WAIT_MS = 90 * 60_000;

/**
 * Whether a turn that ended is held open for its background work. That waits for a tester whose report comes when
 * a long playtest ends; but once the turn's result is in (a PR opened, a report written, a fix pushed), a dev server
 * left running is no reason to wait. On 11 October one held a finished coder for 46 minutes, blocking QA's fix round.
 */
export function keepWaitingForBackground(o: { background: boolean; resultReady: boolean; waitedMs: number }): boolean {
  return o.background && !o.resultReady && o.waitedMs < BACKGROUND_WAIT_MS;
}

/** This repo's pull request linked in a coder's message, or null. */
export function prUrlIn(text: string, fullName: string): { number: number; url: string } | null {
  const escaped = fullName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp(`https://github\\.com/${escaped}/pull/(\\d+)`, 'i'));
  return m ? { number: Number(m[1]), url: m[0] } : null;
}

/**
 * Whether an issue session that just ended sends its PR to QA. Never into a round under way; for a PR QA already
 * judged, only when it has new commits since: a late finish (a turn held open by background work) mustn't re-test
 * the commit that failed, but a follow-up pushed to a PR that passed must be tested.
 */
export function queueQaAfterIssue(o: {
  status: 'queued' | 'testing' | 'passed' | 'failed' | 'fixing' | 'needs-human' | undefined;
  testedSha: string | null;
  headSha: string | null;
}): boolean {
  if (o.status === undefined || o.status === 'queued') return true;
  if (o.status === 'testing' || o.status === 'fixing') return false;
  return fixChangedPr(o.testedSha, o.headSha);
}
