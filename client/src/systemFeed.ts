import { useSyncExternalStore } from 'react';
import { percentOf, type SystemView } from '../../shared/system';

// One poll of GET /api/system shared by every gauge board and the gauges panel: it runs every 5 s while at least one
// of them is mounted, skips its turn while the tab is hidden, and stops when the last one unmounts. The last two
// minutes of CPU and memory are kept here, so the panel opens with the history the board has already seen.

export const POLL_MS = 5000;
export const HISTORY_MS = 2 * 60_000;

export interface SystemPoint {
  at: number;
  cpu: number | null;
  mem: number | null;
}

export interface SystemFeed {
  latest: SystemView | null;
  history: SystemPoint[];
  /** The last poll failed (the office restarting, say); the latest reading stays up. */
  failed: boolean;
}

let feed: SystemFeed = { latest: null, history: [], failed: false };
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inflight = false;

function emit(next: SystemFeed) {
  feed = next;
  for (const l of listeners) l();
}

/** Add a reading to the history, dropping points older than HISTORY_MS. Repeats (the server's cached sample) are skipped. */
export function addPoint(history: SystemPoint[], v: SystemView): SystemPoint[] {
  if (history.length && history[history.length - 1].at >= v.at) return history;
  const point = { at: v.at, cpu: v.cpu.pct, mem: percentOf(v.memory.used, v.memory.total) };
  return [...history.filter((p) => v.at - p.at < HISTORY_MS), point];
}

async function poll() {
  if (inflight) return;
  inflight = true;
  try {
    const res = await fetch('/api/system', { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const v = (await res.json()) as SystemView;
    if (v.at !== feed.latest?.at || feed.failed) emit({ latest: v, history: addPoint(feed.history, v), failed: false });
  } catch {
    if (!feed.failed) emit({ ...feed, failed: true });
  } finally {
    inflight = false;
  }
}

function tick() {
  timer = null;
  if (!listeners.size) return;
  if (document.visibilityState !== 'hidden') void poll();
  timer = setTimeout(tick, POLL_MS);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    // a reading already fresh enough waits for its turn; otherwise ask now
    const age = feed.latest ? Date.now() - feed.latest.at : Infinity;
    timer = setTimeout(tick, age >= POLL_MS ? 0 : POLL_MS - age);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}

/** The computer's latest reading and its recent history; polling runs while any component uses this. */
export function useSystemFeed(): SystemFeed {
  return useSyncExternalStore(subscribe, () => feed);
}
