// shared/ship.test.ts
import * as shipModule from './ship.ts';
import { describe, expect, it } from 'vitest';
import { buildFor, earlierLive, prNumbersFromSubjects, shipBlocked, signStatus, suggestDomain, validDomain, waitingPulls, type Deployment, type ShipState } from './ship.ts';

const dep = (id: string, sha: string, state: Deployment['state'], createdAt: number): Deployment => ({ id, url: `${id}.vercel.app`, sha, state, createdAt });

describe('what is waiting to ship', () => {
  it('reads PR numbers from merge commits and squash merges, once each, in order', () => {
    expect(
      prNumbersFromSubjects(['Merge pull request #12 from acme/swarm/issue-3', 'Add dark mode (#14)', 'Fix typo', 'Revert "Add dark mode (#14)" (#15)', 'Add dark mode (#14)']),
    ).toEqual([12, 14, 15]);
  });

  it('names each waiting PR by its title, falling back to the commit subject', () => {
    expect(waitingPulls(['Add dark mode (#14)', 'Merge pull request #12 from x'], [{ number: 12, title: 'Due dates' }])).toEqual([
      { number: 14, title: 'Add dark mode' },
      { number: 12, title: 'Due dates' },
    ]);
  });
});

describe('which build ships', () => {
  const deps = [dep('a', 'aaa111', 'READY', 1), dep('b', 'bbb222', 'BUILDING', 3), dep('c', 'bbb222', 'READY', 2)];
  it("is the newest build of main's head, matching short or full shas", () => {
    expect(buildFor(deps, 'bbb222')?.id).toBe('b');
    expect(buildFor(deps, 'aaa1')?.id).toBe('a');
    expect(buildFor(deps, 'ccc')).toBeNull();
    expect(buildFor(deps, null)).toBeNull();
  });
});

describe('when Ship it is refused, and why', () => {
  const base: ShipState = {
    method: 'git-promote',
    hasProject: true,
    loggedIn: true,
    busy: null,
    live: dep('live', 'aaa111', 'READY', 1),
    mainSha: 'bbb222',
    mainChecks: 'passing',
    undoneSha: null,
    build: dep('b', 'bbb222', 'READY', 2),
  };
  it('allows a ready build of a newer main', () => expect(shipBlocked(base)).toBeNull());
  it('needs setting up, a login, and nothing else running', () => {
    expect(shipBlocked({ ...base, method: 'none' })).toMatch(/set up/i);
    expect(shipBlocked({ ...base, loggedIn: false })).toMatch(/vercel login/);
    expect(shipBlocked({ ...base, busy: 'shipping' })).toMatch(/busy/i);
  });
  it('has nothing to do when every merge goes live by itself', () => expect(shipBlocked({ ...base, method: 'git-auto' })).toMatch(/every merge/i));
  it("refuses while main's checks fail, while main is still on an undone change, and when nothing is waiting", () => {
    expect(shipBlocked({ ...base, mainChecks: 'failing' })).toMatch(/checks are failing/);
    expect(shipBlocked({ ...base, undoneSha: 'bbb2' })).toMatch(/undid/);
    expect(shipBlocked({ ...base, live: dep('live', 'bbb222', 'READY', 2) })).toMatch(/nothing waiting/i);
  });
  it('waits for the build of main, and says when it failed', () => {
    expect(shipBlocked({ ...base, build: null })).toMatch(/hasn't started/);
    expect(shipBlocked({ ...base, build: dep('b', 'bbb222', 'BUILDING', 2) })).toMatch(/still building/);
    expect(shipBlocked({ ...base, build: dep('b', 'bbb222', 'ERROR', 2) })).toMatch(/failed/);
  });
  it('builds from the dungeon for the CLI method, so no Vercel build is needed first', () => expect(shipBlocked({ ...base, method: 'cli', build: null })).toBeNull());
  it('ships a chamber that has never been live', () => expect(shipBlocked({ ...base, live: null })).toBeNull());
});

describe('going back', () => {
  it('offers earlier ready production builds, newest first, never the live one or a later one', () => {
    const live = dep('l', 'l', 'READY', 5);
    const all = [dep('x', 'x', 'READY', 1), dep('y', 'y', 'ERROR', 2), dep('z', 'z', 'READY', 3), live, dep('n', 'n', 'READY', 9)];
    expect(earlierLive(all, live).map((d) => d.id)).toEqual(['z', 'x']);
    expect(earlierLive(all, null)).toEqual([]);
  });
});

describe('the sign', () => {
  const v = { method: 'git-promote' as const, busy: null, lastFailed: false, autoAssign: false, live: dep('l', 'l', 'READY', 1), waiting: 0 };
  it('says what state the chamber is in', () => {
    expect(signStatus({ ...v, method: 'none' })).toBe('not set up yet');
    expect(signStatus({ ...v, busy: 'shipping' })).toBe('shipping…');
    expect(signStatus({ ...v, busy: 'undoing' })).toBe('going back…');
    expect(signStatus({ ...v, lastFailed: true })).toBe('ship failed');
    expect(signStatus({ ...v, live: null })).toBe('not live yet');
    expect(signStatus({ ...v, waiting: 3 })).toBe('live · 3 waiting');
    expect(signStatus(v)).toBe('live · up to date');
    expect(signStatus({ ...v, method: 'git-auto', autoAssign: true })).toBe('goes live with every merge');
    expect(signStatus({ ...v, method: 'git-auto', autoAssign: false })).toBe('paused after an undo');
  });
});

describe('the launch address', () => {
  it('suggests a subdomain of the parent from the repo name', () => {
    expect(suggestDomain('acme/Pixel Todo_App', 'brainit.site')).toBe('pixel-todo-app.brainit.site');
    expect(suggestDomain('acme/---', 'brainit.site')).toBe('app.brainit.site');
  });
  it('accepts real host names only', () => {
    expect(validDomain('pixel-todo.brainit.site')).toBe(true);
    expect(validDomain('https://x.brainit.site')).toBe(false);
    expect(validDomain('-x.brainit.site')).toBe(false);
    expect(validDomain('brainit')).toBe(false);
  });
});

describe('messages with commands in them', () => {
  it('splits `code` out of a message so the panel can show it as code', () => {
    const { splitTicks } = shipModule;
    expect(splitTicks("`main`'s checks are failing.")).toEqual([
      { code: true, text: 'main' },
      { code: false, text: "'s checks are failing." },
    ]);
    expect(splitTicks('no marks')).toEqual([{ code: false, text: 'no marks' }]);
    expect(splitTicks('a `lone tick')).toEqual([{ code: false, text: 'a `lone tick' }]);
  });
});
