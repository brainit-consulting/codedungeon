import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { isRemoval, permissionAnswer, PERMISSION_WAIT_MS, PromptWait, scratchRule, waitingText } from './permissionGate.ts';

const bash = (command: string, cwd?: string) => ({ hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command }, cwd });
const pwsh = (command: string, cwd?: string) => ({ hook_event_name: 'PermissionRequest', tool_name: 'PowerShell', tool_input: { command }, cwd });

// A real dungeon home in the test's temp folder: its tmp is the scratch folder, a desk sits beside it.
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
const scratch = path.join(home, 'tmp');
const pad = path.join(scratch, 'claude', 'godric', 'scratchpad');
const desk = path.join(home, 'workspaces', 'wildgauls', 'desks', 'godric');
const outside = path.join(home, 'elsewhere');
for (const d of [path.join(pad, 'prev'), desk, outside]) fs.mkdirSync(d, { recursive: true });
fs.symlinkSync(outside, path.join(scratch, 'link'), 'junction');

describe('permissionAnswer', () => {
  it("answers yes to a write into Claude Code's own folder (Maud stalled 8.5 hours on this, 7 Oct)", () => {
    expect(permissionAnswer(bash('echo "- [note](note.md)" >> /c/Users/snake/.claude/projects/H--wildgauls/memory/MEMORY.md'), scratch)).toBe('allow');
  });
  it('answers yes to file tools and other tools', () => {
    expect(permissionAnswer({ tool_name: 'Write', tool_input: { file_path: 'H:\\repo\\.git\\info\\exclude' } }, scratch)).toBe('allow');
    expect(permissionAnswer({ tool_name: 'mcp__playwright__browser_click', tool_input: {} }, scratch)).toBe('allow');
  });
  it('leaves a removal to the Overlord: Claude Code only asks about removals it flags (a drive folder, home, the working directory)', () => {
    expect(permissionAnswer(bash('git worktree remove --force H:/gqa73 && git worktree prune; rm -rf H:/gqa73'), scratch)).toBeNull();
    expect(permissionAnswer(bash('rm -rf H:/codedungeon-home'), scratch)).toBeNull();
    expect(permissionAnswer({ tool_name: 'PowerShell', tool_input: { command: 'Remove-Item -Recurse -Force H:\\scratch' } }, scratch)).toBeNull();
  });
});

describe('permissionAnswer: removals inside the scratch folder', () => {
  const allow = (b: Record<string, unknown>) => expect(permissionAnswer(b, scratch), String((b.tool_input as { command: string }).command)).toBe('allow');
  const ask = (b: Record<string, unknown>) => expect(permissionAnswer(b, scratch), String((b.tool_input as { command: string }).command)).toBeNull();

  it("answers yes to Godric's command (he waited four hours on it, 8 Oct)", () => {
    allow(bash(`cd "${pad}" && rm -f prev/*; bash prev.sh "Idle:1,Haggle:2"`, desk));
  });
  it('answers yes to removals named by their full path inside it, from Bash or PowerShell', () => {
    allow(bash(`rm -rf "${path.join(pad, 'prev')}"`, desk));
    allow(bash(`rm -f '${path.join(pad, 'prev')}'/*.png "${path.join(pad, 'old.txt')}"`, desk));
    allow(pwsh(`Remove-Item -Recurse -Force '${path.join(pad, 'prev')}'`, desk));
    allow(pwsh(`Remove-Item -Recurse -Force ${path.join(pad, 'prev')}`, desk));
  });
  it("asks about a relative removal without its own cd: the hook's folder may not be where the shell is", () => {
    ask(bash('rm -rf prev', pad));
  });
  it('asks about the scratch folder itself, everything in it at once, or anywhere outside it', () => {
    ask(bash(`rm -rf "${scratch}"`, desk));
    ask(bash(`rm -rf "${scratch}"/*`, desk));
    ask(bash(`rm -rf "${path.join(pad, '..', '..', '..', '..', 'elsewhere')}"`, desk));
    ask(bash(`rm -rf "${path.join(pad, 'prev')}" "${desk}"`, desk));
    ask(bash('rm -rf build', desk));
    ask(bash(`rm -rf "${path.join(scratch, 'link', 'stuff')}"`, desk)); // a junction out of the folder
  });
  it('asks when the folder a relative removal runs in is not certain', () => {
    ask(bash(`cd "${pad}"; rm -f prev/*`, desk)); // a failed cd leaves it in the desk
    ask(bash(`cd "${pad}" || rm -rf *`, desk));
    ask(bash(`(cd "${pad}") && rm -rf *`, desk));
    ask(bash(`cd "${pad}" | rm -rf *`, desk));
    ask(bash('rm -rf prev')); // no working directory in the hook
  });
  it('asks about anything the shell would expand or that it cannot read with certainty', () => {
    ask(bash(`rm -rf "$TMPDIR/x"`, pad));
    ask(bash('rm -rf ~/x', pad));
    ask(bash(`rm -rf $(cat list.txt)`, pad));
    ask(bash(`rm -rf "${pad}`, desk)); // unbalanced quote
    ask(pwsh(`Remove-Item a,${outside}`, pad));
    ask(bash('rm -rf', pad)); // nothing named
  });
  it('asks about git removals wherever they are', () => {
    ask(bash('git clean -fdx', pad));
    ask(bash(`git worktree remove --force "${path.join(pad, 'wt')}"`, desk));
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
