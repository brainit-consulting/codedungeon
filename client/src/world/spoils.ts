// The chest of spoils in the hall's trophy corner: what's in it (the guild's latest merged pull requests) and what
// happens when you open it. Pure, so it can be tested; SpoilsChest.tsx draws it.

export interface Spoil {
  /** The chamber's repo name, without the owner. */
  chamber: string;
  number: number;
  title: string;
  url: string;
  /** When it was merged, if GitHub said (the board counts a pull request as merged by its state). */
  mergedAt: string | null;
  /** The coder who made it, while the dungeon still knows (their current pull request or branch). */
  by: string | null;
}

interface PullLike {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: string;
  createdAt: string;
  mergedAt: string | null;
}
interface RepoLike {
  id: string;
  fullName: string;
  pulls: PullLike[];
}
interface AgentLike {
  name: string;
  repoId: string;
  role: string;
  prNumber: number | null;
  branch: string | null;
}

/** The newest merged pull requests across every chamber, newest first. */
export function spoilsList(repos: RepoLike[], agents: AgentLike[], limit = 8): Spoil[] {
  const out: (Spoil & { at: string })[] = [];
  for (const r of repos) {
    const devs = agents.filter((a) => a.repoId === r.id && a.role === 'dev');
    for (const p of r.pulls) {
      if (p.state !== 'MERGED') continue;
      const by = devs.find((a) => a.prNumber === p.number) ?? devs.find((a) => a.branch && a.branch === p.headRefName);
      out.push({ chamber: r.fullName.split('/').pop() ?? r.fullName, number: p.number, title: p.title, url: p.url, mergedAt: p.mergedAt, by: by?.name ?? null, at: p.mergedAt ?? p.createdAt });
    }
  }
  return out
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map(({ at: _at, ...s }) => s);
}

/** About one opening in five lets a rat out. */
export const RAT_CHANCE = 0.2;

/**
 * What happens when the chest is opened. The very first time ever it's a mimic and snaps at you (then opens).
 * After that, from the second opening of a visit, now and then a rat bolts out, but only one a visit.
 */
export function chestOpening(s: { mimicDone: boolean; opens: number; ratOut: boolean; roll: number }): { mimic: boolean; rat: boolean } {
  if (!s.mimicDone) return { mimic: true, rat: false };
  // one in five from the second opening, and the third has one for sure if none has come yet this visit
  return { mimic: false, rat: !s.ratOut && s.opens >= 1 && (s.roll < RAT_CHANCE || s.opens >= 2) };
}
