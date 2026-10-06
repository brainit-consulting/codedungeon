import { create } from 'zustand';

// Mouse look: filtering of pointer-lock deltas and the viewer's look preferences.
//
// Chromium on Windows sometimes reports huge bogus movementX/Y under pointer lock (right after
// the lock is taken, with high-DPI or high-polling mice, and when a busy page coalesces events).
// One 600 px spike is past the pitch clamp and snaps the view straight up or down, so every
// delta goes through filterLookDelta before it turns the camera.

/** Radians per pixel of mouse movement at 1× sensitivity. */
export const LOOK_RADIANS_PER_PX = 0.0022;

/** Events ignored after the pointer lock is (re)acquired; the first ones are often garbage. */
export const SKIP_AFTER_LOCK = 3;
/** A single event moving further than this is suspicious whatever the recent motion was. */
export const SPIKE_PX = 250;
/** ...as is one this many times the recent average, once it's at least RATIO_MIN_PX. */
export const SPIKE_RATIO = 8;
export const RATIO_MIN_PX = 48;
/** Nobody moves this far in one event; always dropped, never given the benefit of the doubt. */
export const MAX_PX = 1000;
/** A held suspicious event is confirmed only by a follow-up this soon after it... */
export const CONFIRM_MS = 50;
/** ...that is at least this fraction of its size (a real flick decelerates, a spike just stops). */
export const CONFIRM_FRACTION = 0.25;
const AVG_ALPHA = 0.2;

export interface LookFilter {
  /** Events still to ignore after the lock was acquired. */
  skip: number;
  /** Running average of |movement| over accepted events. */
  avg: number;
  /** A suspicious event waiting for the next one to tell whether it was a flick or a spike. */
  pending: { dx: number; dy: number; t: number } | null;
  /** Spikes thrown away so far. */
  dropped: number;
  /** Events ignored right after taking the lock. */
  skipped: number;
}

export function createLookFilter(): LookFilter {
  return { skip: SKIP_AFTER_LOCK, avg: 0, pending: null, dropped: 0, skipped: 0 };
}

/** Call when the pointer lock is (re)acquired or lost. Keeps the diagnostic counters. */
export function resetLookFilter(f: LookFilter) {
  f.skip = SKIP_AFTER_LOCK;
  f.avg = 0;
  f.pending = null;
}

const size = (dx: number, dy: number) => Math.max(Math.abs(dx), Math.abs(dy));

function accept(f: LookFilter, dx: number, dy: number): [number, number] {
  f.avg += (size(dx, dy) - f.avg) * AVG_ALPHA;
  return [dx, dy];
}

/**
 * Filters one pointer-lock mousemove. Returns the delta to apply, or null to ignore the event.
 *
 * A suspicious event (bigger than SPIKE_PX, or far above the recent average) is held back for one
 * event: if the next one follows quickly and is still moving fast it was a genuine flick and both
 * are applied together; otherwise it was a lone spike and is dropped. Normal motion is never delayed.
 */
export function filterLookDelta(f: LookFilter, dx: number, dy: number, t: number): [number, number] | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (f.skip > 0) {
    f.skip--;
    f.skipped++;
    return null;
  }
  const m = size(dx, dy);
  if (m > MAX_PX) {
    f.dropped++;
    return null;
  }

  const held = f.pending;
  f.pending = null;
  if (held) {
    if (t - held.t <= CONFIRM_MS && m >= size(held.dx, held.dy) * CONFIRM_FRACTION) {
      accept(f, held.dx, held.dy);
      return accept(f, held.dx + dx, held.dy + dy);
    }
    f.dropped++;
  }

  const suspicious = m > SPIKE_PX || (m >= RATIO_MIN_PX && m > SPIKE_RATIO * f.avg);
  if (suspicious) {
    f.pending = { dx, dy, t };
    return null;
  }
  return accept(f, dx, dy);
}

// ---------- preferences (per browser, in localStorage) ----------

export const SENSITIVITY_MIN = 0.25;
export const SENSITIVITY_MAX = 3;

export interface LookPrefs {
  sensitivity: number;
  invertY: boolean;
  /** Grab the mouse again when a panel or question closes (see lookLock.ts). Off unless ticked. */
  grabOnClose: boolean;
}
const PREFS_KEY = 'cubefarm:look';
const DEFAULT_PREFS: LookPrefs = { sensitivity: 1, invertY: false, grabOnClose: false };

const clampSensitivity = (v: number) => Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, v));

/**
 * The settings as saved. The grab setting is saved as `grab`: the older `grabOnClose` was on by default and saved
 * along with any other change, so it doesn't say anyone chose it, and is ignored.
 */
export function parseLookPrefs(raw: string | null): LookPrefs {
  try {
    const v = JSON.parse(raw ?? 'null') as (Partial<LookPrefs> & { grab?: boolean }) | null;
    return {
      sensitivity: typeof v?.sensitivity === 'number' && Number.isFinite(v.sensitivity) ? clampSensitivity(v.sensitivity) : DEFAULT_PREFS.sensitivity,
      invertY: v?.invertY === true,
      grabOnClose: v?.grab === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function loadPrefs(): LookPrefs {
  try {
    return parseLookPrefs(localStorage.getItem(PREFS_KEY));
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const useLookPrefs = create<LookPrefs & { set: (p: Partial<LookPrefs>) => void }>((set, get) => ({
  ...loadPrefs(),
  set: (p) => {
    const next = { ...p, ...(p.sensitivity !== undefined ? { sensitivity: clampSensitivity(p.sensitivity) } : {}) };
    set(next);
    const { sensitivity, invertY, grabOnClose } = get();
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ sensitivity, invertY, grab: grabOnClose }));
    } catch {
      // storage may be unavailable (private mode); the setting just won't survive a reload
    }
  },
}));

// ---------- spyglass zoom ----------

/** One wheel notch zooms in (or out) by this factor. */
export const ZOOM_STEP = 1.25;
/** The closest look: enough to read a terminal slate or a notice from across a chamber. */
export const ZOOM_MAX = 3;

/** The zoom after one wheel event: up (negative deltaY) zooms in, down zooms out, clamped to 1×–ZOOM_MAX. */
export function nextZoom(zoom: number, deltaY: number): number {
  if (!deltaY) return zoom;
  const z = deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(1, Math.abs(z - 1) < 1e-6 ? 1 : z));
}

/** The camera's vertical field of view in degrees at a zoom: the view's half-height shrinks by the zoom factor. */
export function zoomedFov(baseDeg: number, zoom: number): number {
  return (2 * Math.atan(Math.tan((baseDeg * Math.PI) / 360) / zoom) * 180) / Math.PI;
}

/** Mouse look is slowed by the zoom, so the same hand movement covers the same part of the view. */
export function lookScale(zoom: number): number {
  return 1 / zoom;
}
