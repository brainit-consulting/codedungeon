# Code Dungeon

A medieval dungeon you walk through in first person, where every coder is a real AI coding agent working through
your GitHub issues. Each of your projects gets its own chamber. You watch the coders write the code, the testers
check every pull request, and the work get merged. When an app is ready, you ship it to Vercel from the same place.

You are the Overlord. The DungeonMaster plans the work, the guild does it, and nothing happens out of sight: the
slate on every workbench is that coder's live terminal.

**The User Guide** (also in the dungeon: press `B`): https://codedungeon-guide.vercel.app

## What you need

- **Windows 10 or 11.** It is built and run on Windows. The tests also pass on Linux; macOS is untested.
- **Node.js 22 or newer** ([nodejs.org](https://nodejs.org)).
- **git.**
- **The GitHub CLI, signed in**: install it from [cli.github.com](https://cli.github.com), then run `gh auth login`.
  Every project must be on GitHub, because issues and pull requests are how the guild works.
- **A Claude subscription** for Claude Code, the coders' default agent. You don't install Claude Code yourself: it
  comes with the dungeon, and you sign it in once (see below). Coders can also run Codex or OpenCode if you have
  them installed and signed in.
- **Google Chrome**, for testers who check apps in a real browser.
- **Optional, for shipping:** the Vercel CLI, signed in (`npm i -g vercel`, then `vercel login`).

## Install

```bash
git clone https://github.com/brainit-consulting/codedungeon.git
cd codedungeon
npm install
node bin/cubefarm.js login
node bin/cubefarm.js doctor
```

`login` signs Claude Code in (once). `doctor` checks Node, git, the GitHub CLI and the Claude sign-in, and says
what's missing.

## Start it

There are three ways. Most of the time you want the first.

| | Command | What you get |
| --- | --- | --- |
| **Everyday** | `npm run dev` | The dungeon at **http://localhost:5417**, run from the source. It restarts its server by itself when the code changes, so it suits a dungeon that works on itself. |
| **Built** | `npm run build`, then `npm start` | The built dungeon at **http://localhost:4417**, opened in your browser. `npm start -- --no-open` skips the browser. |
| **Demo** | see below | Fake GitHub and fake coders: look around without touching your repos or spending any usage. |

Stop it with `Ctrl+C` in its terminal; that stops the coders' sessions too. When the dungeon only restarts (after a
change to its own code), their sessions carry on.

### The demo

Give the demo its own data folder and ports, so it never mixes with your real dungeon. In PowerShell:

```powershell
$env:SWARM_HOME = "$PWD\..\codedungeon-home\demo"; $env:SWARM_PORT = "4460"; $env:SWARM_CLIENT_PORT = "5460"
npm run dev -- --demo
```

Then open http://localhost:5460. The banner says `DEMO MODE` when it's right.

## Your first minutes

1. **Enter the dungeon.** A short setup asks your name and your company's, and a tour shows you round.
2. **Bring in a project.** Go to your table in your study (back left of the great hall) and press `E` for the
   Overlord's ledger. **Add a project** connects a project folder or a GitHub repo, or starts a new one. It gets a
   chamber off the gallery.
3. **Let the DungeonMaster plan.** He studies the project, writes its test checklist, turns your brief into GitHub
   issues and puts forward recruits. Press `P` for your scroll to talk to him and approve recruits.
4. **Watch the work.** Coders take issues and open pull requests. Testers check each one, in a real browser when it
   has a page to see, and post a report with screenshots. With auto-merge on, a pull request merges itself once it
   passes and GitHub's checks are green.
5. **Ship it.** Press `E` on a chamber's SHIP IT sign (or **🚢 Ship** in the ledger) to put its app on Vercel.

## Keys

| Key | Action |
| --- | --- |
| `W A S D` or arrows | walk (`Shift` to run) |
| mouse | look around (click the view first; in a browser pane that can't capture the mouse, drag) |
| `E` or click | use what the cross is on |
| `P` | your scroll |
| `B` | the User Guide |
| `H` | help |
| `C` | call the cat |
| `M` / `N` | all sound / just the music, on or off |
| `Esc` | let go of the mouse, or close a panel |

The guide's last chapter lists every key.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | run the dungeon from source (http://localhost:5417) |
| `npm run build` | check the types and build the dungeon into `dist/` and `dist-server/` |
| `npm start` | run the built dungeon (http://localhost:4417) |
| `node bin/cubefarm.js doctor` | check that this machine is ready |
| `node bin/cubefarm.js login` | sign Claude Code in |
| `npm test` | the unit tests |
| `npm run typecheck` | the type check |
| `npm run test:e2e` | build, start a demo dungeon and test it in a headless browser |
| `npm run guide:site -- <folder>` | write the public User Guide's pages into a folder |

## Where it keeps things

- **Data:** a `codedungeon-home` folder next to the repo: settings, clones of your repos, one working copy per coder,
  and logs. Set `SWARM_HOME` to use another folder.
- **Ports:** 4417 for the server, and 5417 for the page in `npm run dev`. Set `SWARM_PORT` and `SWARM_CLIENT_PORT`
  to change them.

## Good to know

- **It runs on your subscriptions.** Coders on the same agent share its usage limits. To cap how many work at once,
  set a session limit in the ledger's Settings.
- **Coders work on your machine** with your own skills, MCP servers and settings, each in its own copy of the repo.
  They don't push to your main branch and they don't merge: the dungeon merges, after the testers pass the work.

## Updating

```bash
git pull
npm install
```

Then start it again.

## License

[MIT](LICENSE).
