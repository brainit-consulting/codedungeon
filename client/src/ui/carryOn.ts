import type { AgentView } from '../../../shared/types';

// The Carry on button on a coder's terminal panel (TerminalView.tsx): when it shows, and what it says. It sends an
// ordinary follow-up, which resumes their session on the same branch where Stop left it.

/** What it tells them: short, since every word is paid for in their session. */
export const CARRY_ON = 'Carry on where you left off.';

/** A coder the Overlord stopped partway through an issue or a fix. A failed session's issue goes back on the board instead. */
export function canCarryOn(a: Pick<AgentView, 'role' | 'status' | 'branch'>): boolean {
  return a.role === 'dev' && a.status === 'stopped' && !!a.branch;
}
