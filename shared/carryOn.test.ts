import { describe, expect, it } from 'vitest';
import { CARRY_ON, carryOnPlan, type CarryAgent } from './carryOn.ts';
import type { QaStatus } from './types.ts';

const coder = (o: Partial<CarryAgent> = {}): CarryAgent => ({
  id: 'maud',
  role: 'dev',
  task: 'issue',
  status: 'stopped',
  branch: 'swarm/issue-8-maud-the-scribe',
  issueNumber: 8,
  prNumber: null,
  resumable: true,
  ...o,
});
const tester = (o: Partial<CarryAgent> = {}): CarryAgent =>
  coder({ id: 'gerard', role: 'qa', task: 'qa', branch: 'qa/pr-12-gerard-the-assayer', issueNumber: 5, prNumber: 12, ...o });
const pull = (number: number, o: Partial<{ state: string; headRefName: string; closesIssues: number[] }> = {}) => ({
  number,
  state: 'OPEN',
  headRefName: `swarm/issue-${number}-someone`,
  closesIssues: [] as number[],
  ...o,
});
const qa = (status: QaStatus, qaAgentId: string | null = null, devAgentId: string | null = 'aldric') => ({ status, qaAgentId, devAgentId });
const world = (o: Partial<Parameters<typeof carryOnPlan>[1]> = {}) => ({ others: [], pulls: [pull(12)], qa: null, ...o });

describe('Carry on, for a coder on an issue', () => {
  it('picks their session back up after a Stop, an Esc, a crash or a restart', () => {
    expect(carryOnPlan(coder(), world())).toEqual({ kind: 'resume' });
    expect(carryOnPlan(coder({ status: 'error' }), world())).toEqual({ kind: 'resume' });
  });

  it('starts the issue again when there is no session to pick up (stopped or failed before Claude got going)', () => {
    expect(carryOnPlan(coder({ resumable: false }), world())).toEqual({ kind: 'restart' });
  });

  it("doesn't, once someone else has taken the issue up since; their own pull request doesn't count", () => {
    const other = coder({ id: 'osric', status: 'working', branch: 'swarm/issue-8-osric' });
    expect(carryOnPlan(coder({ status: 'error' }), world({ others: [other] })).kind).toBe('none');
    const theirs = pull(30, { headRefName: 'swarm/issue-8-osric', closesIssues: [8] });
    expect(carryOnPlan(coder({ status: 'error' }), world({ pulls: [theirs] })).kind).toBe('none');
    const own = pull(31, { headRefName: 'swarm/issue-8-maud-the-scribe', closesIssues: [8] });
    expect(carryOnPlan(coder({ prNumber: 31 }), world({ pulls: [own] }))).toEqual({ kind: 'resume' });
    const idleWithIt = coder({ id: 'osric', status: 'idle' });
    expect(carryOnPlan(coder(), world({ others: [idleWithIt] }))).toEqual({ kind: 'resume' });
  });
});

describe('Carry on, for a coder fixing a pull request', () => {
  const fixer = (o: Partial<CarryAgent> = {}) => coder({ task: 'fix', prNumber: 12, branch: 'swarm/issue-5-aldric', ...o });

  it('picks the fix back up once Stop has put it back as failed, or while it is still theirs', () => {
    expect(carryOnPlan(fixer(), world({ qa: qa('failed', null, 'maud') }))).toEqual({ kind: 'resume' });
    expect(carryOnPlan(fixer(), world({ qa: qa('fixing', null, 'maud') }))).toEqual({ kind: 'resume' });
    expect(carryOnPlan(fixer({ status: 'error' }), world({ qa: qa('needs-human', null, 'maud') }))).toEqual({ kind: 'resume' });
  });

  it("doesn't when someone else is fixing it, it has moved on, or it's no longer open", () => {
    expect(carryOnPlan(fixer(), world({ qa: qa('fixing', null, 'osric') })).kind).toBe('none');
    for (const s of ['queued', 'testing', 'passed'] as const) expect(carryOnPlan(fixer(), world({ qa: qa(s, null, 'maud') })).kind).toBe('none');
    expect(carryOnPlan(fixer(), world({ qa: qa('failed', null, 'maud'), pulls: [pull(12, { state: 'MERGED' })] })).kind).toBe('none');
  });
});

describe('Carry on, for whoever was testing a pull request', () => {
  it('picks the test back up: after a Stop (needs the Overlord), after a crash (back in the queue), or after a restart (still theirs)', () => {
    expect(carryOnPlan(tester(), world({ qa: qa('needs-human') }))).toEqual({ kind: 'resume' });
    expect(carryOnPlan(tester({ status: 'error' }), world({ qa: qa('queued') }))).toEqual({ kind: 'resume' });
    expect(carryOnPlan(tester(), world({ qa: qa('testing', 'gerard') }))).toEqual({ kind: 'resume' });
  });

  it('works the same for a coder who was covering for the testers', () => {
    expect(carryOnPlan(tester({ id: 'aldric', role: 'dev' }), world({ qa: qa('needs-human', null, 'maud') }))).toEqual({ kind: 'resume' });
  });

  it('tests it again from the top when there is no session to pick up', () => {
    expect(carryOnPlan(tester({ resumable: false }), world({ qa: qa('needs-human') }))).toEqual({ kind: 'restart' });
  });

  it("doesn't when someone else is testing it, it has moved on, or it's no longer open", () => {
    expect(carryOnPlan(tester(), world({ qa: qa('testing', 'hawise') })).kind).toBe('none');
    for (const s of ['failed', 'fixing', 'passed'] as const) expect(carryOnPlan(tester(), world({ qa: qa(s) })).kind).toBe('none');
    expect(carryOnPlan(tester(), world({ qa: qa('needs-human'), pulls: [pull(12, { state: 'CLOSED' })] })).kind).toBe('none');
    expect(carryOnPlan(tester(), world({ qa: qa('needs-human'), pulls: [] })).kind).toBe('none');
  });
});

describe('Carry on, when there is nothing to carry on', () => {
  it('is never offered to someone working, done or free, nor to the DungeonMaster', () => {
    for (const status of ['working', 'preparing', 'done', 'idle'] as const) expect(carryOnPlan(coder({ status }), world()).kind).toBe('none');
    expect(carryOnPlan(coder({ task: null }), world()).kind).toBe('none');
    expect(carryOnPlan(coder({ role: 'ceo' }), world()).kind).toBe('none');
  });

  it('says why, in words the Overlord can act on', () => {
    const plan = carryOnPlan(tester(), world({ qa: qa('testing', 'hawise') }));
    expect(plan.kind === 'none' && plan.why).toMatch(/PR #12/);
  });
});

describe('what Carry on tells them', () => {
  it('is a few words (every word is paid for in their session)', () => {
    expect(CARRY_ON.split(' ').length).toBeLessThanOrEqual(8);
  });
});
