// server/ship.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SHIP } from '../shared/ship.ts';
import { createFakeVercel, fakeShipDir } from './demoVercel.ts';
import { Shipyard, type ShipRepo } from './ship.ts';

function world(opts: { buildMs?: number } = {}) {
  const main: { sha: string; subject: string }[] = [{ sha: 's0', subject: 'Initial commit' }];
  const head = () => main[main.length - 1].sha;
  const vercel = createFakeVercel({ buildMs: opts.buildMs ?? 0, headOf: head });
  const issues: { title: string; body: string }[] = [];
  const emitted: string[] = [];
  let checks: 'passing' | 'failing' = 'passing';
  const repo: ShipRepo = { id: 'demo-co/todo', fullName: 'demo-co/todo', defaultBranch: 'main', ship: structuredClone(DEFAULT_SHIP) };
  const yard = new Shipyard(
    {
      vercel,
      branchHead: async () => ({ sha: head(), checks }),
      commitSubjects: async (_f, base, to) => {
        const from = main.findIndex((c) => c.sha === base);
        const end = main.findIndex((c) => c.sha === to);
        return main.slice(from + 1, end + 1).map((c) => c.subject);
      },
      prepareShipCheckout: async (f) => fakeShipDir(f),
    },
    {
      emit: (id) => emitted.push(id),
      save: () => {},
      pulls: () => [{ number: 7, title: 'Dark mode' }],
      createIssue: async (_id, title, body) => (issues.push({ title, body }), issues.length),
    },
  );
  const merge = (n: number, title: string) => {
    const sha = `s${main.length}`;
    main.push({ sha, subject: `${title} (#${n})` });
    vercel.merged(repo.fullName, sha);
  };
  return { yard, repo, vercel, merge, issues, emitted, setChecks: (c: typeof checks) => (checks = c), head };
}

const setUp = async (w: ReturnType<typeof world>, method: 'git-promote' | 'git-auto' | 'cli') => {
  const project = await w.vercel.createProject('todo', 'demo-team');
  await w.yard.setup(w.repo, { method, scope: 'demo-team', project });
};

afterEach(() => vi.useRealTimers());

describe('SHIP IT', () => {
  it('shows what is live and what is waiting, then ships the build of main and says so', async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode');
    await w.yard.refresh(w.repo);
    let v = w.yard.view(w.repo);
    expect(v.live?.sha).toBe('s0');
    expect(v.waiting).toEqual([{ number: 7, title: 'Dark mode' }]);
    expect(v.blocked).toBeNull();
    await expect(w.yard.ship(w.repo, false)).rejects.toThrow(/first ship/i);
    await w.yard.ship(w.repo, true);
    v = w.yard.view(w.repo);
    expect(v.live?.sha).toBe('s1');
    expect(v.waiting).toEqual([]);
    expect(v.log[0]).toMatchObject({ action: 'ship', ok: true, prs: [7], sha: 's1' });
    expect(w.repo.ship.firstShipDone).toBe(true);
  });

  it("refuses a second Ship while the first is still going, and doesn't promote twice", async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode');
    await w.yard.refresh(w.repo);
    const promote = vi.spyOn(w.vercel, 'promote');
    const [a, b] = await Promise.allSettled([w.yard.ship(w.repo, true), w.yard.ship(w.repo, true)]);
    expect([a.status, b.status].sort()).toEqual(['fulfilled', 'rejected']);
    expect(promote).toHaveBeenCalledTimes(1);
  });

  it("ships main's head at the moment of the click, not what the panel last showed", async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode');
    await w.yard.refresh(w.repo);
    w.merge(8, 'Due dates'); // lands after the panel last looked
    await w.yard.ship(w.repo, true);
    expect(w.yard.view(w.repo).live?.sha).toBe('s2');
    expect(w.yard.view(w.repo).log[0].prs).toEqual([7, 8]);
  });

  it("won't ship while main's checks fail", async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode');
    w.setChecks('failing');
    await expect(w.yard.ship(w.repo, true)).rejects.toThrow(/checks are failing/);
  });

  it('undoes a ship, locks Ship until main moves on, and files the follow-up', async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode');
    await w.yard.ship(w.repo, true);
    await w.yard.undo(w.repo);
    const v = w.yard.view(w.repo);
    expect(v.live?.sha).toBe('s0');
    expect(v.blocked).toMatch(/undid/);
    expect(v.log[0]).toMatchObject({ action: 'undo', ok: true, prs: [7] });
    await w.yard.followUp(w.repo, 'revert');
    expect(w.issues[0].title).toMatch(/Revert/);
    expect(w.issues[0].body).toContain('#7');
    w.merge(9, 'Fix dark mode');
    await w.yard.refresh(w.repo);
    expect(w.yard.view(w.repo).blocked).toBeNull();
  });

  it('every merge goes live in the building stage; an undo pauses that, and Resume brings it back', async () => {
    const w = world();
    await setUp(w, 'git-auto');
    w.merge(7, 'Dark mode');
    await w.yard.refresh(w.repo);
    expect(w.yard.view(w.repo).live?.sha).toBe('s1');
    await w.yard.undo(w.repo);
    w.merge(8, 'Fix it');
    await w.yard.refresh(w.repo);
    expect(w.yard.view(w.repo).autoAssign).toBe(false);
    expect(w.yard.view(w.repo).live?.sha).toBe('s0');
    await w.yard.resume(w.repo);
    expect(w.yard.view(w.repo).autoAssign).toBe(true);
    expect(w.yard.view(w.repo).live?.sha).toBe('s2');
  });

  it('launches on a subdomain and from then on only Ship puts work live', async () => {
    const w = world();
    await setUp(w, 'git-auto');
    await w.yard.launch(w.repo, 'todo.brainit.site');
    expect(w.repo.ship.method).toBe('git-promote');
    expect(w.yard.view(w.repo).domains[0]).toBe('todo.brainit.site');
    w.merge(7, 'Dark mode');
    await w.yard.refresh(w.repo);
    expect(w.yard.view(w.repo).live?.sha).toBe('s0');
    await expect(w.yard.launch(w.repo, 'https://nope')).rejects.toThrow(/address/);
  });

  it('ships from the dungeon with the CLI method', async () => {
    const w = world();
    await setUp(w, 'cli');
    w.merge(7, 'Dark mode');
    await w.yard.ship(w.repo, true);
    expect(w.yard.view(w.repo).live?.sha).toBe('s1');
    await w.yard.preview(w.repo);
    expect(w.yard.view(w.repo).previewUrl).toMatch(/vercel\.app$/);
  });

  it('says to log in when the CLI is logged out, without calling Vercel again on every refresh', async () => {
    const w = world();
    await setUp(w, 'git-promote');
    w.vercel.loggedIn = false;
    await w.yard.check(w.repo);
    const spy = vi.spyOn(w.vercel, 'project');
    await w.yard.refresh(w.repo);
    expect(w.yard.view(w.repo).loggedInAs).toBeNull();
    expect(w.yard.view(w.repo).blocked).toMatch(/vercel login/);
    expect(spy).not.toHaveBeenCalled();
  });

  it('forgets a chamber: no timer fires and nothing is emitted for it afterwards', async () => {
    vi.useFakeTimers();
    const w = world({ buildMs: 30_000 });
    await setUp(w, 'git-promote');
    w.merge(7, 'Dark mode'); // building: the yard looks again every few seconds
    await w.yard.refresh(w.repo);
    w.yard.forget(w.repo.id);
    const before = w.emitted.length;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(w.emitted.length).toBe(before);
  });
});
