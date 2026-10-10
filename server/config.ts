import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SERVER_PORT, defaultHome, liveOfficeConflict, localRules } from '../shared/dungeon.mjs';

export const PORT = Number(process.env.SWARM_PORT ?? SERVER_PORT);
// package.json sits one folder up both from server/ and from the published dist-server/.
const PACKAGE_JSON = path.resolve(import.meta.dirname, '..', 'package.json');
export const VERSION: string = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).version;
/** The version as package.json says now: an update that doesn't restart the server (client-only) still shows its number. */
export function currentVersion(): string {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8')).version ?? VERSION;
  } catch {
    return VERSION;
  }
}

// Everything the swarm writes lives outside this project so that agents working in
// cloned repos never pick up this project's CLAUDE.md or settings by walking up the tree.
// Code Dungeon: beside the repo (codedungeon-home), never a cubefarm office's ~/.cubefarm.
const ROOT = path.resolve(import.meta.dirname, '..');
export const HOME_DIR = process.env.SWARM_HOME ?? defaultHome(ROOT);
{
  const conflict = liveOfficeConflict({ ports: [PORT], home: HOME_DIR, userHome: os.homedir(), forbidCDrive: localRules(ROOT).forbidCDrive });
  if (conflict) {
    console.error(`
  ${conflict}
`);
    process.exit(1);
  }
}
export const WORKSPACE_ROOT = path.join(HOME_DIR, 'workspaces');
export const DEMO = process.argv.includes('--demo') || process.env.SWARM_DEMO === '1' || process.env.SWARM_DEMO === 'true';
/**
 * In development (`npm run dev`), the live page Vite serves, named by the launcher (scripts/officeSteps.mjs
 * devPageUrl). The server's own page is then the last build, which can be days old: browsers are sent here instead.
 */
export function devPage(env: NodeJS.ProcessEnv): string | null {
  const url = env.SWARM_DEV_PAGE ?? '';
  return /^http:\/\/localhost:\d+$/.test(url) ? url : null;
}
export const DEV_PAGE = devPage(process.env);
export const STATE_FILE = path.join(HOME_DIR, DEMO ? 'demo-state.json' : 'state.json');

// How often each connected repo's issues and PRs are refreshed from GitHub.
export const SYNC_INTERVAL_MS = 45_000;
// How often idle agents on auto-assign floors look for new work.
export const SCHEDULER_INTERVAL_MS = 8_000;
// Terminal lines kept per agent.
export const LOG_BUFFER = 600;

/**
 * Where new projects go unless the manager picks another folder. Run from a checkout, that's the folder the app sits
 * in (C:\Projects\cubefarm → C:\Projects). Installed from npm the app lives in node_modules, so it's the usual
 * projects folder in your home instead.
 */
export function defaultProjectsDir(appDir: string, home = os.homedir()): string {
  if (!appDir.split(/[\\/]/).includes('node_modules')) return path.resolve(appDir, '..');
  const names = ['Projects', 'projects', 'code', 'Code', 'dev', 'Developer', 'src', 'repos', 'git', 'GitHub'];
  return names.map((n) => path.join(home, n)).find((d) => fs.existsSync(d)) ?? path.join(home, 'Projects');
}
