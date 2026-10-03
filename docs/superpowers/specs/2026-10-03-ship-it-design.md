# SHIP IT: shipping a chamber's app to Vercel

Date: 2026-10-03. Agreed with the Overlord in conversation (option A: SHIP IT is the gate between `main` and what
goes live, with every Vercel route on offer). This is the first of two pieces; the second, a quick start from the
`start-an-app` skill (brainit-consulting/skills), comes after and hands its new app to this panel.

## Goal

When a chamber's app is ready, the Overlord ships it from the dungeon: the SHIP IT sign on the chamber's north wall
shows what is live and what is waiting, and pulling it puts the waiting work live on Vercel. Each chamber chooses
how it ships, once.

## The three ways a chamber can ship

| Method | What builds | What pulling SHIP IT does | Undo |
| --- | --- | --- | --- |
| **1. GitHub builds, you promote** (default) | Vercel's GitHub integration: a preview for every pull request, and every merge to `main` built as a production deployment *held back* from the domains | `vercel promote` the newest ready build of `main`'s head | `vercel rollback` to the previous live deployment |
| **2. GitHub builds, every merge goes live** | the same, with production builds going live as they finish (the usual Vercel setup) | nothing to ship: the panel shows what's live, the last build and any failure | `vercel rollback` |
| **3. Vercel CLI from the dungeon** | nothing until asked | `vercel deploy --prod` from a clean checkout of `origin/main`; a **Preview** button runs `vercel deploy` and gives a link | `vercel rollback` |

## Two stages: building, then launched

The Overlord's habit: a new app lives on the free `*.vercel.app` address while it's being built; when it's ready it
gets a subdomain of their own, e.g. `myapp.brainit.site` (brainit.site's DNS is on Vercel, so that's free). The
panel follows that:

1. **Building.** A newly set-up chamber uses method 2 on its `*.vercel.app` address: every merge goes live there, as
   nobody depends on it yet. (Method 3 is the choice for a chamber not connected to GitHub.)
2. **Launched.** A **Launch** button: suggests `<repo>.brainit.site` (editable; the parent domain is a setting,
   default `brainit.site`), adds it to the project (`vercel domains add <name> <project>`), and switches the chamber
   to method 1, so from then on only SHIP IT puts work live. Launch always asks first: it makes a public address.

A chamber can change method later in the panel's settings; Launch is the usual way into method 1.

Why method 1 is the default once launched: agents merge to `main` all day, so a live site that follows `main` changes under the
Overlord's feet. Holding production builds back (Vercel's *auto-assign custom production domains* off) makes
SHIP IT the deliberate step while keeping the standard GitHub-to-Vercel setup, and promoting an already-built
deployment goes live in seconds.

Checked on 2026-10-03, not assumed: Vercel's public API has no setting for a project's production branch (only the
dashboard changes it), so the gate is not a `production` branch. `PATCH /v9/projects/{idOrName}` does accept
`autoAssignCustomDomains`; `vercel promote` and `vercel rollback` are documented CLI commands; `vercel api` makes
authenticated calls with the CLI's own login. Vercel CLI 60.1.3 is installed and logged in on this machine.

## What the Overlord sees

**The sign** (OfficeFloor's SHIP IT plaque) is drawn from the chamber's ship state:
- not set up: "SHIP IT · not set up"
- "Live · 3 waiting", "Live · up to date", "Building…", "Shipping…", "Ship failed", or for method 2 "Goes live with every merge".
- E on it opens the panel (new overlay kind `ship`).

**The panel**
- **Live now:** the URL (opens in a new tab), the commit and when it went live, and by which method.
- **Waiting to ship:** the pull requests merged into `main` since the live commit, by number and title. Worked out
  from git (`liveSha..origin/main` in the chamber's checkout), not from dates.
- **`main`'s checks:** passing / failing / running. SHIP IT is disabled while they fail, with the reason shown.
- **Buttons:** Ship it (methods 1 and 3), Preview (method 3), Launch (building stage), Undo last ship (any method
  with a previous live deployment). Each shows its progress and ends in a plain result line.
- **Go back to…:** any earlier live deployment from the ship log (the Overlord is on Vercel Pro, where rollback
  isn't limited to the previous deployment).
- **Ship log:** who shipped what and when, the outcome, and the Vercel link (the last 50 entries).
- **Settings:** the method, the Vercel project, and a link to the project's settings on Vercel for environment
  variables (managing those is out of scope).

**Wording** stays plain and exact: "Ship it", "Undo last ship", URLs and commit ids as they are.

## Setting a chamber up

Done from the panel, once, with the Overlord's existing Vercel login. The dungeon never logs in, never creates an
account, and never spends money.

1. `vercel whoami`. If it fails, the panel says: open a terminal, run `vercel login`, then press Check again.
2. Pick the Vercel project: an existing one from `vercel project ls`, or **Create project** (named after the repo,
   on a button the Overlord presses).
3. Link the chamber's ship checkout to it (`vercel link --yes --project <name>`).
4. Methods 1 and 2: connect the GitHub repo (`vercel git connect <repo url>`). Method 1: turn production
   auto-assignment off (`vercel api` `PATCH /v9/projects/<id>` with `autoAssignCustomDomains: false`).
5. The first ship of every chamber asks plainly, because it makes the app public: "This puts <repo> on the
   internet at <url>. Ship it?"

## Undo

Two halves: the live site, then the code.

1. **The live site goes back at once.** `vercel rollback` to the previous live deployment (or the one picked in
   "Go back to…"): seconds, no rebuild.
2. **The broken change can't go live again by accident.** `main` still has it, so after an undo:
   - the panel says so: "Back on <previous>. `main` still has the change that broke it."
   - **SHIP IT is locked** until `main` has a newer commit than the one undone (or the Overlord overrides it).
   - **Going live with merges is paused** (method 2), so nothing goes live behind the Overlord's back while
     something is broken. **Resume** turns it back on. Vercel itself turns production auto-assignment off after a
     rollback (to be confirmed below); the dungeon shows that state rather than fighting it.
   - Two follow-ups: **Revert those changes** (a pull request reverting the shipped PRs' commits, through QA like
     any other) and **Fix it forward** (an issue naming what broke and the PRs that went out, for a coder).

## Who can ship

Only the Overlord, from the panel (REST routes under `/api/repos/:id/ship/...`). The DungeonMaster gets no ship
tool. Coders' and testers' prompts gain one line: never deploy, promote or roll back; the Overlord ships. (Prompts
are the office's rules, per CLAUDE.md, not enforcement.)

## How it works

- **State** (persisted per chamber): `ship: { method: 'none' | 'git-promote' | 'git-auto' | 'cli'; project: { id,
  name, orgId } | null; firstShipDone: boolean; log: ShipLogEntry[] }`.
- **View** (on `RepoView`): the config plus `live` (deployment id, URL, sha, time), `latest` (newest production
  build of `main`: id, sha, state BUILDING / READY / ERROR, URL), `waiting` (PR numbers and titles), `busy`
  (`setting-up` | `shipping` | `previewing` | `undoing` | null) and `error`. Sent with the snapshot and as `repo`
  events, like the rest of the chamber.
- **Refreshing:** the server asks Vercel about a chamber's deployments with its other GitHub sync (about once a
  minute), every 5 seconds while something is building or a ship is under way, and never for chambers with method
  `none`.
- **The CLI:** every Vercel call goes through a new set of `Backend` methods using the `vercel` command (arguments as
  arrays; on Windows the `.cmd` shim through `cmd.exe`, as npm is). Never a pasted token. Output read as JSON where
  the command offers it.
- **Method 3's checkout:** a git worktree `<SWARM_HOME>/workspaces/<owner>__<repo>/ship`, reset to `origin/main`
  before each deploy, holding the `.vercel` link. Never the Overlord's own folder.
- **Pure decisions, unit-tested:** which PRs are waiting (from commit subjects: merge commits and squash `(#123)`);
  whether Ship it is allowed and why not; which deployment to promote (newest READY one whose sha is `main`'s head);
  what Undo goes back to; reading the CLI's JSON output (fixtures).
- **Demo mode:** a fake Vercel in `server/demo.ts`: each merge makes a production build that becomes READY after a
  few seconds; promote, deploy, preview and rollback flip the fake state, so the whole panel works with no Vercel.

## Not in this piece

- The `start-an-app` quick start (the next spec).
- Hosts other than Vercel (Netlify, Cloudflare, a GitHub release only): the method list leaves room for them.
- Environment variables, domains beyond Launch's one subdomain, and Vercel billing: the panel links to Vercel.
- Rolling releases and ship schedules.

## Checked on a real project (2026-10-03)

Measured on a Vercel Pro project in the Overlord's "Emile's projects" scope (Vercel CLI 60.1.3), connected to a
GitHub repo. That project then became the published Code Dungeon User Guide.

1. **Held back:** with `autoAssignCustomDomains` false, a production build from a push became READY while the
   project's `*.vercel.app` address kept serving the previous build. `vercel promote <url> --yes` put it live in 2 s.
   Promoting does not turn auto-assignment back on.
2. **Undo pauses going live:** after `vercel rollback`, Vercel set `autoAssignCustomDomains` to false by itself; the
   next push built but stayed held back. So for method 2, an undo leaves the chamber paused, as designed above.
3. **Pro rollback depth:** a rollback two deployments back (not just the previous one) worked, in 2 s.
4. **The CLI's login is enough:** `vercel api /v9/projects/<name> -X PATCH -F autoAssignCustomDomains=false` worked
   with no token; `vercel ls <project> --environment production --format json` lists deployments with their state
   and `meta.githubCommitSha`.

What the build must do because of what was found:
- Pass `--scope <team>` on every call: run by a program, the CLI refuses to pick a team itself. The chamber stores
  its team (the `orgId` from `.vercel/project.json` and the team slug).
- `vercel git connect --yes`, run in a checkout whose `origin` is the repo (it reads the remote; given a URL it
  stops at a yes/no prompt).
- Give every call a closed stdin, so a prompt the CLI adds in a future version fails fast instead of hanging.
