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
