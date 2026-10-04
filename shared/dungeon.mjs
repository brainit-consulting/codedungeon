// Code Dungeon's own ports and data folder, and the guard that keeps it off a cubefarm office on the same machine
// (ports 4317/5317, data in ~/.cubefarm). A machine can add its own rules in dungeon.local.json beside the repo
// (not in git): `forbidCDrive` keeps the data folder off the C: drive. Plain JavaScript so the launcher runs it
// without tsx; types are in dungeon.d.mts.
import fs from 'node:fs';
import path from 'node:path';

export const SERVER_PORT = 4417;
export const CLIENT_PORT = 5417;
const LIVE_PORTS = [4317, 5317];

/** The data folder beside the repo: …/codedungeon → …/codedungeon-home. */
export function defaultHome(repoRoot) {
  return path.resolve(repoRoot, '..', 'codedungeon-home');
}

/** This machine's own rules, from the text of dungeon.local.json; missing, unreadable or odd means none. */
export function parseLocalRules(text) {
  try {
    const rules = text ? JSON.parse(text) : {};
    return { forbidCDrive: rules?.forbidCDrive === true };
  } catch {
    return { forbidCDrive: false };
  }
}

/** This machine's own rules, read from dungeon.local.json in the repo's folder. */
export function localRules(repoRoot) {
  try {
    return parseLocalRules(fs.readFileSync(path.join(repoRoot, 'dungeon.local.json'), 'utf8'));
  } catch {
    return parseLocalRules(null);
  }
}

/** Why the office must not start with these ports and data folder, or null when it may. */
export function liveOfficeConflict({ ports, home, userHome, platform = process.platform, forbidCDrive = false }) {
  const port = ports.find((p) => LIVE_PORTS.includes(p));
  if (port) return `Port ${port} belongs to the live cubefarm office. Code Dungeon uses ${SERVER_PORT} and ${CLIENT_PORT}.`;
  const p = platform === 'win32' ? path.win32 : path.posix;
  const fold = (s) => (platform === 'win32' ? s.toLowerCase() : s);
  const resolved = p.resolve(home);
  if (fold(resolved) === fold(p.resolve(userHome, '.cubefarm'))) return `${resolved} is the live cubefarm office's data. Code Dungeon keeps its own in codedungeon-home.`;
  if (forbidCDrive && platform === 'win32' && /^c:/i.test(resolved))
    return `${resolved} is on the C: drive, which this machine's dungeon.local.json forbids. Set SWARM_HOME to a folder on another drive.`;
  return null;
}
