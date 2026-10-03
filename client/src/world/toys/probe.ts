// window.__swarmToys: a read-only peek at the darts, for QA and Playwright (pointer lock doesn't work headless).
// Each read returns a fresh snapshot. In dev builds, window.__throwDart(power) throws the next dart in hand along
// the current view, so a browser without pointer lock can play too.

import { useStore, type Held } from '../../store';
import { throwDart } from './hands';

export interface DartsState {
  /** Where the three darts are. */
  hand: number;
  ledge: number;
  flying: number;
  stuck: number;
  loose: number;
  /** The chalk tally: this round's throws ('T20', 'MISS', …), its total, and the best round kept in this browser. */
  board: { throws: string[]; total: number; best: number };
}

export interface ToysSnapshot {
  /** Rigid bodies in the current physics world (the building, the board and darts off the ledge). */
  bodies: number;
  /** What the player is carrying, e.g. { kind: 'darts', count: 2 }. */
  held: Held | null;
  /** Whether a throw is being charged right now. */
  charging: boolean;
  /** The darts, or null where there's no dart board (or the physics world isn't loaded). */
  darts: DartsState | null;
}

let bodies: (() => number) | null = null;
let darts: (() => DartsState) | null = null;

/** The mounted toy world registers itself here; null when there is none (loading, failed, or between floors). */
export function setToySource(s: (() => number) | null) {
  bodies = s;
}

/** The mounted dart board registers its darts here. */
export function setDartsSource(s: (() => DartsState) | null) {
  darts = s;
}

function snapshot(): ToysSnapshot {
  const { held, chargeAt } = useStore.getState();
  let n = 0;
  let d: DartsState | null = null;
  try {
    n = bodies ? bodies() : 0;
    d = darts ? darts() : null;
  } catch {
    // the world is being torn down; report it as empty
  }
  return { bodies: n, held, charging: chargeAt !== null, darts: d };
}

if (typeof window !== 'undefined' && !Object.getOwnPropertyDescriptor(window, '__swarmToys')) {
  Object.defineProperty(window, '__swarmToys', { get: snapshot, enumerable: false, configurable: false });
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__throwDart = (power = 0.6) => throwDart(power);
}
