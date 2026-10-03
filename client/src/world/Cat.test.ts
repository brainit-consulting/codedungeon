import { describe, expect, it } from 'vitest';
import { catNav, chamberSpots, hallSpots } from './Cat';
import { chamber, dungeonColliders, inDungeon, roomAt } from './dungeon';
import { HALF_W, HEARTH } from './layout';
import { clear, planPath } from './nav';
import { RAT, createWarren, stepWarren, type WarrenEnv } from './ratBrain';
import { PILE, PILE_DROP } from './Rats';

describe("the cat's favourite spots", () => {
  it('can all be reached from the hearth on her grid, with six chambers', () => {
    const slots = [1, 2, 3, 4, 5, 6];
    const nav = catNav(slots);
    const from = { x: -HALF_W + HEARTH.d + 0.6, z: HEARTH.z + 0.8 };
    const spots = [...hallSpots(false), ...slots.flatMap((slot) => chamberSpots({ slot, busyDesks: [0, 5, 11] }))];
    for (const s of spots) {
      const target = s.y ? (s.approach ?? s) : s;
      expect(planPath(nav, from, target), s.id).not.toBeNull();
    }
  });
});

describe('her pile of rats', () => {
  it('lies on open floor by the hearth, out of the way, and she can carry a rat there from a far chamber', () => {
    const slots = [1, 2, 3, 4, 5, 6];
    const nav = catNav(slots);
    const walls = dungeonColliders(slots);
    // the pile itself (about 0.3 m across) and where she stands to lay one on it: clear of the hearth and the wall
    expect(clear(walls, PILE.x, PILE.z, 0.3, nav.bounds)).toBe(true);
    expect(clear(walls, PILE_DROP.x, PILE_DROP.z, 0.2, nav.bounds)).toBe(true);
    expect(Math.hypot(PILE.x - (-HALF_W + HEARTH.d), PILE.z - HEARTH.z)).toBeLessThan(3);
    // tucked in the corner: well off the hall's walkways
    expect(PILE.x).toBeLessThan(-HALF_W + 1);
    const far = chamber(6);
    expect(planPath(nav, { x: far.x, z: far.z }, PILE_DROP)).not.toBeNull();
  });
});

describe('rats in the dungeon', () => {
  it('are born on open floor inside the hall, the gallery and the chambers, away from the player', () => {
    const slots = [1, 2, 3, 5];
    const nav = catNav(slots);
    const walls = dungeonColliders(slots);
    const player = { x: 0, z: 0 };
    const w = createWarren(17);
    const env: WarrenEnv = { nav, player, kills: 0, inside: (x, z) => inDungeon(x, z, slots), threats: [] };
    const born: { x: number; z: number }[] = [];
    for (let t = 0; t < 900 && w.spawned < RAT.cap; t += 1 / 10) {
      stepWarren(w, 1 / 10, env);
      for (const r of w.rats) {
        if (r.dead) continue;
        born.push({ x: r.x, z: r.z });
        r.dead = true; // a stand-in cat, to see all twelve born
        env.kills++;
      }
    }
    expect(born).toHaveLength(RAT.cap);
    for (const p of born) {
      expect(inDungeon(p.x, p.z, slots)).toBe(true);
      expect(clear(walls, p.x, p.z, 0.3, nav.bounds)).toBe(true);
      expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeGreaterThanOrEqual(RAT.spawnClear);
    }
    expect(new Set(born.map((p) => roomAt(p.x, p.z, slots))).size).toBeGreaterThan(1);
  });
});
