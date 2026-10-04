// Every sound in the dungeon, synthesized with WebAudio (no audio files); the bell and gong recipes are in
// sfxVoices.ts. One shared AudioContext feeds a master gain, so volume and mute apply to everything at once.
// Audio is optional: when it's blocked or unavailable (headless browsers), sounds just don't play.

import { SOUNDS, type Voice } from './sfxVoices';

export interface AudioPrefs {
  volume: number; // 0-100
  muted: boolean;
  music: number; // 0-100, the background music's share (under the master volume)
  musicOn: boolean;
}

const PREFS_KEY = 'cubefarm:audio';

const pct = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback;
};

function loadPrefs(): AudioPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<AudioPrefs> | null;
    return { volume: pct(p?.volume, 70), muted: p?.muted === true, music: pct(p?.music, 50), musicOn: p?.musicOn !== false };
  } catch {
    return { volume: 70, muted: false, music: 50, musicOn: true };
  }
}

let prefs = loadPrefs();
const listeners = new Set<() => void>();

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;

// Perceived loudness is roughly logarithmic, so the slider maps to a squared gain.
const masterLevel = () => (prefs.muted ? 0 : (prefs.volume / 100) ** 2);

/** The shared context and master gain, or null until the first user gesture / when audio is unavailable. */
export function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!unlocked) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = masterLevel();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    // Don't queue sounds on a stopped clock: they'd all fire at once when it starts.
    return ctx.state === 'running' && master ? { ctx, out: master } : null;
  } catch {
    return null;
  }
}

/** Start audio from a user gesture ("Enter the office", or any first click/key). */
export function unlockAudio() {
  unlocked = true;
  audio();
}

if (typeof window !== 'undefined') for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, unlockAudio, { once: true, capture: true });

// ---------- volume & mute ----------

export const getAudioPrefs = () => prefs;

export function subscribeAudio(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

export function setAudioPrefs(patch: Partial<AudioPrefs>) {
  prefs = { ...prefs, ...patch, volume: pct(patch.volume ?? prefs.volume, prefs.volume), music: pct(patch.music ?? prefs.music, prefs.music) };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // storage may be unavailable (private mode); the setting just won't be remembered
  }
  if (ctx && master) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.015);
    } catch {
      // audio is optional
    }
  }
  for (const fn of listeners) fn();
}

export const toggleMute = () => setAudioPrefs({ muted: !prefs.muted });
export const toggleMusic = () => setAudioPrefs({ musicOn: !prefs.musicOn });

// ---------- building blocks (exported so toys can add their sounds through the same mixer) ----------

export interface ToneOpts {
  freq: number;
  to?: number; // glide to this frequency by the end
  type?: OscillatorType;
  at?: number; // seconds from now
  dur: number;
  peak: number; // 0-1, before the master volume
  attack?: number;
}

/** One enveloped oscillator note. */
export function tone({ freq, to, type = 'sine', at = 0, dur, peak, attack = 0.015 }: ToneOpts) {
  const a = audio();
  if (!a) return;
  try {
    const t0 = a.ctx.currentTime + at;
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch {
    // audio is optional
  }
}

export interface NoiseOpts {
  at?: number;
  dur: number;
  peak: number;
  filter?: BiquadFilterType;
  freq: number; // filter frequency
  to?: number; // sweep the filter to this frequency by the end
  q?: number;
  attack?: number;
}

let noiseBuf: AudioBuffer | null = null;

/** A burst of filtered white noise: footsteps, whooshes, pops. */
export function noise({ at = 0, dur, peak, filter = 'lowpass', freq, to, q = 1, attack = 0.005 }: NoiseOpts) {
  const a = audio();
  if (!a) return;
  try {
    if (!noiseBuf || noiseBuf.sampleRate !== a.ctx.sampleRate) {
      noiseBuf = a.ctx.createBuffer(1, a.ctx.sampleRate * 2, a.ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const t0 = a.ctx.currentTime + at;
    const src = a.ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bq = a.ctx.createBiquadFilter();
    bq.type = filter;
    bq.Q.value = q;
    bq.frequency.setValueAtTime(freq, t0);
    if (to) bq.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = a.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bq).connect(gain).connect(a.out);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  } catch {
    // audio is optional
  }
}

// ---------- the dungeon's sounds ----------

const play = (voices: Voice[]) => voices.forEach((v) => (v.kind === 'tone' ? tone(v) : noise(v)));

let lastChirp = -Infinity;

/** A DungeonMaster message: a small handbell, ting-ting (messages that arrive together ring it once). */
export function chirp() {
  if (performance.now() - lastChirp < 800) return;
  lastChirp = performance.now();
  play(SOUNDS.message());
}

/** One soft footstep: a muffled thud. */
export function footstep(running = false) {
  noise({ dur: running ? 0.09 : 0.12, peak: running ? 0.07 : 0.045, freq: (running ? 700 : 480) * (0.9 + Math.random() * 0.2), q: 0.7 });
}

let stepCount = 0;

/**
 * Called every frame with the head-bob phase: one step each half bob cycle (so the step rate follows
 * the bob and speeds up when running), and none while standing still.
 */
export function footstepsFollow(bobPhase: number, moving: boolean, running: boolean) {
  const n = Math.floor(bobPhase / Math.PI);
  if (moving && n !== stepCount) footstep(running);
  stepCount = n;
}

// ---------- event cues ----------

export type Cue = 'error' | 'qaFailed' | 'ready' | 'merged' | 'welcome';

// What each cue sounds like is in sfxVoices.ts (SOUNDS); the rank decides which one wins a burst.
const CUES: Record<Cue, { rank: number; play: () => void }> = {
  error: { rank: 5, play: () => play(SOUNDS.error()) },
  qaFailed: { rank: 4, play: () => play(SOUNDS.qaFailed()) },
  ready: { rank: 3, play: () => play(SOUNDS.ready()) },
  merged: { rank: 2, play: () => play(SOUNDS.merged()) },
  welcome: { rank: 1, play: () => play(SOUNDS.welcome()) },
};

const GATHER_MS = 150; // cues that arrive together are gathered, and only the most important plays
const GAP_MS = 1000; // at most one cue a second
let pending: Cue | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let lastRank = 0;
let lastAt = -Infinity;

const better = (a: Cue | null, b: Cue) => (a && CUES[a].rank >= CUES[b].rank ? a : b);

/** Play an event cue, rate-limited: bursts collapse into their most important cue. */
export function cue(c: Cue) {
  const now = performance.now();
  // Inside the gap after a cue, only something more important than what just played gets through.
  if (now - lastAt < GAP_MS && CUES[c].rank <= lastRank && !pending) return;
  pending = better(pending, c);
  if (timer) return;
  timer = setTimeout(flush, Math.max(GATHER_MS, lastAt + GAP_MS - now));
}

function flush() {
  timer = null;
  const c = pending;
  pending = null;
  if (!c) return;
  lastAt = performance.now();
  lastRank = CUES[c].rank;
  CUES[c].play();
}
