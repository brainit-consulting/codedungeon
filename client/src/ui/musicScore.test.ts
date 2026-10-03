import { describe, expect, it } from 'vitest';
import { BARS, BEATS, LUTE_RANGE, PROGRESSION, SCALE, composePhrase } from './musicScore';

const inScale = (midi: number) => SCALE.includes(((midi % 12) + 12) % 12);

describe('the dungeon music score', () => {
  it('writes the same phrase from the same seed and index, and a different one for the next phrase', () => {
    expect(composePhrase(7, 3)).toEqual(composePhrase(7, 3));
    expect(composePhrase(7, 4)).not.toEqual(composePhrase(7, 3));
    expect(composePhrase(8, 3)).not.toEqual(composePhrase(7, 3));
  });

  it('keeps the lute in the key and in its range', () => {
    for (let i = 0; i < 30; i++) {
      for (const n of composePhrase(1, i).filter((n) => n.voice === 'lute')) {
        expect(inScale(n.midi)).toBe(true);
        expect(n.midi).toBeGreaterThanOrEqual(LUTE_RANGE[0]);
        expect(n.midi).toBeLessThanOrEqual(LUTE_RANGE[1]);
      }
    }
  });

  it('plays each bar of the progression on the pad, with the bass on its root', () => {
    const notes = composePhrase(2, 0);
    for (let bar = 0; bar < BARS; bar++) {
      const pad = notes.filter((n) => n.voice === 'pad' && n.beat === bar * BEATS).map((n) => n.midi);
      expect(pad.sort((a, b) => a - b)).toEqual([...PROGRESSION[bar]].sort((a, b) => a - b));
      const bass = notes.find((n) => n.voice === 'bass' && n.beat === bar * BEATS);
      expect(bass?.midi).toBe(PROGRESSION[bar][0] - 12);
    }
  });

  it('never lets a note run past the end of its phrase', () => {
    for (let i = 0; i < 30; i++) for (const n of composePhrase(3, i)) expect(n.beat + n.beats).toBeLessThanOrEqual(BARS * BEATS);
  });

  it('plays the lute one note at a time, with rests between phrases of it', () => {
    let sounding = 0;
    for (let i = 0; i < 30; i++) {
      const lute = composePhrase(4, i)
        .filter((n) => n.voice === 'lute')
        .sort((a, b) => a.beat - b.beat);
      for (let k = 1; k < lute.length; k++) expect(lute[k].beat).toBeGreaterThanOrEqual(lute[k - 1].beat + lute[k - 1].beats);
      sounding += lute.reduce((t, n) => t + n.beats, 0);
    }
    const share = sounding / (30 * BARS * BEATS);
    expect(share).toBeGreaterThan(0.3); // there is a tune
    expect(share).toBeLessThan(0.8); // but it breathes
  });

  it('rings a bell now and then, not every phrase', () => {
    const bells = Array.from({ length: 40 }, (_, i) => composePhrase(5, i).filter((n) => n.voice === 'bell').length);
    const withBell = bells.filter((b) => b > 0).length;
    expect(withBell).toBeGreaterThan(0);
    expect(withBell).toBeLessThan(20);
  });
});
