import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

// Test browsers a chamber's Playwright asked for that this machine doesn't have: read from Playwright's own error,
// described by a dry run of the project's own Playwright (what it would fetch, and how big), and installed with it, so
// the build always matches. Only ever into the dungeon's browser folder (PLAYWRIGHT_BROWSERS_PATH, set by the launcher),
// and only when the Overlord presses Install. Nothing is ever deleted.

export interface MissingBrowser {
  /** The build's folder name in the browser folder, e.g. webkit-2359. */
  key: string;
  /** Playwright's name for it, as in the folder (chromium_headless_shell), and its build. */
  browser: string;
  revision: string;
}

/** Every browser build named in Playwright's "Executable doesn't exist at …\<name>-<build>\…" errors, once each. */
export function missingBrowsers(text: string): MissingBrowser[] {
  const out: MissingBrowser[] = [];
  for (const m of text.matchAll(/Executable doesn't exist at .*?[\\/]([a-z][a-z_]*)-(\d+)[\\/]/g)) {
    const key = `${m[1]}-${m[2]}`;
    if (!out.some((x) => x.key === key)) out.push({ key, browser: m[1], revision: m[2] });
  }
  return out;
}

/** The name Playwright's install command takes for a browser folder's name. */
export const installName = (browser: string) => browser.replaceAll('_', '-');

export interface DryRunPart {
  /** e.g. "WebKit 26.6", without Playwright's own build note. */
  title: string;
  location: string;
  url: string;
}

/** What `install --dry-run` says it would fetch: each part, where it would go, and its first download address. */
export function parseDryRun(text: string): DryRunPart[] {
  const parts: DryRunPart[] = [];
  let title: string | null = null;
  let location: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^(\S.*?)\s+\(playwright [^)]*\)\s*$/);
    if (head) {
      title = head[1];
      location = null;
      continue;
    }
    const loc = line.match(/^\s+Install location:\s+(.+?)\s*$/);
    if (loc) location = loc[1];
    const url = line.match(/^\s+Download url:\s+(\S+)/);
    if (url && title && location) parts.push({ title, location, url: url[1] });
  }
  return parts;
}

/** Playwright's download bar ("|■■■…|  70% of 59.8 MiB") in a few words, or null for other lines. */
export function installProgress(line: string): string | null {
  const m = line.match(/\|\s*(\d+)% of ([\d.]+ \w+)\s*$/);
  return m ? `downloading ${m[1]}% of ${m[2]}` : null;
}

async function readJson(file: string): Promise<{ browsers?: { name?: string; revision?: string }[] } | null> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * The cli.js of the project's own playwright-core that wants this browser build, looking in `root` and its first-level
 * folders (a game in game2d/), in npm's layout and pnpm's. Null when there's none.
 */
export async function findPlaywright(root: string, browser: string, revision: string): Promise<string | null> {
  const subs = await fs.readdir(root, { withFileTypes: true }).catch(() => []);
  const dirs = [root, ...subs.filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules').map((d) => path.join(root, d.name))];
  const name = installName(browser);
  for (const dir of dirs) {
    const modules = path.join(dir, 'node_modules');
    const cores = [path.join(modules, 'playwright-core')];
    const pnpm = await fs.readdir(path.join(modules, '.pnpm')).catch(() => [] as string[]);
    for (const p of pnpm) if (p.startsWith('playwright-core@')) cores.push(path.join(modules, '.pnpm', p, 'node_modules', 'playwright-core'));
    for (const core of cores) {
      const list = (await readJson(path.join(core, 'browsers.json')))?.browsers ?? [];
      if (list.some((b) => b.name === name && b.revision === revision)) return path.join(core, 'cli.js');
    }
  }
  return null;
}

/** Run Playwright's cli.js; resolves with its output, a line at a time to `onLine` as it comes. */
function runCli(cli: string, args: string[], onLine: (line: string) => void = () => undefined): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: path.dirname(cli), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let partial = '';
    const take = (buf: Buffer) => {
      const text = partial + buf.toString();
      out += buf.toString();
      // the download bar redraws with \r
      const lines = text.split(/\r\n|\r|\n/);
      partial = lines.pop() ?? '';
      for (const l of lines) onLine(l);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.once('error', (err) => resolve({ code: -1, out: err.message }));
    child.once('close', (code) => resolve({ code, out }));
  });
}

const exists = (p: string) =>
  fs.access(p).then(
    () => true,
    () => false,
  );

export interface BrowserInfo {
  /** e.g. "WebKit 26.6". */
  name: string;
  /** What Install would download, in bytes (the parts not here yet), or null when the server didn't say. */
  bytes: number | null;
}

/** What installing this build would fetch, by a dry run of the project's own Playwright under `root`. */
export async function describeBrowser(root: string, browser: string, revision: string): Promise<BrowserInfo> {
  const cli = await findPlaywright(root, browser, revision);
  if (!cli) throw new Error(`no Playwright in ${root} asks for ${browser} build ${revision}`);
  const { code, out } = await runCli(cli, ['install', '--dry-run', installName(browser)]);
  const parts = parseDryRun(out);
  if (code !== 0 || !parts.length) throw new Error(`Playwright's dry run said nothing usable (code ${code})`);
  let bytes: number | null = 0;
  for (const p of parts) {
    if (await exists(p.location)) continue;
    const size = await fetch(p.url, { method: 'HEAD', signal: AbortSignal.timeout(15_000) })
      .then((r) => (r.ok ? Number(r.headers.get('content-length')) : NaN))
      .catch(() => NaN);
    bytes = Number.isFinite(size) && bytes !== null ? bytes + size : null;
  }
  return { name: parts[0].title, bytes };
}

/** Install the build with the project's own Playwright under `root` (no time limit), its download progress in a few words. */
export async function installBrowser(root: string, browser: string, revision: string, progress: (text: string) => void): Promise<void> {
  const cli = await findPlaywright(root, browser, revision);
  if (!cli) throw new Error(`Couldn't find the project's Playwright in ${root} any more. Run "npx playwright install ${installName(browser)}" in the project.`);
  let last = '';
  const { code, out } = await runCli(cli, ['install', installName(browser)], (line) => {
    const p = installProgress(line);
    if (p && p !== last) progress((last = p));
  });
  if (code !== 0) {
    const said = out.split(/\r\n|\r|\n/).filter((l) => l.trim() && !installProgress(l)).slice(-2).join(' ');
    throw new Error(`Playwright couldn't install it: ${said || `exit code ${code}`}`);
  }
}
