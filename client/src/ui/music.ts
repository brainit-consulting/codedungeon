// Plays the dungeon's background music (ui/musicScore.ts) with WebAudio, through the office's master volume, so M
// silences it with everything else. It has its own level and on/off (the help's Sound row, or N). Notes are queued a
// phrase at a time a couple of seconds ahead; a stone-room echo sits over all of it. No audio files.

import { BARS, BEATS, TEMPO, composePhrase, type Note } from './musicScore';
import { audio, getAudioPrefs, subscribeAudio } from './sfx';

const SPB = 60 / TEMPO;
export const PHRASE_SECONDS = BARS * BEATS * SPB;
const LOOKAHEAD = 2.5;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** The music's gain for a 0-100 setting. Measured offline: at 100 the band peaks at 0.73 (RMS 0.09), under clipping. */
export const musicLevel = (pct: number) => 3 * (pct / 100) ** 1.5;

let echoIr: AudioBuffer | null = null;

/** A stone room's echo: three seconds of decaying noise, a little different in each ear. Built once. */
function stoneEcho(ctx: BaseAudioContext) {
  if (!echoIr || echoIr.sampleRate !== ctx.sampleRate) {
    const len = Math.floor(ctx.sampleRate * 3.2);
    echoIr = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = echoIr.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = echoIr;
  return conv;
}

export interface Band {
  bus: GainNode;
  /** Queue one phrase to start at time `t0` (context seconds). */
  play(notes: Note[], t0: number): void;
  /** Stop every note queued or sounding, at context time `at`. */
  silence(at: number): void;
  /** How many notes are queued or sounding. */
  readonly sounding: number;
}

/** The instruments, wired to `out`: pad, bass, lute and bell, dry and through the echo, into one bus. */
export function createBand(ctx: BaseAudioContext, out: AudioNode, level: number): Band {
  const bus = ctx.createGain();
  bus.gain.value = level;
  bus.connect(out);
  const dry = ctx.createGain();
  dry.gain.value = 0.7;
  dry.connect(bus);
  const echo = stoneEcho(ctx);
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  echo.connect(wet).connect(bus);
  const input = ctx.createGain();
  input.connect(dry);
  input.connect(echo);

  const env = (t0: number, attack: number, peak: number, hold: number, release: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.setValueAtTime(peak, t0 + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack, hold) + release);
    return { g, end: t0 + Math.max(attack, hold) + release + 0.05 };
  };
  const live = new Set<OscillatorNode>();
  const osc = (type: OscillatorType, freq: number, detune: number, into: AudioNode, t0: number, end: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(into);
    o.start(t0);
    o.stop(end);
    live.add(o);
    o.onended = () => live.delete(o);
  };

  const voices: Record<Note['voice'], (n: Note, t0: number) => void> = {
    // a soft bowed chord: two detuned saws through a dark filter, swelling in and out
    pad(n, t0) {
      const { g, end } = env(t0, 1.4, 0.03 * n.vel, n.beats * SPB - 0.4, 1.8);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 700;
      f.connect(g).connect(input);
      osc('sawtooth', hz(n.midi), -7, f, t0, end);
      osc('sawtooth', hz(n.midi), 7, f, t0, end);
    },
    // a low string, plucked and left to ring
    bass(n, t0) {
      const { g, end } = env(t0, 0.04, 0.16 * n.vel, 0.1, n.beats * SPB + 0.8);
      g.connect(input);
      osc('sine', hz(n.midi), 0, g, t0, end);
      osc('triangle', hz(n.midi), 0, g, t0, end);
    },
    // the lute: a bright pluck that darkens as it dies away
    lute(n, t0) {
      const { g, end } = env(t0, 0.006, 0.11 * n.vel, 0.02, Math.min(n.beats * SPB + 0.5, 2.6));
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(3200, t0);
      f.frequency.exponentialRampToValueAtTime(700, t0 + 0.8);
      f.connect(g).connect(input);
      osc('triangle', hz(n.midi), 0, f, t0, end);
      osc('sawtooth', hz(n.midi) * 2, 3, f, t0, t0 + 0.3);
    },
    // a far-off bell: a few out-of-tune partials, long and quiet
    bell(n, t0) {
      for (const [ratio, peak] of [
        [1, 0.035],
        [2.76, 0.015],
        [5.4, 0.007],
      ] as const) {
        const { g, end } = env(t0, 0.01, peak * n.vel, 0.01, n.beats * SPB / ratio + 1);
        g.connect(input);
        osc('sine', hz(n.midi) * ratio, 0, g, t0, end);
      }
    },
  };

  return {
    bus,
    play(notes, t0) {
      for (const n of notes) voices[n.voice](n, t0 + n.beat * SPB);
    },
    silence(at) {
      for (const o of live) {
        try {
          o.stop(at); // a note not yet started never starts
        } catch {
          // already stopped
        }
      }
    },
    get sounding() {
      return live.size;
    },
  };
}

// ---------- the live player ----------

const SEED = Math.floor(Math.random() * 1e9); // a different tune each visit
let band: Band | null = null;
let phrase = 0;
let nextAt = 0;
let started = false;

function stop() {
  const a = audio();
  const old = band;
  band = null;
  if (!old) return;
  if (a) {
    old.bus.gain.setTargetAtTime(0, a.ctx.currentTime, 0.3);
    old.silence(a.ctx.currentTime + 1.5); // after the fade; queued notes are dropped
  }
  setTimeout(() => old.bus.disconnect(), 2000);
}

function tick() {
  const p = getAudioPrefs();
  const a = audio();
  if (!a || p.muted || !p.musicOn || p.music === 0) {
    stop();
    return;
  }
  if (!band) {
    band = createBand(a.ctx, a.out, 0);
    band.bus.gain.setTargetAtTime(musicLevel(p.music), a.ctx.currentTime, 1.5); // fade in
    nextAt = a.ctx.currentTime + 0.5;
  }
  nextAt = Math.max(nextAt, a.ctx.currentTime + 0.05); // a stalled page skips what it missed instead of playing it all at once
  while (nextAt < a.ctx.currentTime + LOOKAHEAD) {
    band.play(composePhrase(SEED, phrase++), nextAt);
    nextAt += PHRASE_SECONDS;
  }
}

/** Start the music (it waits for the first click or key, like every sound). Safe to call more than once. */
export function startMusic() {
  if (started || typeof window === 'undefined') return;
  started = true;
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__music = () => ({ playing: !!band, sounding: band?.sounding ?? 0 });
  setInterval(tick, 250);
  subscribeAudio(() => {
    const a = audio();
    if (band && a) band.bus.gain.setTargetAtTime(musicLevel(getAudioPrefs().music), a.ctx.currentTime, 0.1);
    tick();
  });
}
