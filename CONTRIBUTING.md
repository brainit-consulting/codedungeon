# Contributing

How to run Code Dungeon from source and test it. Agent sessions working on this repo also follow
[CLAUDE.md](CLAUDE.md).

## Run it from source

```bash
git clone https://github.com/brainit-consulting/codedungeon.git
cd codedungeon
npm install
npm run dev
```

Open http://localhost:5417. `SWARM_CLIENT_PORT` moves the page, `SWARM_PORT` the server (4417). The server restarts
when code in `server/` or `shared/` changes, and the page reloads itself.

To work without touching GitHub or spending any usage, run the demo: fake repos and fake coders, with its own data
folder and ports so it never mixes with a real dungeon. In PowerShell:

```powershell
$env:SWARM_HOME = "$PWD\..\codedungeon-home\demo"; $env:SWARM_PORT = "4460"; $env:SWARM_CLIENT_PORT = "5460"
npm run dev -- --demo
```

`npm run build` then `npm start` runs the built dungeon on http://localhost:4417.

Both `npm run dev` and `npm start` go through `scripts/office.mjs`, the launcher: `--dev` runs the server from source
plus Vite, and without it the launcher runs `bin/codedungeon.js` on the build. It restarts the dungeon when its own
code changes. Updating is by hand for now (`git pull`, `npm install`, start it again); the self-update code is there
but switched off. See [Updating the dungeon](docs/how-it-works.md#updating-the-dungeon).

## Testing

```bash
npm test             # run every test once (Vitest)
npm run test:watch   # re-run tests as you edit
npm run typecheck
npm run build
npm run test:e2e     # browser smoke tests (Playwright): builds, boots a demo dungeon and drives it
```

- Tests sit next to the code they cover as `*.test.ts`, anywhere under `client/`, `server/`, `shared/` or
  `scripts/` (e.g. `shared/issues.test.ts`). Vitest finds them through `vitest.config.ts`; `tsc` type-checks them and
  the Vite build leaves them out, since nothing in the app imports them.
- Keep them fast and offline: no network, no GitHub (`gh`), no Claude sessions and no real data folder. Test pure
  logic directly, fake anything that would spend usage, and use a temp `SWARM_HOME` and free ports for anything that
  needs a server. `npm test` already points `SWARM_HOME` at a temp folder.
- `npm run test:e2e` runs `e2e/*.spec.ts` in headless Chromium with software WebGL against a demo dungeon on port 4399
  (`E2E_PORT` changes it) with a temp `SWARM_HOME`. The first time, get the browser with
  `npx playwright install chromium`. Wait on what the page shows rather than sleeping, and don't rely on pointer
  lock, which a headless browser may not grant.
- GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm run typecheck`, `npm test` and `npm run build` on
  Ubuntu and Windows for every pull request and every push to `main`, then packs the package, installs it into an
  empty folder and boots it in demo mode (`scripts/smoke-package.mjs`). A separate `e2e` job on Ubuntu runs
  `npm run test:e2e` and uploads the Playwright report when it fails. It needs no secrets.
- Anything a person can see or hear in the dungeon belongs in its medieval world: woodcut icons, period words and
  colours. When you change it, update the User Guide too (`client/src/ui/userGuideChapters.ts`); the public site is
  built from the same chapters (`npm run guide:site -- <folder>`).

## Architecture

```
client/  Vite + React + react-three-fiber
  src/world/   the 3D dungeon: the great hall, the gallery, chambers, benches, characters, the notice board, the cat
               and the wolf
  src/ui/      the HUD and panels: terminal, notice board, the Roll of Chambers, the Overlord's ledger, the scroll,
               the User Guide
bin/codedungeon.js  the command: checks the machine (npm run doctor), signs Claude in (npm run login), starts the
                    built server and opens the browser
scripts/office.mjs  the launcher for a checkout (npm run dev / npm start): runs the dungeon and updates it
server/  Node + Express + ws
  swarm.ts        orchestrator: chambers, agents, scheduling, persistence, websocket fan-out
  agentRunner.ts  one Claude Agent SDK session per agent; turns its stream into terminal lines
  cliRunner.ts    one agent as the real CLI in a pseudo-terminal: hooks, turn endings, the DungeonMaster's tools
  ptyHost.ts      the terminal keeper: its own process holding the CLIs' terminals and hooks through restarts
  ptyClient.ts    the dungeon's side of the keeper (ptyProtocol.ts: their messages)
  clis.ts         the CLIs agents can run (Claude Code, Codex, OpenCode): finding them, their command lines
  terminal.ts     each agent's terminal: a headless xterm mirror, its viewers, keystrokes to the running CLI
  github.ts       everything GitHub, via the gh CLI
  workspace.ts    clones + per-agent git worktrees
  previews.ts     one app preview per chamber: ports, statuses, start / stop
  previewRunner.ts  checkout, install and run a chamber's app in its preview worktree
  ship.ts         SHIP IT: putting a chamber's app on Vercel
  demo.ts         fake GitHub and fake agents for --demo
shared/types.ts   the websocket / REST contract
```

Much of the code still uses the names Code Dungeon inherited from cubefarm (office, floor, CEO) for the dungeon, its
chambers and the DungeonMaster.

The server streams everything to the browser over one websocket (`/ws`); an open terminal panel has its own
(`/ws/term?agent=<id>`). Slates and the notice board are canvases drawn from that data and used as textures. They
only repaint when something changed, and less often when you're far away.

## Releases

Code Dungeon isn't published to npm: people run it from a clone of this repo, and the launcher keeps that clone up to
date from `main`. `node scripts/smoke-package.mjs` (after `npm run build`) still packs it, installs it into an empty
folder and boots it in demo mode, as CI does, to keep the built command honest.
