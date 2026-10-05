// A chamber whose GitHub repo has no default branch yet: nobody can start work until it does. Pure, so it can be tested.

export interface BranchState {
  fullName: string;
  branch: string;
  /** GitHub has the branch. */
  onGitHub: boolean;
  /** The branch's head in the chamber's folder (short sha), when the folder has it and GitHub doesn't. */
  localHead: string | null;
  /** The Overlord's own project folder, when the chamber lives in one. */
  localPath: string | null;
}

/**
 * What to tell the Overlord, or null when the branch is on GitHub. The usual cause is a first push that never
 * finished (a large one is slow), so when the folder already has the commits the notice names the push to run.
 */
export function noMainNotice(s: BranchState): string | null {
  if (s.onGitHub) return null;
  const name = s.fullName.split('/').pop() ?? s.fullName;
  if (s.localHead && s.localPath) {
    return `${name}'s ${s.branch} branch is on this computer (at ${s.localHead}) but not on GitHub yet. In ${s.localPath} run: git push -u origin ${s.branch}. With large files this can take a while. The guild starts once it's there.`;
  }
  return `${s.fullName} has no ${s.branch} branch on GitHub yet. Push a first commit to it (or create the repo with a README). The guild starts once it's there.`;
}
