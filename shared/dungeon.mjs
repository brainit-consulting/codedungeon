// Code Dungeon's own ports and data folder, and the guard that keeps it off the live cubefarm office
// (ports 4317/5317, data in ~/.cubefarm) and off the C: drive. Plain JavaScript so the launcher runs it
// without tsx; types are in dungeon.d.mts.
import path from 'node:path';

export const SERVER_PORT = 4417;
export const CLIENT_PORT = 5417;
const LIVE_PORTS = [4317, 5317];

/** The data folder beside the repo: H:\codedungeon → H:\codedungeon-home. */
export function defaultHome(repoRoot) {
  return path.resolve(repoRoot, '..', 'codedungeon-home');
}

/** Why the office must not start with these ports and data folder, or null when it may. */
export function liveOfficeConflict({ ports, home, userHome, platform = process.platform }) {
  const port = ports.find((p) => LIVE_PORTS.includes(p));
  if (port) return `Port ${port} belongs to the live cubefarm office. Code Dungeon uses ${SERVER_PORT} and ${CLIENT_PORT}.`;
  const p = platform === 'win32' ? path.win32 : path.posix;
  const fold = (s) => (platform === 'win32' ? s.toLowerCase() : s);
  const resolved = p.resolve(home);
  if (fold(resolved) === fold(p.resolve(userHome, '.cubefarm'))) return `${resolved} is the live cubefarm office's data. Code Dungeon keeps its own in codedungeon-home.`;
  if (platform === 'win32' && /^c:/i.test(resolved)) return `${resolved} is on the C: drive. Code Dungeon keeps its data on H:.`;
  return null;
}
