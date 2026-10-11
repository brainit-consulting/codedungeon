// Fitting the work to the computer. Each working agent, with its dev server and test browser, peaked around 1 to
// 1.5 GB in October 2026; a laptop that ran out of memory took both dungeons on it down. So: a suggested session
// limit from the machine's memory and cores, and a hold on starting new sessions while free memory is low. Running
// sessions are never stopped by it, so no work is lost.

const GB = 1024 ** 3;
/** Left for the operating system, the browser showing the dungeon, and everything else on the machine. */
const RESERVED = 8 * GB;
/** One working agent at its peak: the CLI, its dev server and a test browser. */
const PER_SESSION = 1.5 * GB;
/** Agents' builds and tests are busy work: about 2.5 cores each. */
const CORES_PER_SESSION = 2.5;

/** Below this much free memory, no new session starts. */
export const HOLD_BELOW = 1 * GB;
/** New sessions start again once more than this has stayed free for CALM_MS. */
export const RESUME_ABOVE = 2 * GB;
export const CALM_MS = 3 * 60_000;

/** How many sessions this computer can run at once without running short. */
export function suggestedSessions(totalBytes: number, cores: number): number {
  const byMemory = Math.floor((totalBytes - RESERVED) / PER_SESSION);
  const byCores = Math.floor(cores / CORES_PER_SESSION);
  return Math.max(1, Math.min(byMemory, byCores));
}

export interface MemoryHold {
  holding: boolean;
  /** Since when more than RESUME_ABOVE has been free while holding; null otherwise. */
  calmSince: number | null;
}

/** The hold after a reading of free memory: on below HOLD_BELOW, off after CALM_MS above RESUME_ABOVE. */
export function nextHold(h: MemoryHold, freeBytes: number, now: number): MemoryHold {
  if (freeBytes < HOLD_BELOW) return { holding: true, calmSince: null };
  if (!h.holding) return h;
  if (freeBytes <= RESUME_ABOVE) return { holding: true, calmSince: null };
  const since = h.calmSince ?? now;
  return now - since >= CALM_MS ? { holding: false, calmSince: null } : { holding: true, calmSince: since };
}
