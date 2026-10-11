import { describe, expect, it } from 'vitest';
import { fixChangedPr, keepWaitingForBackground, prUrlIn, queueQaAfterIssue, workingAloneAfter } from './handOff.ts';

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

describe('a turn that ends with background work still running', () => {
  it('waits while the result is still missing, as before (a tester whose report comes when the playtest ends)', () => {
    expect(keepWaitingForBackground({ background: true, resultReady: false, waitedMs: 60_000 })).toBe(true);
  });
  it("doesn't wait once the result is in: a PR opened, a report written, a fix pushed (the dev server it left is stopped)", () => {
    expect(keepWaitingForBackground({ background: true, resultReady: true, waitedMs: 0 })).toBe(false);
  });
  it('without background work, or after 90 minutes, the turn ends', () => {
    expect(keepWaitingForBackground({ background: false, resultReady: false, waitedMs: 0 })).toBe(false);
    expect(keepWaitingForBackground({ background: true, resultReady: false, waitedMs: 90 * 60_000 })).toBe(false);
  });
});

describe('the pull request a turn names', () => {
  it("finds this repo's PR link, in any case, and not another repo's", () => {
    expect(prUrlIn('Done.\nhttps://github.com/Brainit-Consulting/Guildhall-Reference/pull/70', 'brainit-consulting/guildhall-reference')).toEqual({ number: 70, url: 'https://github.com/Brainit-Consulting/Guildhall-Reference/pull/70' });
    expect(prUrlIn('see https://github.com/someone/else/pull/3', 'brainit-consulting/guildhall-reference')).toBeNull();
    expect(prUrlIn('https://github.com/o/r.x/pull/9', 'o/r.x')).toEqual({ number: 9, url: 'https://github.com/o/r.x/pull/9' });
    expect(prUrlIn('https://github.com/o/rax/pull/9', 'o/r.x')).toBeNull();
  });
});

describe('QA after an issue session ends', () => {
  it('queues a PR QA has never seen, and one already waiting', () => {
    expect(queueQaAfterIssue({ status: undefined, testedSha: null, headSha: 'aaa' })).toBe(true);
    expect(queueQaAfterIssue({ status: 'queued', testedSha: null, headSha: 'aaa' })).toBe(true);
  });
  it("doesn't re-test the commit QA already judged: a late finish on a failed PR (11 October, PR #70)", () => {
    for (const status of ['failed', 'passed', 'needs-human'] as const) expect(queueQaAfterIssue({ status, testedSha: 'aaa1111', headSha: 'aaa1111' })).toBe(false);
  });
  it('does re-test new commits: a follow-up pushed to a PR that passed, failed or needs you', () => {
    for (const status of ['failed', 'passed', 'needs-human'] as const) expect(queueQaAfterIssue({ status, testedSha: 'aaa1111', headSha: 'bbb2222' })).toBe(true);
  });
  it('never interrupts a round under way, and re-tests when it cannot tell the commits apart', () => {
    for (const status of ['testing', 'fixing'] as const) expect(queueQaAfterIssue({ status, testedSha: 'aaa', headSha: 'bbb' })).toBe(false);
    expect(queueQaAfterIssue({ status: 'passed', testedSha: null, headSha: 'bbb' })).toBe(true);
    expect(queueQaAfterIssue({ status: 'passed', testedSha: 'aaa', headSha: null })).toBe(true);
  });
});
