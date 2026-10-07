import type { UsageView } from './types.ts';

// The gauges (GET /api/system): how busy the computer running the office is, and the plain-number formatting both
// the wall board and its detail panel use.

/** One reading of the machine and the office, as GET /api/system returns it. Sizes in bytes, times in seconds. */
export interface SystemView {
  /** When the sample was taken (epoch ms). */
  at: number;
  host: { platform: string; cpuModel: string; cores: number };
  /** CPU busy, 0-100, overall and per core, since the previous sample. Null when there is nothing to compare yet. */
  cpu: { pct: number | null; cores: (number | null)[] };
  memory: { used: number; total: number };
  /** The office's own Node process. */
  process: { rss: number; heapUsed: number };
  /** The drive holding the office's data folder; null where the platform can't say. */
  disk: { path: string; free: number; total: number } | null;
  uptime: { system: number; office: number };
  /** Agents in a session (preparing or working), everyone hired, the manager's cap (0 = none), the CLIs in terminals. */
  sessions: { running: number; agents: number; limit: number; clisWorking: number; clisWaiting: number };
  /** Claude's usage as the office knows it from Claude's warnings, and how many sessions pacing allows. */
  usage: UsageView & { pacingSessions: number };
  /** Every session since local midnight, at API prices (the usage meter). */
  today: { tokens: number; costUsd: number };
}

/** "512 MB", "31.7 GB", "1.20 TB": binary units, three significant figures. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '?';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

/** "45s", "12m", "3h 05m", "4d 2h". */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '?';
  const s = Math.floor(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

/** Share of a whole as 0-100, or null when the whole is unknown. */
export function percentOf(part: number, whole: number): number | null {
  return whole > 0 && Number.isFinite(part) ? Math.min(100, Math.max(0, (part / whole) * 100)) : null;
}
