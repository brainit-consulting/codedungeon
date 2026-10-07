import { describe, expect, it, vi } from 'vitest';
import { isRemoval, permissionAnswer, PERMISSION_WAIT_MS, PromptWait, scratchRule, waitingText } from './permissionGate.ts';

const bash = (command: string) => ({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command } });

describe('permissionAnswer', () => {
  it("answers yes to a write into Claude Code's own folder (Maud stalled 8.5 hours on this, 7 Oct)", () => {
    expect(permissionAnswer(bash('echo "- [note](note.md)" >> /c/Users/snake/.claude/projects/H--wildgauls/memory/MEMORY.md'))).toBe('allow');
  });
  it('answers yes to file tools and other tools', () => {
    expect(permissionAnswer({ tool_name: 'Write', tool_input: { file_path: 'H:\\repo\\.git\\info\\exclude' } })).toBe('allow');
    expect(permissionAnswer({ tool_name: 'mcp__playwright__browser_click', tool_input: {} })).toBe('allow');
  });
  it('leaves a removal to the Overlord: Claude Code only asks about removals it flags (a drive folder, home, the working directory)', () => {
    expect(permissionAnswer(bash('git worktree remove --force H:/gqa73 && git worktree prune; rm -rf H:/gqa73'))).toBeNull();
    expect(permissionAnswer(bash('rm -rf H:/codedungeon-home'))).toBeNull();
    expect(permissionAnswer({ tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse -Force H:\\scratch' } })).toBeNull();
  });
});

describe('isRemoval', () => {
  it('finds removal commands wherever they sit in a command line', () => {
    for (const c of ['rm -rf x', 'cd a && rm b', 'rmdir /s /q H:\\x', 'Remove-Item x', 'ri x', 'del /q x', 'erase x', 'rd /s x', 'unlink x', 'sudo rm x', 'echo hi; rm -f y', 'git worktree remove --force H:/x', 'shred x'])
      expect(isRemoval(c), c).toBe(true);
  });
  it('leaves ordinary commands alone, including words that only contain those letters', () => {
    for (const c of ['npm run build', 'git commit -m "remove the old header"', 'echo format', 'grep -r delimiter .', 'node scripts/rdl.mjs', 'ls -la', 'git restore x'])
      expect(isRemoval(c), c).toBe(false);
  });
});

describe('waitingText', () => {
  it('says what Claude Code is asking about, and where to answer', () => {
    expect(waitingText('$ rm -rf H:/gqa73')).toBe("Claude Code is asking before it runs `$ rm -rf H:/gqa73`. Open their terminal and answer it.");
  });
  it('waits ten minutes before telling the Overlord', () => expect(PERMISSION_WAIT_MS).toBe(10 * 60_000));
});

describe('PromptWait', () => {
  it('tells the Overlord once a prompt has waited ten minutes, and says when it is answered', () => {
    vi.useFakeTimers();
    const told: (string | null)[] = [];
    const w = new PromptWait((t) => told.push(t));
    w.start('$ rm -rf H:/gqa73');
    vi.advanceTimersByTime(PERMISSION_WAIT_MS - 1);
    expect(told).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(told).toEqual([waitingText('$ rm -rf H:/gqa73')]);
    w.start('$ rm -rf H:/gqa73'); // the notification for the same prompt: no second message
    vi.advanceTimersByTime(PERMISSION_WAIT_MS);
    expect(told).toHaveLength(1);
    w.clear();
    expect(told).toEqual([waitingText('$ rm -rf H:/gqa73'), null]);
    vi.useRealTimers();
  });
  it('says nothing when the prompt is answered in time', () => {
    vi.useFakeTimers();
    const told: (string | null)[] = [];
    const w = new PromptWait((t) => told.push(t));
    w.start('');
    vi.advanceTimersByTime(60_000);
    w.clear();
    vi.advanceTimersByTime(PERMISSION_WAIT_MS);
    expect(told).toEqual([]);
    vi.useRealTimers();
  });
  it('keeps the most specific description it was given', () => {
    vi.useFakeTimers();
    const told: (string | null)[] = [];
    const w = new PromptWait((t) => told.push(t));
    w.start('$ rm -rf H:/x');
    w.start(''); // the notification fires after the hook, without a command
    vi.advanceTimersByTime(PERMISSION_WAIT_MS);
    expect(told).toEqual([waitingText('$ rm -rf H:/x')]);
    vi.useRealTimers();
  });
});

describe('scratchRule', () => {
  it("tells coders and testers where scratch folders go, and why (Gerard's H:/gqa73 needed an answer nobody gave)", () => {
    expect(scratchRule('H:\codedungeon-home\tmp')).toBe(
      'Make scratch folders and extra git worktrees under H:\codedungeon-home\tmp, never at the top of a drive or in your home folder: Claude Code asks before removing those, and nobody is at your terminal to answer.',
    );
  });
});
