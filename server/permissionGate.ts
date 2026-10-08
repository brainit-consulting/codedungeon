// Permission prompts a coder's Claude Code shows despite the office's PreToolUse "allow": writes into protected paths
// such as .claude and .git, and removals Claude Code flags as critical (a drive's top-level folder, home, the working
// directory). Nobody is at the terminal to answer, so a coder sat at one for 8.5 hours on 7 October. The office
// answers yes through the PermissionRequest hook, except to a removal: measured the same day, that hook can approve
// even a critical-path rm, so those stay a prompt and the Overlord is told when one has waited too long. The one
// removal it does answer is one it can read with certainty as staying inside the dungeon's own scratch folder: Godric
// waited four hours on 8 October to clear old frames from his scratchpad there.

import fs from 'node:fs';
import path from 'node:path';

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

/**
 * The office's answer to a PermissionRequest hook: 'allow', or null to leave the prompt for the Overlord. A removal
 * is allowed only when every one in the command line stays strictly inside `scratch` (the dungeon's tmp folder).
 */
export function permissionAnswer(b: Record<string, unknown>, scratch: string): 'allow' | null {
  const input = (b.tool_input ?? {}) as Record<string, unknown>;
  const command = typeof input.command === 'string' ? input.command : '';
  if (!command || !isRemoval(command)) return 'allow';
  return removesOnlyScratch(command, scratch, b.tool_name === 'PowerShell' ? 'ps' : 'sh') ? 'allow' : null;
}

// ---------- reading a removal ----------

const CD = new Set(['cd', 'chdir', 'pushd', 'sl', 'set-location', 'push-location']);
const CMD_FLAG = new Set(['rd', 'rmdir', 'del', 'erase']); // cmd's /s /q style flags
/** Characters that make a word mean something other than its text: expansions, lists, redirects, home. */
const UNSAFE = /[$%~`,;{}<>|!&\r\n\0]/;

/**
 * Whether every removal in `command` stays strictly inside `scratch`. Anything it can't read with certainty answers
 * false: subshells and expansions, the scratch folder itself, a glob over its top level, links out of it, and a
 * relative path unless the same line moved into a known folder first (a `cd` counts only when `&&` joins it to what
 * follows). The hook's own `cwd` isn't trusted: Claude Code's idea of the folder may not be where its shell is.
 */
function removesOnlyScratch(command: string, scratch: string, shell: 'sh' | 'ps'): boolean {
  if (/[()`]/.test(command)) return false;
  const parts = command.split(/(&&|\|\||[;&|\n])/);
  let here: string | null = null;
  let moved = false;
  for (let i = 0; i < parts.length; i += 2) {
    if (i > 0 && parts[i - 1] !== '&&' && moved) here = null; // a cd that may have failed, or ran in a pipe
    const words = splitWords(parts[i], shell);
    if (!words) return false;
    while (words.length && /^(sudo|command|exec)$/i.test(words[0])) words.shift();
    const first = (words[0] ?? '').toLowerCase().replace(/\.exe$/, '');
    const args = words.slice(1);
    if (CD.has(first)) {
      const to = args.filter((a) => !a.startsWith('-'));
      here = to.length === 1 ? resolveWord(to[0], here) : null;
      moved = true;
    } else if (first === 'git' && isRemoval(parts[i])) {
      return false;
    } else if (isRemoval(parts[i])) {
      const end = args.indexOf('--');
      const flag = (a: string) => a.startsWith('-') || (CMD_FLAG.has(first) && /^\/[a-z?]$/i.test(a));
      const targets = end < 0 ? args.filter((a) => !flag(a)) : [...args.slice(0, end).filter((a) => !flag(a)), ...args.slice(end + 1)];
      if (!targets.length || !targets.every((t) => insideScratch(t, here, scratch))) return false;
    }
  }
  return true;
}

/** A segment's words as the shell would pass them, quotes removed; null when it can't be read with certainty. */
function splitWords(s: string, shell: 'sh' | 'ps'): string[] | null {
  const words: string[] = [];
  let word = '';
  let started = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'" || c === '"') {
      const end = s.indexOf(c, i + 1);
      if (end < 0) return null;
      const inner = s.slice(i + 1, end);
      if (c === '"' && (inner.includes('$') || (shell === 'sh' && /\\[$`"\\\n]/.test(inner)))) return null;
      word += inner;
      started = true;
      i = end;
    } else if (/\s/.test(c)) {
      if (started) words.push(word);
      word = '';
      started = false;
    } else {
      if (c === '\\' && shell === 'sh') return null; // bash would take it as an escape
      word += c;
      started = true;
    }
  }
  if (started) words.push(word);
  return words;
}

/** A word as an absolute path, or null when it isn't a plain path the shell passes as written. */
function resolveWord(word: string, here: string | null): string | null {
  if (!word || UNSAFE.test(word) || /^[a-z]:(?![\\/])/i.test(word)) return null;
  let p = word;
  if (process.platform === 'win32') p = p.replace(/^\/([a-z])(?=\/|$)/i, '$1:'); // Git Bash's /h/... for H:\...
  if (path.isAbsolute(p)) return path.resolve(p);
  return here ? path.resolve(here, p) : null;
}

/** Whether a removal target stays strictly inside `scratch`, following links on the way. */
function insideScratch(word: string, here: string | null, scratch: string): boolean {
  const segments = word.split(/[\\/]/);
  const glob = (s: string) => /[*?[\]]/.test(s);
  if (segments.slice(0, -1).some(glob)) return false;
  const full = resolveWord(word, here);
  if (!full) return false;
  const target = glob(segments[segments.length - 1]) ? path.dirname(full) : full;
  const within = (root: string, p: string) => {
    const rel = path.relative(root, p);
    return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  };
  if (!within(path.resolve(scratch), target)) return false;
  let existing = target;
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
  try {
    const real = fs.realpathSync.native(existing);
    const realRoot = fs.realpathSync.native(scratch);
    return real === realRoot ? existing !== target : within(realRoot, real);
  } catch {
    return false;
  }
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
