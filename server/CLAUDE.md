# Server code map

Loaded when working under `server/`. The rest of the rules are in the root CLAUDE.md.

Server (`server/`, Node + Express 5 + ws, run by tsx in development; esbuild bundles it into `dist-server/` for npm):
- `index.ts`: entry; picks the real or demo backend, REST routes under `/api`, the `/ws` and `/ws/term` websockets, serves `dist/`, shutdown.
- `config.ts`: `SWARM_PORT` (default 4417), `SWARM_HOME` (default `codedungeon-home` beside the repo), `--demo`, state file, intervals,
  the default projects folder.
- `swarm.ts`: the orchestrator. Floors, agents, scheduling/auto-assign, dev → QA → fix → merge loop, dev and QA
  prompts, CEO job queue, phone messages, persistence (`state.json` / `demo-state.json`), websocket fan-out.
- `agentRunner.ts`: one Agent SDK session; options, env stripping, Playwright MCP, and turning the SDK stream into
  terminal lines.
- `cliRunner.ts`: the terminal runtime (the default): one agent as the real CLI in a node-pty, same session contract
  as `agentRunner.ts`. Claude Code reports through HTTP hooks (`POST /api/hooks/:token`; PreToolUse approves every
  call); Codex reports turn endings (notify) and, once the manager trusts them, its steps (`-c hooks.*`); OpenCode
  only turn endings. Codex/OpenCode screenshots are collected from the session's Playwright output folder. Esc in a
  terminal ends the session as `interrupted`. The CEO's office tools are served over MCP (`/api/mcp/:token`).
- `ptyHost.ts`: the terminal keeper, a detached process of its own (`launch` re-spawns it outside the office's process
  tree) holding the CLIs' pseudo-terminals and relaying their hooks, so agents keep working through office restarts.
  `ptyClient.ts` is the office's side (start/connect, spawn, adopt after a restart, local fallback); `ptyProtocol.ts`
  their JSON-lines messages. The launcher's `office:shutdown` says `restart: false` when quitting: CLIs stop then.
  A developer's CLI stays at its prompt after the task (`keepAlive`): follow-ups and prompts typed there reuse it.
- `boxes.ts`, `boxRunner.ts`: coders in Upstash Boxes (`@upstash/box`). `boxes.ts` is the box layer: the API key and
  GitHub token (env or the Windows user environment), the base snapshot (`BASE_SETUP`), desk and sign-in scripts, and
  the events program every hook and status line runs in a box. `boxRunner.ts`'s `BoxPty` implements `Pty` for a CLI
  in tmux in the box: `tmux attach` over a PTY session (reconnects with backoff), events followed with `tail -F`.
  `shared/cloudBoxes.ts` holds the settings and who may move into a box. Testers stay local.
- `clis.ts`: the CLIs (Claude Code from the SDK's bundled binary, Codex, OpenCode): detection, Windows `.cmd` shim
  unwrapping, each one's command line, and the helper scripts they call back with.
- `terminal.ts`: `AgentTerminal`, a headless xterm mirror per agent (replay for late viewers, saved to disk), its
  `/ws/term` viewers, and keystrokes/resizes to the running CLI.
- `ceo.ts`: the CEO's office MCP tools (`createOfficeTools`, zod-validated), `ceoSystemPrompt`, `ceoJobPrompt`.
- `backend.ts`: the `Backend` interface (everything touching GitHub, git, disk and sessions) and `realBackend`.
- `demo.ts`: `createDemoBackend()`: fake GitHub, fake sessions (drawn into the agent's terminal in the terminal runtime), fake previews for `--demo`.
- `github.ts`: all GitHub access through the `gh` CLI.
- `workspace.ts`: floor checkouts, per-agent worktrees (`<SWARM_HOME>/workspaces/<owner>__<repo>/desks/<agent>`),
  fast-forwarding main, per-repo git lock, stopping processes an agent left running.
- `exec.ts`: `run` / `git` / `gh`: `execFile` without a shell, prompts disabled, `CommandError` with stderr.
- `previews.ts`: one preview per floor: ports (6300 + floor), statuses, config validation.
- `previewRunner.ts`: checks out, installs and runs a floor's app in its preview worktree; kills the process tree.
- `httpError.ts`: `HttpError(status, message)`.
- `officeUpdate.ts`: the office's self-update: the drain decision, the launcher contract (IPC, `last-update.json`).
- `pacing.ts`: pacing new work after Claude's usage warnings: the start/skip decision and the usage state.
