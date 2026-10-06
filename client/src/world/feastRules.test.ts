// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { FEAST_TABLES } from './layout';
import { TABLE_FOOD, tableFood } from './feastRules';
import { TAVERN_SEATS, restTargets } from './tavernRules';

describe('food on the feasting tables', () => {
  it('puts bread, cheese and fruit on every table, and not the same spread twice', () => {
    const spreads = FEAST_TABLES.map((_, i) => tableFood(i));
    for (const s of spreads) {
      const kinds = new Set(s.map((f) => f.kind));
      expect(kinds.has('loaf') || kinds.has('boule')).toBe(true);
      expect(kinds.has('cheese')).toBe(true);
      expect(kinds.has('apples') || kinds.has('grapes')).toBe(true);
    }
    expect(JSON.stringify(spreads[0])).not.toBe(JSON.stringify(spreads[1]));
  });

  it('keeps everything on the table top, clear of the candlestick and the plate', () => {
    for (let i = 0; i < FEAST_TABLES.length; i++) {
      for (const f of tableFood(i)) {
        const r = TABLE_FOOD[f.kind].radius;
        expect(Math.abs(f.x) + r, f.kind).toBeLessThan(1.4);
        expect(Math.abs(f.z) + r, f.kind).toBeLessThan(0.53);
        expect(Math.abs(f.x) - r, `${f.kind} vs the candlestick`).toBeGreaterThan(0.25);
        expect(Math.hypot(f.x + 0.4, f.z + 0.25) - r, `${f.kind} vs the plate`).toBeGreaterThan(0.17);
      }
    }
  });

  it("leaves the drinkers' mugs and resting hands room", () => {
    FEAST_TABLES.forEach((t, i) => {
      const spots = TAVERN_SEATS.filter((s) => s.kind === 'bench' && Math.abs(s.mug.x - t.x) < 1.5 && Math.abs(s.mug.z - t.z) < 1).flatMap((s) => {
        const { left } = restTargets(s);
        return [s.mug, left];
      });
      expect(spots.length).toBe(12);
      for (const f of tableFood(i)) for (const p of spots) expect(Math.hypot(t.x + f.x - p.x, t.z + f.z - p.z) - TABLE_FOOD[f.kind].radius, f.kind).toBeGreaterThan(0.08);
    });
  });
});

describe('the spread itself', () => {
  it('never stacks one dish on another', () => {
    for (let i = 0; i < FEAST_TABLES.length; i++) {
      const s = tableFood(i);
      for (let a = 0; a < s.length; a++)
        for (let b = a + 1; b < s.length; b++) expect(Math.hypot(s[a].x - s[b].x, s[a].z - s[b].z), `${s[a].kind} and ${s[b].kind}`).toBeGreaterThan(TABLE_FOOD[s[a].kind].radius + TABLE_FOOD[s[b].kind].radius);
    }
  });
});
