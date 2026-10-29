# Client code map

Loaded when working under `client/`. The rest of the rules are in the root CLAUDE.md.

Client (`client/`, Vite root; React 19, R3F, drei, zustand):
- `src/world/`: the 3D building: floors, desks, characters (`appearance.ts`, `characterParts.ts`), elevator,
  whiteboard, player movement and collisions (`layout.ts`), canvas textures (`draw.ts`), `toys/` (Rapier physics: the dart board, its darts and the chalk tally; rules in `dartboard.ts`), `nav.ts` (grid pathfinding), `dungeon.ts` (the plan: hall, gallery, chambers), `models.tsx` (glTF models in
  `client/public/models`, built from the CC0 Quaternius packs by `scripts/build-models.py`), `stone.ts` (tiling stone
  materials), `lightPool.tsx` (torches register as anchors; a fixed pool of point lights follows the nearest).
- `src/ui/`: HTML overlays: HUD, terminal (`LiveTerminal.tsx`: xterm.js on `/ws/term`), Kanban, manager's console,
  phone, elevator panel, app
  viewer, sounds (`sfx.ts`).
- `src/store.ts`: the zustand store; `apply(ServerEvent)` folds websocket events into UI state.
- `src/api.ts`: REST calls; errors become toasts.
- `src/net.ts`: the websocket connection with reconnect. `src/perf.tsx`: render pausing, adaptive DPR, `?stats`.
