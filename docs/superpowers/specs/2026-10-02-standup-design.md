# Code Dungeon, project 1: stand-up

Date: 2026-10-02. Status: agreed in conversation, waiting for review of this written version.

## Goal

Code Dungeon runs as a **real office** (real GitHub issues, real agents) from `H:\codedungeon`, started with
`npm run dev`, with all of its own data on the H: drive. It still looks like cubefarm. The medieval rebuild is
project 2 (see the end of this file) and starts only after this runs.

Success means:

- `npm run dev` in `H:\codedungeon` starts the server on **4417** and Vite on **5417**.
- State, repo clones and agent worktrees go to `H:\codedungeon-home`.
- The live cubefarm office (`H:\cubefarm`, port 4317, `C:\Users\snake\.cubefarm`) is never touched and can run at
  the same time.
- It cannot fall back to 4317, 5317 or `~/.cubefarm` by accident, whatever the environment says.

## Source

`H:\cubefarm`, branch `local/all-fixes` (cubefarm 0.3.2 plus our three fixes), head `9be1580`. `H:\cubefarm` itself
is read from but never changed.

## Steps

1. **Bring the history in without disturbing the existing files.** `H:\codedungeon` already holds
   `PLANNING-START.md` and this spec, so a plain `git clone` into it would fail. Instead: `git init` in place,
   fetch `local/all-fixes` from `H:\cubefarm`, and check it out as `main`. The two existing files don't clash with
   anything in cubefarm. Remotes: `upstream` = `https://github.com/leonvanzyl/cubefarm.git`, and `origin` = a new
   **private** GitHub repo, `brainit-consulting/codedungeon`, that `main` is pushed to.
2. **Defaults that can't point at the live office**, set in code:
   - `server/config.ts`: `PORT` defaults to 4417, `HOME_DIR` defaults to `<repo>/../codedungeon-home`, resolved from
     the repo's own location (so `H:\codedungeon-home`), not from the user's home folder.
   - `scripts/officeSteps.mjs` (`swarmHome`, `clientPort`), `vite.config.ts` and `bin/cubefarm.js`: the same
     defaults (4417, 5417 and the same home folder).
   - **Guard:** at startup the server refuses to run if its port is 4317 or 5317, or if its home folder is
     `~/.cubefarm`. It exits with a plain message. A guard that refuses is safer than a default that has to stay
     right.
3. **`npm run dev` is the real office.** It stays `scripts/office.mjs --dev`, which is already real (no `--demo`).
   The `demo` script and the demo entry in `.claude/launch.json` are removed. The server's `--demo` flag stays,
   because the automated tests use it; nobody starts it by hand.
4. **Self-update off.** The launcher's update (the `u` + Enter command and the server's `office:update` request)
   is disabled with a one-line message saying updates are manual until Code Dungeon has its own upstream.
5. **Nothing extra on C:.**
   - A project `.npmrc` sets `cache=H:\codedungeon-home\npm-cache`.
   - The Playwright e2e temp folder moves from the OS temp folder to `H:\codedungeon-home\tmp`, and the Playwright
     browsers to `H:\codedungeon-home\ms-playwright`.
   - The launcher sets `TEMP`, `TMP`, the npm cache and `PLAYWRIGHT_BROWSERS_PATH` to folders under
     `H:\codedungeon-home` for itself and every agent it starts.
   - `package.json` `name` becomes `codedungeon` and is marked `"private": true`, so it can't be published to npm.
6. **`npm install`** in `H:\codedungeon` (a fresh install, not a copy of cubefarm's `node_modules`).
7. **Docs that agents read.** In `CLAUDE.md`, the "live office" safety section is rewritten for Code Dungeon: its
   ports, its home folder, and the rule that `H:\cubefarm`, 4317, 5317 and `~/.cubefarm` are never touched.
   The rest of `CLAUDE.md` stays as it is until project 2 changes the code it describes.
8. **Commit** the result on `main`, this spec included.

## Known C: drive use that this project does not move

- **Claude Code's own folder** (`C:\Users\snake\.claude`): login, settings and session logs of every Claude agent.
  Moving it means giving the agents a separate config folder on H: and logging in again, which changes how they
  authenticate. Left as it is unless you ask.
- **Codex and OpenCode** keep their own config in the user folder in the same way.
- **Windows temp files** from anything started outside the launcher.

## Verification (each item observed, not assumed)

- `npm run typecheck` and `npm test` pass.
- `npm run dev`: the server answers on 4417, Vite on 5417, and `H:\codedungeon-home\state.json` is created.
- The live office still answers on 4317, and `C:\Users\snake\.cubefarm` was not modified (its newest modified
  time is checked before and after).
- Setting `SWARM_PORT=4317` makes Code Dungeon refuse to start.
- What needs you: adding a first real project and watching an agent pick up an issue. I'll ask you to do that rather
  than claim it works.

## Out of scope

Anything visual, any renaming in the UI, npm publishing.

---

## Decisions already made for project 2 (the dungeon), recorded so they aren't lost

- **A real software factory**, not a demo or a joke. The theme dresses real work; it never gets in its way.
- **Layout:** one dungeon on a single level, with no floors and no elevator. A great hall holds the bar, the
  DungeonMaster's seat and the dart board. Each project gets its own vaulted chamber off the hall, behind a door you
  walk through. Only nearby chambers are drawn. Adding a project adds a chamber.
- **Roles:** CEO → **DungeonMaster**. Manager (you) → **Overlord**. Agents get medieval names.
- **World:** crude medieval props, tables and building. All light comes from candles, torches and fire. Nothing
  modern. A bar scene with a barman, kegs, bottles and beer.
- **Toys:** the balls, roomba, hoop, blasters and the rest go. **The only game is darts:** you throw darts at a
  dart board, in place of the blaster. The phone games (snake, tetris, pet, paint) go too.
- **There must be a black cat.**
- **UI:** the phone, consoles and terminal become medieval objects (a scroll, a ledger, a scrying glass). The agents'
  terminal output stays fully readable.
- **Models (decided 2026-10-02):** real 3D models (glTF), not code-built boxes. Filler props come from free-licence
  medieval packs (Kenney, Quaternius), restyled to match. Signature pieces (bar, kegs, the DungeonMaster's seat, the
  cat, the dart board) are made in Blender through the Blender MCP as needed. Each piece is one merged mesh.
- Open for project 2: the agents' name list, the full props list, the cat's behaviour.
