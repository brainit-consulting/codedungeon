import { describe, expect, it } from 'vitest';
import { headFromGraphql } from './github.ts';

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
