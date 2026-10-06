// Checks the npm package the way a user gets it: packs it, installs it into an empty folder, runs the command
// and boots the office in demo mode (no GitHub, no Claude). Run `npm run build` first.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { defaultHome } from '../shared/dungeon.mjs';

const root = path.resolve(import.meta.dirname, '..');
// Under codedungeon-home, not the OS temp folder: the office refuses a SWARM_HOME on C:.
fs.mkdirSync(path.join(defaultHome(root), 'tmp'), { recursive: true });
const tmp = fs.mkdtempSync(path.join(defaultHome(root), 'tmp', 'package-'));
// An agent's reserved port when it has one (CI sets SWARM_PORT=0).
const PORT = Number(process.env.SWARM_PORT) || 4456;
const sh = (cmd, cwd) => {
  const res = spawnSync(cmd, { cwd, shell: true, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`${cmd} failed:\n${res.stdout}\n${res.stderr}`);
  return res.stdout.trim();
};

let server;
try {
  const tarball = path.join(root, sh('npm pack --silent', root).split(/\r?\n/).pop());
  sh('npm init -y', tmp);
  sh(`npm install --no-audit --no-fund "${tarball}"`, tmp);
  fs.rmSync(tarball);
  const version = sh('npx --no-install codedungeon --version', tmp);
  console.log(`codedungeon --version: ${version}`);
  // installed as a package, it gives its hints the npx way
  const wrong = spawnSync('npx --no-install codedungeon frobnicate', { cwd: tmp, shell: true, encoding: 'utf8' });
  if (!`${wrong.stdout}${wrong.stderr}`.includes('npx codedungeon@latest --help')) throw new Error(`no npx hint for a wrong command:\n${wrong.stderr}`);

  // with no SWARM_HOME, its data goes in codedungeon-home in your home folder (here a stand-in home in the temp folder)
  const user = path.join(tmp, 'user');
  fs.mkdirSync(user);
  const env = { ...process.env, USERPROFILE: user, HOME: user };
  delete env.SWARM_HOME;
  const bin = path.join(tmp, 'node_modules', 'codedungeon', 'bin', 'codedungeon.js');
  server = spawn(process.execPath, [bin, '--demo', '--no-open', '--port', String(PORT)], {
    env,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  // its banner says where its state lives ("state: <file>"); passed on as it comes
  let banner = '';
  server.stdout.on('data', (b) => {
    banner += b;
    process.stdout.write(b);
  });
  let state = null;
  for (let i = 0; i < 120 && !state; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (server.exitCode !== null) throw new Error(`the office exited with code ${server.exitCode}`);
    state = await fetch(`http://127.0.0.1:${PORT}/api/state`)
      .then((r) => r.json())
      .catch(() => null);
  }
  if (!state || !Array.isArray(state.repos)) throw new Error('the office never answered /api/state');
  const page = await fetch(`http://127.0.0.1:${PORT}/`).then((r) => r.text());
  if (!page.includes('<title>Code Dungeon</title>')) throw new Error('the dungeon does not serve the client');
  console.log(`demo office up: ${state.repos.length} floors, ${state.agents.length} agents, client served`);
  const stateAt = banner.match(/state:\s*(\S+)/)?.[1];
  if (!stateAt?.startsWith(path.join(user, 'codedungeon-home') + path.sep)) throw new Error(`the installed package keeps its state at ${stateAt}, not in codedungeon-home in the home folder`);
  console.log(`data folder: ${path.relative(tmp, path.dirname(stateAt))} (codedungeon-home in the home folder)`);
} finally {
  server?.kill();
  // Windows keeps the folder locked until the office has exited.
  await new Promise((r) => setTimeout(r, 1000));
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
}
