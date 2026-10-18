// Sending a stuck pull request back to a coder with the Overlord's note (or the DungeonMaster's), for a proper fix
// round on its own branch. Shared by the server's QA flow and the notice board.
import type { QaStatus } from './types.ts';

/**
 * QA's report failed this exact commit and nothing new was pushed: another QA round would test the same code again.
 * `failedSha` is the commit a report failed, not just the last one tested: a round that was stopped or ended without
 * a report failed nothing, so retrying it needs no warning.
 */
export function stillFailedCommit(failedSha: string | null, headSha: string | null, status: QaStatus | null): boolean {
  if (!failedSha || !headSha || (status !== 'failed' && status !== 'needs-human')) return false;
  const [a, b] = [failedSha.toLowerCase(), headSha.toLowerCase()];
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * The commit QA has failed after a round: the tested commit when the report failed it, none when it passed, and the
 * one from before when there was no report (the round was stopped, or ended without one).
 */
export function failedShaAfter(verdict: 'pass' | 'fail' | null, testedSha: string | null, before: string | null): string | null {
  if (verdict === 'pass') return null;
  if (verdict === 'fail') return testedSha;
  return before;
}

/** Why a PR can't be sent back right now, worded for the Overlord or the DungeonMaster; null when it can. */
export function sendBackRefusal(pr: number, status: QaStatus | null, note: string): string | null {
  if (!note.trim()) return 'Write what the coder should do.';
  if (!status || status === 'queued') return `PR #${pr} has not been through QA yet: send it to QA first.`;
  if (status === 'testing') return `PR #${pr} is being tested right now.`;
  if (status === 'fixing') return `PR #${pr} is already being fixed.`;
  if (status === 'passed') return `PR #${pr} passed QA; it merges once its checks pass.`;
  return null;
}

/** What a fix round tells the coder to do: the Overlord's note first, then QA's own instructions. */
export function fixBrief(note: string | null, qaInstructions: string | null): string {
  if (!note) return qaInstructions ?? '';
  const mine = `The Overlord's instructions:\n${note.trim()}`;
  return qaInstructions ? `${mine}\n\nQA's suggestions, from its last report. Where they differ, follow the Overlord:\n${qaInstructions}` : mine;
}
