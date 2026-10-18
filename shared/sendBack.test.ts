import { describe, expect, it } from 'vitest';
import { failedShaAfter, fixBrief, sendBackRefusal, stillFailedCommit } from './sendBack.ts';

describe('failedShaAfter', () => {
  it('records the tested commit when the report failed it, and clears it when a report passes', () => {
    expect(failedShaAfter('fail', 'aefef23', null)).toBe('aefef23');
    expect(failedShaAfter('pass', 'aefef23', 'aefef23')).toBeNull();
  });

  it('keeps what was there when the round had no report (stopped, or the tester ended without one)', () => {
    expect(failedShaAfter(null, 'aefef23', null)).toBeNull();
    expect(failedShaAfter(null, '99d1dae', 'aefef23')).toBe('aefef23');
  });

  it("a round that ended without a report doesn't make Retry QA warn; a failing report still does", () => {
    // PR #48 in the Young Overlords dry run: tested on a6214ab, the test was stopped, card says needs you
    const noReport = failedShaAfter(null, 'a6214ab', null);
    expect(stillFailedCommit(noReport, 'a6214abf00d', 'needs-human')).toBe(false);
    const failed = failedShaAfter('fail', 'a6214ab', null);
    expect(stillFailedCommit(failed, 'a6214abf00d', 'needs-human')).toBe(true);
  });
});

describe('stillFailedCommit', () => {
  it('is true when the PR is still on the commit QA failed', () => {
    expect(stillFailedCommit('aefef23', 'aefef23f1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f', 'needs-human')).toBe(true);
  });

  it('is false once the coder pushed a new commit', () => {
    expect(stillFailedCommit('aefef23', '99d1dae', 'needs-human')).toBe(false);
  });

  it('is false when a commit is unknown, or QA never failed it', () => {
    expect(stillFailedCommit(null, 'aefef23', 'needs-human')).toBe(false);
    expect(stillFailedCommit('aefef23', null, 'failed')).toBe(false);
    expect(stillFailedCommit('aefef23', 'aefef23', 'passed')).toBe(false);
    expect(stillFailedCommit('aefef23', 'aefef23', null)).toBe(false);
  });
});

describe('sendBackRefusal', () => {
  it('allows a PR that failed QA or waits for the Overlord', () => {
    expect(sendBackRefusal(5, 'needs-human', 'Add a half-step.')).toBeNull();
    expect(sendBackRefusal(5, 'failed', 'Add a half-step.')).toBeNull();
  });

  it('refuses an empty note', () => {
    expect(sendBackRefusal(5, 'needs-human', '   ')).toBe('Write what the coder should do.');
  });

  it('refuses a PR QA has not tested yet', () => {
    expect(sendBackRefusal(5, null, 'x')).toBe('PR #5 has not been through QA yet: send it to QA first.');
  });

  it('refuses one already being tested or fixed', () => {
    expect(sendBackRefusal(5, 'testing', 'x')).toBe('PR #5 is being tested right now.');
    expect(sendBackRefusal(5, 'fixing', 'x')).toBe('PR #5 is already being fixed.');
  });

  it('refuses one that passed', () => {
    expect(sendBackRefusal(5, 'passed', 'x')).toBe('PR #5 passed QA; it merges once its checks pass.');
  });
});

describe('fixBrief', () => {
  it("puts the Overlord's note first and says it comes before QA's suggestions", () => {
    const brief = fixBrief('Add a half-step at the foot of the wall walk.', 'Change companion.ts so it hops higher.');
    expect(brief.indexOf('Add a half-step')).toBeLessThan(brief.indexOf('companion.ts'));
    expect(brief).toMatch(/Where they differ, follow the Overlord/);
  });

  it("is QA's instructions alone when there is no note", () => {
    expect(fixBrief(null, 'Fix the test.')).toBe('Fix the test.');
  });

  it('is the note alone when QA left no instructions', () => {
    expect(fixBrief('Rename it.', null)).toBe("The Overlord's instructions:\nRename it.");
  });
});
