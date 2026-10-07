import { describe, expect, it } from 'vitest';
import type { SystemView } from '../../../shared/system';
import { addPoint, HISTORY_MS } from '../systemFeed';
import { gaugeFace, usageLine } from './gauges';

const reading = (at: number, cpu: number | null, used = 8): SystemView => ({
  at,
  host: { platform: 'test', cpuModel: 'test', cores: 4 },
  cpu: { pct: cpu, cores: [cpu, cpu, cpu, cpu] },
  memory: { used: used * 2 ** 30, total: 16 * 2 ** 30 },
  process: { rss: 100 * 2 ** 20, heapUsed: 10 * 2 ** 20 },
  disk: { path: 'H:\\', free: 3 * 2 ** 40, total: 4 * 2 ** 40 },
  uptime: { system: 100, office: 10 },
  sessions: { running: 1, agents: 3, limit: 0, clisWorking: 1, clisWaiting: 0 },
  usage: { state: 'normal', until: null, pacingSessions: 3 },
  today: { tokens: 4_210_000, costUsd: 18.4 },
});

describe('gaugeFace', () => {
  it('rounds to whole percents, so small wobbles do not repaint the board', () => {
    const normal = { state: 'normal', until: null } as const;
    const a = gaugeFace(reading(1, 40.2), normal, false);
    const b = gaugeFace(reading(2, 39.8), normal, false);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.dials.map((d) => d.pct)).toEqual([40, 50, 25]);
    expect(a.dials[1].detail).toBe('8.00 GB of 16.0 GB');
    expect(a.sessions).toBe('1 session running · dungeon 100 MB');
  });

  it('shows empty dials before the first reading', () => {
    expect(gaugeFace(null, { state: 'normal', until: null }, false).dials.map((d) => d.pct)).toEqual([null, null, null]);
  });

  it('marks pacing and the usage limit in the accent', () => {
    expect(usageLine({ state: 'normal', until: null })).toEqual({ text: 'normal', tone: 'good' });
    expect(usageLine({ state: 'pacing', until: null }).tone).toBe('bad');
    expect(usageLine({ state: 'paused', until: null }).text).toBe('paused at the limit');
  });
});

describe('addPoint', () => {
  it('keeps two minutes of history and skips repeats of the same sample', () => {
    let h = addPoint([], reading(0, 10));
    h = addPoint(h, reading(0, 10));
    expect(h).toHaveLength(1);
    h = addPoint(h, reading(5000, 20));
    h = addPoint(h, reading(HISTORY_MS + 1000, 30));
    expect(h.map((p) => p.cpu)).toEqual([20, 30]);
    expect(h[1].mem).toBe(50);
  });
});
