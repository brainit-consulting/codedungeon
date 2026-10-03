// Every call the dungeon makes to Vercel: through the `vercel` CLI and the Overlord's own login, never a token.
// Run by a program the CLI insists on --scope, and every call gets a closed stdin so a question the CLI asks fails
// at once instead of hanging. Measured with Vercel CLI 60.1.3 (docs/superpowers/specs/2026-10-03-ship-it-design.md).

import fs from 'node:fs';
import { resolveCommand, unwrapCmdShim } from './clis.ts';
import { run } from './exec.ts';
import type { Deployment, VercelProjectRef } from '../shared/ship.ts';

export interface VercelProjectInfo {
  autoAssign: boolean;
  /** The GitHub repo the project builds from ("owner/name", or the name alone), or null. */
  repo: string | null;
  live: Deployment | null;
  domains: string[];
}

export interface VercelBackend {
  /** Who the CLI is logged in as; throws when it isn't (or isn't installed). */
  whoami(): Promise<string>;
  teams(): Promise<{ slug: string; name: string }[]>;
  projects(scope: string): Promise<{ id: string; name: string }[]>;
  createProject(name: string, scope: string): Promise<{ id: string; name: string }>;
  /** Link a checkout to the project (writes its .vercel folder). */
  link(dir: string, p: VercelProjectRef): Promise<void>;
  /** Connect the project to the GitHub repo of the checkout's `origin`. */
  gitConnect(dir: string, p: VercelProjectRef): Promise<void>;
  project(p: VercelProjectRef): Promise<VercelProjectInfo>;
  /** Recent production deployments, newest first. */
  deployments(p: VercelProjectRef): Promise<Deployment[]>;
  setAutoAssign(p: VercelProjectRef, on: boolean): Promise<void>;
  promote(p: VercelProjectRef, d: Deployment): Promise<void>;
  rollback(p: VercelProjectRef, d: Deployment): Promise<void>;
  /** Deploy a checkout; returns the new deployment's host name. */
  deploy(dir: string, p: VercelProjectRef, prod: boolean): Promise<string>;
  addDomain(p: VercelProjectRef, domain: string): Promise<void>;
}

// ---------- reading output ----------

/** The JSON in CLI output (it may print a banner line first). */
export function jsonOf<T>(out: string): T {
  const i = out.search(/[[{]/);
  if (i < 0) throw new Error(`Vercel answered without JSON: ${out.slice(0, 200)}`);
  return JSON.parse(out.slice(i)) as T;
}

interface RawDeployment {
  uid?: string;
  id?: string;
  url: string;
  state?: string;
  readyState?: string;
  created?: number;
  createdAt?: number;
  meta?: { githubCommitSha?: string };
}

const STATES: Deployment['state'][] = ['QUEUED', 'BUILDING', 'READY', 'ERROR', 'CANCELED'];

export function toDeployment(d: RawDeployment): Deployment {
  const raw = (d.readyState ?? d.state ?? 'QUEUED').toUpperCase();
  const state = STATES.includes(raw as Deployment['state']) ? (raw as Deployment['state']) : raw === 'INITIALIZING' ? 'BUILDING' : 'QUEUED';
  return { id: d.uid ?? d.id ?? '', url: d.url, sha: d.meta?.githubCommitSha ?? null, state, createdAt: d.createdAt ?? d.created ?? 0 };
}

export function parseProject(
  raw: { autoAssignCustomDomains?: boolean; targets?: { production?: RawDeployment }; link?: { org?: string; repo?: string } },
  domains: { domains?: { name: string }[] },
): VercelProjectInfo {
  const names = (domains.domains ?? []).map((d) => d.name);
  const vercelApp = (n: string) => n.endsWith('.vercel.app');
  return {
    autoAssign: raw.autoAssignCustomDomains !== false,
    repo: raw.link?.repo ? (raw.link.org ? `${raw.link.org}/${raw.link.repo}` : raw.link.repo) : null,
    live: raw.targets?.production ? toDeployment(raw.targets.production) : null,
    domains: [...names.filter((n) => !vercelApp(n)), ...names.filter(vercelApp)],
  };
}

export function parseDeployUrl(out: string): string {
  const all = out.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi);
  if (!all) throw new Error(`Vercel didn't say where the deployment is: no address in its output (${out.slice(-200)})`);
  return all[all.length - 1].replace(/^https:\/\//, '');
}

// ---------- running the CLI ----------

const VOLTA_SHIM = /^\s*volta\s+run\s+%~n0\s+%\*\s*$/im;

/**
 * How to start the CLI without cmd.exe, which Node won't execFile a .cmd through and which would split arguments on
 * `&` and expand %VARS%. An npm launcher is unwrapped to node on its script. A Volta launcher ("volta run %~n0 %*")
 * also goes through cmd.exe inside Volta (measured: an `&` in an argument broke the call), so it's resolved to the
 * npm launcher Volta keeps behind it (`volta which vercel` + .cmd), and that is unwrapped. Null when there's no CLI,
 * or a launcher this can't read.
 */
export function commandFor(found: string | null, shimText: string | null, volta: { cmdPath: string; text: string } | null): { file: string; args: string[] } | null {
  if (!found) return null;
  if (shimText === null || !/\.(cmd|bat)$/i.test(found)) return { file: found, args: [] };
  if (VOLTA_SHIM.test(shimText)) return volta ? unwrapCmdShim(volta.cmdPath, volta.text) : null;
  return unwrapCmdShim(found, shimText);
}

let resolved: Promise<{ file: string; args: string[] } | null> | null = null;

async function vercelCommand(): Promise<{ file: string; args: string[] } | null> {
  const found = resolveCommand('vercel');
  const shim = found && /\.(cmd|bat)$/i.test(found) ? fs.readFileSync(found, 'utf8') : null;
  let volta: { cmdPath: string; text: string } | null = null;
  if (shim && VOLTA_SHIM.test(shim)) {
    const voltaExe = resolveCommand('volta');
    const target = voltaExe ? (await run(voltaExe, ['which', 'vercel'], { timeoutMs: 30_000, input: '' }).catch(() => '')).trim() : '';
    const cmdPath = target ? `${target.replace(/\.(cmd|exe)$/i, '')}.cmd` : '';
    if (cmdPath && fs.existsSync(cmdPath)) volta = { cmdPath, text: fs.readFileSync(cmdPath, 'utf8') };
  }
  return commandFor(found, shim, volta);
}

/** Run `vercel <args>`; stdin is closed so a prompt fails fast. */
export async function vercel(args: string[], opts: { cwd?: string; timeoutMs?: number } = {}): Promise<string> {
  resolved ??= vercelCommand();
  const cmd = await resolved;
  if (!cmd) {
    resolved = null; // look again next time: it may have been installed since
    throw new Error("The Vercel CLI wasn't found, or its launcher can't be read: install it (`npm i -g vercel`), then run `vercel login`.");
  }
  return run(cmd.file, [...cmd.args, ...args], { cwd: opts.cwd, timeoutMs: opts.timeoutMs ?? 120_000, input: '' });
}

const api = async <T>(path: string, scope: string | null, extra: string[] = []) =>
  jsonOf<T>(await vercel(['api', path, ...(scope ? ['--scope', scope] : []), '--raw', ...extra]));

export const realVercel: VercelBackend = {
  async whoami() {
    const out = await vercel(['whoami'], { timeoutMs: 30_000 });
    const name = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).pop();
    if (!name) throw new Error('The Vercel CLI is not logged in: run `vercel login` in a terminal.');
    return name;
  },
  async teams() {
    const out = await api<{ teams: { slug: string; name: string }[] }>('/v2/teams', null);
    return out.teams.map((t) => ({ slug: t.slug, name: t.name }));
  },
  async projects(scope) {
    const out = await api<{ projects: { id: string; name: string }[] }>('/v10/projects?limit=100', scope);
    return out.projects.map((p) => ({ id: p.id, name: p.name }));
  },
  async createProject(name, scope) {
    await vercel(['project', 'add', name, '--scope', scope]);
    const p = await api<{ id: string; name: string }>(`/v9/projects/${encodeURIComponent(name)}`, scope);
    return { id: p.id, name: p.name };
  },
  async link(dir, p) {
    await vercel(['link', '--yes', '--project', p.name, '--scope', p.scope], { cwd: dir });
  },
  async gitConnect(dir, p) {
    try {
      await vercel(['git', 'connect', '--yes', '--scope', p.scope], { cwd: dir });
    } catch (err) {
      if (!/already connected/i.test((err as Error).message)) throw err;
    }
  },
  async project(p) {
    const [raw, domains] = await Promise.all([api<Parameters<typeof parseProject>[0]>(`/v9/projects/${p.id}`, p.scope), api<{ domains: { name: string }[] }>(`/v9/projects/${p.id}/domains`, p.scope)]);
    return parseProject(raw, domains);
  },
  async deployments(p) {
    const out = await api<{ deployments: RawDeployment[] }>(`/v6/deployments?projectId=${p.id}&target=production&limit=20`, p.scope);
    return out.deployments.map(toDeployment).sort((a, b) => b.createdAt - a.createdAt);
  },
  async setAutoAssign(p, on) {
    await vercel(['api', `/v9/projects/${p.id}`, '-X', 'PATCH', '-F', `autoAssignCustomDomains=${on}`, '--scope', p.scope, '--raw']);
  },
  async promote(p, d) {
    await vercel(['promote', d.url, '--yes', '--scope', p.scope], { timeoutMs: 300_000 });
  },
  async rollback(p, d) {
    await vercel(['rollback', d.url, '--yes', '--scope', p.scope], { timeoutMs: 300_000 });
  },
  async deploy(dir, p, prod) {
    return parseDeployUrl(await vercel(['deploy', ...(prod ? ['--prod'] : []), '--yes', '--scope', p.scope], { cwd: dir, timeoutMs: 900_000 }));
  },
  async addDomain(p, domain) {
    await api(`/v10/projects/${p.id}/domains`, p.scope, ['-X', 'POST', '-f', `name=${domain}`]);
  },
};
