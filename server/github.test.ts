import { describe, expect, it } from 'vitest';
import { headFromGraphql, issuesFromGraphql, pullAssociations, toPull } from './github.ts';

describe("a branch's head and its checks", () => {
  it('reads the sha and sums up check runs and statuses', () => {
    const ok = { data: { repository: { ref: { target: { oid: 'abc', statusCheckRollup: { contexts: { nodes: [{ name: 'CI', status: 'COMPLETED', conclusion: 'SUCCESS' }, { context: 'Vercel', state: 'SUCCESS' }] } } } } } } };
    expect(headFromGraphql(ok, 'o/r', 'main')).toEqual({ sha: 'abc', checks: 'passing' });
    const bad = structuredClone(ok);
    bad.data.repository.ref.target.statusCheckRollup.contexts.nodes.push({ context: 'Vercel preview', state: 'FAILURE' } as never);
    expect(headFromGraphql(bad, 'o/r', 'main').checks).toBe('failing');
    const none = { data: { repository: { ref: { target: { oid: 'abc', statusCheckRollup: null } } } } };
    expect(headFromGraphql(none, 'o/r', 'main').checks).toBe('none');
    expect(() => headFromGraphql({ data: { repository: { ref: null } } }, 'o/r', 'main')).toThrow(/no branch main/);
  });
});

describe('who opened an issue or a pull request', () => {
  const issue = (number: number, authorAssociation: string, login: string | null = 'someone') => ({
    number,
    title: `#${number}`,
    body: null,
    url: `u/${number}`,
    createdAt: '2026-10-16T00:00:00Z',
    author: login ? { login } : null,
    authorAssociation,
    labels: { nodes: [{ name: 'swarm:frontend' }] },
  });

  it('marks issues from the owner, org members and collaborators as trusted, oldest first', () => {
    const out = { data: { repository: { issues: { nodes: [issue(7, 'NONE', 'mallory'), issue(5, 'OWNER', 'emile'), issue(6, 'CONTRIBUTOR', null)] } } } };
    expect(issuesFromGraphql(out)).toEqual([
      { number: 5, title: '#5', body: '', url: 'u/5', labels: ['swarm:frontend'], createdAt: '2026-10-16T00:00:00Z', author: 'emile', trusted: true },
      { number: 6, title: '#6', body: '', url: 'u/6', labels: ['swarm:frontend'], createdAt: '2026-10-16T00:00:00Z', author: null, trusted: false },
      { number: 7, title: '#7', body: '', url: 'u/7', labels: ['swarm:frontend'], createdAt: '2026-10-16T00:00:00Z', author: 'mallory', trusted: false },
    ]);
  });

  it('trusts a PR only when its author is trusted and it is not from a fork', () => {
    const out = { data: { repository: { open: { nodes: [{ number: 3, authorAssociation: 'MEMBER' }, { number: 4, authorAssociation: 'NONE' }] }, merged: { nodes: [{ number: 1, authorAssociation: 'OWNER' }] } } } };
    const assoc = pullAssociations(out);
    const raw = (number: number, isCrossRepository: boolean) => ({
      number, title: '', url: '', headRefName: 'swarm/issue-1-x', state: 'OPEN' as const, isDraft: false, mergeable: 'MERGEABLE', reviewDecision: null, closingIssuesReferences: [], createdAt: '', mergedAt: null, additions: 0, deletions: 0, headRefOid: 'abc', mergeStateStatus: 'CLEAN', statusCheckRollup: null, author: { login: 'x' }, isCrossRepository,
    });
    expect(toPull(raw(3, false), assoc.get(3)).trusted).toBe(true);
    expect(toPull(raw(1, false), assoc.get(1)).trusted).toBe(true);
    expect(toPull(raw(3, true), assoc.get(3)).trusted).toBe(false); // a fork
    expect(toPull(raw(4, false), assoc.get(4)).trusted).toBe(false); // a stranger
    expect(toPull(raw(9, false), assoc.get(9)).trusted).toBe(false); // not in the lookup
    expect(toPull(raw(3, false), assoc.get(3)).author).toBe('x');
  });
});
