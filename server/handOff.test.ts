import { describe, expect, it } from 'vitest';
import { fixChangedPr, workingAloneAfter } from './handOff.ts';

describe('workingAloneAfter', () => {
  it('a CLI at its prompt that starts using tools is working on its own', () => {
    expect(workingAloneAfter(false, 'PreToolUse')).toBe(true);
    expect(workingAloneAfter(false, 'PostToolUse')).toBe(true);
    expect(workingAloneAfter(false, 'PostToolUseFailure')).toBe(true);
  });

  it('it stops working on its own when its turn stops', () => {
    expect(workingAloneAfter(true, 'Stop')).toBe(false);
    expect(workingAloneAfter(true, 'StopFailure')).toBe(false);
  });

  it('a prompt alone, a notification or the status line change nothing', () => {
    // a blocked prompt (the dungeon refused it) may still never run; the tool call that follows is the sign
    for (const ev of ['UserPromptSubmit', 'Notification', 'StatusLine', 'PermissionRequest']) {
      expect(workingAloneAfter(false, ev)).toBe(false);
      expect(workingAloneAfter(true, ev)).toBe(true);
    }
  });
});

describe('fixChangedPr', () => {
  it('a fix that pushed a new commit changed the PR', () => {
    expect(fixChangedPr('aefef23', '99d1dae')).toBe(true);
  });

  it('a fix that left the commit QA failed did not', () => {
    expect(fixChangedPr('aefef23', 'aefef23')).toBe(false);
  });

  it('compares whole and short ids alike, in any case', () => {
    expect(fixChangedPr('AEFEF23', 'aefef23f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f')).toBe(false);
  });

  it('when either commit is unknown, it gives the fix the benefit of the doubt', () => {
    expect(fixChangedPr(null, 'aefef23')).toBe(true);
    expect(fixChangedPr('aefef23', null)).toBe(true);
  });
});
