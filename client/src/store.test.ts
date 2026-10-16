import { describe, expect, it } from 'vitest';
import type { RepoView } from '../../shared/types';
import { kanbanFor, useStore } from './store';

const repo = (id: string, floor: number) => ({ id, floor }) as unknown as RepoView;

describe('the room you are in', () => {
  it('sends you back to the hall when the project whose chamber you stand in is removed', () => {
    useStore.setState({ repos: [repo('a/one', 1), repo('a/two', 2)], floor: 2, visit: null });
    useStore.getState().apply({ type: 'repoRemoved', repoId: 'a/two' } as never);
    expect(useStore.getState().floor).toBe(0);
    expect(useStore.getState().visit?.to).toBe(0);
  });

  it('leaves you where you are when another project is removed', () => {
    useStore.setState({ repos: [repo('a/one', 1), repo('a/two', 2)], floor: 1, visit: null });
    useStore.getState().apply({ type: 'repoRemoved', repoId: 'a/two' } as never);
    expect(useStore.getState().floor).toBe(1);
    expect(useStore.getState().visit).toBeNull();
  });
});

describe("strangers' issues and pull requests on the board", () => {
  const issue = (number: number, trusted: boolean) => ({ number, title: `#${number}`, body: '', url: '', labels: [], createdAt: '', author: trusted ? 'emile' : 'mallory', trusted });
  const pull = { number: 9, title: 'Speed up the build', url: '', headRefName: 'swarm/issue-1-speed', state: 'OPEN', isDraft: false, closesIssues: [1], author: 'mallory', trusted: false };
  const board = kanbanFor({ id: 'a/one', issues: [issue(1, true), issue(2, false)], pulls: [pull] } as unknown as RepoView, [], {});

  it('marks them and never offers them as work', () => {
    expect(board.backlog.map((c) => [c.number, c.stranger ?? false])).toEqual([
      [1, false],
      [2, true],
    ]);
    expect(board.backlog[1].note).toBe('🔒 stranger @mallory · never taken');
    expect(board.qa).toMatchObject([{ number: 9, stranger: true, note: '🔒 stranger @mallory · never tested' }]);
  });

  it("doesn't let a stranger's PR that says it closes an issue take that issue off the backlog", () => {
    expect(board.backlog.some((c) => c.number === 1)).toBe(true);
  });
});
