import { describe, expect, it } from 'vitest';
import { BOARD, SEGMENTS, bestRound, emptyRound, roundTotal, scoreAt, throwInto } from './dartboard';

// A point at radius r (m) in the middle of the segment showing `n`.
function at(n: number, r: number) {
  const k = SEGMENTS.indexOf(n);
  const a = (k * Math.PI * 2) / 20; // clockwise from straight up
  return { x: Math.sin(a) * r, y: Math.cos(a) * r };
}

describe('scoreAt', () => {
  it('scores the bull and the outer bull', () => {
    expect(scoreAt(0, 0)).toEqual({ points: 50, label: 'BULL' });
    expect(scoreAt(0.004, -0.003)).toEqual({ points: 50, label: 'BULL' });
    expect(scoreAt(0.01, 0)).toEqual({ points: 25, label: '25' });
  });

  it('scores singles, trebles and doubles in every segment', () => {
    for (const n of SEGMENTS) {
      const s = at(n, 0.06);
      expect(scoreAt(s.x, s.y)).toEqual({ points: n, label: String(n) });
      const t = at(n, 0.103);
      expect(scoreAt(t.x, t.y)).toEqual({ points: n * 3, label: `T${n}` });
      const o = at(n, 0.13);
      expect(scoreAt(o.x, o.y)).toEqual({ points: n, label: String(n) });
      const d = at(n, 0.166);
      expect(scoreAt(d.x, d.y)).toEqual({ points: n * 2, label: `D${n}` });
    }
  });

  it('puts 20 at the top, 6 on the right, 3 at the bottom and 11 on the left', () => {
    expect(scoreAt(0, 0.06).points).toBe(20);
    expect(scoreAt(0.06, 0).points).toBe(6);
    expect(scoreAt(0, -0.06).points).toBe(3);
    expect(scoreAt(-0.06, 0).points).toBe(11);
  });

  it('splits segments on their boundaries: just clockwise of the 20/1 line is a 1', () => {
    const half = Math.PI / 20;
    expect(scoreAt(Math.sin(half - 0.01) * 0.06, Math.cos(half - 0.01) * 0.06).points).toBe(20);
    expect(scoreAt(Math.sin(half + 0.01) * 0.06, Math.cos(half + 0.01) * 0.06).points).toBe(1);
  });

  it('misses outside the double ring', () => {
    expect(scoreAt(0, BOARD.double[1] + 0.002)).toEqual({ points: 0, label: 'MISS' });
    expect(scoreAt(0.2, 0.1)).toEqual({ points: 0, label: 'MISS' });
  });
});

describe('the round tally', () => {
  it('adds up to three throws and then starts a new round', () => {
    let r = emptyRound();
    r = throwInto(r, { points: 60, label: 'T20' });
    r = throwInto(r, { points: 0, label: 'MISS' });
    r = throwInto(r, { points: 25, label: '25' });
    expect(r.throws.map((t) => t.label)).toEqual(['T20', 'MISS', '25']);
    expect(roundTotal(r)).toBe(85);
    r = throwInto(r, { points: 1, label: '1' });
    expect(r.throws.map((t) => t.label)).toEqual(['1']);
  });

  it('keeps the best finished round', () => {
    const full = (pts: number[]) => pts.reduce((r, p) => throwInto(r, { points: p, label: String(p) }), emptyRound());
    expect(bestRound(0, full([20, 20, 20]))).toBe(60);
    expect(bestRound(100, full([20, 20, 20]))).toBe(100);
    expect(bestRound(10, full([60, 60]))).toBe(10); // unfinished rounds don't count
  });
});
