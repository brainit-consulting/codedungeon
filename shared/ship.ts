// SHIP IT: how a chamber's app gets from `main` to the internet on Vercel. The pure parts, shared by the server
// (server/ship.ts decides with them) and the client (the panel and the sign show them).
// Spec: docs/superpowers/specs/2026-10-03-ship-it-design.md

/** How a chamber ships. `git-*`: Vercel's GitHub integration builds; `cli`: the dungeon deploys with the CLI. */
export type ShipMethod = 'none' | 'git-promote' | 'git-auto' | 'cli';
export type ShipBusy = 'setting-up' | 'shipping' | 'previewing' | 'undoing' | 'resuming' | 'launching';
export type Checks = 'pending' | 'passing' | 'failing' | 'none';

/** A Vercel project, with the team (`scope`) every CLI call must name. */
export interface VercelProjectRef {
  id: string;
  name: string;
  scope: string;
}

export interface ShipLogEntry {
  at: number;
  action: 'ship' | 'undo' | 'launch' | 'resume';
  ok: boolean;
  deploymentId: string | null;
  url: string | null;
  sha: string | null;
  prs: number[];
  note: string;
}

/** What is kept on disk per chamber. */
export interface ShipConfig {
  method: ShipMethod;
  project: VercelProjectRef | null;
  firstShipDone: boolean;
  /** The commit an Undo took off the live site: Ship it stays locked while `main` is still on it. */
  undoneSha: string | null;
  log: ShipLogEntry[];
}

export const DEFAULT_SHIP: ShipConfig = { method: 'none', project: null, firstShipDone: false, undoneSha: null, log: [] };
export const SHIP_LOG_MAX = 50;
export const LAUNCH_PARENT = 'brainit.site';

export interface Deployment {
  id: string;
  /** Host name, without https:// */
  url: string;
  sha: string | null;
  state: 'QUEUED' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED';
  createdAt: number;
}

/** What the panel and the sign show for a chamber. */
export interface ShipView {
  method: ShipMethod;
  project: VercelProjectRef | null;
  /** Who the Vercel CLI is logged in as; null when it isn't (or isn't installed): see `error`. */
  loggedInAs: string | null;
  firstShipDone: boolean;
  live: Deployment | null;
  /** The newest production build, whatever its state. */
  latest: Deployment | null;
  /** The project's addresses, custom ones first. */
  domains: string[];
  /** Vercel's "go live automatically" for production builds; null until known. */
  autoAssign: boolean | null;
  mainSha: string | null;
  mainChecks: Checks;
  waiting: { number: number; title: string }[];
  undoneSha: string | null;
  /** Earlier live-able builds, newest first, for "Go back to…". */
  earlier: Deployment[];
  previewUrl: string | null;
  busy: ShipBusy | null;
  error: string | null;
  /** Why Ship it can't run now, or null. */
  blocked: string | null;
  log: ShipLogEntry[];
}

/** PR numbers named by commit subjects: GitHub merge commits ("Merge pull request #12 …") and squash merges ("Title (#12)"). */
export function prNumbersFromSubjects(subjects: string[]): number[] {
  const out: number[] = [];
  for (const s of subjects) {
    const m = /^Merge pull request #(\d+)\b/.exec(s) ?? /\(#(\d+)\)\s*$/.exec(s);
    const n = m ? Number(m[1]) : NaN;
    if (Number.isInteger(n) && !out.includes(n)) out.push(n);
  }
  return out;
}

/** The PRs merged since the live commit, by title where the chamber knows it. */
export function waitingPulls(subjects: string[], pulls: { number: number; title: string }[]): { number: number; title: string }[] {
  return prNumbersFromSubjects(subjects).map((n) => {
    const known = pulls.find((p) => p.number === n)?.title;
    const subject = subjects.find((s) => new RegExp(`\\(#${n}\\)\\s*$`).test(s))?.replace(/\s*\(#\d+\)\s*$/, '');
    return { number: n, title: known ?? subject ?? `#${n}` };
  });
}

/** Whether two shas name the same commit (either may be short). */
export const sameSha = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && (a.startsWith(b) || b.startsWith(a));

/** The newest production build of commit `sha`, whatever its state. */
export function buildFor(deployments: Deployment[], sha: string | null): Deployment | null {
  return deployments.filter((d) => sameSha(d.sha, sha)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
}

export interface ShipState {
  method: ShipMethod;
  hasProject: boolean;
  loggedIn: boolean;
  busy: ShipBusy | null;
  live: Deployment | null;
  mainSha: string | null;
  mainChecks: Checks;
  undoneSha: string | null;
  /** buildFor(deployments, mainSha) */
  build: Deployment | null;
}

/** Why Ship it can't run now, in words for the Overlord, or null when it can. */
export function shipBlocked(s: ShipState): string | null {
  if (s.method === 'none' || !s.hasProject) return 'Set up how this chamber ships first.';
  if (!s.loggedIn) return 'The Vercel CLI is not logged in: run `vercel login` in a terminal, then press Check.';
  if (s.busy) return 'Busy: wait for the last step to finish.';
  if (s.method === 'git-auto') return 'Every merge goes live by itself in this chamber.';
  if (!s.mainSha) return "Can't see `main` on GitHub yet.";
  if (s.mainChecks === 'failing') return "`main`'s checks are failing.";
  if (s.undoneSha && sameSha(s.undoneSha, s.mainSha)) return '`main` is still on the change you undid. Merge a fix first.';
  if (s.live && sameSha(s.live.sha, s.mainSha)) return 'Nothing waiting: the live site is already on `main`.';
  if (s.method === 'git-promote') {
    if (!s.build) return "Vercel hasn't started building `main` yet.";
    if (s.build.state === 'ERROR' || s.build.state === 'CANCELED') return "Vercel's build of `main` failed.";
    if (s.build.state !== 'READY') return 'Vercel is still building `main`.';
  }
  return null;
}

/** Earlier ready production builds the live site can go back to, newest first. */
export function earlierLive(deployments: Deployment[], live: Deployment | null): Deployment[] {
  if (!live) return [];
  return deployments.filter((d) => d.state === 'READY' && d.id !== live.id && d.createdAt < live.createdAt).sort((a, b) => b.createdAt - a.createdAt);
}

/** The second line of the SHIP IT sign. */
export function signStatus(v: { method: ShipMethod; busy: ShipBusy | null; lastFailed: boolean; autoAssign: boolean | null; live: Deployment | null; waiting: number }): string {
  if (v.method === 'none') return 'not set up yet';
  if (v.busy === 'shipping' || v.busy === 'resuming') return 'shipping…';
  if (v.busy === 'undoing') return 'going back…';
  if (v.busy) return 'setting up…';
  if (v.lastFailed) return 'ship failed';
  if (v.method === 'git-auto') return v.autoAssign === false ? 'paused after an undo' : 'goes live with every merge';
  if (!v.live) return 'not live yet';
  return v.waiting > 0 ? `live · ${v.waiting} waiting` : 'live · up to date';
}

/** `<repo name>.<parent>`, made into a valid host label. */
export function suggestDomain(fullName: string, parent: string): string {
  const name = fullName.split('/').pop() ?? '';
  const label = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 63);
  return `${label || 'app'}.${parent}`;
}

/** A host name Vercel will accept as a domain (no scheme, no path). */
export function validDomain(d: string): boolean {
  return d.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d);
}

/** A message split into plain text and `code` spans, for showing commands and branch names as code. */
export function splitTicks(message: string): { code: boolean; text: string }[] {
  return message
    .split(/(`[^`]+`)/)
    .filter((part) => part !== '')
    .map((part) => (/^`[^`]+`$/.test(part) ? { code: true, text: part.slice(1, -1) } : { code: false, text: part }));
}
