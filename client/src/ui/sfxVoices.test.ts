import { describe, expect, it } from 'vitest';
import { bell, GONG, HANDBELL, lengthOf, MAX_FREQ, SOUNDS, TOWER_BELL, type Sound } from './sfxVoices';

const names = Object.keys(SOUNDS) as Sound[];

describe('bell partials', () => {
  it('rings a handbell on the inharmonic modes of a struck bar', () => {
    const ratios = HANDBELL.map((p) => p.ratio);
    expect(ratios).toContain(1);
    expect(ratios.some((r) => Math.abs(r - 2.76) < 0.01)).toBe(true);
    expect(ratios.some((r) => Math.abs(r - 5.4) < 0.01)).toBe(true);
    // The two loudest overtones sit well away from whole-number harmonics (8.933, quiet and short, lands near 9).
    for (const r of ratios.filter((x) => x > 1.1 && x < 8)) expect(Math.abs(r - Math.round(r))).toBeGreaterThan(0.2);
  });

  it('tunes the tower bell to a minor third (the tierce) with its hum an octave down', () => {
    const ratios = TOWER_BELL.map((p) => p.ratio);
    expect(ratios).toEqual(expect.arrayContaining([0.5, 1, 1.2, 2]));
  });

  it.each([
    ['handbell', HANDBELL.slice(1)],
    ['tower bell', TOWER_BELL.slice(1)],
    ['gong', GONG],
  ])('makes each higher %s partial die no later than the one below it', (_name, partials) => {
    for (let i = 1; i < partials.length; i++) expect(partials[i].ring).toBeLessThanOrEqual(partials[i - 1].ring);
  });

  it('decays every partial exponentially from a fast strike', () => {
    for (const v of bell(HANDBELL, 880, { ring: 1, peak: 0.1 })) {
      expect(v.attack).toBeLessThanOrEqual(0.003);
      expect(v.dur).toBeGreaterThan(0);
    }
  });

  it('drops partials that would go above MAX_FREQ', () => {
    const tones = bell(HANDBELL, 2000, { ring: 1, peak: 0.1 }).filter((v) => v.kind === 'tone');
    expect(tones.every((v) => v.freq <= MAX_FREQ)).toBe(true);
    expect(tones.length).toBe(HANDBELL.length - 1);
  });
});

describe('the dungeon sounds', () => {
  it.each(names)('%s uses only sines and filtered noise (no buzzy square or sawtooth waves)', (name) => {
    for (const v of SOUNDS[name]()) if (v.kind === 'tone') expect(v.type ?? 'sine').toBe('sine');
  });

  it.each(names)('%s stays under Nyquist and is short', (name) => {
    const voices = SOUNDS[name]();
    expect(voices.every((v) => v.freq <= MAX_FREQ)).toBe(true);
    expect(lengthOf(voices)).toBeLessThanOrEqual(1.5);
  });

  // The sum of the sine peaks bounds the tones' combined amplitude. Measured in a browser's
  // OfflineAudioContext, each replaced office sound peaked between 0.03 and 0.12 at full volume.
  it.each(names)('%s keeps its summed tone peaks gentle', (name) => {
    const sum = SOUNDS[name]()
      .filter((v) => v.kind === 'tone')
      .reduce((s, v) => s + v.peak, 0);
    expect(sum).toBeLessThanOrEqual(name === 'error' ? 0.04 : 0.25);
  });
});
