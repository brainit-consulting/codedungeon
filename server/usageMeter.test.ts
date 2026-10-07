import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { costStep, FileMeter, foldUsage, NO_TOKENS, statusUsage, subTokens, sumTokens, totalTokens, UsageTally, type Tokens } from './usageMeter.ts';

// One reply as Claude Code writes it to its session file (shape measured 2026-10-06).
const reply = (id: string, output: number, extra: Partial<Record<string, number>> = {}) =>
  JSON.stringify({
    type: 'assistant',
    requestId: `req_${id}`,
    message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 2, cache_creation_input_tokens: 100, cache_read_input_tokens: 1000, output_tokens: output, ...extra } },
  });

describe('foldUsage', () => {
  it('counts each reply once, keeping its last record', () => {
    const byId = new Map<string, Tokens>();
    // copies of one reply: the output grows as it streams (17 then 496, measured in a subagent file)
    foldUsage([reply('a', 17), reply('a', 496), reply('b', 10)], byId);
    expect(sumTokens(byId)).toEqual({ input: 4, cacheRead: 2000, cacheWrite: 200, output: 506 });
  });
  it('skips bad JSON, user lines and lines without usage', () => {
    const byId = new Map<string, Tokens>();
    foldUsage(['{oops', JSON.stringify({ type: 'user', message: { content: 'hi' } }), JSON.stringify({ type: 'assistant', message: { id: 'x' } }), reply('c', 5)], byId);
    expect(sumTokens(byId).output).toBe(5);
  });
});

describe('costStep', () => {
  it('adds what the running cost grew by', () => expect(costStep(1.5, 2)).toBeCloseTo(0.5));
  it('counts from 0 again when the running cost drops (/clear, a fresh process)', () => expect(costStep(3, 0.25)).toBeCloseTo(0.25));
});

describe('UsageTally', () => {
  it('starts a job at 0 when the CLI already did work (a kept-alive CLI)', () => {
    const before: Tokens = { input: 10, cacheRead: 5000, cacheWrite: 300, output: 900 };
    const t = new UsageTally(before, 4.2);
    expect(t.update(before, 4.2)).toEqual({ tokens: NO_TOKENS, costUsd: 0 });
    const after: Tokens = { input: 12, cacheRead: 7000, cacheWrite: 400, output: 1000 };
    const job = t.update(after, 4.7);
    expect(job.tokens).toEqual({ input: 2, cacheRead: 2000, cacheWrite: 100, output: 100 });
    expect(job.costUsd).toBeCloseTo(0.5);
  });
  it('keeps the last figures when a reading is missing', () => {
    const t = new UsageTally(NO_TOKENS, 0);
    t.update({ input: 1, cacheRead: 2, cacheWrite: 3, output: 4 }, 0.1);
    expect(t.update(null, null)).toEqual({ tokens: { input: 1, cacheRead: 2, cacheWrite: 3, output: 4 }, costUsd: 0.1 });
  });
  it('never goes negative after a cost reset', () => {
    const t = new UsageTally(NO_TOKENS, 2);
    expect(t.update(null, 0.3).costUsd).toBeCloseTo(0.3);
  });
});

describe('FileMeter', () => {
  const dir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cd-meter-'));
  it('reads only what was added, and holds a half-written line for the next read', () => {
    const d = dir();
    const file = path.join(d, 's.jsonl');
    fs.writeFileSync(file, `${reply('a', 10)}\n${reply('b', 20).slice(0, 30)}`);
    const m = new FileMeter();
    expect(m.read(file).output).toBe(10);
    fs.appendFileSync(file, `${reply('b', 20).slice(30)}\n`);
    expect(m.read(file).output).toBe(30);
  });
  it("adds the session's subagent files, including ones that appear later", () => {
    const d = dir();
    const file = path.join(d, 's.jsonl');
    fs.writeFileSync(file, `${reply('a', 10)}\n`);
    const m = new FileMeter();
    expect(totalTokens(m.read(file))).toBe(2 + 100 + 1000 + 10);
    fs.mkdirSync(path.join(d, 's', 'subagents'), { recursive: true });
    fs.writeFileSync(path.join(d, 's', 'subagents', 'agent-1.jsonl'), `${reply('sub1', 7)}\n`);
    expect(m.read(file).output).toBe(17);
  });
  it('gives what it had when the file is missing', () => {
    expect(new FileMeter().read(path.join(dir(), 'none.jsonl'))).toEqual(NO_TOKENS);
  });
});

describe('statusUsage', () => {
  it('reads the cost and the context fill from a status line payload', () => {
    expect(statusUsage({ cost: { total_cost_usd: 1.25 }, context_window: { used_percentage: 41.6 } })).toEqual({ cost: 1.25, contextPct: 42 });
  });
  it('gives nulls when they are missing (early in a session)', () => {
    expect(statusUsage({ context_window: { used_percentage: null } })).toEqual({ cost: null, contextPct: null });
  });
});

it('subTokens floors at 0', () => expect(subTokens(NO_TOKENS, { input: 1, cacheRead: 1, cacheWrite: 1, output: 1 })).toEqual(NO_TOKENS));
