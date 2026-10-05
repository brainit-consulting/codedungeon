// Carry on: getting a coder or tester going again on the same work, however it was halted: the Overlord's Stop, Esc
// in their terminal, a session that failed or crashed, a restart that lost it. Pure and shared: the server decides
// with it (Swarm.carryOn), and an agent's panel uses it to offer the button.

import type { AgentRole, AgentStatus, AgentTask, QaStatus } from './types.ts';

export interface CarryAgent {
  id: string;
  role: AgentRole;
  task: AgentTask | null;
  status: AgentStatus;
  branch: string | null;
  issueNumber: number | null;
  prNumber: number | null;
  /** Their session can be picked up again: the CLI said which it was, and they have a branch. */
  resumable: boolean;
}

interface PullLike {
  number: number;
  state: string;
  headRefName: string;
  closesIssues: number[];
}

interface QaLike {
  status: QaStatus;
  qaAgentId: string | null;
  devAgentId: string | null;
}

/** What Carry on tells them: short, since every word is paid for in their session. */
export const CARRY_ON = 'Carry on where you left off.';

/** resume: the same session, picked up where it stopped. restart: nothing to pick up, so the same task from the top. */
export type CarryOnPlan = { kind: 'resume' } | { kind: 'restart' } | { kind: 'none'; why: string };

const none = (why: string): CarryOnPlan => ({ kind: 'none', why });

/**
 * What Carry on does for this agent. `others` are the rest of their chamber, `pulls` its pull requests, `qa` the QA
 * record of the pull request they were fixing or testing.
 */
export function carryOnPlan(a: CarryAgent, world: { others: CarryAgent[]; pulls: PullLike[]; qa: QaLike | null }): CarryOnPlan {
  if (a.role === 'ceo') return none('the DungeonMaster carries on by herself');
  if (a.status === 'preparing' || a.status === 'working') return none("they're already working");
  if ((a.status !== 'stopped' && a.status !== 'error') || !a.task) return none('they have nothing unfinished to carry on with');
  const go: CarryOnPlan = a.resumable ? { kind: 'resume' } : { kind: 'restart' };

  if (a.task === 'issue') {
    const n = a.issueNumber;
    if (!n) return none('they have no issue to carry on with');
    const coder = world.others.find((o) => o.id !== a.id && o.task === 'issue' && o.issueNumber === n && o.status !== 'idle' && o.status !== 'error');
    const pr = world.pulls.find((p) => p.state === 'OPEN' && p.headRefName !== a.branch && (p.closesIssues.includes(n) || p.headRefName.startsWith(`swarm/issue-${n}-`)));
    if (coder || pr) return none(`#${n} has been taken up by someone else since${pr ? ` (PR #${pr.number})` : ''}`);
    return go;
  }

  const n = a.prNumber;
  if (!n) return none('they have no pull request to carry on with');
  if (!world.pulls.some((p) => p.number === n && p.state === 'OPEN')) return none(`PR #${n} isn't open any more`);
  const q = world.qa;
  if (!q) return none(`PR #${n} isn't waiting on anyone`);
  if (a.task === 'fix') {
    if (q.status === 'fixing') return q.devAgentId === a.id ? go : none(`someone else is fixing PR #${n} now`);
    return q.status === 'failed' || q.status === 'needs-human' ? go : none(`PR #${n} has moved on (${q.status})`);
  }
  if (q.status === 'testing') return q.qaAgentId === a.id ? go : none(`someone else is testing PR #${n} now`);
  return q.status === 'queued' || q.status === 'needs-human' ? go : none(`PR #${n} has moved on (${q.status})`);
}
