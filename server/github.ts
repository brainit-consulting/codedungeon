import { gh, ghJson } from './exec.ts';
import type { GhRepoSummary, IssueInfo, PullInfo } from '../shared/types.ts';
import { trustedAuthor, trustedPull, type GhComment } from './trust.ts';

// All GitHub access goes through the gh CLI so it reuses the user's existing `gh auth login`.

export async function currentUser(): Promise<string> {
  return gh(['api', 'user', '--jq', '.login']);
}

export async function listMyRepos(owner?: string): Promise<GhRepoSummary[]> {
  const args = ['repo', 'list'];
  if (owner) args.push(owner);
  args.push('--limit', '200', '--json', 'nameWithOwner,description,visibility,updatedAt');
  const repos = await ghJson<GhRepoSummary[]>(args);
  return repos.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export interface RepoMeta {
  nameWithOwner: string;
  description: string;
  url: string;
  defaultBranch: string;
  /** Private: GitHub shows its pages only to accounts with access (a 404 to anyone else). */
  private: boolean;
}

export async function repoMeta(fullName: string): Promise<RepoMeta> {
  const raw = await ghJson<{ nameWithOwner: string; description: string | null; url: string; defaultBranchRef: { name: string } | null; isPrivate: boolean }>([
    'repo',
    'view',
    fullName,
    '--json',
    'nameWithOwner,description,url,defaultBranchRef,isPrivate',
  ]);
  return {
    nameWithOwner: raw.nameWithOwner,
    description: raw.description ?? '',
    url: raw.url,
    defaultBranch: raw.defaultBranchRef?.name || 'main',
    private: !!raw.isPrivate,
  };
}

interface IssuesGraphql {
  data: {
    repository: {
      issues: {
        nodes: { number: number; title: string; body: string | null; url: string; createdAt: string; author: { login: string } | null; authorAssociation: string; labels: { nodes: { name: string }[] } }[];
      };
    };
  };
}

export function issuesFromGraphql(out: IssuesGraphql): IssueInfo[] {
  return out.data.repository.issues.nodes
    .map((i) => ({
      number: i.number,
      title: i.title,
      body: i.body ?? '',
      url: i.url,
      labels: i.labels.nodes.map((l) => l.name),
      createdAt: i.createdAt,
      author: i.author?.login ?? null,
      trusted: trustedAuthor(i.authorAssociation),
    }))
    .sort((a, b) => a.number - b.number);
}

/** The newest 100 open issues, oldest first. GraphQL because `gh issue list` can't say who the author is to the repo. */
export async function listIssues(fullName: string): Promise<IssueInfo[]> {
  const [owner, name] = fullName.split('/');
  const query =
    'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){issues(states:OPEN,first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{number title body url createdAt author{login} authorAssociation labels(first:100){nodes{name}}}}}}';
  return issuesFromGraphql(await ghJson<IssuesGraphql>(['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`]));
}

interface RawPull {
  number: number;
  title: string;
  url: string;
  headRefName: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  isDraft: boolean;
  mergeable: string;
  reviewDecision: string | null;
  closingIssuesReferences: { number: number }[] | null;
  createdAt: string;
  mergedAt: string | null;
  additions: number;
  deletions: number;
  headRefOid: string;
  mergeStateStatus: string;
  author: { login: string } | null;
  isCrossRepository: boolean;
  // check runs (GitHub Actions…) carry name/status/conclusion/detailsUrl; commit statuses (Vercel…) carry context/state/targetUrl
  statusCheckRollup: { name?: string; context?: string; status?: string; conclusion?: string; state?: string; detailsUrl?: string; targetUrl?: string }[] | null;
}

const PR_FIELDS =
  'number,title,url,headRefName,headRefOid,state,isDraft,mergeable,mergeStateStatus,reviewDecision,closingIssuesReferences,createdAt,mergedAt,additions,deletions,statusCheckRollup,author,isCrossRepository';

type Check = NonNullable<RawPull['statusCheckRollup']>[number];
const BAD = ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
const failed = (c: Check) => BAD.includes(c.conclusion ?? '') || BAD.includes(c.state ?? '');
const pending = (c: Check) => (!!c.status && c.status !== 'COMPLETED') || c.state === 'PENDING' || c.state === 'EXPECTED';
const checkName = (c: Check) => c.name || c.context || 'check';

function checksOf(rollup: RawPull['statusCheckRollup']): PullInfo['checks'] {
  if (!rollup || rollup.length === 0) return 'none';
  if (rollup.some(failed)) return 'failing';
  if (rollup.some(pending)) return 'pending';
  return 'passing';
}

/** `association`: the PR author's authorAssociation, which `gh pr list` doesn't give (pullAssociations). */
export function toPull(p: RawPull, association: string | undefined): PullInfo {
  return {
    number: p.number,
    title: p.title,
    url: p.url,
    headRefName: p.headRefName,
    state: p.state,
    isDraft: p.isDraft,
    mergeable: p.mergeable,
    reviewDecision: p.reviewDecision || null,
    closesIssues: (p.closingIssuesReferences ?? []).map((r) => r.number),
    createdAt: p.createdAt,
    mergedAt: p.mergedAt,
    additions: p.additions,
    deletions: p.deletions,
    checks: checksOf(p.statusCheckRollup),
    headSha: p.headRefOid,
    mergeState: p.mergeStateStatus || 'UNKNOWN',
    failedChecks: (p.statusCheckRollup ?? []).filter(failed).map((c) => ({ name: checkName(c), url: c.detailsUrl || c.targetUrl || null })),
    pendingChecks: (p.statusCheckRollup ?? []).filter(pending).map(checkName),
    author: p.author?.login ?? null,
    trusted: trustedPull(association, p.isCrossRepository),
  };
}

interface AssociationsGraphql {
  data: { repository: Record<'open' | 'merged', { nodes: { number: number; authorAssociation: string }[] }> };
}

/** PR number → its author's authorAssociation. */
export function pullAssociations(out: AssociationsGraphql): Map<number, string> {
  const r = out.data.repository;
  return new Map([...r.open.nodes, ...r.merged.nodes].map((p) => [p.number, p.authorAssociation]));
}

export async function listPulls(fullName: string): Promise<PullInfo[]> {
  const [owner, name] = fullName.split('/');
  const query =
    'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){open:pullRequests(states:OPEN,first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{number authorAssociation}} merged:pullRequests(states:MERGED,first:20,orderBy:{field:CREATED_AT,direction:DESC}){nodes{number authorAssociation}}}}';
  const [open, merged, associations] = await Promise.all([
    ghJson<RawPull[]>(['pr', 'list', '-R', fullName, '--state', 'open', '--limit', '50', '--json', PR_FIELDS]),
    ghJson<RawPull[]>(['pr', 'list', '-R', fullName, '--state', 'merged', '--limit', '8', '--json', PR_FIELDS]),
    ghJson<AssociationsGraphql>(['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`]).then(pullAssociations),
  ]);
  // A PR missing from the lookup (opened between the two calls) counts as a stranger's until the next sync.
  return [...open, ...merged].map((p) => toPull(p, associations.get(p.number)));
}

/** Pull requests merged on or after `since` (ISO), newest first, up to 100: the Overlord's Ledger. */
export async function mergedSince(fullName: string, since: string): Promise<{ number: number; title: string; url: string; mergedAt: string }[]> {
  const day = since.slice(0, 10); // GitHub's search takes a date; the page trims to the exact hour
  const list = await ghJson<{ number: number; title: string; url: string; mergedAt: string | null }[]>(['pr', 'list', '-R', fullName, '--state', 'merged', '--search', `merged:>=${day}`, '--limit', '100', '--json', 'number,title,url,mergedAt']);
  return list.filter((p): p is typeof p & { mergedAt: string } => !!p.mergedAt && p.mergedAt >= since);
}

interface HeadGraphql {
  data: { repository: { ref: { target: { oid: string; statusCheckRollup: { contexts: { nodes: Check[] } } | null } } | null } };
}

export function headFromGraphql(out: HeadGraphql, fullName: string, branch: string): { sha: string; checks: PullInfo['checks'] } {
  const target = out.data.repository.ref?.target;
  if (!target) throw new Error(`${fullName} has no branch ${branch}`);
  return { sha: target.oid, checks: checksOf(target.statusCheckRollup?.contexts.nodes ?? null) };
}

/** A branch's head commit and how its checks stand (for SHIP IT: is `main` green?). */
export async function branchHead(fullName: string, branch: string): Promise<{ sha: string; checks: PullInfo['checks'] }> {
  const [owner, name] = fullName.split('/');
  const query =
    'query($owner:String!,$name:String!,$ref:String!){repository(owner:$owner,name:$name){ref(qualifiedName:$ref){target{... on Commit{oid statusCheckRollup{contexts(first:100){nodes{... on CheckRun{name status conclusion detailsUrl} ... on StatusContext{context state targetUrl}}}}}}}}}';
  const out = await ghJson<HeadGraphql>(['api', 'graphql', '-f', `query=${query}`, '-f', `owner=${owner}`, '-f', `name=${name}`, '-f', `ref=refs/heads/${branch}`]);
  return headFromGraphql(out, fullName, branch);
}

/** The first lines of the commits after `base` up to `head` (oldest first). */
export async function commitSubjects(fullName: string, base: string, head: string): Promise<string[]> {
  const out = await ghJson<{ commits: { commit: { message: string } }[] }>(['api', `repos/${fullName}/compare/${base}...${head}`]);
  return out.commits.map((c) => c.commit.message.split('\n')[0]);
}

// swarm:<specialty> labels route issues to specialists. gh refuses unknown labels, so they're created on first use.
const labelsMade = new Set<string>();

async function ensureLabel(fullName: string, name: string) {
  const key = `${fullName}#${name}`;
  if (labelsMade.has(key)) return;
  await gh(['label', 'create', name, '-R', fullName, '--color', 'c77dff', '--description', 'Code Dungeon: routed to this specialty', '--force']);
  labelsMade.add(key);
}

export async function createIssue(fullName: string, title: string, body: string, labels: string[] = []): Promise<number> {
  for (const l of labels) await ensureLabel(fullName, l);
  const args = ['issue', 'create', '-R', fullName, '--title', title, '--body-file', '-'];
  for (const l of labels) args.push('--label', l);
  const out = await gh(args, { input: body || ' ' });
  const match = out.match(/\/issues\/(\d+)/);
  if (!match) throw new Error(`Could not read the new issue number from gh output: ${out}`);
  return Number(match[1]);
}

/** OPEN or CLOSED; null when the repo has no such issue. */
export async function issueState(fullName: string, number: number): Promise<'OPEN' | 'CLOSED' | null> {
  try {
    const raw = await ghJson<{ state: string }>(['issue', 'view', String(number), '-R', fullName, '--json', 'state']);
    return raw.state === 'OPEN' ? 'OPEN' : 'CLOSED';
  } catch {
    return null;
  }
}

/** Replace an issue's body and/or add and remove labels. */
export async function editIssue(fullName: string, number: number, edit: { body?: string; addLabels?: string[]; removeLabels?: string[] }): Promise<void> {
  const args = ['issue', 'edit', String(number), '-R', fullName];
  if (edit.body !== undefined) args.push('--body-file', '-');
  for (const l of edit.addLabels ?? []) {
    await ensureLabel(fullName, l);
    args.push('--add-label', l);
  }
  for (const l of edit.removeLabels ?? []) args.push('--remove-label', l);
  if (args.length === 5) return;
  await gh(args, edit.body !== undefined ? { input: edit.body || ' ' } : undefined);
}

/** Merge a PR. With headSha, GitHub refuses if anything was pushed after that commit (e.g. after QA signed it off). */
export async function mergePull(fullName: string, number: number, method: 'squash' | 'merge' | 'rebase', headSha?: string): Promise<void> {
  const pr = await ghJson<{ headRefName: string; isCrossRepository: boolean }>(['pr', 'view', String(number), '-R', fullName, '--json', 'headRefName,isCrossRepository']);
  await gh(['pr', 'merge', String(number), '-R', fullName, `--${method}`, ...(headSha ? ['--match-head-commit', headSha] : [])], { timeoutMs: 60_000 });
  // Tidy up the swarm branch on the remote; the local worktree is cleaned when the agent takes its next issue.
  if (!pr.isCrossRepository && pr.headRefName.startsWith('swarm/')) {
    await gh(['api', '-X', 'DELETE', `repos/${fullName}/git/refs/heads/${pr.headRefName}`]).catch(() => undefined);
  }
}

/** Whether two commits hold exactly the same files, e.g. an empty commit pushed to re-run a deployment. */
export async function sameCode(fullName: string, a: string, b: string): Promise<boolean> {
  const tree = (sha: string) => gh(['api', `repos/${fullName}/commits/${sha}`, '--jq', '.commit.tree.sha']);
  const [ta, tb] = await Promise.all([tree(a), tree(b)]);
  return !!ta.trim() && ta.trim() === tb.trim();
}

/** Merge the base branch into a PR's branch on GitHub, for repos that only merge up-to-date branches. */
export async function updateBranch(fullName: string, number: number): Promise<void> {
  await gh(['pr', 'update-branch', String(number), '-R', fullName], { timeoutMs: 60_000 });
}

export async function closePull(fullName: string, number: number): Promise<void> {
  await gh(['pr', 'close', String(number), '-R', fullName]);
}

export async function prForBranch(fullName: string, branch: string): Promise<{ number: number; url: string } | null> {
  const list = await ghJson<{ number: number; url: string }[]>(['pr', 'list', '-R', fullName, '--head', branch, '--state', 'all', '--json', 'number,url', '--limit', '1']);
  return list[0] ?? null;
}

// ---------- QA support ----------

export interface PrDetails {
  number: number;
  title: string;
  body: string;
  url: string;
  headRefName: string;
  headSha: string;
  isCrossRepository: boolean;
  closesIssues: number[];
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  mergeable: string;
  mergeState: string;
}

export async function prDetails(fullName: string, number: number): Promise<PrDetails> {
  const raw = await ghJson<{
    number: number;
    title: string;
    body: string;
    url: string;
    headRefName: string;
    headRefOid: string;
    isCrossRepository: boolean;
    closingIssuesReferences: { number: number }[] | null;
    state: PrDetails['state'];
    mergeable: string;
    mergeStateStatus: string;
  }>(['pr', 'view', String(number), '-R', fullName, '--json', 'number,title,body,url,headRefName,headRefOid,isCrossRepository,closingIssuesReferences,state,mergeable,mergeStateStatus']);
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? '',
    url: raw.url,
    headRefName: raw.headRefName,
    headSha: raw.headRefOid,
    isCrossRepository: raw.isCrossRepository,
    closesIssues: (raw.closingIssuesReferences ?? []).map((r) => r.number),
    state: raw.state,
    mergeable: raw.mergeable,
    mergeState: raw.mergeStateStatus || 'UNKNOWN',
  };
}

/** An issue's title, body and comments; each comment says what its author is to the repo (server/trust.ts). */
export async function issueDetails(fullName: string, number: number): Promise<{ title: string; body: string; comments: GhComment[] }> {
  const raw = await ghJson<{ title: string; body: string; comments: { author: { login: string } | null; authorAssociation: string; body: string; createdAt: string }[] }>([
    'issue',
    'view',
    String(number),
    '-R',
    fullName,
    '--json',
    'title,body,comments',
  ]);
  const comments = (raw.comments ?? []).map((c) => ({ author: c.author?.login ?? null, association: c.authorAssociation, body: c.body ?? '', createdAt: c.createdAt }));
  return { title: raw.title, body: raw.body ?? '', comments };
}

export async function commentPull(fullName: string, number: number, body: string): Promise<string> {
  const out = await gh(['pr', 'comment', String(number), '-R', fullName, '--body-file', '-'], { input: body });
  return out.match(/https:\/\/github\.com\/\S+/)?.[0] ?? '';
}

// QA screenshots live on an orphan branch so evidence never lands in the default branch when a PR is merged.
export const EVIDENCE_BRANCH = 'swarm-qa-evidence';
/** On the evidence branch itself: Vercel skips its commits (one per screenshot), which nothing reads; GitHub serves
 *  the screenshots. Measured on the reference CRM: no deployment and no commit status for a commit carrying it. */
export const EVIDENCE_VERCEL_JSON = JSON.stringify({ $schema: 'https://openapi.vercel.sh/vercel.json', git: { deploymentEnabled: { [EVIDENCE_BRANCH]: false } } }, null, 2) + '\n';
const evidenceReady = new Set<string>();

const ghApiJson = <T>(method: string, endpoint: string, body: unknown) =>
  gh(['api', '-X', method, endpoint, '-H', 'Content-Type: application/json', '--input', '-'], { input: JSON.stringify(body), timeoutMs: 120_000 }).then(
    (out) => (out ? JSON.parse(out) : null) as T,
  );

async function ensureEvidenceBranch(fullName: string) {
  if (evidenceReady.has(fullName)) return;
  try {
    await gh(['api', `repos/${fullName}/git/ref/heads/${EVIDENCE_BRANCH}`]);
  } catch {
    const readme =
      '# QA evidence\n\nScreenshots attached to pull request QA reports by Code Dungeon QA agents.\nThis branch has no shared history with the code and is never merged.\n';
    const newTree = await ghApiJson<{ sha: string }>('POST', `repos/${fullName}/git/trees`, {
      tree: [
        { path: 'README.md', mode: '100644', type: 'blob', content: readme },
        { path: 'vercel.json', mode: '100644', type: 'blob', content: EVIDENCE_VERCEL_JSON },
      ],
    });
    const commit = await ghApiJson<{ sha: string }>('POST', `repos/${fullName}/git/commits`, { message: 'QA evidence branch (Code Dungeon)', tree: newTree.sha, parents: [] });
    await ghApiJson('POST', `repos/${fullName}/git/refs`, { ref: `refs/heads/${EVIDENCE_BRANCH}`, sha: commit.sha });
    evidenceReady.add(fullName);
    return;
  }
  // a branch made before 0.18 has no vercel.json: add it once; a refusal never stops the screenshot
  try {
    await gh(['api', `repos/${fullName}/contents/vercel.json?ref=${EVIDENCE_BRANCH}`]);
  } catch {
    await ghApiJson('PUT', `repos/${fullName}/contents/vercel.json`, {
      message: 'QA evidence branch: no Vercel deployments (Code Dungeon)',
      content: Buffer.from(EVIDENCE_VERCEL_JSON).toString('base64'),
      branch: EVIDENCE_BRANCH,
    }).catch(() => {});
  }
  evidenceReady.add(fullName);
}

/** Upload one evidence file and return a URL that renders inside PR comments (also for private repos). */
export async function uploadEvidence(fullName: string, filePath: string, data: Buffer): Promise<string> {
  await ensureEvidenceBranch(fullName);
  await ghApiJson('PUT', `repos/${fullName}/contents/${filePath}`, {
    message: `QA evidence: ${filePath}`,
    content: data.toString('base64'),
    branch: EVIDENCE_BRANCH,
  });
  return `https://github.com/${fullName}/raw/${EVIDENCE_BRANCH}/${filePath}`;
}
