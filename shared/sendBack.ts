// Sending a stuck pull request back to a coder with the Overlord's note (or the DungeonMaster's), for a proper fix
// round on its own branch. Shared by the server's QA flow and the notice board.
import type { QaStatus } from './types.ts';

/** QA failed this exact commit and nothing new was pushed: another QA round would test the same code again. */
export function stillFailedCommit(testedSha: string | null, headSha: string | null, status: QaStatus | null): boolean {
  if (!testedSha || !headSha || (status !== 'failed' && status !== 'needs-human')) return false;
  const [a, b] = [testedSha.toLowerCase(), headSha.toLowerCase()];
  return a.startsWith(b) || b.startsWith(a);
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
