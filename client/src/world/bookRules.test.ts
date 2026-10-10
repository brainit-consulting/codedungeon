import { describe, expect, it } from 'vitest';
import { LIBRARY, shelfRow } from './bookRules';

describe('LIBRARY', () => {
  it('has the classics and a couple of the dungeon\'s own, each with a line to read', () => {
    expect(LIBRARY.length).toBeGreaterThanOrEqual(24);
    expect(LIBRARY.filter((b) => b.dungeon).length).toBe(2);
    for (const b of LIBRARY) {
      expect(b.title, b.id).toBeTruthy();
      expect(b.by, b.id).toBeTruthy();
      expect(b.about.length, b.id).toBeGreaterThan(20);
      expect(b.about.length, b.id).toBeLessThan(260);
    }
    expect(new Set(LIBRARY.map((b) => b.id)).size).toBe(LIBRARY.length);
  });
});

describe('shelfRow', () => {
  const width = 1.24;
  const clear = 0.3;
  const rows = Array.from({ length: 40 }, (_, seed) => shelfRow(seed, width, clear, seed * 5));

  it('keeps every book inside the shelf, under the board above, and clear of its neighbours', () => {
    for (const row of rows) {
      // what stands on the board itself (a pile's upper books lie on the one below)
      const spans = row.filter((b) => b.y === 0).map((b) => [b.x - b.footprint / 2, b.x + b.footprint / 2] as const).sort((a, b) => a[0] - b[0]);
      for (const [a, z] of spans) {
        expect(a).toBeGreaterThanOrEqual(-width / 2 - 1e-9);
        expect(z).toBeLessThanOrEqual(width / 2 + 1e-9);
      }
      for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1] - 1e-9);
      for (const b of row) expect(b.top).toBeLessThanOrEqual(clear - 0.02);
    }
  });

  it('fills most of the shelf, with a few titled books to read and plain ones between', () => {
    for (const row of rows) {
      const used = row.reduce((s, b) => s + b.footprint, 0);
      expect(used / width).toBeGreaterThan(0.6);
      const titled = row.filter((b) => b.book);
      expect(titled.length).toBeGreaterThanOrEqual(3);
      expect(titled.length).toBeLessThan(row.length);
    }
  });

  it('is the same every time for the same shelf, and different shelves differ', () => {
    expect(shelfRow(7, width, clear, 3)).toEqual(shelfRow(7, width, clear, 3));
    expect(JSON.stringify(shelfRow(7, width, clear, 3))).not.toEqual(JSON.stringify(shelfRow(8, width, clear, 3)));
  });

  it('works through the library from the offset it is given, so shelves side by side show different titles', () => {
    const a = shelfRow(1, width, clear, 0).flatMap((b) => (b.book ? [b.book.id] : []));
    const b = shelfRow(2, width, clear, a.length).flatMap((x) => (x.book ? [x.book.id] : []));
    expect(a.some((id) => b.includes(id))).toBe(false);
  });
});
