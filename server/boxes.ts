// Recruits who work in an Upstash Box: one Linux machine in the cloud per recruit, made from the dungeon's base
// snapshot, driven through the Box API (@upstash/box). Their CLIs sign in to the Overlord's own subscriptions inside
// the box (never a copied login), and the office follows them through a file of events, since a box can't reach this
// computer. Everything here talks to Upstash; boxRunner.ts runs a CLI in a box, and the swarm decides who goes where.
import { execFileSync } from 'node:child_process';
import { Box } from '@upstash/box';

/** The box's user and the dungeon's folder in it. */
export const BOX_HOME = '/home/boxuser';
export const BOX_DIR = `${BOX_HOME}/.code-dungeon`;
export const BOX_BIN = `${BOX_DIR}/bin`;
export const BOX_SESSIONS = `${BOX_DIR}/sessions`;
export const BOX_SCRATCH = `${BOX_DIR}/tmp`;
export const BOX_DESKS = `${BOX_HOME}/desks`;
/** The Playwright MCP server the base installed, and the Chromium it's pointed at (there's no Chrome for these machines). */
export const BOX_MCP = `${BOX_DIR}/pw/node_modules/@playwright/mcp/cli.js`;
export const BOX_CHROMIUM = `${BOX_DIR}/chromium`;
/** The free plan's limit; the office never runs more boxes than the Overlord allows. */
export const FREE_PLAN_BOXES = 10;
/** Labels: every box the office makes carries them, so it can tell its own boxes from others on the account. */
export const BOX_LABEL = 'code-dungeon';

/**
 * The Box API key, from UPSTASH_BOX_API_KEY. On Windows a key the Overlord saved in their user environment after the
 * office started isn't in its environment yet, so the registry is read too. Never logged or stored.
 */
export function boxApiKey(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string | null {
  if (env.UPSTASH_BOX_API_KEY) return env.UPSTASH_BOX_API_KEY;
  if (platform !== 'win32') return null;
  return readUserEnv('UPSTASH_BOX_API_KEY');
}

/**
 * The GitHub token the boxes push with (a fine-grained token for the dungeon's repos), from
 * CODEDUNGEON_BOX_GITHUB_TOKEN; never written to a box's disk (see gitEnv).
 */
export function boxGithubToken(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string | null {
  if (env.CODEDUNGEON_BOX_GITHUB_TOKEN) return env.CODEDUNGEON_BOX_GITHUB_TOKEN;
  if (platform !== 'win32') return null;
  return readUserEnv('CODEDUNGEON_BOX_GITHUB_TOKEN');
}

function readUserEnv(name: string): string | null {
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Environment', '/v', name], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    return parseRegValue(out, name);
  } catch {
    return null;
  }
}

/** The value of `name` in `reg query` output; null when it isn't there. */
export function parseRegValue(out: string, name: string): string | null {
  const m = new RegExp(`^\\s*${name}\\s+REG_\\w+\\s+(.+?)\\s*$`, 'm').exec(out);
  return m ? m[1] : null;
}

/** Quoted for bash: one argument, whatever it holds. */
export const shq = (s: string) => `'${s.replaceAll("'", `'"'"'`)}'`;

/**
 * The environment a git or gh command in a box runs with: the token only there, never on the box's disk. git asks the
 * credential helper, which reads $GH_TOKEN from that environment; gh reads it directly.
 */
export function gitEnv(token: string | null): Record<string, string> {
  return token ? { GH_TOKEN: token, GIT_TERMINAL_PROMPT: '0' } : { GIT_TERMINAL_PROMPT: '0' };
}

/** git's credential helper for github.com in a box: answers with $GH_TOKEN, stores nothing. */
export const GIT_CREDENTIAL_HELPER = '!f(){ test "$1" = get || exit 0; test -n "$GH_TOKEN" || exit 0; echo username=x-access-token; echo "password=$GH_TOKEN"; }; f';

/** A desk in a box: the repo's own clone per recruit (no worktrees: one recruit per box). */
export const boxDeskDir = (fullName: string) => `${BOX_DESKS}/${fullName.replace('/', '__')}`;

/**
 * Where a session starts. In a box it's always the box's desk, whatever the caller worked out: a resumed session once
 * got this computer's desk path, and its CLI exited 1 at the `cd` (Carry on, late messages, recovery after a restart).
 */
export const sessionCwd = (inBox: boolean, fullName: string, given: string) => (inBox ? boxDeskDir(fullName) : given);

/** The shell commands that make a box's desk ready on `branch`: cloned once, then fetched and reset like a local desk. */
export function prepareDeskScript(fullName: string, base: { defaultBranch: string; pr?: number }, branch: string): string {
  const dir = boxDeskDir(fullName);
  const url = `https://github.com/${fullName}.git`;
  return [
    'set -e',
    `git config --global credential.https://github.com.helper ${shq(GIT_CREDENTIAL_HELPER)}`,
    'git config --global --replace-all credential.helper ""', // the image's own "store" helper would write the token to disk
    `mkdir -p ${shq(BOX_DESKS)} ${shq(BOX_SCRATCH)}`,
    `if [ ! -d ${shq(dir + '/.git')} ]; then git clone --quiet ${shq(url)} ${shq(dir)}; fi`,
    `cd ${shq(dir)}`,
    `git fetch --quiet origin ${shq(base.pr ? `+refs/pull/${base.pr}/head:refs/remotes/origin/pr-${base.pr}` : `+refs/heads/${base.defaultBranch}:refs/remotes/origin/${base.defaultBranch}`)}`,
    'git reset --quiet --hard',
    'git clean -fdq -e node_modules',
    `git checkout --quiet -B ${shq(branch)} ${shq(base.pr ? `origin/pr-${base.pr}` : `origin/${base.defaultBranch}`)}`,
  ].join('\n');
}

/** Stops what a recruit left running on their port in the box (dev servers), never their CLI. */
export const releaseDeskScript = (port: number) => `lsof -ti tcp:${port} 2>/dev/null | xargs -r kill 2>/dev/null; true`;

/** Whether a box's CLI is signed in: Claude Code's `auth status --json`, or Codex's `login status` exit code. */
export const signInCheck = (cli: 'claude' | 'codex' | 'opencode') =>
  cli === 'claude' ? 'claude auth status --json 2>/dev/null' : cli === 'codex' ? 'codex login status >/dev/null 2>&1 && echo signed-in || echo signed-out' : 'echo signed-in';

/** Reads what signInCheck printed. */
export function signedIn(cli: 'claude' | 'codex' | 'opencode', out: string): boolean {
  if (cli === 'claude') {
    try {
      return JSON.parse(out.slice(out.indexOf('{'))).loggedIn === true;
    } catch {
      return false;
    }
  }
  return /signed-in/.test(out) && !/signed-out/.test(out);
}

/** The command a recruit's terminal runs to sign the box's CLI in to the Overlord's subscription (typed by them). */
export const signInCommand = (cli: 'claude' | 'codex' | 'opencode') => (cli === 'claude' ? 'claude auth login' : cli === 'codex' ? 'codex login --device-auth' : 'opencode auth login');

/**
 * The program every CLI hook, status line and notify call runs in a box. It writes one line of JSON per event to the
 * session's events file, which the office follows, and answers the CLI itself: a box can't reach the office, so its
 * answers can't wait for one. Every tool call is allowed (as the office does locally); nothing is ever sent anywhere.
 * The events file is in CD_EVENTS_FILE, which the CLI passes on to everything it runs.
 *   hook            Claude Code hook: JSON on stdin
 *   status <line>   Claude Code status line: JSON on stdin, prints <line>
 *   notify <json>   Codex's notify program (Codex adds the JSON)
 *   codex           Codex hook: JSON on stdin
 */
export const BOX_EVENT_SOURCE = String.raw`// Code Dungeon (in an Upstash Box): passes the CLI's events to the office through a file.
const fs = require('fs');
const [mode, extra] = process.argv.slice(2);
const file = process.env.CD_EVENTS_FILE;
const put = (body) => { try { fs.appendFileSync(file, JSON.stringify({ at: Date.now(), ...body }) + '\n'); } catch {} };
const ALLOW = { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'Approved by Code Dungeon' } };
if (mode === 'notify') {
  let event = {};
  try { event = JSON.parse(extra || '{}'); } catch {}
  if (event.type === 'agent-turn-complete') {
    const input = String((event['input-messages'] || [])[0] || '').slice(0, 300);
    put({ hook_event_name: 'TurnComplete', session_id: event['thread-id'] || null, last_assistant_message: event['last-assistant-message'] || '', input });
  }
} else {
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', () => {
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}
    if (mode === 'status') {
      put({ hook_event_name: 'StatusLine', session_id: body.session_id, cost: body.cost, rate_limits: body.rate_limits, context_window: body.context_window });
      process.stdout.write(String(extra || 'Code Dungeon'));
      return;
    }
    put(body);
    const event = String(body.hook_event_name || '');
    if (mode === 'hook' && event === 'PreToolUse') process.stdout.write(JSON.stringify(ALLOW));
    else if (mode === 'hook' && event === 'PermissionRequest') process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } } }));
    else process.stdout.write('{}');
  });
}
`;

/**
 * Splits text read from an events file into whole lines and what's left over (a line still being written), and
 * parses each line; a broken line is skipped.
 */
export function eventLines(buffer: string): { events: Record<string, unknown>[]; rest: string } {
  const parts = buffer.split('\n');
  const rest = parts.pop() ?? '';
  const events: Record<string, unknown>[] = [];
  for (const line of parts) {
    if (!line.trim()) continue;
    try {
      const v = JSON.parse(line);
      if (v && typeof v === 'object' && !Array.isArray(v)) events.push(v as Record<string, unknown>);
    } catch {
      // a broken line: skipped
    }
  }
  return { events, rest };
}

/**
 * The script a recruit's tmux session runs: their CLI with its environment, its exit code saved for the office.
 * Arguments are quoted one by one, so nothing in a prompt is read by the shell.
 */
export function launchScript(o: { cwd: string; file: string; args: string[]; env: Record<string, string>; exitFile: string }): string {
  return [
    '#!/bin/bash',
    ...Object.entries(o.env).map(([k, v]) => `export ${k}=${shq(v)}`),
    `cd ${shq(o.cwd)} || exit 1`,
    `${[o.file, ...o.args].map(shq).join(' ')}`,
    `echo $? > ${shq(o.exitFile)}`,
  ].join('\n');
}

// ---------- the Box API ----------

let client: { apiKey: string } | null = null;

/** The connection to the Box API; null without a key. */
export function boxConnection(): { apiKey: string } | null {
  if (client) return client;
  const apiKey = boxApiKey();
  if (!apiKey) return null;
  client = { apiKey };
  return client;
}

/** Forget the key (it was changed, or found wrong). */
export function resetBoxConnection() {
  client = null;
}

const BOX_TIMEOUT_MS = 30 * 60_000;

/** A box by id. */
export async function getBox(id: string): Promise<Box> {
  const c = boxConnection();
  if (!c) throw new Error('No Upstash Box API key (UPSTASH_BOX_API_KEY)');
  return Box.get(id, { apiKey: c.apiKey, timeout: BOX_TIMEOUT_MS } as never);
}

/** A new box for a recruit, from the dungeon's base snapshot. */
export async function createRecruitBox(snapshotId: string, name: string, labels: string[]): Promise<Box> {
  const c = boxConnection();
  if (!c) throw new Error('No Upstash Box API key (UPSTASH_BOX_API_KEY)');
  return Box.fromSnapshot(snapshotId, { apiKey: c.apiKey, name, labels: [BOX_LABEL, ...labels].slice(0, 5), timeout: BOX_TIMEOUT_MS } as never);
}

/** The office's boxes on the account, with what each has used. */
export async function listOfficeBoxes(): Promise<{ id: string; name: string; status: string; labels: string[]; cpuSeconds: number }[]> {
  const c = boxConnection();
  if (!c) return [];
  const all = await Box.list({ apiKey: c.apiKey } as never);
  return all
    .filter((b) => (b.labels ?? []).includes(BOX_LABEL))
    .map((b) => ({ id: b.id, name: b.name ?? '', status: String(b.status), labels: b.labels ?? [], cpuSeconds: Math.round((b.total_cpu_ns ?? 0) / 1e9) }));
}

/** Runs a shell command in a box and returns what it printed (stdout and stderr together) and whether it succeeded. */
export async function boxRun(box: Box, command: string, env: Record<string, string> = {}): Promise<{ ok: boolean; out: string }> {
  const prefix = Object.entries(env).map(([k, v]) => `${k}=${shq(v)}`).join(' ');
  const run = await box.exec.command(`${prefix ? `env ${prefix} ` : ''}bash -c ${shq(command)} 2>&1`);
  return { ok: run.status === 'completed', out: String(run.result ?? '') };
}

/**
 * Builds the base snapshot: a fresh box set up with BASE_SETUP, saved, then deleted (a snapshot outlives its box).
 * Returns the snapshot's id. No login is ever in it.
 */
export async function buildBaseSnapshot(): Promise<string> {
  const c = boxConnection();
  if (!c) throw new Error('No Upstash Box API key (UPSTASH_BOX_API_KEY)');
  const box = await Box.create({ apiKey: c.apiKey, name: 'code-dungeon-base', labels: [BOX_LABEL, 'base'], runtime: 'node', size: 'small', timeout: BOX_TIMEOUT_MS } as never);
  try {
    const setup = await boxRun(box, BASE_SETUP);
    if (!setup.ok) throw new Error(setup.out.trim().split('\n').slice(-3).join(' ').slice(0, 300) || 'the setup failed');
    const snap = await box.snapshot({ name: `code-dungeon-base-${new Date().toISOString().slice(0, 10)}` });
    return snap.id;
  } finally {
    await box.delete().catch(() => undefined);
  }
}

/** The base snapshot's setup: everything a recruit's box needs, no logins. Kept here so a new base can be built. */
export const BASE_SETUP = [
  'set -e',
  'sudo apt-get update -qq >/dev/null',
  'sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq tmux lsof >/dev/null',
  `mkdir -p ${BOX_DIR}/pw ${BOX_BIN} ${BOX_SESSIONS} ${BOX_SCRATCH} ${BOX_DESKS}`,
  `cd ${BOX_DIR}/pw && npm init -y >/dev/null && npm install -s --no-audit --no-fund playwright@latest @playwright/mcp@latest >/dev/null`,
  'sudo ./node_modules/.bin/playwright install-deps chromium >/dev/null',
  './node_modules/.bin/playwright install chromium >/dev/null',
  // The browser tool's own Playwright wants an exact Chromium build: it's pointed at this one instead (BOX_CHROMIUM).
  `ln -sf "$(ls -d ${BOX_HOME}/.cache/ms-playwright/chromium-*/chrome-linux*/chrome | tail -1)" ${BOX_DIR}/chromium`,
  `test -x ${BOX_DIR}/chromium`,
  // Claude Code's first-run screens answered, so a recruit's CLI starts at its prompt
  `node -e 'const f=require("os").homedir()+"/.claude.json";const fs=require("fs");const c=fs.existsSync(f)?JSON.parse(fs.readFileSync(f)):{};Object.assign(c,{hasCompletedOnboarding:true,theme:"dark"});fs.writeFileSync(f,JSON.stringify(c,null,2))'`,
  `date -u +%FT%TZ > ${BOX_DIR}/base-ready`,
].join(' && ');
