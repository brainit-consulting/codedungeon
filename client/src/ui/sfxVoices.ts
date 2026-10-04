// The dungeon's sound recipes as plain data: struck bells and a bronze gong, built from sine partials and
// filtered noise. sfx.ts plays them through its tone() and noise(); keeping them pure lets tests check
// their partials, levels and lengths without an AudioContext.

import type { Cue, NoiseOpts, ToneOpts } from './sfx';

export type Voice = ({ kind: 'tone' } & ToneOpts) | ({ kind: 'noise' } & NoiseOpts);

/** One partial of a struck bell: frequency ratio to the strike note, share of the peak, share of the ring time. */
export interface BellPartial {
  ratio: number;
  gain: number;
  ring: number;
}

/**
 * A small handbell. Its partials are inharmonic (1 : 2.756 : 5.404 : 8.933, the modes of a struck bar),
 * which is what makes it a bell and not a beep. The near-unison partner beats slowly against the
 * fundamental, as a real casting does. Higher partials are quieter and die sooner.
 */
export const HANDBELL: BellPartial[] = [
  { ratio: 1, gain: 0.55, ring: 1 },
  { ratio: 1.004, gain: 0.4, ring: 0.9 },
  { ratio: 2.756, gain: 0.35, ring: 0.55 },
  { ratio: 5.404, gain: 0.16, ring: 0.3 },
  { ratio: 8.933, gain: 0.06, ring: 0.16 },
];

/** A tower bell, minor-third tuned: hum (an octave down), prime, tierce (the minor third), quint, nominal. */
export const TOWER_BELL: BellPartial[] = [
  { ratio: 0.5, gain: 0.5, ring: 1 },
  { ratio: 1, gain: 0.45, ring: 0.75 },
  { ratio: 1.2, gain: 0.35, ring: 0.65 },
  { ratio: 1.5, gain: 0.12, ring: 0.45 },
  { ratio: 2, gain: 0.25, ring: 0.4 },
  { ratio: 2.5, gain: 0.06, ring: 0.25 },
];

/** A small, heavy bronze gong struck with a padded beater: low, inharmonic and quickly damped. */
export const GONG: BellPartial[] = [
  { ratio: 1, gain: 0.5, ring: 1 },
  { ratio: 1.52, gain: 0.4, ring: 0.8 },
  { ratio: 2.11, gain: 0.3, ring: 0.6 },
  { ratio: 2.74, gain: 0.18, ring: 0.45 },
  { ratio: 3.39, gain: 0.1, ring: 0.3 },
];

/** Nothing is synthesised above this: it keeps every partial well under Nyquist at 44.1 kHz. */
export const MAX_FREQ = 12000;

interface Strike {
  at?: number;
  /** Seconds the fundamental rings for (to 0.0001, i.e. -80 dB from 1). */
  ring: number;
  /** Peak of a partial with gain 1, before the master volume. */
  peak: number;
}

/** One strike of a bell: a sine per partial, each decaying exponentially, plus a short tick of the clapper. */
export function bell(partials: BellPartial[], freq: number, { at = 0, ring, peak }: Strike): Voice[] {
  const voices: Voice[] = partials
    .filter((p) => freq * p.ratio <= MAX_FREQ)
    .map((p) => ({ kind: 'tone', freq: freq * p.ratio, type: 'sine', at, dur: ring * p.ring, peak: peak * p.gain, attack: 0.003 }));
  voices.push({ kind: 'noise', at, dur: 0.025, peak: peak * 0.25, filter: 'bandpass', freq: Math.min(freq * 3, 6000), q: 1.5, attack: 0.001 });
  return voices;
}

export type Sound = 'message' | Cue;

/** What each sound plays. Levels are set so none peaks above the office sound it replaced. */
export const SOUNDS: Record<Sound, () => Voice[]> = {
  // A DungeonMaster message: a small handbell shaken once, ting-ting.
  message: () => [...bell(HANDBELL, 1174.7, { ring: 0.7, peak: 0.05 }), ...bell(HANDBELL, 1174.7, { at: 0.16, ring: 0.6, peak: 0.03 })],
  // An agent hit an error: one dull stroke on a low bronze gong.
  error: () => [
    ...bell(GONG, 146.8, { ring: 0.75, peak: 0.016 }),
    { kind: 'noise', dur: 0.06, peak: 0.02, filter: 'lowpass', freq: 500, q: 0.7, attack: 0.002 },
  ],
  // QA failed a PR: a tower bell tolls twice, falling.
  qaFailed: () => [...bell(TOWER_BELL, 392, { ring: 0.85, peak: 0.07 }), ...bell(TOWER_BELL, 329.6, { at: 0.4, ring: 0.95, peak: 0.07 })],
  // A PR passed QA and is ready to merge: three small handbells rung upward.
  ready: () => [784, 987.8, 1174.7].flatMap((f, i) => bell(HANDBELL, f, { at: i * 0.11, ring: 0.75, peak: 0.045 })),
  // A PR was merged: two larger bells a fifth apart, the second left to ring.
  merged: () => [
    ...bell(HANDBELL, 523.3, { ring: 0.7, peak: 0.045 }),
    ...bell(HANDBELL, 784, { at: 0.18, ring: 1, peak: 0.045 }),
    { kind: 'tone', freq: 392, type: 'sine', at: 0.18, dur: 0.9, peak: 0.015, attack: 0.01 },
  ],
  // A new recruit arrived: the gate bell, struck twice.
  welcome: () => [...bell(HANDBELL, 587.3, { ring: 0.7, peak: 0.05 }), ...bell(HANDBELL, 587.3, { at: 0.3, ring: 0.9, peak: 0.045 })],
};

/** When a recipe's last voice has fully died away, in seconds from the start. */
export const lengthOf = (voices: Voice[]) => Math.max(...voices.map((v) => (v.at ?? 0) + v.dur));
