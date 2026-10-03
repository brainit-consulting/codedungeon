// Each project's chamber number (RepoView.floor) is fixed for as long as the project stays: the dungeon places the
// chamber by it, previews take their port from it, and the CEO's tools address projects by it. A new project takes the
// lowest number free, so a disconnected project's chamber is reused instead of everyone moving along.

/** The chamber a new project gets, given the numbers already in use. */
export function nextChamber(used: number[]): number {
  const taken = new Set(used);
  let n = 1;
  while (taken.has(n)) n++;
  return n;
}
