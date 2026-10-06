// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { INKPOT, LINES, PAGE, PAGE_S, inkDrawn, pageInk, pageLayout, pageTop, penAt } from './quillRules';

const FRAME = 1 / 60;

describe('the quill on the page', () => {
  it('writes inside the right-hand page, nib down on it, and lifts it between words and lines', () => {
    let lifted = 0;
    let wrote = 0;
    for (let t = 0; t < 200; t += 0.05) {
      const p = penAt(t, 0);
      if (p.dipping || p.turn) continue;
      expect(p.x).toBeGreaterThanOrEqual(PAGE.minX - 0.005);
      expect(p.x).toBeLessThanOrEqual(PAGE.maxX + 0.005);
      expect(p.z).toBeGreaterThanOrEqual(PAGE.minZ - 0.01);
      expect(p.z).toBeLessThanOrEqual(PAGE.maxZ + 0.005);
      if (p.writing) {
        wrote++;
        expect(p.y).toBeCloseTo(pageTop(p.x), 6);
      } else {
        lifted++;
        expect(p.y).toBeGreaterThan(pageTop(p.x));
      }
    }
    expect(wrote).toBeGreaterThan(lifted * 2);
    expect(lifted).toBeGreaterThan(0);
  });

  it('writes in small loops, as a hand does, not in a straight line', () => {
    const zs: number[] = [];
    for (let t = 0; t < 30; t += FRAME) {
      const p = penAt(t, 0);
      if (p.writing) zs.push(p.z);
    }
    // within one line, the nib goes up and down a few millimetres, over and over
    let turns = 0;
    for (let i = 2; i < zs.length; i++) if ((zs[i] - zs[i - 1]) * (zs[i - 1] - zs[i - 2]) < 0) turns++;
    expect(turns).toBeGreaterThan(zs.length / 20);
  });

  it('lays a page out like code: lines at different indents, short and long, some left blank', () => {
    const indents = new Set<number>();
    const lengths: number[] = [];
    let blank = 0;
    for (let page = 0; page < 20; page++) {
      const lines = pageLayout(page, 7);
      expect(lines).toHaveLength(LINES);
      expect(lines[0].words.length).toBeGreaterThan(0);
      for (const l of lines) {
        if (!l.words.length) {
          blank++;
          continue;
        }
        indents.add(Math.round((l.words[0].from - PAGE.minX) * 1000));
        lengths.push(l.words[l.words.length - 1].to - l.words[0].from);
        for (const w of l.words) {
          expect(w.to).toBeGreaterThan(w.from);
          expect(w.from).toBeGreaterThanOrEqual(PAGE.minX);
          expect(w.to).toBeLessThanOrEqual(PAGE.maxX);
        }
      }
    }
    expect(indents.size).toBeGreaterThanOrEqual(3);
    expect(Math.min(...lengths)).toBeLessThan(0.04);
    expect(Math.max(...lengths)).toBeGreaterThan(0.14);
    expect(blank).toBeGreaterThan(3);
  });

  it('fills a page in PAGE_S seconds, dips the nib twice on the way, and turns the page', () => {
    const at = (p: ReturnType<typeof penAt>) => Math.hypot(p.x - INKPOT.x, p.z - INKPOT.z) < 0.01 && p.y < INKPOT.top;
    let dips = 0;
    let wasIn = false;
    let turned = false;
    for (let t = 0; t < PAGE_S; t += FRAME) {
      const p = penAt(t, 0);
      if (at(p) && !wasIn) dips++;
      wasIn = at(p);
      turned ||= p.turning > 0.5;
    }
    expect(dips).toBe(2);
    expect(turned).toBe(true);
    expect(penAt(PAGE_S * 3 + 0.01, 0).page).toBe(penAt(0.01, 0).page + 3);
  });

  it('moves smoothly: no jump of more than a couple of centimetres between frames', () => {
    let prev = penAt(0, 3);
    for (let t = FRAME; t < 200; t += FRAME) {
      const p = penAt(t, 3);
      expect(Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z)).toBeLessThan(0.02);
      prev = p;
    }
  });

  it("writes at each coder's own pace, on pages of their own", () => {
    expect(JSON.stringify(penAt(10, 1))).not.toBe(JSON.stringify(penAt(10, 2)));
    expect(JSON.stringify(pageLayout(0, 1))).not.toBe(JSON.stringify(pageLayout(0, 2)));
  });
});

describe('the ink', () => {
  it('ends right under the nib while it writes', () => {
    const seed = 5;
    let checked = 0;
    let ink = pageInk(0, seed);
    for (let t = 0; t < 120; t += 0.07) {
      const p = penAt(t, seed);
      if (ink.page !== p.page) ink = pageInk(p.page, seed);
      // (in a word's first stroke, the last ink is still the word before's end)
      if (!p.writing || p.s < 0.001) continue;
      const n = inkDrawn(ink, p);
      expect(n % 2).toBe(0); // whole strokes
      if (n === 0) continue;
      const k = (n - 1) * 3;
      const end = {
        x: ink.positions[k],
        y: ink.positions[k + 1],
        z: ink.positions[k + 2],
      };
      expect(Math.hypot(end.x - p.x, end.z - p.z)).toBeLessThan(0.0015);
      expect(end.y).toBeGreaterThan(p.y);
      expect(end.y - p.y).toBeLessThan(0.002);
      checked++;
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('only grows while a page is written, and the next page starts clean', () => {
    const seed = 9;
    let ink = pageInk(0, seed);
    let was = 0;
    let page = 0;
    for (let t = 0; t < PAGE_S * 2.5; t += FRAME) {
      const p = penAt(t, seed);
      if (p.page !== page) {
        page = p.page;
        ink = pageInk(page, seed);
        was = 0;
      }
      const n = inkDrawn(ink, p);
      expect(n).toBeGreaterThanOrEqual(was);
      was = n;
    }
    expect(was).toBeLessThan(ink.positions.length / 3);
    // a page written to the end shows all its ink
    expect(
      inkDrawn(ink, {
        ...penAt(0, seed),
        page: ink.page,
        line: LINES,
        word: 0,
        s: 0,
      }),
    ).toBe(ink.positions.length / 3);
  });
});
