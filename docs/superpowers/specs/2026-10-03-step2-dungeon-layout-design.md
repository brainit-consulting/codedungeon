# Step 2: one dungeon, a chamber per project

Date: 2026-10-03, overnight. Follows the agreed layout: a great hall, a chamber per project off it, no floors, no
elevator, only nearby chambers drawn.

## Plan (world coordinates, metres; -Z is north)

- **Great hall** = the old lobby, unchanged, at the origin (32 x 24).
- **Gallery**: through the doorway in the middle of the hall's south wall, a 4 m wide passage runs south.
- **Chambers** = the old office floors, unchanged inside, each turned a quarter so its local south wall (where the
  elevator door was) lies along the gallery. Odd chamber numbers open west, even ones east, two per row, rows
  32.8 m apart. The doorway in that wall is the chamber's door. The gallery draws those walls (the chamber leaves its
  own south wall out), so a chamber that isn't drawn still shows its wall and doorway.
- **What is drawn**: the hall while you're in it or within 18 m into the gallery; the chamber you're in; in the
  gallery, chambers whose door is within 12 m. So at most two chambers at once.
- **Collisions**: one list for the whole dungeon (hall + gallery + every chamber turned into place).
- **The room you're in** (`store.floor`) is worked out from where you stand: a chamber's number, or 0 for the hall
  and the gallery. There is no travel any more. "Go to floor" (the directory, Visit buttons) walks you straight
  into that chamber, just inside its door, facing in.
- **Chamber numbers are fixed**: the server gives a new project the lowest free number and no longer renumbers when
  one is removed, so chambers don't move, preview ports (6300 + number) stay put, and the CEO's tools keep working.
- **The sun follows the player** in 4 m steps, since its shadows only cover about one room.
- The saved view (`codedungeon:view`) stores x, z, yaw, pitch; the room follows from the position.

## Units

- `client/src/world/dungeon.ts` (pure, tested): `chamber`, `toWorld`/`toLocal`/`rectToWorld`, `galleryEnd`,
  `galleryColliders`, `dungeonColliders`, `roomAt`, `chambersToDraw`, `visitSpot`, `inDungeon`.
- `client/src/world/Gallery.tsx`: the gallery's floor, ceiling, walls with doorways, lights.
- `shared/chambers.ts` (tested): `nextChamber`.
- Removed: `Elevator.tsx`, the elevator cabin colliders, travel state, the elevator sounds.

## Out of scope

Looks (step 3/4), doors that open and close, wording beyond replacing "floor/elevator/lobby" with plain
"chamber/directory/great hall" (step 7 makes it medieval).
