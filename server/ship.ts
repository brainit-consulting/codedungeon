// SHIP IT for each chamber: what's live on Vercel, what's waiting on `main`, and the Overlord's ship, undo, resume
// and launch. The decisions are in shared/ship.ts; this keeps each chamber's runtime state, talks to Vercel and
// GitHub through ShipDeps, and tells the swarm when a chamber's view changed (like Previews does for previews).
// Spec: docs/superpowers/specs/2026-10-03-ship-it-design.md

import {
  LAUNCH_PARENT,
  SHIP_LOG_MAX,
  buildFor,
  earlierLive,
  sameSha,
  shipBlocked,
  validDomain,
  waitingPulls,
  type Checks,
  type Deployment,
  type ShipBusy,
  type ShipConfig,
  type ShipLogEntry,
  type ShipMethod,
  type ShipView,
  type VercelProjectRef,
} from '../shared/ship.ts';
import { HttpError } from './httpError.ts';
import type { VercelBackend } from './vercel.ts';

export interface ShipRepo {
  id: string;
  fullName: string;
  defaultBranch: string;
  ship: ShipConfig;
}

export interface ShipDeps {
  vercel: VercelBackend;
  branchHead(fullName: string, branch: string): Promise<{ sha: string; checks: Checks }>;
  commitSubjects(fullName: string, base: string, head: string): Promise<string[]>;
  prepareShipCheckout(fullName: string, branch: string): Promise<string>;
}

export interface ShipHooks {
  emit(repoId: string): void;
  save(): void;
  pulls(repoId: string): { number: number; title: string }[];
  createIssue(repoId: string, title: string, body: string): Promise<number>;
}

interface Rt {
  live: Deployment | null;
  deployments: Deployment[];
  domains: string[];
  autoAssign: boolean | null;
  mainSha: string | null;
  mainChecks: Checks;
  subjects: string[];
  busy: ShipBusy | null;
  error: string | null;
  previewUrl: string | null;
  timer: NodeJS.Timeout | null;
  refreshing: Promise<void> | null;
}

/** How often to look again while a build or a step is under way. */
const FAST_MS = 5_000;
/** How long a `vercel whoami` answer is trusted (Check asks again at once). */
const WHO_MS = 5 * 60_000;

export class Shipyard {
  private rts = new Map<string, Rt>();
  private who: { name: string | null; error: string | null; at: number } = { name: null, error: null, at: 0 };

  constructor(
    private deps: ShipDeps,
    private hooks: ShipHooks,
  ) {}

  private rt(id: string): Rt {
    let rt = this.rts.get(id);
    if (!rt) {
      rt = { live: null, deployments: [], domains: [], autoAssign: null, mainSha: null, mainChecks: 'none', subjects: [], busy: null, error: null, previewUrl: null, timer: null, refreshing: null };
      this.rts.set(id, rt);
    }
    return rt;
  }

  view(r: ShipRepo): ShipView {
    const rt = this.rt(r.id);
    const build = buildFor(rt.deployments, rt.mainSha);
    const loggedIn = !!this.who.name;
    return {
      method: r.ship.method,
      project: r.ship.project,
      loggedInAs: this.who.name,
      firstShipDone: r.ship.firstShipDone,
      live: rt.live,
      latest: rt.deployments[0] ?? null,
      domains: rt.domains,
      autoAssign: rt.autoAssign,
      mainSha: rt.mainSha,
      mainChecks: rt.mainChecks,
      waiting: waitingPulls(rt.subjects, this.hooks.pulls(r.id)),
      undoneSha: r.ship.undoneSha,
      earlier: earlierLive(rt.deployments, rt.live),
      previewUrl: rt.previewUrl,
      busy: rt.busy,
      error: rt.error ?? (loggedIn || r.ship.method === 'none' ? null : this.who.error),
      blocked: shipBlocked({ method: r.ship.method, hasProject: !!r.ship.project, loggedIn, busy: rt.busy, live: rt.live, mainSha: rt.mainSha, mainChecks: rt.mainChecks, undoneSha: r.ship.undoneSha, build }),
      log: r.ship.log,
    };
  }

  private async whoami(force: boolean) {
    if (!force && this.who.at && Date.now() - this.who.at < WHO_MS) return this.who.name;
    try {
      this.who = { name: await this.deps.vercel.whoami(), error: null, at: Date.now() };
    } catch (err) {
      this.who = { name: null, error: (err as Error).message, at: Date.now() };
    }
    return this.who.name;
  }

  /** Look at Vercel and GitHub again (one look at a time per chamber), then tell the swarm. */
  refresh(r: ShipRepo): Promise<void> {
    const rt = this.rt(r.id);
    if (rt.refreshing) return rt.refreshing;
    rt.refreshing = this.look(r, rt).finally(() => {
      rt.refreshing = null;
      if (this.rts.get(r.id) !== rt) return; // forgotten while looking
      this.schedule(r, rt);
      this.hooks.emit(r.id);
    });
    return rt.refreshing;
  }

  /** Check again now, including the login. */
  async check(r: ShipRepo) {
    await this.whoami(true);
    await this.refresh(r);
    return this.view(r);
  }

  private async look(r: ShipRepo, rt: Rt) {
    const p = r.ship.project;
    if (r.ship.method === 'none' || !p) return;
    if (!(await this.whoami(false))) return; // logged out: the view says so; Check tries again
    try {
      const [info, deployments, head] = await Promise.all([this.deps.vercel.project(p), this.deps.vercel.deployments(p), this.deps.branchHead(r.fullName, r.defaultBranch)]);
      rt.live = info.live;
      rt.domains = info.domains;
      rt.autoAssign = info.autoAssign;
      rt.deployments = deployments;
      rt.mainSha = head.sha;
      rt.mainChecks = head.checks;
      rt.subjects = rt.live?.sha && !sameSha(rt.live.sha, head.sha) ? await this.deps.commitSubjects(r.fullName, rt.live.sha, head.sha) : [];
      if (r.ship.undoneSha && !sameSha(r.ship.undoneSha, head.sha) && !rt.busy) {
        r.ship.undoneSha = null; // main moved on past the undone change
        this.hooks.save();
      }
      if (!rt.busy) rt.error = null;
    } catch (err) {
      rt.error = (err as Error).message;
    }
  }

  private schedule(r: ShipRepo, rt: Rt) {
    if (rt.timer) clearTimeout(rt.timer);
    rt.timer = null;
    const building = rt.deployments.some((d) => d.state === 'BUILDING' || d.state === 'QUEUED');
    if (!rt.busy && !building) return;
    rt.timer = setTimeout(() => {
      rt.timer = null;
      if (this.rts.get(r.id) === rt) void this.refresh(r);
    }, FAST_MS);
  }

  /** Stop looking after a chamber (it was disconnected). */
  forget(id: string) {
    const rt = this.rts.get(id);
    if (rt?.timer) clearTimeout(rt.timer);
    this.rts.delete(id);
  }

  stopAll() {
    for (const id of [...this.rts.keys()]) this.forget(id);
  }

  private async step<T>(r: ShipRepo, what: ShipBusy, fn: (p: VercelProjectRef) => Promise<T>): Promise<T> {
    const rt = this.rt(r.id);
    if (rt.busy) throw new HttpError(409, `Busy (${rt.busy.replace('-', ' ')}): wait for it to finish.`);
    const p = r.ship.project;
    if (!p && what !== 'setting-up') throw new HttpError(409, 'Set up how this chamber ships first.');
    rt.busy = what;
    rt.error = null;
    this.hooks.emit(r.id);
    try {
      return await fn(p!);
    } catch (err) {
      rt.error = (err as Error).message;
      throw err;
    } finally {
      rt.busy = null;
      this.hooks.save();
      await this.refresh(r);
    }
  }

  private log(r: ShipRepo, e: Omit<ShipLogEntry, 'at'>) {
    r.ship.log = [{ at: Date.now(), ...e }, ...r.ship.log].slice(0, SHIP_LOG_MAX);
  }

  /** The Vercel teams, and the projects in one of them, for the setup form. */
  async options(scope?: string) {
    const teams = await this.deps.vercel.teams();
    const pick = scope ?? teams[0]?.slug;
    return { loggedInAs: await this.whoami(true), teams, scope: pick ?? null, projects: pick ? await this.deps.vercel.projects(pick) : [] };
  }

  async setup(r: ShipRepo, opts: { method: Exclude<ShipMethod, 'none'>; scope: string; project?: { id: string; name: string }; create?: string }) {
    return this.step(r, 'setting-up', async () => {
      if (!(await this.whoami(true))) throw new HttpError(409, this.who.error ?? 'The Vercel CLI is not logged in: run `vercel login` in a terminal.');
      const made = opts.create ? await this.deps.vercel.createProject(opts.create, opts.scope) : opts.project;
      if (!made) throw new HttpError(400, 'Pick a Vercel project, or create one.');
      const p: VercelProjectRef = { id: made.id, name: made.name, scope: opts.scope };
      const dir = await this.deps.prepareShipCheckout(r.fullName, r.defaultBranch);
      await this.deps.vercel.link(dir, p);
      if (opts.method !== 'cli') {
        await this.deps.vercel.gitConnect(dir, p);
        await this.deps.vercel.setAutoAssign(p, opts.method === 'git-auto');
      }
      r.ship.method = opts.method;
      r.ship.project = p;
    });
  }

  async ship(r: ShipRepo, confirmed: boolean) {
    if (!r.ship.firstShipDone && !confirmed) throw new HttpError(409, 'Confirm the first ship: it puts the app on the internet.');
    await this.refresh(r); // decide on what is true now, not on what the panel last showed
    const rt = this.rt(r.id);
    const blocked = this.view(r).blocked;
    if (blocked) throw new HttpError(409, blocked);
    const prs = waitingPulls(rt.subjects, []).map((w) => w.number);
    const sha = rt.mainSha;
    return this.step(r, 'shipping', async (p) => {
      try {
        let url: string;
        if (r.ship.method === 'cli') {
          url = await this.deps.vercel.deploy(await this.deps.prepareShipCheckout(r.fullName, r.defaultBranch), p, true);
        } else {
          const build = buildFor(rt.deployments, sha)!;
          await this.deps.vercel.promote(p, build);
          url = build.url;
        }
        r.ship.firstShipDone = true;
        r.ship.undoneSha = null;
        this.log(r, { action: 'ship', ok: true, deploymentId: null, url, sha, prs, note: prs.length ? `Shipped ${prs.map((n) => `#${n}`).join(', ')}` : 'Shipped' });
      } catch (err) {
        this.log(r, { action: 'ship', ok: false, deploymentId: null, url: null, sha, prs, note: (err as Error).message });
        throw err;
      }
    });
  }

  async preview(r: ShipRepo) {
    if (r.ship.method !== 'cli') throw new HttpError(409, 'Previews come from GitHub in this chamber: every pull request gets one.');
    const rt = this.rt(r.id);
    return this.step(r, 'previewing', async (p) => {
      rt.previewUrl = await this.deps.vercel.deploy(await this.deps.prepareShipCheckout(r.fullName, r.defaultBranch), p, false);
    });
  }

  async undo(r: ShipRepo, deploymentId?: string) {
    await this.refresh(r);
    const rt = this.rt(r.id);
    const earlier = earlierLive(rt.deployments, rt.live);
    const target = deploymentId ? earlier.find((d) => d.id === deploymentId) : earlier[0];
    if (!target) throw new HttpError(409, deploymentId ? 'That build is not one the live site can go back to.' : 'Nothing earlier to go back to.');
    const undone = rt.live;
    const shipped = r.ship.log.find((e) => e.action === 'ship' && e.ok && sameSha(e.sha, undone?.sha));
    return this.step(r, 'undoing', async (p) => {
      await this.deps.vercel.rollback(p, target);
      r.ship.undoneSha = undone?.sha ?? null;
      this.log(r, { action: 'undo', ok: true, deploymentId: target.id, url: target.url, sha: target.sha, prs: shipped?.prs ?? [], note: `Back on ${target.sha?.slice(0, 7) ?? target.url}` });
    });
  }

  /** Every merge goes live again (method git-auto, after an undo). */
  async resume(r: ShipRepo) {
    if (r.ship.method !== 'git-auto') throw new HttpError(409, 'Only a chamber where every merge goes live can resume that.');
    await this.refresh(r);
    const rt = this.rt(r.id);
    return this.step(r, 'resuming', async (p) => {
      await this.deps.vercel.setAutoAssign(p, true);
      const build = buildFor(rt.deployments, rt.mainSha);
      const stillBad = r.ship.undoneSha && sameSha(r.ship.undoneSha, rt.mainSha);
      if (build?.state === 'READY' && !stillBad && !sameSha(rt.live?.sha, rt.mainSha)) await this.deps.vercel.promote(p, build);
      this.log(r, { action: 'resume', ok: true, deploymentId: null, url: null, sha: rt.mainSha, prs: [], note: 'Every merge goes live again' });
    });
  }

  /** Give the app its own address and, for GitHub-built chambers, make SHIP IT the gate from now on. */
  async launch(r: ShipRepo, domain: string) {
    const d = domain.trim().toLowerCase();
    if (!validDomain(d)) throw new HttpError(400, `"${domain}" is not an address Vercel can use. Something like app.${LAUNCH_PARENT}.`);
    return this.step(r, 'launching', async (p) => {
      await this.deps.vercel.addDomain(p, d);
      if (r.ship.method === 'git-auto') {
        await this.deps.vercel.setAutoAssign(p, false);
        r.ship.method = 'git-promote';
      }
      this.log(r, { action: 'launch', ok: true, deploymentId: null, url: d, sha: null, prs: [], note: `Launched at ${d}` });
    });
  }

  /** After an undo: an issue asking a coder to revert the shipped PRs, or to fix forward. */
  async followUp(r: ShipRepo, kind: 'revert' | 'fix') {
    const undo = r.ship.log.find((e) => e.action === 'undo');
    if (!undo) throw new HttpError(409, 'There is no undo to follow up.');
    const prs = undo.prs.map((n) => `#${n}`).join(', ') || 'the last ship';
    const title = kind === 'revert' ? `Revert ${prs}: undone on the live site` : `Fix what broke the live site in ${prs}`;
    const body =
      kind === 'revert'
        ? `The Overlord undid the ship of ${prs} (the live site went back to ${undo.sha?.slice(0, 7) ?? 'the previous build'}). Revert those changes on \`main\` in one pull request, so \`main\` matches what is live.`
        : `The Overlord undid the ship of ${prs}: something in it broke the live site. Find what broke, fix it on \`main\`, and say in the pull request what it was.`;
    return this.hooks.createIssue(r.id, title, body);
  }
}
