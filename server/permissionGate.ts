// Permission prompts a coder's Claude Code shows despite the office's PreToolUse "allow": writes into protected paths
// such as .claude and .git, and removals Claude Code flags as critical (a drive's top-level folder, home, the working
// directory). Nobody is at the terminal to answer, so a coder sat at one for 8.5 hours on 7 October. The office
// answers yes through the PermissionRequest hook, except to a removal: measured the same day, that hook can approve
// even a critical-path rm, so those stay a prompt and the Overlord is told when one has waited too long.

/** How long a prompt waits before it goes on the Overlord's scroll. */
export const PERMISSION_WAIT_MS = 10 * 60_000;

const REMOVERS = new Set(['rm', 'rmdir', 'rd', 'del', 'erase', 'unlink', 'shred', 'remove-item', 'ri']);

/** Whether a shell command line removes files or folders anywhere in it. */
export function isRemoval(command: string): boolean {
  for (const part of command.split(/[;&|()\n`]|\$\(/)) {
    const words = part.trim().replace(/^(sudo|command|exec)\s+/i, '').split(/\s+/);
    const first = (words[0] ?? '').toLowerCase().replace(/\.exe$/, '');
    if (REMOVERS.has(first)) return true;
    if (first === 'git' && (/^(rm|clean)$/i.test(words[1] ?? '') || (words[1] === 'worktree' && words[2] === 'remove'))) return true;
  }
  return false;
}

/** The office's answer to a PermissionRequest hook: 'allow', or null to leave the prompt for the Overlord. */
export function permissionAnswer(b: Record<string, unknown>): 'allow' | null {
  const input = (b.tool_input ?? {}) as Record<string, unknown>;
  const command = typeof input.command === 'string' ? input.command : '';
  return command && isRemoval(command) ? null : 'allow';
}

/** The line in coders' and testers' instructions that keeps their scratch out of the removals Claude Code asks about. */
export const scratchRule = (tmp: string) =>
  `Make scratch folders and extra git worktrees under ${tmp}, never at the top of a drive or in your home folder: Claude Code asks before removing those, and nobody is at your terminal to answer.`;

/** What the Overlord is told about a prompt that has waited too long. */
export const waitingText = (what: string) => `Claude Code is asking before it runs \`${what}\`. Open their terminal and answer it.`;

/**
 * One session's unanswered prompt: `told` hears the text once it has waited PERMISSION_WAIT_MS, and null when the
 * prompt is answered after that. start() again for the same prompt (its later notification) changes nothing.
 */
export class PromptWait {
  private timer: NodeJS.Timeout | undefined;
  private toldOverlord = false;
  private what = '';

  constructor(private readonly told: (text: string | null) => void) {}

  start(what: string) {
    this.what = what || this.what || 'a tool';
    if (this.timer || this.toldOverlord) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.toldOverlord = true;
      this.told(waitingText(this.what));
    }, PERMISSION_WAIT_MS);
  }

  clear() {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.toldOverlord) this.told(null);
    this.toldOverlord = false;
    this.what = '';
  }
}
