// How long the Overlord's written briefs may be. Shared by the server, which refuses a longer one instead of cutting it
// short, and the ledger, which counts as the Overlord types.

/** A chamber's QA brief (what the tester checks on every PR) and a team member's brief. */
export const BRIEF_MAX = 2500;
/** A chamber's brief: what it should build next. */
export const MISSION_MAX = 4000;

/** Why this text can't be saved as `what`, worded for the Overlord; null when it fits. Counts the text as it's saved (trimmed). */
export function tooLong(what: string, text: string, max: number): string | null {
  const length = text.trim().length;
  if (length <= max) return null;
  return `The ${what} is ${length.toLocaleString('en-US')} characters, over the ${max.toLocaleString('en-US')} limit. Shorten it by ${(length - max).toLocaleString('en-US')} and save again: nothing was saved.`;
}

/** The count shown under a brief while it's typed, e.g. "2,346 / 2,500". */
export function briefCount(text: string, max: number): string {
  return `${text.trim().length.toLocaleString('en-US')} / ${max.toLocaleString('en-US')}`;
}
