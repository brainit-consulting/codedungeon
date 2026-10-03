import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { SystemView } from '../shared/system.ts';
import type { UsageView } from '../shared/types.ts';

// The gauges (GET /api/system): how busy the computer is, from Node's own os/fs/process calls. Nothing runs on a
// timer: a request takes a sample, and every request within SAMPLE_MS gets that same sample, so any number of
// boards and panels cost one sample per 5 seconds, and none at all while nobody is looking.

/** A sample is reused this long. */
export const SAMPLE_MS = 5000;
/** A previous CPU sample older than this would average over minutes nobody watched: take a fresh baseline instead. */
const STALE_MS = 30_000;
/** How long the fresh baseline is. */
const BASELINE_MS = 250;

/** One core's cumulative CPU times (ms), as os.cpus() reports them. */
export type CpuTimes = { user: number; nice: number; sys: number; idle: number; irq: number };

const total = (t: CpuTimes) => t.user + t.nice + t.sys + t.idle + t.irq;
const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * CPU busy % between two samples, per core and overall (0-100, one decimal). A core with no time passed reads null;
 * cores missing from either sample are left out of the overall figure.
 */
export function cpuBusy(prev: CpuTimes[], next: CpuTimes[]): { pct: number | null; cores: (number | null)[] } {
  let all = 0;
  let idle = 0;
  const cores = next.map((n, i) => {
    const p = prev[i];
    if (!p) return null;
    const dt = total(n) - total(p);
    const di = n.idle - p.idle;
    if (dt <= 0) return null;
    all += dt;
    idle += di;
    return round1(Math.min(100, Math.max(0, ((dt - di) / dt) * 100)));
  });
  return { pct: all > 0 ? round1(Math.min(100, Math.max(0, ((all - idle) / all) * 100))) : null, cores };
}

/** Free (available to this user) and total bytes from fs.statfs. */
export function diskFromStatfs(s: { bsize: number; blocks: number; bavail: number }): { free: number; total: number } | null {
  const t = s.blocks * s.bsize;
  return t > 0 ? { free: s.bavail * s.bsize, total: t } : null;
}

/** What the office itself contributes: its sessions, its CLIs and Claude's usage. */
export interface OfficeLoad {
  running: number;
  agents: number;
  limit: number;
  clisWorking: number;
  clisWaiting: number;
  usage: UsageView;
  pacingSessions: number;
}

const cpuTimes = (): CpuTimes[] => os.cpus().map((c) => c.times);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The drive holding `dir`; its root when `dir` doesn't exist yet. */
async function diskOf(dir: string): Promise<SystemView['disk']> {
  for (const p of [dir, path.parse(path.resolve(dir)).root]) {
    try {
      const d = diskFromStatfs(await fs.statfs(p));
      if (d) return { path: p, ...d };
    } catch {
      // try the drive's root next
    }
  }
  return null;
}

/** Samples on demand, at most once per SAMPLE_MS however many callers ask. */
export function createSystemMonitor(opts: { diskPath: string; office: () => OfficeLoad }) {
  let cached: SystemView | null = null;
  let inflight: Promise<SystemView> | null = null;
  let last: { at: number; cpus: CpuTimes[] } | null = null;

  async function sample(): Promise<SystemView> {
    if (!last || Date.now() - last.at > STALE_MS) {
      last = { at: Date.now(), cpus: cpuTimes() };
      await sleep(BASELINE_MS);
    }
    const list = os.cpus();
    const cpus = list.map((c) => c.times);
    const cpu = cpuBusy(last.cpus, cpus);
    last = { at: Date.now(), cpus };
    const disk = await diskOf(opts.diskPath);
    const mem = process.memoryUsage();
    const office = opts.office();
    const info = list[0];
    return {
      at: Date.now(),
      host: { platform: os.version?.() || os.type(), cpuModel: info?.model.trim() ?? '', cores: cpus.length },
      cpu,
      memory: { used: os.totalmem() - os.freemem(), total: os.totalmem() },
      process: { rss: mem.rss, heapUsed: mem.heapUsed },
      disk,
      uptime: { system: Math.round(os.uptime()), office: Math.round(process.uptime()) },
      sessions: { running: office.running, agents: office.agents, limit: office.limit, clisWorking: office.clisWorking, clisWaiting: office.clisWaiting },
      usage: { ...office.usage, pacingSessions: office.pacingSessions },
    };
  }

  return {
    read(): Promise<SystemView> {
      if (cached && Date.now() - cached.at < SAMPLE_MS) return Promise.resolve(cached);
      inflight ??= sample()
        .then((v) => (cached = v))
        .finally(() => (inflight = null));
      return inflight;
    },
  };
}
