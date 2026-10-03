# Good morning, Overlord

Written overnight, 2026-10-03. Everything is committed and pushed to the private repo
(github.com/brainit-consulting/codedungeon, branch `main`). CI is green on every step; the last full run
(commit 020aeb9: unit tests, typecheck, package smoke test on Linux and Windows, browser end-to-end) passed.

## Try it first

```
cd H:\codedungeon
npm run dev
```

Then open http://localhost:5417. That is your real Code Dungeon office (port 4417, data in `H:\codedungeon-home`).
Nothing was running it overnight: I tested everything in a separate demo office on other ports.

Things to try:
- Walk south through the archway in the great hall: the gallery leads to each project's chamber.
- **C** calls the cat. She ignores you for a few seconds, then follows.
- **E** on the dart board (great hall, south wall, west end) takes the three darts. Hold the mouse to throw harder.
- **P** opens your scroll, **H** the help, **E** at your table (your study, back left) the Overlord's ledger.

## What got built (in the agreed order)

1. **Toys out, darts in.** The balls, hoop, roomba, foam blasters and phone games are gone (about 5,800 lines).
   Darts are thrown by hand, stick only in the board, and score like the real game (20 segments, doubles, trebles,
   25, bull). A chalk tally keeps the round and the best round. Coders are not targets.
2. **One dungeon level.** The great hall (old lobby) opens south into a gallery; every project's chamber (old office
   floor) opens off it, west and east. No floors, no elevator. Only nearby chambers are drawn. The directory beside
   the archway walks you straight into any chamber. Chamber numbers are now fixed on the server (a removed project no
   longer shuffles everyone else).
3. **Real models and firelight.** Stone floors, brick walls and vaults (textures from the Quaternius village kit),
   no windows, no sun. Torches, candles, chandeliers and the hearth give the light. A fixed pool of 8 lights follows
   you, so the light count never changes (changing it makes three.js stutter).
4. **Furnishing.** Chambers: workbenches, the coders' screens as framed "slates" on easels (the live terminals,
   unchanged), ledgers and quills, candles, chandeliers, the ale corner, the notice board as cork and parchment.
   Great hall: the bar (where reception was) with kegs and bottles behind, stools, a hearth, two feasting tables,
   your table and high-backed chair, the DungeonMaster's weapon stand, chest and banners.
5. **The people (first pass).** New recruits get a name and a trade (Aldric the Smith, Maud the Scribe; testers are
   Gerard the Assayer and friends). The DungeonMaster defaults to Mortimer. Coders wear muted dyes, hoods and linen
   coifs; testers an apron with a wax seal; the DungeonMaster a crimson robe and gold chain. Existing agents keep
   their names (renaming is in the ledger).
6. **The black cat.** Walks the whole dungeon: sleeps by the hearth, sits on the bar and pushes a mug towards the
   edge, purrs beside working coders, takes the DungeonMaster's desk when he isn't working, sits in front of the
   notice board, wanders. Ignores you when called, then follows. Never blocks a click or the way.
7. **UI and wording.** Parchment-and-ink panels in Alegreya, one rust accent, no blur or gradients. Labels, help,
   tutorial and notices speak of the DungeonMaster, the Overlord, chambers, recruits, the scroll and the notice board.
   Real data (terminals, PR and issue numbers and titles, commands) is unchanged.
   Sound: fire crackles near flames (the hearth roars), and the cat purrs when you're close.

## What I verified, and how

- **Measured in a browser (demo office):** every room renders with no console errors; walking into a chamber
  switches the HUD; visits and the saved spot work; darts collect, fly, stick and score (one stuck in the 3, two
  fell short as the physics predicts); the cat walked from a chamber through the gallery to the hall, jumped onto
  the DungeonMaster's desk and sat; 60 fps in hall, gallery and chamber at the browser pane's size.
- **Tests:** 260 unit tests pass (typecheck clean). New ones cover the dart scoring, the dungeon plan, stable
  chamber numbers, pathfinding on any bounds, and the cat's routine.
- **Not verified by me:** the sounds (I can't hear the browser pane), full-screen frame rate on your laptop, and a
  real project end to end in the new dungeon. Those are yours to check.

## Decisions I made for you (overrule any of them)

- **Darts:** chalk tally with real scoring; coders are not targets; G (or Esc) puts darts back on the ledge.
- **Layout:** chambers 32 x 24 m like the old floors, two per row along a 4 m gallery; doorways are open arches.
- **Look:** dark but readable: I raised the light after the first pass was too dark to work in. The cel-shaded
  people got a darker shading ramp so they don't glow.
- **Characters:** I kept the code-built people (cheap to draw) and re-dressed them, instead of the rigged Quaternius
  characters. See the first question below.
- **Sounds:** made from noise bursts through the existing mixer (M mutes them), no audio files.
- **Wording:** a helper agent did the client wording pass with a fixed glossary; I did the server notices and
  the 3D signs.

## What I need from you

1. **The coders' bodies.** I downloaded rigged Quaternius characters, fantasy outfits and an animation library
   (sitting, talking, walking; no typing). They'd look far closer to the stone and props, but each coder becomes a
   skinned, animated mesh (up to 15 per chamber), which may be heavy on this laptop. Want me to try one chamber with
   them and measure?
2. **The agents' own prompts** still talk about "floors", "the manager" and "the office" (that's what the
   DungeonMaster reads). Changing them changes what the agents say to you. Re-word them too?
3. **How dark?** Look at the hall and a chamber and tell me: darker, lighter, or right.
4. **Blender** stayed unused tonight: the free packs covered the bar, kegs, seat and dart board, and the cat is
   code-built so she can be posed. Is there a piece you'd like modelled properly (the cat, a throne, the hearth)?

## Downloads (your standing yes)

All from Quaternius's official itch.io pages, free tier, CC0, saved to `H:\codedungeon-home\assets-src` (listed with
byte sizes in `DOWNLOADS.md` there): Fantasy Props MegaKit (150 MB), Medieval Village MegaKit (161 MB), Universal
Animation Library (16 MB), Universal Base Characters (129 MB), Modular Character Outfits - Fantasy (294 MB). Only
the models in use are copied into the repo, shrunk to 1024 px textures (about 7.5 MB). Nothing from Kenney yet.

## A second pair of eyes

At the end I had a fresh reviewer read the whole night's work. No critical problems; five important ones, all fixed
and pushed (with tests where they could be tested):
- A reload inside a chamber could drop you in the hall (a race with the server's project list).
- A project removed while you stood in its chamber left you outside the walls (and stranded the cat).
- Sharing model materials by name alone could turn some parts black.
- The cat's long trips froze the frame (measured 414 ms for ten chambers; now 28 ms).
- The great hall was rebuilt every time you passed the first doorways (now just hidden).
Smaller ones fixed too: an escaped dart now counts as a miss; the cat lands before answering a call; C is in the help.

Left as they are (your call):
- Chambers 1 and 2 face each other: from inside one, the open doorway opposite shows black.
- Firelight casts no shadows, so the hearth's glow reaches through stone into the nearest chambers from the gallery.
- Each flame animates itself (about 60 small callbacks in a chamber); fine at 60 fps here, worth batching later.

## Things I'd own up to

- I wrote the cat's brain before its tests (everything else was test-first). I then broke the brain on purpose
  twice to check the tests catch it; they did.
- One push broke CI (the package smoke test looked for the old page title); fixed in the next push.
- I briefly hid the notice board behind its own frame; caught it on screen and fixed it.

## Smaller things left

- Chamber doorways are open arches (no doors yet).
- The phone panel is still phone-shaped under its parchment (could become a scroll).
- `ElevatorPanel.tsx` and the overlay kind `elevator` keep their old names in code (the panel says Directory).
- The demo office's own data still uses cubefarm-era names (Ada, Morgan); new real recruits get the new names.
