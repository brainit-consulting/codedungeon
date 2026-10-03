// A Vercel that lives in memory, for demo mode and the SHIP IT tests. It behaves the way the real one was measured
// to (docs/superpowers/specs/2026-10-03-ship-it-design.md): with auto-assign off, production builds wait to be
// promoted; a rollback turns auto-assign off. A project connected to a repo goes live with that repo's current
// `main` at once (the real one waits for the next push), so the demo has something live to show. It lives only in
// memory, so after the demo restarts it takes back a project it doesn't know, connected to the demo repo of that name.

import type { Deployment, VercelProjectRef } from '../shared/ship.ts';
import type { VercelBackend } from './vercel.ts';

interface FakeProject {
  id: string;
  name: string;
  scope: string;
  repo: string | null;
  autoAssign: boolean;
  live: string | null;
  deployments: Deployment[];
  domains: string[];
}

export type FakeVercel = VercelBackend & { loggedIn: boolean; merged(fullName: string, sha: string): void };

/** The ship checkout's path in demo mode: nothing on disk, just a name the fake can read the repo back from. */
export const fakeShipDir = (fullName: string) => `demo-ship/${fullName}`;
const repoOf = (dir: string) => dir.replace(/^demo-ship\//, '');

export function createFakeVercel(opts: { buildMs: number; headOf(fullName: string): string; repoFor?(projectName: string): string | null }): FakeVercel {
  const projects = new Map<string, FakeProject>();
  let n = 0;
  const get = (p: VercelProjectRef) => {
    let f = projects.get(p.id);
    const repo = f ? null : (opts.repoFor?.(p.name) ?? null);
    if (!f && repo) {
      // a project from before the demo restarted
      f = { id: p.id, name: p.name, scope: p.scope, repo, autoAssign: true, live: null, deployments: [], domains: [`${p.name}.vercel.app`] };
      projects.set(f.id, f);
      f.live = build(f, opts.headOf(repo), false).id;
    }
    if (!f) throw new Error(`No Vercel project ${p.name}`);
    return f;
  };
  const build = (f: FakeProject, sha: string, live: boolean) => {
    const d: Deployment = { id: `dpl_demo${++n}`, url: `${f.name}-${n.toString(36)}demo.vercel.app`, sha, state: opts.buildMs ? 'BUILDING' : 'READY', createdAt: Date.now() + n };
    f.deployments.unshift(d);
    const finish = () => {
      d.state = 'READY';
      if (live) f.live = d.id;
    };
    if (opts.buildMs) setTimeout(finish, opts.buildMs);
    else finish();
    return d;
  };
  const fake: FakeVercel = {
    loggedIn: true,
    async whoami() {
      if (!fake.loggedIn) throw new Error('The Vercel CLI is not logged in: run `vercel login` in a terminal.');
      return 'demo-overlord';
    },
    async teams() {
      return [{ slug: 'demo-team', name: 'Demo team' }];
    },
    async projects(scope) {
      return [...projects.values()].filter((p) => p.scope === scope).map((p) => ({ id: p.id, name: p.name }));
    },
    async createProject(name, scope) {
      const f: FakeProject = { id: `prj_demo${++n}`, name, scope, repo: null, autoAssign: true, live: null, deployments: [], domains: [`${name}.vercel.app`] };
      projects.set(f.id, f);
      return { id: f.id, name };
    },
    async link(_dir, p) {
      get(p);
    },
    async gitConnect(dir, p) {
      const f = get(p);
      f.repo = repoOf(dir);
      if (!f.deployments.length) f.live = build(f, opts.headOf(f.repo), false).id;
    },
    async project(p) {
      const f = get(p);
      const live = f.deployments.find((d) => d.id === f.live) ?? null;
      const custom = f.domains.filter((d) => !d.endsWith('.vercel.app'));
      return { autoAssign: f.autoAssign, repo: f.repo, live: live && { ...live }, domains: [...custom, ...f.domains.filter((d) => d.endsWith('.vercel.app'))] };
    },
    async deployments(p) {
      return get(p).deployments.map((d) => ({ ...d }));
    },
    async setAutoAssign(p, on) {
      get(p).autoAssign = on;
    },
    async promote(p, d) {
      get(p).live = d.id;
    },
    async rollback(p, d) {
      const f = get(p);
      f.live = d.id;
      f.autoAssign = false;
    },
    async deploy(dir, p, prod) {
      const f = get(p);
      const d = build(f, opts.headOf(repoOf(dir)), prod);
      return d.url;
    },
    async addDomain(p, domain) {
      get(p).domains.unshift(domain);
    },
    merged(fullName, sha) {
      for (const f of projects.values()) if (f.repo === fullName) build(f, sha, f.autoAssign);
    },
  };
  return fake;
}
