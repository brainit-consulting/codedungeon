// The usage meter: tokens and cost at API prices for each agent's job. Claude Code writes every reply to its session
// file, often several times while it streams; the last record of a reply is the true one (measured: 63 records for
// 26 replies in one coder's session). The status line gives the session's running cost, which carries across jobs
// in a CLI the office keeps open, so a job is measured from where the CLI stood when it began. The office only reads
// these files; it never writes to Claude's folder.
import fs from 'node:fs';
import path from 'node:path';

export interface Tokens {
  input: number;
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

export const NO_TOKENS: Tokens = Object.freeze({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });

export const addTokens = (a: Tokens, b: Tokens): Tokens => ({
  input: a.input + b.input,
  cacheRead: a.cacheRead + b.cacheRead,
  cacheWrite: a.cacheWrite + b.cacheWrite,
  output: a.output + b.output,
});

/** a minus b, each count floored at 0. */
export const subTokens = (a: Tokens, b: Tokens): Tokens => ({
  input: Math.max(0, a.input - b.input),
  cacheRead: Math.max(0, a.cacheRead - b.cacheRead),
  cacheWrite: Math.max(0, a.cacheWrite - b.cacheWrite),
  output: Math.max(0, a.output - b.output),
});

export const totalTokens = (t: Tokens) => t.input + t.cacheRead + t.cacheWrite + t.output;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Folds session-file lines into `byId`: one entry per reply (message.id), the last record winning. */
export function foldUsage(lines: string[], byId: Map<string, Tokens>) {
  for (const line of lines) {
    let j: { type?: string; message?: { id?: string; usage?: Record<string, unknown> } } | null;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    const u = j?.message?.usage;
    const id = j?.message?.id;
    if (j?.type !== 'assistant' || !u || !id) continue;
    byId.set(id, { input: num(u.input_tokens), cacheRead: num(u.cache_read_input_tokens), cacheWrite: num(u.cache_creation_input_tokens), output: num(u.output_tokens) });
  }
}

export function sumTokens(byId: Map<string, Tokens>): Tokens {
  let t = NO_TOKENS;
  for (const v of byId.values()) t = addTokens(t, v);
  return t;
}

/** The SDK's per-model running totals (a result's modelUsage: main loop, subagents and compaction) as one count. */
export function modelTokens(mu: Record<string, { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }> | undefined): Tokens {
  let t = NO_TOKENS;
  for (const m of Object.values(mu ?? {})) {
    t = addTokens(t, { input: num(m.inputTokens), cacheRead: num(m.cacheReadInputTokens), cacheWrite: num(m.cacheCreationInputTokens), output: num(m.outputTokens) });
  }
  return t;
}

/** What a running cost added since `last`. A drop means it started again from 0 (/clear, a new process). */
export const costStep = (last: number, now: number) => (now >= last ? now - last : now);

/**
 * One job's figures, measured from where the session stood when the job began. lastCost null: where the running
 * cost stood isn't known (a CLI re-attached after an office restart), so its first reading is the baseline.
 */
export class UsageTally {
  private tokens: Tokens = NO_TOKENS;
  private cost = 0;
  constructor(
    private readonly baseTokens: Tokens,
    private lastCost: number | null,
  ) {}

  update(totals: Tokens | null, cost: number | null) {
    if (totals) this.tokens = subTokens(totals, this.baseTokens);
    if (cost !== null) {
      if (this.lastCost !== null) this.cost += costStep(this.lastCost, cost);
      this.lastCost = cost;
    }
    return { tokens: this.tokens, costUsd: this.cost };
  }
}

interface FileState {
  offset: number;
  rest: string;
  byId: Map<string, Tokens>;
}

/** Reads a session file and its subagents' files a little at a time: only what was added since the last read. */
export class FileMeter {
  private files = new Map<string, FileState>();

  private readOne(file: string) {
    let st = this.files.get(file);
    if (!st) this.files.set(file, (st = { offset: 0, rest: '', byId: new Map() }));
    try {
      const size = fs.statSync(file).size;
      if (size < st.offset) Object.assign(st, { offset: 0, rest: '', byId: new Map() }); // rewritten: start again
      if (size === st.offset) return;
      const fd = fs.openSync(file, 'r');
      try {
        const buf = Buffer.alloc(size - st.offset);
        fs.readSync(fd, buf, 0, buf.length, st.offset);
        st.offset = size;
        const lines = (st.rest + buf.toString('utf8')).split('\n');
        st.rest = lines.pop() ?? ''; // a line Claude Code is still writing waits for the next read
        foldUsage(lines, st.byId);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      // missing, or locked for a moment: keep what we had
    }
  }

  /** The session's totals so far: the main file plus every file in its subagents folder. */
  read(file: string): Tokens {
    this.readOne(file);
    const subDir = path.join(file.replace(/\.jsonl$/, ''), 'subagents');
    let subs: string[] = [];
    try {
      subs = fs.readdirSync(subDir).filter((f) => f.endsWith('.jsonl')).map((f) => path.join(subDir, f));
    } catch {
      // no subagents yet
    }
    for (const s of subs) this.readOne(s);
    let t = NO_TOKENS;
    for (const f of [file, ...subs]) {
      const st = this.files.get(f);
      if (st) t = addTokens(t, sumTokens(st.byId));
    }
    return t;
  }
}

/** The running cost and how full the context is, from Claude Code's status line payload. */
export function statusUsage(b: Record<string, unknown>) {
  const raw = (b.cost as { total_cost_usd?: unknown } | undefined)?.total_cost_usd;
  const pct = (b.context_window as { used_percentage?: unknown } | undefined)?.used_percentage;
  return {
    cost: typeof raw === 'number' && Number.isFinite(raw) ? raw : null,
    contextPct: typeof pct === 'number' && Number.isFinite(pct) ? Math.round(pct) : null,
  };
}
