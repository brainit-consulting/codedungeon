// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { FEAST_TABLES } from './layout';
import { BITES, PLATE, TABLE_FOOD, bunchRadius, grapeBerries, plateFood, roomFor, tableFood, tableGrapes, type OnPlate } from './feastRules';
import { TAVERN_SEATS, restTargets } from './tavernRules';

describe('food on the feasting tables', () => {
  it('puts bread, cheese and fruit on every table, and not the same spread twice', () => {
    const spreads = FEAST_TABLES.map((_, i) => tableFood(i));
    for (const s of spreads) {
      const kinds = new Set(s.map((f) => f.kind));
      expect(kinds.has('loaf') || kinds.has('boule')).toBe(true);
      expect(kinds.has('cheese')).toBe(true);
      expect(kinds.has('apples')).toBe(true);
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

describe('grapes', () => {
  const all = FEAST_TABLES.map((_, i) => tableGrapes(i));

  it('puts two or three bunches on every table, green and dark both', () => {
    for (const bunches of all) {
      expect(bunches.length).toBeGreaterThanOrEqual(2);
      expect(bunches.length).toBeLessThanOrEqual(3);
      expect(new Set(bunches.map((b) => b.colour))).toEqual(new Set(['green', 'dark']));
    }
  });

  it('lays them where there is room: on the top, clear of the dishes, the plate, the mugs, the hands and each other', () => {
    all.forEach((bunches, i) => {
      const dishes = tableFood(i).map((d) => ({ x: d.x, z: d.z, r: TABLE_FOOD[d.kind].radius }));
      bunches.forEach((b, k) => {
        const others = [...dishes, ...bunches.filter((_, j) => j !== k).map((o) => ({ x: o.x, z: o.z, r: o.radius }))];
        expect(roomFor(i, b.x, b.z, b.radius, others), `table ${i} bunch ${k}`).toBe(true);
      });
    });
  });

  it('varies them: different sizes, and different places from table to table, the same every visit', () => {
    expect(new Set(all.flat().map((b) => b.berries.length)).size).toBeGreaterThan(1);
    expect(JSON.stringify(all[0].map((b) => [b.x, b.z]))).not.toBe(JSON.stringify(all[1].map((b) => [b.x, b.z])));
    expect(tableGrapes(0)).toEqual(all[0]);
  });

  it('keeps every berry inside its bunch, the bottom ones resting on the table', () => {
    for (const b of all.flat()) {
      for (const [x, y, z, r] of b.berries) {
        expect(Math.hypot(x, z) + r).toBeLessThanOrEqual(b.radius + 1e-9);
        expect(y).toBeGreaterThanOrEqual(r - 1e-9);
      }
      expect(b.berries.filter(([, y, , r]) => Math.abs(y - r) < 1e-9).length).toBeGreaterThan(5);
    }
  });

  it('makes small bunches and big ones', () => {
    const rand = () => 0.5;
    expect(grapeBerries(rand, 7).length).toBeGreaterThan(grapeBerries(rand, 3).length + 10);
    expect(bunchRadius(grapeBerries(rand, 7))).toBeGreaterThan(bunchRadius(grapeBerries(rand, 3)));
  });
});

describe('the plates', () => {
  /** A piece's four corners on the plate, from its footprint and turn (three.js: rotation.y = t lays x along (cos t, -sin t)). */
  const corners = (p: OnPlate) => {
    const { along, across } = BITES[p.kind];
    const ax = { x: Math.cos(p.turn), z: -Math.sin(p.turn) };
    const az = { x: Math.sin(p.turn), z: Math.cos(p.turn) };
    return [-1, 1].flatMap((i) => [-1, 1].map((j) => ({ x: p.x + ax.x * along * i + az.x * across * j, z: p.z + ax.z * along * i + az.z * across * j })));
  };

  it('has ham and cheese on every plate, and no two plates the same', () => {
    const plates = FEAST_TABLES.map((_, i) => plateFood(i));
    for (const p of plates) {
      expect(p.some((f) => f.kind === 'ham')).toBe(true);
      expect(p.some((f) => f.kind !== 'ham')).toBe(true);
    }
    expect(JSON.stringify(plates[0].map((f) => f.kind))).not.toBe(JSON.stringify(plates[1].map((f) => f.kind)));
  });

  it('keeps every piece in the well, each kind on its own half', () => {
    for (let i = 0; i < 6; i++) {
      for (const p of plateFood(i)) {
        const u = { x: Math.cos(p.side), z: Math.sin(p.side) };
        for (const c of corners(p)) {
          expect(Math.hypot(c.x, c.z), `plate ${i} ${p.kind}`).toBeLessThan(PLATE.well);
          expect(c.x * u.x + c.z * u.z, `plate ${i} ${p.kind} on its half`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('lays each slice of a fan on the one before', () => {
    for (let i = 0; i < 3; i++) {
      const p = plateFood(i);
      for (const kind of ['ham', 'cheeseSlice'] as const) {
        const fan = p.filter((f) => f.kind === kind);
        fan.forEach((f, k) => {
          expect(f.layer).toBe(k);
          if (k) expect(Math.hypot(f.x - fan[k - 1].x, f.z - fan[k - 1].z)).toBeLessThan(BITES[kind].along);
        });
      }
    }
  });
});
