import os from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { formatBytes, formatDuration, percentOf } from '../shared/system.ts';
import { cpuBusy, createSystemMonitor, diskFromStatfs, type CpuTimes, type OfficeLoad } from './system.ts';

const core = (busy: number, idle: number): CpuTimes => ({ user: busy, nice: 0, sys: 0, idle, irq: 0 });

describe('cpuBusy', () => {
  it('reads busy time against all time since the last sample, per core and overall', () => {
    const prev = [core(100, 900), core(500, 500)];
    const next = [core(150, 1850), core(1400, 600)]; // core 0: 50 of 1000 busy; core 1: 900 of 1000
    expect(cpuBusy(prev, next)).toEqual({ pct: 47.5, cores: [5, 90] });
  });

  it('counts sys and irq as busy', () => {
    const next = { user: 10, nice: 0, sys: 20, idle: 60, irq: 10 };
    expect(cpuBusy([core(0, 0)], [next]).pct).toBe(40);
  });

  it('says null when no time has passed or a core is new', () => {
    expect(cpuBusy([core(5, 5)], [core(5, 5)])).toEqual({ pct: null, cores: [null] });
    expect(cpuBusy([core(0, 0)], [core(10, 10), core(3, 3)])).toEqual({ pct: 50, cores: [50, null] });
  });

  it('stays within 0-100 when counters misbehave', () => {
    expect(cpuBusy([core(0, 100)], [core(200, 90)]).cores[0]).toBe(100);
    expect(cpuBusy([core(0, 100)], [core(10, 50)]).cores[0]).toBeNull();
  });
});

describe('diskFromStatfs', () => {
  it('multiplies blocks by the block size and uses the space available to this user', () => {
    expect(diskFromStatfs({ bsize: 2048, blocks: 1000, bavail: 250 })).toEqual({ free: 512_000, total: 2_048_000 });
  });

  it('is null for a drive that reports nothing', () => {
    expect(diskFromStatfs({ bsize: 0, blocks: 0, bavail: 0 })).toBeNull();
  });
});

describe('formatting', () => {
  it('formats bytes in binary units to three figures', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1536)).toBe('1.50 KB');
    expect(formatBytes(34_014_511_104)).toBe('31.7 GB');
    expect(formatBytes(1_202_906_157_056)).toBe('1.09 TB');
    expect(formatBytes(-1)).toBe('?');
  });

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(720)).toBe('12m');
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe('3h 05m');
    expect(formatDuration(4 * 86400 + 2 * 3600 + 59)).toBe('4d 2h');
  });

  it('gives a share as 0-100, or null without a whole', () => {
    expect(percentOf(1, 4)).toBe(25);
    expect(percentOf(5, 4)).toBe(100);
    expect(percentOf(1, 0)).toBeNull();
  });
});

describe('createSystemMonitor', () => {
  const load: OfficeLoad = { running: 2, agents: 5, limit: 0, clisWorking: 1, clisWaiting: 1, usage: { state: 'normal', until: null }, pacingSessions: 3, today: { tokens: 0, costUsd: 0 } };

  it('takes one sample for many callers and reuses it', async () => {
    const office = vi.fn(() => load);
    const mon = createSystemMonitor({ diskPath: os.tmpdir(), office });
    const [a, b] = await Promise.all([mon.read(), mon.read()]);
    const c = await mon.read();
    expect(office).toHaveBeenCalledTimes(1);
    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(a.host.cores).toBe(os.cpus().length);
    expect(a.cpu.cores).toHaveLength(a.host.cores);
    expect(a.memory.total).toBe(os.totalmem());
    expect(a.disk?.total).toBeGreaterThan(0);
    expect(a.sessions).toEqual({ running: 2, agents: 5, limit: 0, clisWorking: 1, clisWaiting: 1 });
    expect(a.usage).toEqual({ state: 'normal', until: null, pacingSessions: 3 });
  });
});
