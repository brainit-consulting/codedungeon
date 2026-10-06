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
  /** The dungeon is pushing the branch right now. */
  uploading?: boolean;
}

/**
 * What to tell the Overlord, or null when the branch is on GitHub. The usual cause is a first push that never
 * finished (a large one is slow), so when the folder already has the commits the notice offers the push.
 */
export function noMainNotice(s: BranchState): string | null {
  if (s.onGitHub) return null;
  const name = s.fullName.split('/').pop() ?? s.fullName;
  if (s.uploading) return `${name} is uploading to GitHub. With large files this can take a while. The guild starts once it's there.`;
  if (s.localHead && s.localPath) {
    return `${name}'s ${s.branch} branch is on this computer (at ${s.localHead}) but not on GitHub yet. Press Push to GitHub, or in ${s.localPath} run: git push -u origin ${s.branch}. With large files this can take a while. The guild starts once it's there.`;
  }
  return `${s.fullName} has no ${s.branch} branch on GitHub yet. Push a first commit to it (or create the repo with a README). The guild starts once it's there.`;
}

/**
 * One line of `git push --progress` (or Git LFS before it) as a few plain words for the chamber, or null for lines
 * that say nothing about progress.
 */
export function pushProgress(line: string): string | null {
  const pct = line.match(/:\s+(\d+)%/)?.[1];
  if (/^\s*Uploading LFS objects:/i.test(line) && pct) {
    const of = line.match(/\((\d+)\/(\d+)\)/);
    return `sending large files ${pct}%${of ? ` (${of[1]} of ${of[2]})` : ''}`;
  }
  if (/^\s*Writing objects:/i.test(line) && pct) return `sending ${pct}%`;
  if (/^\s*Compressing objects:/i.test(line) && pct) return `packing ${pct}%`;
  if (/^\s*(Enumerating|Counting) objects:/i.test(line)) return 'counting files';
  return null;
}
