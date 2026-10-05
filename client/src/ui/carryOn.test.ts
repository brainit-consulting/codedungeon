// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { CARRY_ON, canCarryOn } from './carryOn';

describe('the Carry on button', () => {
  const coder = { role: 'dev' as const, status: 'stopped' as const, branch: 'swarm/issue-8-maud-the-scribe' };

  it('shows for a coder the Overlord stopped partway through their work', () => {
    expect(canCarryOn(coder)).toBe(true);
  });

  it("doesn't show while they work, once they're done, after a failed session, or on a free bench", () => {
    for (const status of ['working', 'preparing', 'done', 'error', 'idle'] as const) expect(canCarryOn({ ...coder, status })).toBe(false);
  });

  it("doesn't show without a branch to carry on on, or for a tester or the DungeonMaster", () => {
    expect(canCarryOn({ ...coder, branch: null })).toBe(false);
    expect(canCarryOn({ ...coder, role: 'qa' })).toBe(false);
    expect(canCarryOn({ ...coder, role: 'ceo' })).toBe(false);
  });

  it('tells them to carry on, in a few words (every word is paid for in their session)', () => {
    expect(CARRY_ON.split(' ').length).toBeLessThanOrEqual(8);
  });
});
