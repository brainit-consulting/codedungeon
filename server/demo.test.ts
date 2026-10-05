// Run with `npm test` (Vitest).
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Backend } from './backend.ts';
import type { LogEntry, SessionCallbacks, SessionOptions } from './agentRunner.ts';
import { createDemoBackend } from './demo.ts';

afterEach(() => void vi.useRealTimers());

/** A fake session, with what it reported: its session ids and its log. */
function session(backend: Backend, o: Partial<SessionOptions>) {
  const seen = { ids: [] as (string | null)[], text: [] as string[], ok: null as boolean | null };
  const cb = new Proxy({} as SessionCallbacks, {
    get: (_, k) =>
      k === 'sessionId'
        ? (id: string | null) => seen.ids.push(id)
        : k === 'log'
          ? (e: LogEntry[]) => seen.text.push(...e.map((x) => x.text))
          : k === 'finished'
            ? (r: { ok: boolean }) => (seen.ok = r.ok)
            : () => undefined,
  });
  const handle = backend.startSession({ role: 'dev', model: 'demo', effort: 'medium', cwd: '/demo/desks/maud-the-scribe-aced', prompt: '', ...o } as SessionOptions, cb);
  return { seen, handle };
}

describe("the demo's fake coding sessions", () => {
  it('say which session they are, as Claude Code does, so a stopped coder can be picked up again', () => {
    vi.useFakeTimers();
    const { seen } = session(createDemoBackend(), { prompt: 'Work on issue #3: Dark mode toggle' });
    expect(seen.ids).toHaveLength(1);
    expect(seen.ids[0]).toBeTruthy();
  });

  it('carry on with the same issue when a follow-up resumes one that was stopped', () => {
    vi.useFakeTimers();
    const demo = createDemoBackend();
    const first = session(demo, { prompt: 'Work on issue #3: Dark mode toggle' });
    vi.advanceTimersByTime(3000);
    first.handle.stop();
    const id = first.seen.ids[0]!;
    const again = session(demo, { prompt: 'Carry on where you left off.', resumeSessionId: id });
    expect(again.seen.ids).toEqual([id]);
    vi.advanceTimersByTime(300_000);
    expect(again.seen.ok).toBe(true);
    expect(again.seen.text.join('\n')).toContain('Closes #3');
  });
});
