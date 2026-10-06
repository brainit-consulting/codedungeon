// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import type { PullInfo } from '../shared/types.ts';
import type { Backend } from './backend.ts';
import type { PreviewCallbacks, PreviewJob } from './previewRunner.ts';
import { Previews, type PreviewFloor } from './previews.ts';

// The previews with a fake backend: every run's callbacks are kept, so a test can say how each one goes.

function setup(opts: { hasDefault?: boolean } = {}) {
  const runs: { job: PreviewJob; cb: PreviewCallbacks; stopped: boolean }[] = [];
  const backend = {
    previews: {
      hasDefault: async () => opts.hasDefault ?? true,
      start(job: PreviewJob, cb: PreviewCallbacks) {
        const run = { job, cb, stopped: false };
        runs.push(run);
        cb.status('preparing');
        return { stop: async () => void (run.stopped = true) };
      },
    },
    releaseDesk: async () => undefined,
    removeDesk: async () => undefined,
  } as unknown as Backend;
  // every PR asked about is open
  const pulls = () => [3, 7].map((number) => ({ number, state: 'OPEN' }) as PullInfo);
  const previews = new Previews(backend, { emit: () => undefined, pulls });
  // floor 90: port 6390, which nothing on a test machine listens on
  const floor: PreviewFloor = { id: 'r1', fullName: 'o/app', defaultBranch: 'main', floor: 90, preview: { command: null, env: {} } };
  return { previews, floor, runs };
}

describe('a preview starting by itself (opening the app viewer)', () => {
  it('starts a stopped app on the default branch', async () => {
    const { previews, floor, runs } = setup();
    const view = await previews.start(floor, 'app', null, true);
    expect(runs).toHaveLength(1);
    expect(runs[0].job.pr).toBeNull();
    expect(view.status).toBe('preparing');
    expect(view.held).toBe(false);
  });

  it('leaves a running app alone instead of restarting it', async () => {
    const { previews, floor, runs } = setup();
    await previews.start(floor, 'app', 7);
    runs[0].cb.status('running');
    const view = await previews.start(floor, 'app', null, true);
    expect(runs).toHaveLength(1);
    expect(runs[0].stopped).toBe(false);
    expect(view.status).toBe('running');
    expect(view.pr).toBe(7);
  });

  it("doesn't start an app you stopped, until you start it yourself", async () => {
    const { previews, floor, runs } = setup();
    await previews.start(floor, 'app');
    const stopped = await previews.stop(floor);
    expect(stopped.held).toBe(true);
    expect((await previews.start(floor, 'app', null, true)).status).toBe('stopped');
    expect(runs).toHaveLength(1);
    // started by hand: from then on it starts by itself again
    await previews.start(floor, 'app');
    expect(previews.view(floor).held).toBe(false);
    await previews.stop(floor);
    expect(previews.view(floor).held).toBe(true);
  });

  it("doesn't retry an app that failed", async () => {
    const { previews, floor, runs } = setup();
    await previews.start(floor, 'app');
    runs[0].cb.failed('The app exited (code 1) before it listened on port 6390.');
    const view = await previews.start(floor, 'app', null, true);
    expect(view.status).toBe('error');
    expect(runs).toHaveLength(1);
  });

  it("doesn't start a chamber with nothing to run", async () => {
    const { previews, floor, runs } = setup({ hasDefault: false });
    await previews.refreshDefault(floor);
    const view = await previews.start(floor, 'app', null, true);
    expect(view.status).toBe('unconfigured');
    expect(runs).toHaveLength(0);
  });

  it('still lets you start, restart or switch a run by hand', async () => {
    const { previews, floor, runs } = setup();
    await previews.start(floor, 'app');
    runs[0].cb.status('running');
    await previews.start(floor, 'app', 3);
    expect(runs).toHaveLength(2);
    expect(runs[0].stopped).toBe(true);
    expect(runs[1].job.pr).toBe(3);
  });
});
