# How Code Dungeon works

The details behind the dungeon: how an issue becomes a merged pull request, who does what, and what agents are allowed to do on your machine. For getting started, see the [README](../README.md).

Code Dungeon grew out of Leon van Zyl's [cubefarm](https://github.com/leonvanzyl/cubefarm), released under the MIT license.

Much of the code still uses cubefarm's names: office for the dungeon, floor for a chamber, CEO for the DungeonMaster, manager for the Overlord. File names, routes, settings and environment variables below are written as they are in the code.

## How an issue flows through the dungeon

1. **Backlog.** An issue is assigned to a coder, either by you (the notice board, a coder's terminal or the Overlord's ledger) or automatically when **auto-assign** is on for that chamber. Auto-assign keeps every coder busy while there's work that can start:
   - An issue that says `Depends on #N` (or `Blocked by #N`) waits until #N is closed. Issues labelled `swarm:skip`, `wontfix` or `question` are left alone. Of the rest, the ones that hold up the longest chain of other issues go first, then the ones with the most issues waiting on them, then the lowest issue number.
   - A `swarm:<specialty>` label is a preference, not a lock. A free specialist gets first pick, and otherwise the issue goes to whichever free coder is least needed for their own specialty.
   - If a session fails, its issue goes back on the board for someone else, and the coder gets new work after a two-minute cooldown. An issue that fails twice waits for you to assign it by hand.
   - If Claude turns a session away because your usage limit is reached, the dungeon starts no new work until the limit resets (15 minutes when Claude doesn't say when). Sessions already running carry on.
   - Before that, when Claude warns that usage is getting high (in real terminals: when a usage window passes 90%), the dungeon paces itself until the window resets (an hour if Claude doesn't say): testing, fixes and DungeonMaster jobs start as usual, but new issues only start while fewer sessions than **Sessions while pacing** (the ledger's Settings tab, default 3) are running. Your scroll gets a message when pacing starts and when it ends.
2. **In progress.** The server fetches the repo and sets up the coder's own git worktree on the branch `swarm/issue-<n>-<coder>`, from the default branch. The worktree is reused from task to task, so `node_modules` stays warm. The coder's agent starts there with the issue text. The coder implements the change, runs the project's checks, pushes the branch and opens a PR with `gh pr create` that says `Closes #<n>`.
3. **In QA.** The PR goes to the chamber's assay room. A free tester checks out the PR head in their own worktree; when every tester is busy, a free coder who didn't write the PR covers for them, `test` and `qa` specialists first. The tester then:
   - reads the PR and the linked issue to work out the acceptance criteria
   - reviews the diff like a code reviewer: bugs, unhandled errors and edge cases, security problems, leftover debug code, missing tests
   - runs the test suite, linters, type checks and build
   - exercises the feature in a real headless browser (Playwright), including a phone size and edge cases, taking screenshots of each important state (only when browser testing is on for the chamber)
   - returns a structured report: a verdict, a summary, the checks performed, the commands run, a caption for each screenshot and, on a fail, what needs fixing
4. **Evidence on the PR.** The server uploads up to 8 screenshots to an orphan branch called `swarm-qa-evidence`, so evidence never lands in your code, and posts a comment on the PR. The comment contains the verdict, a table of checks, the commands run, and the screenshots.
5. **Fail → fix → re-test.** If QA fails, the report goes back to the coder who wrote the PR, who resumes their own session and pushes fixes to the same branch. If they're busy on something else, any free coder takes the fix instead. The PR then goes back to QA for the next round. After 3 failed rounds it's flagged **needs you**.
6. **Merge.** Once QA passes, the PR moves to **Ready to merge**. With **auto-merge** on for the chamber (the default; switch it in the ledger or on the notice board), the dungeon takes it from there:
   - It waits for GitHub's checks (Actions, Vercel and so on) and merges as soon as they're green, but only the exact commit QA signed off on. Commits pushed after the sign-off go back through QA first.
   - If checks fail, or the PR conflicts with the default branch because other work merged first, a free coder gets the failing checks or the conflict, fixes the branch, and QA re-tests it. After 3 such fixes it's flagged **needs you**.
   - It squash-merges (falling back to a merge commit, then a rebase, if the repo doesn't allow squash), deletes the remote branch, and updates the branch first if the repo only merges up-to-date branches.
   - If GitHub refuses the merge (say, branch protection wants an approving review), your scroll gets a message and the dungeon retries every 10 minutes. Checks still running after 30 minutes also get a message.
   - Only `swarm/` branches merge themselves. PRs people opened are left for you.

   With auto-merge off, review the PR on GitHub, including the QA comment, then press **Merge** (squash) on the notice board. The board asks you to confirm, and says so plainly when the PR hasn't passed QA. Either way, the coder's terminal notes the merge and they go back to the backlog.
7. **Your folder catches up.** After any merge, the chamber's folder fast-forwards to the default branch, but only when it's on that branch with no local changes. Nothing is ever stashed, reset or discarded; otherwise the ledger shows why it wasn't updated (`2 behind: local changes`, `on branch feature-x`, `diverged: local commits, and 3 commits to pull`). If `package.json` or `package-lock.json` changed, it runs `npm install`. **Sync now** in the ledger retries.

   The dungeon's own folder is the exception, when its repo is one of the chambers: pulling it would restart the dungeon mid-work, so it only shows `update ready (N commits)`. See [Updating the dungeon](#updating-the-dungeon).

PRs opened by people, not agents, show up under **In QA** as "not tested yet", with a **Send to QA** button.

You can message a coder at any time. While they're working, the message goes into their live session. After a coder finishes, the message resumes their session, e.g. "the CI failed, please fix the lint errors".

## Testers

- Every chamber always has at least one tester: one is recruited when a repo is connected, and the last one can't be let go. You can have up to 3 per chamber (the ledger's Guild tab, or press `E` at an empty testing bench in the assay room).
- Testers use the same model and effort settings as everyone else. Their instructions tell them not to change the code under test and not to commit, push, comment on, review or merge anything on GitHub: the dungeon posts their report for them.
- QA is automatic for every PR from a `swarm/` branch, whether or not auto-assign is on.

## The guild

Coders and testers get names from two pools of medieval names with a trade: coders are smiths, scribes, masons and the like (Aldric the Smith, Maud the Scribe), testers are assayers, wardens and reeves (Gerard the Assayer, Hawise the Reeve). A chamber holds up to 12 coders. Each character's look follows their first name, so Maud, Agnes and Hawise are drawn with long hair, a ponytail or a bun; the rest of the look comes from a hash of the agent's id. You can change any agent's name or look in the ledger's Guild tab.

## Models and usage

- Coders and testers default to **Claude Code with Claude Opus 5.5 (`claude-opus-5-5`) at medium effort**. In the ledger, the Settings tab sets the default coding agent, its model and the effort; the Guild tab overrides any of them per agent. The default model belongs to the default coding agent: an agent on another one uses that agent's own default unless you name a model for them. The DungeonMaster runs Claude Code, by default Opus 5.5 at `xhigh` effort, with its own model and effort on the DungeonMaster & recruits tab.
- Agents run on your Claude **subscription**: the server removes `ANTHROPIC_API_KEY` and every other inherited `ANTHROPIC_*` / `CLAUDE*` variable (except `CLAUDE_CONFIG_DIR`) before starting each agent, so Claude Code uses your login. Codex and OpenCode agents use whatever those CLIs are signed in with, and don't count toward Claude's usage pacing.
- Every agent draws on the same subscription usage limits. By default every agent with work runs at once; set a **Session limit** in the ledger's Settings tab to cap it. When a limit is hit, the agent's terminal shows it.

## Agents' terminals

By default (the ledger's Settings tab → **How coders run: Real terminals**) every agent is the actual coding CLI running in its own pseudo-terminal on your machine. Walk up to a bench to watch it live; click the terminal to type into it (while it has focus, `Esc` goes to the agent, which interrupts its turn: the dungeon then counts the agent as stopped, the way the Stop button does, and what you type next at its prompt is a follow-up). The dungeon keeps a copy of each agent's screen and scrollback, so a terminal opened late shows everything so far, and it's saved to `<SWARM_HOME>/terminals/` so it survives a restart. The message box under the terminal types into it for you, or, when the agent isn't running, resumes their session.

- **Claude Code** (the default; the dungeon runs the copy that ships with the Agent SDK, the one `npm run login` signs in) reports every step to the dungeon through HTTP hooks (`POST /api/hooks/:token`) passed with `--settings`: each tool call (the PreToolUse hook also approves it, so the CLI never stops to ask), each finished turn with its final message, failures, and, through its status line, cost and usage limits for pacing. The status line under its prompt shows who the agent is and what they're on. The DungeonMaster's tools reach its CLI over MCP (`/api/mcp/:token`).
- **Codex** and **OpenCode** (experimental) run if they're installed: pick one for everyone (Settings → *Default coding agent*) or per agent (Guild). They get the same prompt and instructions, and tell the dungeon when a turn ends (Codex's `notify` program, an OpenCode plugin). Codex also gets the dungeon's hooks (`-c hooks.*`, which only report its steps, and Esc as `Interrupt`), but Codex runs hooks only once you trust them: the first time, Codex asks to review them, the dungeon carries on without them and its log says how to trust them (type `/hooks` in a Codex agent's terminal and press `t`). That holds for every later session, since the dungeon's hook command never changes (its address travels in `CUBEFARM_HOOK_URL`). Until then, and for OpenCode, the dungeon shows their task rather than each step. Their browser screenshots still reach the dungeon: each session's Playwright server saves its snapshots and unnamed screenshots in the session's own folder (not the worktree), and the dungeon collects new images from there, so their QA reports carry screenshots too. Codex saves every session in your own Codex, where the Codex and ChatGPT apps list it with your chats, so the dungeon archives each agent's thread (`codex archive`) once its CLI closes and unarchives it before resuming it: they're in the apps' Archived list, not your recent chats. Neither runs sandboxed or stops for approvals (see the safety model). OpenCode's self-update is switched off, since several agents starting at once would each reinstall it. The DungeonMaster always runs Claude Code.
- A session is finished when the CLI's turn ends and it doesn't pick up another prompt within 3 seconds. A coder's CLI then stays at its prompt for 30 minutes: type into it and the dungeon takes it on as a follow-up, and the message box (or the dungeon itself, e.g. to fix QA findings) continues in the same CLI. Testers' and the DungeonMaster's CLIs close. After that, a follow-up resumes the session in a new CLI (only the CLI that made a session can resume it).
- The dungeon answers the folder-trust question for its own worktrees (moving to "Yes" first where the CLI selects "No"). Anything else a CLI asks before it starts (sign in, first-run screens) waits for you in its terminal, and the agent's log says so.
- **Agents keep working while the dungeon restarts** (a code change during development, a crash). The CLIs run in the dungeon's *terminal keeper* (`server/ptyHost.ts`), a small process of its own that the dungeon starts and talks to over a local socket (a named pipe on Windows, `<SWARM_HOME>/pty.sock` elsewhere, with a secret in `<SWARM_HOME>/pty.secret`). Their hooks go to the keeper too, which holds each one for up to 110 seconds while the dungeon is away, so none fails and nothing is lost. When the dungeon is back it takes each CLI into its agent's terminal again (what it printed meanwhile, then a redraw) and follows the busy ones' sessions. The DungeonMaster's session is resumed instead, since its tools live in the dungeon's own process. When the dungeon quits for good (Ctrl+C) the CLIs stop with it, and a keeper that no dungeon comes back to for 10 minutes stops them itself. If the keeper can't start, terminals run inside the dungeon and stop when it restarts.
- **Agent SDK** runs Claude Code through the SDK instead, shown as a log of its steps: cubefarm's original runtime.

## Safety model

Agents behave like the coding agents you run in your own terminal: they load your setup (user and project settings, `CLAUDE.md`, skills, plugins, MCP servers and claude.ai connectors; Codex and OpenCode their own config), and nothing runs in a sandbox. On top of that the dungeon adds its hooks, its Playwright server when a chamber tests in a browser, the DungeonMaster's tools, and its instructions.

Nobody may be watching to answer a permission question, so the dungeon approves every tool call (Claude Code through its PreToolUse hook, Codex with `--dangerously-bypass-approvals-and-sandbox`, OpenCode through its permission config). The dungeon's workflow is in each agent's instructions, not enforced: push your own branch and open a PR, never push to the default branch, force-push or merge (the dungeon merges after QA), and, for testers, leave GitHub alone because the dungeon posts their report. `AskUserQuestion` and plan mode stay off for Claude Code: agents decide and record their assumptions in the PR (you can still type into any agent's terminal). The DungeonMaster's Claude Code also has no shell (`Bash`, `PowerShell`) and no `NotebookEdit`.

Agents can do anything your own coding agent in a terminal can. Run the dungeon where you'd run those.

## Where things live

The dungeon's data folder is `SWARM_HOME`, by default `codedungeon-home` in the folder that holds your codedungeon clone. The server binds to `127.0.0.1` only.

- `<SWARM_HOME>/state.json` (`demo-state.json` in demo mode): chambers, agents, settings and each agent's last 200 log lines
- `<SWARM_HOME>/terminals/<agent id>.ansi`: each agent's terminal screen and scrollback
- `<SWARM_HOME>/sessions/<token>/`: a running CLI session's settings, MCP config and instructions (removed when it ends); `<SWARM_HOME>/bin/`: the small scripts the CLIs call back to the dungeon with
- `<SWARM_HOME>/ceo/`: the DungeonMaster's working folder and its notes (`NOTES.md`)
- `<SWARM_HOME>/screens/`: each agent's latest browser screenshot
- `<SWARM_HOME>/workspaces/<owner>__<repo>/desks/<agent>`: one worktree per agent, plus `desks/preview` for the chamber preview
- `<SWARM_HOME>/workspaces/<owner>__<repo>/ship`: the checkout SHIP IT deploys from
- `<SWARM_HOME>/tmp`, `npm-cache`, `ms-playwright`: temp files, the npm cache and Playwright's browsers, when the dungeon runs under its launcher

Each chamber's main checkout is one of your own folders: the one you picked, else the folder in your projects folder that already has the repo as `origin`, else a fresh clone into your projects folder (the ledger's Settings tab; by default the folder that holds your codedungeon clone). Chambers connected before project folders existed keep their clone at `<SWARM_HOME>/workspaces/<owner>__<repo>/main`.

Workspaces live outside this project on purpose: agents working in them never pick up this project's `CLAUDE.md`.

Disconnecting a chamber never deletes anything on GitHub, and it leaves your folder (or the clone) on disk.

## Chamber links

In the ledger, each chamber can **link** to other connected repos. Agents in that chamber get the linked repos' checkouts added to their session (for example, a frontend team that needs to read the API repo) and are told about them in their instructions, with a note not to change them.

## Chamber previews

Every chamber can run its app so you can open and use it from the dungeon. The server side:

- `POST /api/repos/:repo/preview` starts it on the default branch, or `{ "pr": 12 }` on an open pull request (and restarts it when it is already running on another ref). `DELETE /api/repos/:repo/preview` stops it. One preview per chamber.
- It runs in its own worktree, `workspaces/<owner>__<repo>/desks/preview` (branch `swarm-preview`), never in the chamber's main checkout.
- Its port is reserved for the chamber: **6300 + chamber number** (moved up by 100 if that clashes with the dungeon's own `SWARM_PORT`, cubefarm's 4317 or 5317, or another preview). It never uses the agents' 5200-5899 range. If something else already holds the port, the preview reports an error and leaves that program alone.
- Statuses: `preparing` (checkout) → `installing` (`npm ci` with a lockfile, else `npm install`; skipped when `package.json` and the lockfile haven't changed since the last install; 15 minute limit) → `starting` → `running` (once the port accepts connections; 3 minute timeout), or `error` / `stopped`. The repo's `preview` field carries the status, port, URL, ref, short commit, start time, error and the last 40 log lines, and is pushed over the websocket.
- Previews stop when their chamber is disconnected and when the server gets SIGINT/SIGTERM; anything left over from a hard kill is cleaned up at the next start, and every preview reads `stopped` after a restart.

**Configuring it** (`PATCH /api/repos/:repo` with `previewCommand` and `previewEnv`, or the DungeonMaster's `set_floor_profile` tool with `preview_command` / `preview_env`):

- `previewCommand`: a shell command run from the worktree root (`cmd.exe` on Windows). `null` or `""` means the default: `npm run dev`, else `npm run start`, else `npm run preview`. Plain `vite` scripts get `-- --port {port} --strictPort` appended, since Vite ignores `PORT`. No command and no `package.json` means `unconfigured`.
- `previewEnv`: extra environment variables (string values). `ANTHROPIC_*` / `CLAUDE*` names are refused.
- Placeholders, replaced in the command and in env values: `{port}` is the chamber's preview port; `{tmp}` is a scratch folder inside the preview worktree (`.preview-tmp`, kept out of git status).
- `PORT={port}` and `BROWSER=none` are always set. The app gets the dungeon's environment minus `ANTHROPIC_*`, `CLAUDE*` and the dungeon's own `SWARM_*` variables.

Example, this repo previewing itself (a demo dungeon on the chamber's port, with its state in the scratch folder):

```json
{ "previewCommand": "npm run build && node --import tsx server/index.ts --demo",
  "previewEnv": { "SWARM_PORT": "{port}", "SWARM_HOME": "{tmp}" } }
```

In `--demo` mode no git or npm runs: starting a preview serves a small placeholder page ("<chamber> app · <ref>", with a click counter) on the chamber's port.

## Updating the dungeon

Code Dungeon isn't published to npm: you run it from a clone of this repo, and you update that clone by hand. Stop the dungeon, run `git pull` and `npm install` in its folder (and `npm run build` if you use `npm start`), then start it again.

The dungeon runs under a parent process, the launcher `scripts/office.mjs`:

- `npm start` runs the built dungeon under it (`bin/codedungeon.js`: the usual checks, then `dist-server/` serving `dist/`, on `SWARM_PORT`, default 4417). Run `npm run build` first.
- `npm run dev` adds `--dev`: the server from source plus Vite (on `SWARM_CLIENT_PORT`, default 5417), with the server restarted when code in `server/` or `shared/` changes. A file only counts as changed when its modification time or size does, so merely reading one doesn't restart the dungeon.
- Either takes `--demo` after `--` (`npm run dev -- --demo`): fake GitHub and fake agents.
- It refuses cubefarm's ports (4317, 5317) and data folder (`~/.cubefarm`), and points temp files, the npm cache and Playwright's browsers into `SWARM_HOME`.
- It starts the server with an IPC channel and `SWARM_LAUNCHER=1`.

Ctrl+C (or SIGTERM) stops the server, then Vite, and leaves no processes behind; press it twice to quit at once. `node bin/codedungeon.js` and a bare `node --import tsx server/index.ts` run without the launcher.

The dungeon still tells you when its folder is behind. The **Dungeon** row at the top of the ledger's Chambers & repos tab shows the commit it runs and, when the dungeon's own repo is one of its chambers and GitHub has newer commits, `N updates ready` with the steps above. Its **Update now** and **Later** buttons stay disabled, **Update automatically** has no effect, and typing `u` + Enter in the launcher's terminal only logs that Code Dungeon is updated by hand.

Self-updating is switched off until Code Dungeon has an upstream to update from (`selfUpdates()` in `server/officeUpdate.ts` returns false, and the launcher's `update()` only logs). The code for it is still in place. With it on, the dungeon drains (starts no new issues, QA or DungeonMaster jobs, and lets running sessions finish, stopping any still running after 20 minutes) and sends the launcher `{ type: 'office:update', from }`. The launcher then:

1. Pauses the file watcher and stops the dungeon: it sends the server `{ type: 'office:shutdown', restart: true }` (the server stops its chamber previews and exits; agents' CLIs carry on in the terminal keeper), stops Vite, and kills whatever is still running after 20 seconds, process trees included (`taskkill /T /F` on Windows).
2. Checks the folder: only on origin's default branch, with no local changes and no local commits. Otherwise it changes nothing. Nothing is ever stashed or discarded.
3. Runs `git fetch` and `git merge --ff-only origin/<default>`.
4. Runs `npm install --no-save` if `package.json` or `package-lock.json` changed. This only happens once nothing is running, because Windows locks esbuild's and Rollup's binaries while they're in use. `--no-save` leaves the lockfile as pulled, so another npm version can't turn it into a local change that blocks the next update.
5. Under `npm start`, runs `npm run build` whenever anything changed.
6. Writes `<SWARM_HOME>/last-update.json`: `{ from, to, ok, error?, installed, built, at }`. Here `to` is the commit the dungeon runs afterwards, `installed` and `built` say whether npm install and the build ran, and `at` is a timestamp in milliseconds. Then it starts the dungeon again, and the server reports the result on your scroll.

If a step fails, the launcher goes back with `git reset --keep <from>`, which never touches local changes. It reinstalls the old dependencies if npm install ran, rebuilds if a build ran, starts the old version and writes `ok: false` with the error. A refused update (another branch, local changes) also writes `ok: false`.
