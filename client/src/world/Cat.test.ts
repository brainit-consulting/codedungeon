import { describe, expect, it } from 'vitest';
import { catNav, chamberSpots, hallSpots } from './Cat';
import { HALF_W, HEARTH } from './layout';
import { planPath } from './nav';

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
