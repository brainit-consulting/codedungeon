// The dungeon's background music, as notes: a slow four-bar round in D minor (Dm, C, Bb, Am) on a pad, the bass on
// each chord's root, a sparse lute tune over it, and now and then a far-off bell. Written a phrase at a time from a
// seed, so it never quite repeats but the same phrase always comes out the same (and can be tested). ui/music.ts plays it.

export type Voice = 'pad' | 'bass' | 'lute' | 'bell';

export interface Note {
  beat: number; // from the start of the phrase
  beats: number;
  midi: number;
  voice: Voice;
  vel: number; // 0-1
}

export const BEATS = 4; // per bar
export const BARS = 4; // per phrase
export const TEMPO = 62; // beats per minute

/** D natural minor, as pitch classes. */
export const SCALE = [2, 4, 5, 7, 9, 10, 0];
/** The chords, low voicing (root first): Dm, C, Bb, Am. */
export const PROGRESSION: number[][] = [
  [50, 53, 57],
  [48, 52, 55],
  [46, 50, 53],
  [45, 48, 52],
];
export const LUTE_RANGE: [number, number] = [57, 74]; // A3 to D5

// one bar of lute rhythm each; 0 is a rest of one beat
const RHYTHMS = [
  [2, 1, 1],
  [1, 1, 2],
  [3, 1],
  [4],
  [1, 1, 1, 1],
  [0, 1, 1, 1],
  [2, 0, 1],
  [0, 0, 2],
  [0, 0, 0, 0],
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every note of the scale within the lute's range, low to high. */
const LUTE_NOTES = (() => {
  const out: number[] = [];
  for (let m = LUTE_RANGE[0]; m <= LUTE_RANGE[1]; m++) if (SCALE.includes(m % 12)) out.push(m);
  return out;
})();

/** The nearest lute note that belongs to the chord, to land on at the start of a bar. */
function chordTone(chord: number[], near: number) {
  const pcs = chord.map((m) => m % 12);
  let best = 0;
  for (let i = 0; i < LUTE_NOTES.length; i++) {
    if (!pcs.includes(LUTE_NOTES[i] % 12)) continue;
    if (Math.abs(i - near) < Math.abs(best - near) || !pcs.includes(LUTE_NOTES[best] % 12)) best = i;
  }
  return best;
}

export function composePhrase(seed: number, index: number): Note[] {
  const rnd = mulberry32(Math.imul(seed, 7919) + index * 104729 + 17);
  const notes: Note[] = [];
  let at = Math.floor(rnd() * LUTE_NOTES.length);
  // some phrases the lute sits out a bar or two, so the tune comes and goes
  const quiet = rnd() < 0.35 ? Math.floor(rnd() * BARS) : -1;
  for (let bar = 0; bar < BARS; bar++) {
    const chord = PROGRESSION[bar];
    const start = bar * BEATS;
    for (const midi of chord) notes.push({ beat: start, beats: BEATS, midi, voice: 'pad', vel: 0.5 });
    notes.push({ beat: start, beats: 2, midi: chord[0] - 12, voice: 'bass', vel: 0.8 });
    if (bar === quiet) continue;
    const rhythm = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)];
    let beat = start;
    rhythm.forEach((len, k) => {
      if (len === 0) {
        beat += 1;
        return;
      }
      if (k === 0) at = chordTone(chord, at);
      else at = Math.max(0, Math.min(LUTE_NOTES.length - 1, at + Math.floor(rnd() * 5) - 2));
      notes.push({ beat, beats: len, midi: LUTE_NOTES[at], voice: 'lute', vel: 0.55 + rnd() * 0.3 });
      beat += len;
    });
  }
  if (rnd() < 0.25) notes.push({ beat: 2 + Math.floor(rnd() * 3) * 4, beats: 6, midi: rnd() < 0.5 ? 74 : 81, voice: 'bell', vel: 0.5 });
  return notes;
}
