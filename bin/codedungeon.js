#!/usr/bin/env node
// The `codedungeon` command (npx codedungeon@latest, or npm start, npm run login, npm run doctor in a clone): checks
// this machine is ready, starts the dungeon and opens it in the browser.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const MIN_NODE = 22;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
// Run with npx or installed with npm install -g, rather than from a clone (shared/dungeon.mjs installedAsPackage; that
// file isn't in the package).
const packaged = path.resolve(root).split(path.sep).includes('node_modules');
/** How to run a subcommand, the way this copy was started: `login` → "npx codedungeon@latest login" or "npm run login". */
const how = (sub) =>
  packaged ? `npx codedungeon@latest${sub ? ` ${sub}` : ''}` : !sub ? 'npm start' : sub.startsWith('-') ? `node bin/codedungeon.js ${sub}` : `npm run ${sub}`;

const HELP = `
  Code Dungeon ${pkg.version}: a medieval dungeon where a guild of AI coders works through your GitHub issues.

  Usage
    npx codedungeon@latest           start the dungeon and open it in your browser
    npx codedungeon@latest login     sign in to Claude Code, the built-in coding agent
    npx codedungeon@latest doctor    check that this machine is ready
  In a clone of the repo, in its folder: npm start, npm run login, npm run doctor
  (or node bin/codedungeon.js [login | doctor] [options]).

  Options
    --port <n>   port for the dungeon (default 4417)
    --demo       fake GitHub and fake agents: look around without spending any usage
    --no-open    don't open the browser
    -v, --version
    -h, --help

  The dungeon keeps its state and workspaces in codedungeon-home: in your home folder when run with npx, or next to
  the clone's folder (set SWARM_HOME to use another folder).
`;

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (open, close) => (s) => (color ? `\x1b[${open}m${s}\x1b[${close}m` : s);
const green = paint(32, 39);
const red = paint(31, 39);
const dim = paint(2, 22);
const fail = (msg) => {
  console.error(`\n  ${red('✗')} ${msg}\n`);
  process.exit(1);
};

if (Number(process.versions.node.split('.')[0]) < MIN_NODE) fail(`Code Dungeon needs Node.js ${MIN_NODE} or newer (this is ${process.version}). Get it from https://nodejs.org`);

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      port: { type: 'string', short: 'p' },
      demo: { type: 'boolean' },
      'no-open': { type: 'boolean' },
      version: { type: 'boolean', short: 'v' },
      help: { type: 'boolean', short: 'h' },
    },
  });
} catch (err) {
  fail(`${err.message}\n    Run ${how('--help')} for the options.`);
}
const { values, positionals } = args;
const command = positionals[0] ?? 'start';

if (values.help) {
  console.log(HELP);
  process.exit(0);
}
if (values.version) {
  console.log(pkg.version);
  process.exit(0);
}

// ---------- Claude Code ----------

// The Agent SDK ships Claude Code as a per-platform package. The office runs its agents on it, so logging in with it
// is logging the agents in. Same lookup as the SDK's own.
function claudeBinary() {
  let sdk;
  try {
    sdk = createRequire(import.meta.url).resolve('@anthropic-ai/claude-agent-sdk');
  } catch {
    return null;
  }
  const { platform, arch } = process;
  const musl = platform === 'linux' && !process.report?.getReport?.()?.header?.glibcVersionRuntime;
  const targets = platform === 'linux' ? (musl ? [`linux-${arch}-musl`, `linux-${arch}`] : [`linux-${arch}`, `linux-${arch}-musl`]) : [`${platform}-${arch}`];
  const fromSdk = createRequire(sdk);
  for (const target of targets) {
    try {
      return fromSdk.resolve(`@anthropic-ai/claude-agent-sdk-${target}/claude${platform === 'win32' ? '.exe' : ''}`);
    } catch {
      // not installed for this target
    }
  }
  return null;
}

// Like the agents: no API keys or settings inherited from a Claude Code session this was started from.
function claudeEnv() {
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/^(ANTHROPIC_|CLAUDE)/i.test(k) || k === 'CLAUDE_CONFIG_DIR') env[k] = v;
  return env;
}

// ---------- checks ----------

const sh = (cmd, cmdArgs, env) => spawnSync(cmd, cmdArgs, { encoding: 'utf8', windowsHide: true, timeout: 30_000, env });

/** What the office needs: { name, ok, detail, fix, required }. */
function checks() {
  const out = [{ name: 'Node.js', ok: true, detail: process.version }];

  const git = sh('git', ['--version']);
  out.push({ name: 'git', ok: git.status === 0, detail: git.stdout?.trim().replace(/^git version /, ''), fix: 'install git: https://git-scm.com/downloads', required: true });

  if (sh('gh', ['--version']).status !== 0) {
    out.push({ name: 'GitHub CLI', ok: false, fix: 'install it from https://cli.github.com, then run: gh auth login' });
  } else {
    const ok = sh('gh', ['auth', 'status']).status === 0;
    out.push({ name: 'GitHub CLI', ok, detail: ok ? 'signed in' : 'not signed in', fix: 'run: gh auth login' });
  }

  const claude = claudeBinary();
  if (!claude) {
    out.push({ name: 'Claude Code', ok: false, fix: `run npm install again: Claude Code for ${process.platform}-${process.arch} is missing` });
  } else {
    let status = null;
    try {
      status = JSON.parse(sh(claude, ['auth', 'status', '--json'], claudeEnv()).stdout);
    } catch {
      // unreadable: treated as signed out
    }
    const ok = status?.loggedIn === true;
    out.push({ name: 'Claude', ok, detail: ok ? `signed in${status.subscriptionType ? ` (${status.subscriptionType})` : ''}` : 'not signed in', fix: `run: ${how('login')}` });
  }

  // Agents test in a browser through Playwright, which drives Google Chrome by default.
  const chrome = chromePaths().some((p) => fs.existsSync(p));
  out.push({ name: 'Chrome', ok: chrome, detail: chrome ? 'for browser testing' : 'not found', fix: 'install Google Chrome so agents can test in a browser' });
  return out;
}

function chromePaths() {
  const env = process.env;
  if (process.platform === 'win32') {
    return [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(Boolean).map((d) => path.join(d, 'Google', 'Chrome', 'Application', 'chrome.exe'));
  }
  if (process.platform === 'darwin') return ['/Applications/Google Chrome.app', path.join(os.homedir(), 'Applications', 'Google Chrome.app')];
  return ['/opt/google/chrome/chrome', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
}

const printCheck = (c) => console.log(`  ${c.ok ? green('✓') : red('✗')} ${c.name.padEnd(12)} ${c.detail ? dim(c.detail) : ''}${c.ok ? '' : `  → ${c.fix}`}`);

// ---------- helpers ----------

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.setTimeout(1000, () => done(false));
  });
}

async function isOffice(url) {
  try {
    const res = await fetch(`${url}/api/state`, { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return Array.isArray(data?.repos) && Array.isArray(data?.agents);
  } catch {
    return false;
  }
}

function openBrowser(url) {
  const [cmd, cmdArgs, opts] =
    process.platform === 'win32'
      ? ['cmd.exe', ['/d', '/s', '/c', `"start "" "${url}""`], { windowsVerbatimArguments: true }]
      : process.platform === 'darwin'
        ? ['open', [url], {}]
        : ['xdg-open', [url], {}];
  try {
    spawn(cmd, cmdArgs, { ...opts, stdio: 'ignore', detached: true, windowsHide: true })
      .on('error', () => undefined)
      .unref();
  } catch {
    // no browser to open: the URL is printed anyway
  }
}

// ---------- commands ----------

if (command === 'doctor') {
  console.log(`\n  Code Dungeon ${pkg.version}\n`);
  const results = checks();
  results.forEach(printCheck);
  const ok = results.every((c) => c.ok);
  console.log(ok ? `\n  All set. Start the dungeon with: ${packaged ? how() : 'npm start (or npm run dev)'}\n` : '');
  process.exit(ok ? 0 : 1);
}

if (command === 'login') {
  const claude = claudeBinary();
  if (!claude) fail(`Claude Code for ${process.platform}-${process.arch} is missing. Run npm install in the codedungeon folder again.`);
  console.log('\n  Signing in to Claude. Your agents use this login and your subscription.\n');
  const res = spawnSync(claude, ['auth', 'login'], { stdio: 'inherit', env: claudeEnv() });
  process.exit(res.status ?? 1);
}

if (command !== 'start') fail(`Unknown command "${command}". Run ${how('--help')} for the options.`);

const port = Number(values.port ?? process.env.SWARM_PORT ?? 4417);
if (!Number.isInteger(port) || port < 0 || port > 65535) fail(`"${values.port ?? process.env.SWARM_PORT}" isn't a port number.`);
const url = `http://localhost:${port}`;
const demo = values.demo || process.env.SWARM_DEMO === '1' || process.env.SWARM_DEMO === 'true';

// A second office on the same state would resume every agent's session a second time.
if (port !== 0 && (await portOpen(port))) {
  if (!(await isOffice(`http://127.0.0.1:${port}`))) fail(`Something else is using port ${port}. Start the dungeon on another one: ${how('--port 4400')}`);
  console.log(`\n  Code Dungeon is already running: ${url}\n`);
  if (!values['no-open']) openBrowser(url);
  process.exit(0);
}

if (!demo) {
  const problems = checks().filter((c) => !c.ok);
  if (problems.length) {
    console.log('');
    problems.forEach(printCheck);
    if (problems.some((c) => c.required)) fail('Code Dungeon can’t run without these.');
    console.log(dim(`\n  Starting anyway. Fix the above, and check again with: ${how('doctor')}`));
  }
}

const entry = path.join(root, 'dist-server', 'index.js');
if (!fs.existsSync(entry)) fail(`${path.relative(process.cwd(), entry) || entry} is missing. In a checkout of the repo, run npm run build first.`);

process.env.SWARM_PORT = String(port);
if (demo) process.env.SWARM_DEMO = '1';
process.setSourceMapsEnabled(true);
// The server loads its state, then listens.
await import(pathToFileURL(entry).href);

if (!values['no-open'] && port !== 0) {
  for (let i = 0; i < 100 && !(await portOpen(port)); i++) await new Promise((r) => setTimeout(r, 200));
  openBrowser(url);
}
