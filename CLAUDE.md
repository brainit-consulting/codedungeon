# Code Dungeon

A medieval first-person 3D dungeon (React Three Fiber) over a Node orchestrator that runs coding-agent CLI sessions
for developers, QA testers and the DungeonMaster, each in its own git worktree, working through GitHub issues. It is
a real software factory. It started as a fork of cubefarm (github.com/leonvanzyl/cubefarm, remote `upstream`); its
own repo is github.com/brainit-consulting/codedungeon (`origin`). Much of the code still uses cubefarm's names
(office, floor, CEO) for things the dungeon calls the dungeon, chambers and the DungeonMaster.

If a `CLAUDE.local.md` sits next to this file (it's git-ignored), read it too: it holds the rules for the machine
you're on, and where it's stricter, it wins.

## SAFETY (read first)

- **Never touch a live dungeon.** Someone's real dungeon may be running from this folder with `npm run dev`: server
  on 4417, page on 5417, data in `codedungeon-home` next to the repo. Agents working on this repo don't start, stop
  or use it. If cubefarm also runs on the machine (ports 4317/5317, data in `~/.cubefarm`), never touch that either;
  the code refuses those ports and that folder (`shared/dungeon.mjs`).
- Test only in demo mode (fake GitHub, fake agents, no Claude usage), with your own `SWARM_HOME` and your reserved
  `SWARM_PORT` (from your job instructions, never 4317/5317/4417/5417):

  ```powershell
  npm install; npm run build
  $env:SWARM_HOME="$PWD\.swarm-home"; $env:SWARM_PORT="<your port>"; node --import tsx server/index.ts --demo
  ```
  Then open `http://localhost:<your port>`. The startup banner must say `DEMO MODE` and print a `state:` path inside
  your `SWARM_HOME`. Stop it when done; don't commit `.swarm-home`.
- Never `npm run dev` / `npm start` / `node bin/codedungeon.js` from a job: they start a real dungeon.
- Agents are ordinary coding-agent CLI sessions on the Overlord's own setup, unsandboxed, by the Overlord's choice. The
  dungeon's workflow rules (no pushes to the default branch, no merging, QA leaves GitHub alone) live in their prompts
  and instructions, not in enforcement: don't add hooks, permission rules or sandboxes that refuse tool calls.
  `ANTHROPIC_*` / `CLAUDE_*` are stripped from agent and preview env.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` over client, server, shared, the `.ts` in scripts and the configs |
| `npm test` | Vitest, once (`npm run test:watch` to re-run on edits) |
| `npm run build` | typecheck, `vite build` to `dist/`, then the server bundled into `dist-server/` (`scripts/build-server.mjs`) |
| `npm run test:e2e` | Playwright (`e2e/`, `playwright.config.ts`): builds, boots a demo office on `E2E_PORT` (default 4399; set it to your reserved port) with a temp `SWARM_HOME`, and smoke-tests it in headless Chromium |
| `node scripts/smoke-package.mjs` | after a build: packs the npm package, installs it into a temp folder and boots its demo |
| `node --import tsx server/index.ts --demo` | a demo office (see SAFETY for the env it needs) |

CI (`.github/workflows/ci.yml`): Node 24 on `ubuntu-latest` and `windows-latest`, `npm ci` → `typecheck` → `test` →
`build` → package smoke test, for every PR and push to `main`, with a throwaway `SWARM_HOME` and `SWARM_PORT=0`; a separate `e2e`
job on `ubuntu-latest` runs `npm run test:e2e`. All three must pass locally
before you open a PR.

## Code map

The server's and client's file-by-file maps are in `server/CLAUDE.md` and `client/CLAUDE.md`.

The `cubefarm` command (`bin/cubefarm.js`, plain JS): checks Node/git/gh/Claude login, starts `dist-server/index.js`,
opens the browser; `login` and `doctor` subcommands.

The launcher (`scripts/office.mjs`, plain JS; `npm run dev` / `start`, either with `-- --demo`): runs the server (plus Vite with
`--dev`, watching `server/` and `shared/`) with `SWARM_LAUNCHER=1` and an IPC channel. Its self-update (stop,
fast-forward, install/build, restart, roll back on failure, `<SWARM_HOME>/last-update.json`) is switched off for now
(`server/officeUpdate.ts` `selfUpdates`); updating is `git pull` + `npm install` by hand. Its pure decisions
are in `scripts/officeSteps.mjs` (tested in `officeSteps.test.ts`).

Shared (`shared/`, imported by both sides):
- `types.ts`: the REST/websocket contract (`WorldSnapshot`, `ServerEvent`, views, settings).
- `issues.ts`: issue conventions (`swarm:<specialty>` labels, `Depends on #N`, hold-up ranking).


## Conventions

- ESM TypeScript everywhere (`"type": "module"`), strict, `noUnusedLocals`/`Parameters`. The server runs through
  tsx and imports with `.ts` extensions (`import { run } from './exec.ts'`); client files import without extensions.
- Comments are sparse and say why: a short header comment per file describing its role, `/** */` on exported
  functions and interface fields when the name isn't enough, inline notes for Windows or safety reasons, and
  `// ---------- section ----------` dividers in long files. No commented-out code.
- Demo parity: every new `Backend` method, CEO tool or capability gets a fake in `server/demo.ts`, so `--demo` works
  with no GitHub, no git/npm and no Claude usage.
- UI state comes from the server: on connect the client gets a `snapshot`, then typed `ServerEvent`s (`repo`,
  `agent`, `log`, `qa`, `ceo`, `message`, `toast`, …) from `Swarm.broadcast`. Add new state to `shared/types.ts`, the
  snapshot and an event, and handle it in `store.ts`'s `apply`. REST is for commands, not for polling state.
- REST errors: throw `HttpError(4xx, message)`; the handler in `index.ts` returns `{ error }` JSON, anything else
  is a logged 500. Validate request bodies by hand at the route or in the swarm.
- CEO tools: zod input schemas, errors worded so the CEO can act on them, small outputs.
- Windows first (the office runs on Windows):
  - build paths with `path.join` / `path.resolve`; paths may contain spaces, so pass args as arrays (`execFile`),
    never string-built shell commands;
  - `fs.rm` with `maxRetries` for EBUSY/EPERM file locks; write state to a temp file and `rename`;
  - kill process trees, not just the child (`taskkill /T /F` on Windows, process groups elsewhere);
  - `windowsHide: true` on spawns; npm on Windows goes through `cmd.exe`.
- Agent prompts are paid for on every session: keep prompt text short and specific.

## Tests

- Vitest, `*.test.ts` next to the code, anywhere under `client/`, `server/`, `shared/` or `scripts/`
  (e.g. `shared/issues.test.ts`, `client/src/world/layout.test.ts`, `server/ceo.test.ts`). Config: `vitest.config.ts`.
- Test pure functions directly; extract logic into pure helpers rather than mocking. No network, no `gh`, no Claude
  sessions, no real `~/.cubefarm`: `npm test` already points `SWARM_HOME` at a temp folder and `SWARM_PORT` at 0.
- Must pass on both CI runners (ubuntu + windows): don't hardcode `/` or `\` in expected paths.

## Pull requests

- One issue per PR, `Closes #<n>` in the body. Keep the diff small and on-topic.
- Many PRs merge in parallel and auto-merge sends conflicts back: don't reformat, reorder or rename code you aren't
  changing, and don't touch unrelated files.
- Say how you verified it and list your assumptions. UI changes get screenshots from the demo office.
- Never push to `main`, never force-push, never merge your own PR.
