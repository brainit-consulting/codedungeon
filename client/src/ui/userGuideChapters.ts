// The User Guide's text (press B in the dungeon). Edit freely: each chapter is a list of blocks, and inside any
// line [[Key]] draws a key, `code` a command and **bold** bold. Start every chapter with a paragraph that begins
// with a letter: it gets the drop cap. guideBook.test.ts checks the shape.

import type { GuideBlock, GuideChapter } from './guideBook';

const p = (text: string): GuideBlock => ({ kind: 'p', text });
const h = (text: string): GuideBlock => ({ kind: 'h', text });
const list = (...items: string[]): GuideBlock => ({ kind: 'list', items });
const keys = (...rows: [string, string][]): GuideBlock => ({ kind: 'keys', rows });
const command = (text: string): GuideBlock => ({ kind: 'command', text });

export const CHAPTERS: GuideChapter[] = [
  {
    id: 'dungeon',
    title: 'The dungeon and how it is laid out',
    blocks: [
      p(
        'Code Dungeon is a real software workshop drawn as a dungeon. Every coder you see is a real coding agent working on one of your GitHub repos, and everything they do (issues, branches, pull requests, test reports) is real. The dungeon is one level: a great hall, a gallery running south from it, and a chamber for each project.',
      ),
      h('The great hall'),
      p('You start in the great hall. Its corners and walls hold everything that is about the whole dungeon rather than one project:'),
      list(
        '**Your study**, the room at the back left. Your table is there: press [[E]] at it to open the Overlord\'s ledger (chapter VI).',
        "**The DungeonMaster's quarters**, at the back right under the DUNGEONMASTER sign. Press [[E]] on his bench to see what he is working on.",
        '**The bar**, in the middle of the hall, with kegs and bottles behind it. The cat likes to sit on it.',
        '**The hearth** and two feasting tables, towards the south end.',
        '**The recruits\' chairs** along the east wall. Anyone the DungeonMaster wants to recruit waits here for your decision.',
        '**The dart board**, on the south wall at the west end (chapter VII).',
      ),
      h('The gallery and the chambers'),
      p(
        'The archway in the middle of the south wall leads into the gallery. Every connected repo has its own chamber off the gallery, alternating west and east. A chamber keeps its number for as long as its repo is connected, so removing one project never moves the others.',
      ),
      p(
        'Each chamber has a pair of oak doors. They creak open as you come up the gallery towards them and swing shut once you are well past, so from inside one chamber you see the shut doors of the chamber opposite.',
      ),
      p('The Roll of Chambers beside the archway lists every chamber: press [[E]] on it to walk straight into one instead of finding the door.'),
      h('Inside a chamber'),
      list(
        '**The notice board** on the far wall, facing you as you come in: the chamber\'s issues and pull requests (chapter IV).',
        "**The coders' workbenches**, each with a slate on an easel showing that coder's live terminal (chapter V). While they work they write in the ledger on their bench, the quill pinched between thumb and forefinger. The ink goes down as they write, laid out like code, they dip in the inkwell now and then, and turn the page when it's full.",
        '**The assay room**: the testers in aprons along the east wall, who check every pull request before it is merged.',
        '**The gauges** on the far wall, right of the SHIP IT sign: how hard this computer is working (processor, memory, disk) and how Claude usage stands. Press [[E]] on them for the full readout, refreshed every five seconds.',
        "**The framed screen** on the left wall: the project's own app. Press [[E]] on it and the app starts by itself on the default branch, and you use it right there. You can switch it to any open pull request. If you press **Stop**, it stays stopped the next time you open the screen, until you start it again.",
      ),
      p(
        'The plate at the top left of the screen always tells you where you are: the chamber number and repo name, or G and the great hall, with how many people are in the guild, how many are working, and how many pull requests are in QA or ready to merge.',
      ),
    ],
  },
  {
    id: 'moving',
    title: 'Moving about',
    blocks: [
      p(
        'Click the view once to grab the mouse. From then on the arrow is gone: the mouse turns your head, and the small cross in the middle of the screen is what you are pointing at. That first click only grabs the mouse; it never presses anything. After [[Esc]] the arrow comes back and the cross goes away until you click the view again.',
      ),
      keys(
        ['W A S D or the arrow keys', 'Walk'],
        ['Shift', 'Hold to run'],
        ['Mouse', 'Look around'],
        ['Mouse wheel', "Zoom in for a closer look, at a notice board or a coder's slate; roll back or click the middle button to zoom out"],
        ['E or left click', 'Use whatever the cross is on: a bench, the notice board, the Roll of Chambers, your table'],
        ['Esc', 'Let go of the mouse, or close the panel that is open'],
      ),
      p(
        'When the cross is on something you can use, a hint under it says what [[E]] will do, for example "Open the notice board". Opening any panel frees the mouse so you can click in it. When you close it, click the view to look around again. To have the mouse grabbed as soon as a panel closes, tick **Grab the mouse when panels close** in the help ([[H]]).',
      ),
      h('When the mouse cannot be grabbed'),
      p(
        'Some browsers and embedded browser panes refuse to capture the mouse. The dungeon notices within a moment and switches to drag to look: the arrow hides over the view, you hold the left button and drag the way you want to look (drag left to turn left, up to look up), and a click without a drag uses whatever the cross is on. Everything else works the same.',
      ),
      h('Mouse settings'),
      p('The help ([[H]]) has a sensitivity slider and an Invert Y switch. Both are saved in this browser.'),
    ],
  },
  {
    id: 'guild',
    title: 'Your guild',
    blocks: [
      p(
        'Your guild is the people who do the work. Each of them is a real coding agent (Claude Code by default; Codex or OpenCode if you have them) running in its own terminal on this machine, each in its own git worktree, so nobody steps on anyone else\'s changes.',
      ),
      h('Coders'),
      p(
        'Coders pick up GitHub issues, write the change, run the project\'s checks, push a branch and open a pull request. Each has a trade and may have a specialty: an issue labelled `swarm:<specialty>` goes to a free specialist first, but anyone can take it.',
      ),
      h('Testers'),
      p(
        'Testers wear aprons and work in the assay room. They test pull requests and never change them. Every chamber always has at least one tester, and can have up to three. When every tester is busy, a free coder who didn\'t write the pull request covers for them.',
      ),
      h('The DungeonMaster'),
      p(
        'The DungeonMaster runs the dungeon for you. He studies each new chamber, writes its QA brief, turns your project briefs into GitHub issues, gives coders work that fits the project and puts forward recruits. He also reviews the whole dungeon every so often (Settings in the ledger sets how often). Write to him on your scroll ([[P]]).',
      ),
      h('Recruiting'),
      p('There are three ways to add someone to a chamber:'),
      list(
        'Accept a recruit the DungeonMaster puts forward. They wait on the chairs along the great hall\'s east wall: press [[E]] on one to read their credentials, then recruit or decline. The **Recruits** tab of your scroll shows the same list.',
        'Aim at an empty bench in a chamber and press [[E]] (or click it and confirm).',
        "Use the Guild tab of the Overlord's ledger.",
      ),
      p(
        'By default every recruit waits for your yes. In the ledger\'s Settings you can switch to auto-approve while a chamber is under the guild cap; anyone beyond the cap still waits for you.',
      ),
      h('Letting someone go'),
      p(
        'Open their terminal (press [[E]] on their bench) or find them in the Guild tab, and press **Let go**. Their worktree is removed; any branches they pushed stay on GitHub. The last tester in a chamber can\'t be let go.',
      ),
    ],
  },
  {
    id: 'quests',
    title: 'Quests: issues, pull requests and QA',
    blocks: [
      p(
        'Work in the dungeon is GitHub issues. An issue goes from the backlog to a coder, becomes a pull request, is tested in the assay room and is merged. You can watch every step on the chamber\'s notice board, and step in at any of them.',
      ),
      h('Where issues come from'),
      list(
        'Your project briefs: write what a chamber should build next in the ledger (DungeonMaster & recruits tab), and the DungeonMaster turns it into issues.',
        'The **Issues** tab of the ledger, or the notice board, where you can file one yourself.',
        'Anything already open on GitHub for that repo.',
      ),
      p(
        'An issue that says `Depends on #N` waits until #N is closed. Of the rest, the ones holding up the most other work go first, then the oldest.',
      ),
      h('The notice board'),
      p('Press [[E]] on the board at the far end of a chamber. Its columns:'),
      list(
        '**Backlog**: open issues nobody has picked up. Assign one to a coder from here.',
        '**In progress**: coders at work.',
        '**In QA**: pull requests being tested, or being fixed after a failed test. Pull requests that people opened (not coders) show here as not tested yet, with a **Send to QA** button.',
        '**Ready to merge**: QA passed, waiting for you or for auto-merge.',
        '**Merged**: done.',
      ),
      p(
        'With **auto-assign** on for a chamber (in the ledger), free coders take the next issue by themselves. With it off, you hand out issues from the board or from a coder\'s terminal.',
      ),
      h('Pull requests'),
      p(
        'A coder works on a branch called `swarm/issue-<n>-<name>` and opens a pull request that says `Closes #<n>`. Coders never push to the default branch and never merge: the dungeon merges, after QA.',
      ),
      h('QA in the assay room'),
      p(
        'A free tester checks out the pull request, reads it and its issue, reviews the diff, runs the tests, linters and build, and tries the change in a real browser with screenshots. The dungeon posts the report on the pull request as a comment: the verdict, a table of checks, the commands run and the screenshots.',
      ),
      p(
        'If QA fails, the report goes back to the coder who wrote it. They fix the branch and it goes back to QA. After three failed rounds the pull request is marked **needs you**.',
      ),
      h('Merging'),
      p(
        'With **auto-merge** on (the default), a pull request merges itself once QA has passed its latest commit and GitHub\'s checks are green. If checks fail or it conflicts with the default branch, a coder fixes it and QA tests it again. With auto-merge off, read the pull request and its QA comment on GitHub, then press **Merge** on the notice board. Merging something that hasn\'t passed QA asks you to confirm first.',
      ),
    ],
  },
  {
    id: 'watching',
    title: 'Watching the work',
    blocks: [
      p(
        'Nothing in the dungeon happens out of sight. Every coder\'s screen is their real terminal, and you can read it, type into it or stop it at any time.',
      ),
      h('Slates'),
      p(
        'The slate on each workbench is that coder\'s live terminal. Walk up behind them to read it. Press [[E]] on the bench (or click it) for the full terminal, where you can:',
      ),
      list(
        'click into the terminal and type, as if it were your own (while it has focus, [[Esc]] goes to the agent and interrupts its turn);',
        'use the message box underneath: [[Enter]] sends, [[Shift]] + [[Enter]] starts a new line. While they work it is typed into their session; afterwards it resumes it as a follow-up;',
        'press **Stop** to halt them, and **▶ Carry on** to set them going again on the same work, where they stopped, with everything they knew. It works for coding, fixing and testing, after a Stop, after [[Esc]] in their terminal, and after their session failed or crashed. Or hand them an issue from the backlog, or **Clear bench** when they are done.',
      ),
      h('When someone needs you'),
      p(
        "Now and then a coder or tester can't go on without you: a decision only you can make, a password or key, an account, access. They stop and say exactly what they need. It goes on your scroll with an **Answer** button, their panel shows **needs you**, and the scroll's red badge counts them until they're answered. Answer in their message box and they carry on with your answer. If you sorted it out some other way, press **▶ Carry on**.",
      ),
      h("Who's working"),
      p(
        'The list at the top right shows everyone working right now, with their latest thought, reply or tool call: everyone in this chamber, or everyone in the dungeon when you are in the great hall. Click a name to open their terminal. [[Tab]] shows or hides the list.',
      ),
      h('Your scroll'),
      p('Press [[P]] anywhere to take out your scroll. It has three parts:'),
      list(
        '**The DungeonMaster\'s letters** (the first tab, under their name): write to the DungeonMaster and read what they and the dungeon send you (merges, refused merges, usage warnings).',
        '**Recruits**: the people waiting for your yes.',
        '**The Realm**: every project at a glance.',
      ),
      p('The red badge on the scroll counts messages and decisions waiting for you.'),
      h('Sound'),
      p(
        'A handbell rings when the DungeonMaster writes to you. Bells ring when a pull request is ready to merge, fails QA or is merged, and when a new recruit arrives; a low gong sounds when someone hits an error. Quiet music plays under it all. [[M]] mutes or unmutes everything, anywhere; [[N]] turns just the music off or on. Both volumes are in the help ([[H]]).',
      ),
    ],
  },
  {
    id: 'ledger',
    title: "The Overlord's ledger",
    blocks: [
      p(
        'The ledger is where you change how the dungeon runs. It sits on your table in your study (back left of the great hall): press [[E]] at the table to open it. It has five tabs.',
      ),
      h('Chambers & repos'),
      p(
        'One row per chamber. **Visit** walks you there. Switches for **Auto-assign issues**, **Auto-merge** and **Browser testing** (testers use a real browser through Playwright). You can dye the chamber one of eight period colours (ochre, woad, moss and the rest), link it to other chambers so its coders can read those repos, and **Disconnect** it: everyone in it is let go, nothing is deleted on GitHub, and the folder stays on disk.',
      ),
      p(
        'Each row also shows whether your project folder is up to date with GitHub. After a merge it fast-forwards when that is safe; if it can\'t (local changes, another branch checked out), it says why, and **Sync now** tries again. Nothing is ever stashed or thrown away.',
      ),
      p(
        '**Add a project** at the bottom connects a project folder or a GitHub repo, or starts a new one. Every project must be on GitHub, because issues and pull requests are how the guild works.',
      ),
      h('DungeonMaster & recruits'),
      p(
        'The DungeonMaster\'s model and effort, the recruits waiting for you, and a **project brief** for each chamber: what it should build next. **Re-study** asks him to read the repo again and rethink the guild.',
      ),
      h('Guild'),
      p(
        'Everyone in every chamber: name, job title, specialty, coding agent, model, effort and look. **Terminal** opens their terminal; **Let go** lets them go.',
      ),
      h('Issues'),
      p('File a new issue on any chamber\'s repo, and see the open ones.'),
      h('Settings'),
      list(
        '**Default coding agent, model and effort** for everyone (each person can override them in the Guild tab).',
        '**Session limit**: how many agents may work at once. Empty means no limit.',
        '**Sessions while pacing**: how many may run when Claude warns that usage is high (chapter IX).',
        '**Recruiting**: approve every recruit, or auto-approve up to the **guild cap per chamber**.',
        '**Dungeon review every** so many minutes: how often the DungeonMaster looks over everything (0 turns it off).',
        '**How coders run**: real terminals (recommended) or the Agent SDK.',
        'Your name, the name of your hold, the folder new projects are created in, your own domain for launched apps (chapter VIII), and **Replay the tour**.',
      ),
      p(
        'When an update to the dungeon itself is ready, a row at the top of the ledger offers **Update now** or **Later**. Updating lets running sessions finish first, then restarts the dungeon.',
      ),
    ],
  },
  {
    id: 'pastimes',
    title: 'Pastimes: darts and the black cat',
    blocks: [
      p('Not everything in the dungeon is work.'),
      h('Darts'),
      p(
        'The dart board hangs on the great hall\'s south wall, at the west end. Aim at it and press [[E]] to take the three darts. Click or press [[F]] to throw one: a tap lobs it, holding throws harder. [[G]] puts the darts back on the ledge, and so does freeing the mouse with [[Esc]].',
      ),
      p(
        'Darts stick only in the board. A round is three darts, scored like the real game: doubles, trebles, 25 and the bull. The chalk tally beside the board keeps the best round. Press [[E]] on the board again to collect your darts. The coders are not targets.',
      ),
      h('The chest of spoils'),
      p(
        "Under the DungeonMaster's trophies in the great hall's north-east corner stands the chest of spoils. Press [[E]] on it: the lid lifts and a scroll lists the guild's latest merged pull requests, newest first, each one a link to GitHub. Close the scroll and the lid shuts. On the shelves above it a chalice stands for every pull request merged, up to eight.",
      ),
      p('Mind your fingers the first time you open it. And now and then something comes out of it that is not spoils.'),
      h('The tavern'),
      p(
        "Coders and testers with nothing to do don't sit at their benches: they go to the great hall's bar and feasting tables, where Wystan the Tapster keeps the ale coming. They talk, drink and wait for work. When an issue or a pull request comes for them they're back at their bench at once; while they're away, their slate says where they went. The tables are laid with bread, cheese and fruit, and between pours Wystan wipes down the bar or talks with his hands.",
      ),
      p(
        "Stand near the bar and you'll hear some of what they say, in speech bubbles, and some of it is about the guild's real work. Press [[E]] on any of them, or on Wystan, for a word of your own.",
      ),
      h('The wolf by the hearth'),
      p(
        'A wolf sleeps on a hide rug by the great hall\'s fire. He stirs now and then, lifts his head when you come close, and sometimes yawns or gets up to stretch before lying down again. He makes no sound but his breathing, and you can\'t walk through him.',
      ),
      h('The black cat'),
      p(
        'A black cat lives in the dungeon and thinks she runs it. She sleeps by the hearth, sits on the bar, keeps working coders company and takes the DungeonMaster\'s table when he isn\'t looking.',
      ),
      p(
        'Press [[C]] to call her. She will ignore you for a moment, then follow you about. She never blocks your way or a click, and a shut door doesn\'t stop her: she shoulders it open a crack and slips through.',
      ),
      p(
        'Rats get in now and then, never more than three at a time. When she spots one she creeps up on it, pounces, and carries the kill to her pile beside the hearth. Twelve is all there are: once the pile is full, no more come until the dungeon is reloaded.',
      ),
      p(
        "Spiders are another matter. A big black one with red eyes sometimes climbs out of the chest of spoils, never more than three about at once. They creep, freeze, and rear up at you if you get too close. The cat only bothers with one now and then, and when she catches it she eats it on the spot. An old spider slips away once you're well clear of it.",
      ),
      p(
        "Something bigger lives at the far end of the gallery, past the last chamber, where old webs hang in the corners: a tarantula as big as a dog, with rust-red knees. Walk down into its end of the gallery and it runs at you, stops short, rears up and hisses, then backs off home still facing you. It never comes further up the gallery than its own stretch. The cat goes for it as often as not and can kill it. She leaves it where it fell, on its back, and the body shrivels away some minutes later. Within twenty minutes another lets itself down from the ceiling on a thread. There is only ever one alive.",
      ),
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping your app',
    blocks: [
      p(
        'Shipping is putting a chamber\'s app on the internet, on Vercel. The SHIP IT sign on a chamber\'s far wall shows where it stands; press [[E]] on it (or **🚢 Ship** on the chamber\'s row in the ledger) to open the panel. Only you ship: coders and testers never deploy.',
      ),
      h('Setting a chamber up'),
      p('The first time, the panel asks how this chamber ships and which Vercel project it uses (it can create one named after the repo). It uses the Vercel command line on this machine, logged in as you; if it isn\'t, run `vercel login` in a terminal and press **Check**.'),
      list(
        '**Every merge goes live**: Vercel builds from GitHub and each merge to `main` goes live by itself. The way to start: the app lives on its free vercel.app address while it\'s being built.',
        '**GitHub builds, you ship**: every merge is built but held back. **Ship it** puts the newest build of `main` live in seconds.',
        '**Deploy from the dungeon**: the dungeon deploys `main` itself when you press **Ship it**, and **Preview** gives you a link to a test copy.',
      ),
      h('Launching'),
      p('When the app is ready, **Launch** gives it its own address, such as `myapp.example.com` (set your own domain in the ledger\'s Settings and Launch suggests one under it), and from then on merges wait for **Ship it** instead of going live by themselves. The first ship of any chamber asks you first, because it makes the app public.'),
      h('What the panel shows'),
      list(
        '**Live now**: the address, the commit, and since when.',
        '**Waiting to ship**: the pull requests merged since then.',
        '**Ship it** stays greyed out, with the reason, while `main`\'s checks fail, while Vercel is still building, or when nothing is waiting.',
        '**Ship log**: who shipped what, and when.',
      ),
      h('Undo'),
      p(
        '**Undo last ship** puts the previous version back live in seconds (**Go back to…** reaches older ones). `main` still has the change that broke it, so **Ship it** stays locked until `main` moves on, and a chamber where every merge goes live pauses until you press **Resume**. Two buttons follow up: **Revert those changes** files an issue for a coder to undo them, and **Fix it forward** files one to fix what broke. Either way the fix goes through QA like any other work.',
      ),
    ],
  },
  {
    id: 'trouble',
    title: 'When something goes wrong',
    blocks: [
      p(
        'Most problems show up in one of three places: the banner at the top of the screen, a message on your scroll ([[P]]), or the coder\'s own terminal. Start there.',
      ),
      h('"GitHub CLI is not ready"'),
      p(
        'The dungeon reaches GitHub only through the `gh` command. Open a terminal and run `gh auth login`, then `gh auth status` to check. Restart the dungeon afterwards. In the codedungeon folder, `npm run doctor` checks Node, git, `gh` and the Claude login in one go.',
      ),
      h('Claude asks to sign in'),
      p(
        'Agents use your own Claude subscription. If an agent\'s terminal is waiting at a sign-in or first-run screen, it waits for you there: open the terminal and answer it, or run `npm run login` in the codedungeon folder.',
      ),
      h('Usage limits and pacing'),
      p(
        'Every agent on Claude draws on the same subscription. When Claude warns that usage is getting high, the dungeon paces itself: QA, fixes and the DungeonMaster carry on, but new issues only start while fewer sessions than **Sessions while pacing** (Settings, default 3) are running. Your scroll says when pacing starts and ends.',
      ),
      p(
        'If Claude turns a session away because the limit is reached, the dungeon starts no new work until the time Claude gives, and tells you on your scroll. Sessions already running carry on. To use less at once, set a **Session limit** in the ledger\'s Settings.',
      ),
      h('A GitHub link says "Page not found"'),
      p(
        "The chamber's repository is private (the board shows 🔒 private next to its GitHub link). GitHub shows a private repository's issues, pull requests and QA reports only to accounts with access, and to everyone else it says the page isn't found, as if it didn't exist. Sign in to GitHub in the browser you use for the dungeon, on the same computer, with the account the dungeon uses (its name is at the top right) or another account you've given access to the repository.",
      ),
      h('A coder is stuck'),
      list(
        'Open their terminal ([[E]] on their bench) and read the last few lines. They may be waiting on a question or a slow command.',
        'Tell them what to do: type in the message box, or straight into the terminal.',
        'Press **Stop**. **▶ Carry on** then sets them going again where they stopped, or hand the issue to them again or to someone else. **Clear bench** resets a finished or failed bench.',
        'A failed session puts its issue back on the board; the coder gets new work after a two-minute rest. An issue that fails twice waits for you to assign it by hand. Until someone else takes it, **▶ Carry on** on their panel sends them back to it.',
        'If the dungeon restarts, or your computer shuts down, while coders and testers are working, they pick up where they were by themselves once it is running again. If anyone doesn\'t, press **▶ Carry on** on their panel.',
      ),
      h('A chamber says its main branch is not on GitHub yet'),
      p(
        'Coders start from the main branch on GitHub, so nothing can start until it is there. The chamber and its board say what to do, and the guild waits instead of failing. Usually the first push never finished: in your project folder run `git push -u origin main` (with large files it can take a while). Within a minute of it arriving the notice goes and the guild starts on its own.',
      ),
      h('A pull request will not merge'),
      p(
        'If GitHub refuses the merge (for example, branch protection wants an approving review), your scroll gets a message and the dungeon tries again every 10 minutes. Checks still running after 30 minutes also get a message. Pull requests marked **needs you** have failed QA or their fixes three times: read the QA comment on GitHub and decide.',
      ),
      h('The view or the mouse misbehaves'),
      list(
        'Can\'t look around: click the view once. Straight after [[Esc]] the browser refuses for about a second, so if the first click does nothing, click again. Where the mouse can never be captured, drag with the left button held.',
        'In a narrow window (a browser pane beside a chat, say) the line of keys along the bottom steps aside to leave room; the help ([[H]]) and chapter X list them all.',
        'The status pill says **reconnecting**: the dungeon\'s server is restarting or has stopped. Agents\' terminals keep working through a restart.',
        'No sound: press [[M]], and check the volume in the help ([[H]]). No music: press [[N]], and check its own volume there too.',
      ),
    ],
  },
  {
    id: 'keys',
    title: 'Keys at a glance',
    blocks: [
      p('Every key the dungeon listens to. None of them act while you are typing in a box.'),
      keys(
        ['W A S D or arrows', 'Walk'],
        ['Shift', 'Run'],
        ['Mouse', 'Look around (click the view first)'],
        ['Mouse wheel', 'Zoom in and out; middle click to zoom back out'],
        ['E or left click', 'Use what the cross is on'],
        ['Esc', 'Free the mouse, or close a panel'],
        ['P', 'Your scroll'],
        ['Tab', "Show or hide who's working"],
        ['H', 'Help'],
        ['B', 'This User Guide'],
        ['C', 'Call the cat'],
        ['F', 'Throw a dart (hold for a harder throw)'],
        ['G', 'Put the darts back'],
        ['M', 'All sound on or off'],
        ['N', 'Music on or off'],
        ['Enter', 'Send, in the scroll and in a terminal\'s message box'],
        ['Shift + Enter', 'New line in those boxes'],
      ),
      p('In this book, [[←]] and [[→]] turn to the previous and next chapter.'),
    ],
  },  {
    id: 'quick-start',
    title: 'Quick start',
    blocks: [
      p(
        'Code Dungeon is free and open source, under the MIT licence: [github.com/brainit-consulting/codedungeon](https://github.com/brainit-consulting/codedungeon). It runs on your own computer, and the coders work on your own GitHub projects with your own Claude subscription.',
      ),
      p(
        'Two short videos show it: [Introduction to Code Dungeon](https://youtu.be/RzP2SoLmC6Q) (2 minutes 23), what it is and how the guild works, and [Getting started](https://youtu.be/Mn74ZSlh78U) (2 minutes 35), installing it and your first project.',
      ),
      h('What to have ready'),
      list(
        '**A Windows 10 or 11 computer.** Linux works too; macOS has not been tried yet.',
        '**Node.js 22 or newer**, from [nodejs.org](https://nodejs.org).',
        '**git**, from [git-scm.com](https://git-scm.com).',
        '**A GitHub account** ([github.com](https://github.com)) and the GitHub command line, from [cli.github.com](https://cli.github.com). Sign it in with `gh auth login`. Every project in the dungeon lives on GitHub.',
        '**A Claude subscription**, from [claude.ai](https://claude.ai). The coders run Claude Code, which comes with the dungeon; you sign it in once.',
        '**Google Chrome**, from [google.com/chrome](https://www.google.com/chrome/), so the testers can try your app in a real browser.',
        '**A Vercel account**, from [vercel.com](https://vercel.com), only if you want to put your apps on the internet from the dungeon (chapter VIII).',
      ),
      h('Install it and start it'),
      p('Open PowerShell (on Linux, a terminal) in the folder where you keep your projects, and paste this one line:'),
      command('git clone https://github.com/brainit-consulting/codedungeon.git; cd codedungeon; npm install; npm run login; npm run dev'),
      p(
        'It fetches Code Dungeon into a folder called codedungeon, installs what it needs (about a minute), signs Claude in (a browser window asks you to allow it), and starts the dungeon. Then open **http://localhost:5417** in your browser and press **Enter the dungeon**. The first time, a short setup asks your name, names your hold and your DungeonMaster, and brings in your first project.',
      ),
      p('If something is missing, `npm run doctor` in the codedungeon folder checks Node.js, git, the GitHub command line and the Claude sign-in, and says what to fix.'),
      p('To walk round with pretend projects and pretend coders first, start it with `npm run dev -- --demo` instead. Nothing touches GitHub and nothing uses your subscription.'),
      h('Starting it again'),
      p(
        'The dungeon runs while its PowerShell window is open. Another day, open PowerShell in the codedungeon folder, run `npm run dev`, and open http://localhost:5417. Your projects, your guild and your settings are where you left them, in the codedungeon-home folder beside it.',
      ),
      h('Restarting it'),
      p(
        'To stop it, press [[Ctrl]] + [[C]] in its window; that stops the coders\' sessions too. To start it again, run `npm run dev`. When the dungeon restarts by itself, after an update, the coders keep working through it.',
      ),
      h('Updating it'),
      p(
        'The ledger\'s Chambers tab shows when a newer Code Dungeon is on GitHub. To update, stop it with [[Ctrl]] + [[C]], then in its folder run `git pull; npm install; npm run dev`. Your projects, guild and settings stay as they are.',
      ),
    ],
  },
];
