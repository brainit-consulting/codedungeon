# Step 1: toys out, a dart board in

Date: 2026-10-03. Decided overnight under the Overlord's standing instruction to work autonomously; the two open
calls (game style, darts hitting people) were taken as recommended and are listed in the morning summary.

## Goal

The only game in Code Dungeon is darts thrown by hand at a dart board. Everything else that plays goes: the
balls, the basketball hoop, the roomba, the foam blasters, the hit reactions on seated people, and the phone's games
(snake, tetris, pet, paint).

## Decisions

- **Game:** throw by hand, darts stick in the board, a chalk tally beside it. Scored like real darts: the 20
  segments in the standard order, doubles, trebles, the outer bull (25) and the bull (50). A round is 3 darts.
  The tally shows this round's throws and total, and the best round ever thrown here (kept in the browser).
- **People are not targets.** No hit sensors, no flinch. A dart that reaches someone just falls.
- **Darts stick only in the board.** Walls, tables and floors are stone and wood: a dart bounces off and falls.
- **Where:** for now the board hangs on the lobby's south wall, west end, where the blaster rack stood. The step 2
  layout moves it into the great hall. Office floors get no toys at all, so they no longer load the physics engine.
- **Collecting:** the 3 darts start on the board's ledge. Aim at the board and press E to take every dart back
  into your hand (stuck in the board, on the floor or anywhere else). That also ends the round.
- **Throwing:** the existing hand mechanics: hold the mouse (or F) to charge, release to throw, one dart per throw.
  Speed 4 m/s (tap) to 12 m/s (full), full gravity, aimed along the crosshair. G (and Esc, or a panel opening) puts
  the darts in hand back on the ledge, so they can't get lost.
- **Pathfinding kept for the cat:** the roomba's grid A* (`makeNav`, `planPath`, `clear`, `segmentClear`) moves to
  `client/src/world/nav.ts` with its tests. The rest of the roomba goes.

## Board geometry (real regulation sizes, metres)

Centre 1.73 above the floor. Radii from the centre: bull 0.00635, outer bull 0.0159, treble ring 0.099 to 0.107,
double ring 0.162 to 0.170, edge of scoring 0.170, board 0.2255. Segment 20 at the top, then clockwise
20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5. Throw line 2.37 from the board.

## Units

- `world/toys/dartboard.ts` (pure, tested): `scoreAt(x, y)` in board coordinates (metres, +y up, +x right as you
  face the board) → `{ points, label }` (labels like `T20`, `D16`, `25`, `BULL`, `5`, `MISS`); the round tally.
- `world/toys/HandDarts.tsx` (in the physics world): the board's collider, the darts in flight, sticking, scoring,
  collecting, and the dart in your hand.
- `world/toys/DartBoardLook.tsx`: the board and the chalk tally, both canvas textures, toon style for now (the
  step 3/4 models replace the look, not the rules).
- `store.held`: `{ kind: 'darts', count: number }` replaces `ball` and `blaster`.
- `window.__swarmToys` (read-only QA probe): `held`, `charging`, `bodies`, `darts`, `dartsStuck`, `board`
  (`{ throws, total, best }`). In dev builds only, `window.__throwDart(power)` throws the next dart along the
  current view, so a browser without pointer lock can test it.

## Out of scope

Models (step 3), the great hall (step 2), any wording beyond the help text for darts (step 7).

## Verification

`dartboard.test.ts` covers every ring, the segment boundaries and the round tally; `nav.test.ts` keeps the
planner's tests. Typecheck and the full suite pass. In a demo office in the browser: the board renders, a dart
thrown with `__throwDart` sticks and the tally shows its score, E collects the darts, office floors have no
physics world, and the phone has no Games tab.
