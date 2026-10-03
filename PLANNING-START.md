# Code Dungeon — where planning starts

Written 2026-10-02, before a reboot, so the next session can pick up here. Nothing is built yet. This folder holds only this note.

## The goal

Code Dungeon is our own version of cubefarm (Leon van Zyl's 3D office for AI coding agents), redesigned with a medieval theme. That covers the building, the props, the characters and everything else.

## Constraints

- **Keep `H:\cubefarm` as it is.** It's the fork clone of Leon's repo. `origin` = brainit-consulting/cubefarm, `upstream` = leonvanzyl/cubefarm. Its branch `local/all-fixes` is what runs the user's real office today, started with `node bin/cubefarm.js` from `H:\cubefarm` on port 4317, with data in `C:\Users\snake\.cubefarm`. It will be synced with Leon's repo later. Don't build the medieval version there.
- **Code Dungeon lives in `H:\codedungeon`.** The plan: plan it, refactor it, then build the medieval version.
- **Don't disturb the live office.** It uses port 4317 and `C:\Users\snake\.cubefarm`. Develop and test Code Dungeon in demo mode, with its own `SWARM_HOME` and its own port. That's Leon's own rule in cubefarm's CLAUDE.md, and it applies here too.

## What we already know about cubefarm's visuals (read in the source, 0.3.2 + our fixes)

- All of the 3D world is in `client/src/world/`: React Three Fiber, three.js 0.186, drei and Rapier. There are no model files and no texture images. Everything is built in code from boxes, balls and capsules (`Toon.tsx`), with toon materials (`materials.ts`) and ink outlines (drei `Outlines`).
- The floor plan is plain numbers in `layout.ts`: a 32 x 24 m floor, 3.6 m walls, a 4 x 3 desk grid, the elevator in the south wall, and hand-written collision rectangles for every piece of furniture.
- Rooms and furniture: `Shell.tsx` (walls, windows, ceiling lights), `Lobby.tsx` (reception, manager's and CEO's offices, waiting room, trophy cabinet), `OfficeFloor.tsx`, `Desk.tsx`, `Props.tsx`, `Elevator.tsx` and `KanbanBoard.tsx`. `toys/` holds the basketball hoop, darts, blasters and the roomba.
- Characters: `Character.tsx`, `appearance.ts` and `characterParts.ts`. Parts are merged with `mergeGeometries`.
- Screens, signs and the whiteboard are canvas textures drawn in `draw.ts`.
- Performance, measured with `?stats` in a demo office: about **320 draw calls** in the lobby and about **1,040 on an office floor** (148k triangles). The main cause is that every `Box` is its own mesh, plus another for its outline and another for its shadow. A redesign is a good moment to merge static furniture into one mesh per piece.
- Camera helpers for screenshots: in a production build, set `localStorage['cubefarm:view'] = {floor, x, z, yaw, pitch}` and reload. `window.__swarmCam(x, z, yawDeg, pitchDeg)` only exists in dev builds.

## Questions to settle when planning

1. **The relationship to cubefarm.** A long-lived fork that keeps pulling Leon's updates, with the medieval world swapped in? Or a clean break? This decides how far the refactor can go.
2. **The look.** Stay with code-built shapes, or bring in real models (Blender, glTF)? There is a Blender MCP connection available.
3. **Scope of the theme.** Is it just the 3D world, or also the UI (phone, console, Kanban board, terminal panel) and the wording ("CEO" becoming the lord or the keeper, "floors" becoming dungeon levels, and so on)?
4. **Its own GitHub repo** (for example brainit-consulting/codedungeon) and its own npm name, or local only for now?
5. **The first slice:** probably the lobby, re-themed end to end, before anything else.

Also apply the user's rule from `~/.claude/CLAUDE.md`: no generic AI look in words or visuals. Pick one strong direction.

## Open items elsewhere (not part of this plan)

- Leon's repo has open PRs from us: leonvanzyl/cubefarm#58 (QA stuck in "testing" after a restart), #61 (elevator flicker) and #62 (waiting room sign). #56 is merged but unreleased; npm is still at 0.3.2.
- Once Leon releases a version with these fixes, switch the live office back to `npx cubefarm@latest`.

## How to resume after the reboot

1. Start the office again: `cd H:\cubefarm`, then `node bin/cubefarm.js`.
2. Start a Claude Code session in `H:\codedungeon` and say: "read PLANNING-START.md and let's start planning Code Dungeon".
