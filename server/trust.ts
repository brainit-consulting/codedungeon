// Who the dungeon takes work from. On a public repo anyone can open an issue or a pull request, and agents run
// unsandboxed on the Overlord's machine, so only the repo's owner, its organisation's members and its collaborators
// count. Everyone else's issues and pull requests are shown, but never worked on, tested, previewed or merged.

/** GitHub's authorAssociation values that mean a say in the repo. CONTRIBUTOR only means a commit was merged once. */
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

/** Whether an issue's or pull request's author is the repo's owner, an org member or a collaborator. Unknown is no. */
export function trustedAuthor(association: string | null | undefined): boolean {
  return TRUSTED.has(association ?? '');
}

/** A pull request the dungeon may test, fix and merge: a trusted author's, from a branch of the repo itself, not a fork. */
export function trustedPull(association: string | null | undefined, isCrossRepository: boolean | null | undefined): boolean {
  return trustedAuthor(association) && isCrossRepository === false;
}

/** Why the dungeon won't touch an issue or pull request, worded for the Overlord and the DungeonMaster; null when it may. */
export function strangerRefusal(kind: 'Issue' | 'PR', number: number, item: { trusted: boolean; author: string | null }): string | null {
  if (item.trusted) return null;
  const who = item.author ? `@${item.author}` : 'someone';
  return kind === 'Issue'
    ? `Issue #${number} was opened by ${who}, who isn't the repo's owner, an org member or a collaborator, so the dungeon won't work on it. Read it on GitHub, and if you want it built, file it again yourself.`
    : `PR #${number} was opened by ${who} from a fork or by someone who isn't the repo's owner, an org member or a collaborator, so the dungeon won't run, test or merge it. Review it on GitHub yourself.`;
}
