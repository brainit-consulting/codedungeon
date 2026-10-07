import { describe, expect, it } from 'vitest';
import { formatTokens, formatUsd, headerLine, jobLine, splitLine, todayLine } from './usage.ts';

describe('usage formats', () => {
  it('rounds tokens the way the board shows them', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_400)).toBe('12.4k');
    expect(formatTokens(812_345)).toBe('812k');
    expect(formatTokens(4_210_000)).toBe('4.2M');
    expect(formatTokens(NaN)).toBe('0');
  });
  it('gives dollars to the cent', () => {
    expect(formatUsd(0.0412)).toBe('$0.04');
    expect(formatUsd(18.4)).toBe('$18.40');
    expect(formatUsd(-1)).toBe('$0.00');
  });
  it("writes today's line", () => {
    expect(todayLine({ tokens: 4_210_000, costUsd: 18.4 })).toBe('Today at API prices: 4.2M tokens · $18.40');
    expect(todayLine(null)).toBe('Today at API prices: nothing yet');
  });
  it("writes a job's line, and says so when the CLI reports nothing", () => {
    expect(jobLine({ input: 2, cacheRead: 800_000, cacheWrite: 10_000, output: 2_000 }, 3.1, 42, 'Claude Code')).toBe('This job: 812k tokens · $3.10 at API prices · context 42% full');
    expect(jobLine({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }, 0, null, 'Claude Code')).toBe('This job: 0 tokens · $0.00 at API prices');
    expect(jobLine(null, 0, null, 'Codex')).toBe('No figures from Codex');
  });
  it('writes the split', () => {
    expect(splitLine({ input: 2, cacheRead: 800_000, cacheWrite: 10_000, output: 2_000 })).toBe('2 fresh in · 800k cache reads · 10.0k cache writes · 2.0k out');
    expect(splitLine(null)).toBe('');
  });
});

describe('headerLine', () => {
  const t = { input: 2, cacheRead: 800_000, cacheWrite: 10_000, output: 2_000 };
  it('shows the job when there are figures', () => expect(headerLine(t, 3.1, 42, 'claude', 'Claude Code', true)).toBe('This job: 812k tokens · $3.10 at API prices · context 42% full'));
  it('never says "no figures" for a Claude agent: a job from before the meter shows just its cost', () => {
    expect(headerLine(null, 0.42, null, 'claude', 'Claude Code', true)).toBe('This job: $0.42 at API prices');
    expect(headerLine(null, 0, null, 'claude', 'Claude Code', true)).toBeNull();
  });
  it('says so for a CLI that reports nothing, once it has started', () => {
    expect(headerLine(null, 0, null, 'codex', 'Codex', true)).toBe('No figures from Codex');
    expect(headerLine(null, 0, null, 'codex', 'Codex', false)).toBeNull();
  });
});
