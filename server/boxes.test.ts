import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOX_EVENT_SOURCE, boxApiKey, eventLines, gitEnv, launchScript, parseRegValue, prepareDeskScript, shq, signedIn, signInCheck } from './boxes.ts';

/** Runs the box's event program here, as the CLI in a box would. */
function runEvent(dir: string, args: string[], stdin = '') {
  const script = path.join(dir, 'event.cjs');
  fs.writeFileSync(script, BOX_EVENT_SOURCE);
  return execFileSync(process.execPath, [script, ...args], { input: stdin, encoding: 'utf8', env: { ...process.env, CD_EVENTS_FILE: path.join(dir, 'events.jsonl') } });
}

describe('the event program in a box', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'box events '));
  const file = path.join(dir, 'events.jsonl');

  it('allows every tool call itself and writes the hook down for the office', () => {
    const out = runEvent(dir, ['hook'], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', session_id: 's1' }));
    expect(JSON.parse(out).hookSpecificOutput.permissionDecision).toBe('allow');
    const { events } = eventLines(fs.readFileSync(file, 'utf8'));
    expect(events.at(-1)).toMatchObject({ hook_event_name: 'PreToolUse', tool_name: 'Bash', session_id: 's1' });
  });

  it('answers a permission request with allow, and other hooks with nothing', () => {
    expect(JSON.parse(runEvent(dir, ['hook'], JSON.stringify({ hook_event_name: 'PermissionRequest' }))).hookSpecificOutput.decision.behavior).toBe('allow');
    expect(runEvent(dir, ['hook'], JSON.stringify({ hook_event_name: 'Stop', last_assistant_message: 'done' }))).toBe('{}');
  });

  it("prints the office's status line and passes the status on", () => {
    const out = runEvent(dir, ['status', '🏰 Code Dungeon · Ada'], JSON.stringify({ session_id: 's1', cost: { total_cost_usd: 0.42 }, rate_limits: { five_hour: { used_percentage: 12 } } }));
    expect(out).toBe('🏰 Code Dungeon · Ada');
    expect(eventLines(fs.readFileSync(file, 'utf8')).events.at(-1)).toMatchObject({ hook_event_name: 'StatusLine', cost: { total_cost_usd: 0.42 } });
  });

  it("turns Codex's turn-complete notice into TurnComplete", () => {
    runEvent(dir, ['notify', JSON.stringify({ type: 'agent-turn-complete', 'thread-id': 't9', 'last-assistant-message': 'PR opened', 'input-messages': ['Please resolve #4'] })]);
    expect(eventLines(fs.readFileSync(file, 'utf8')).events.at(-1)).toMatchObject({ hook_event_name: 'TurnComplete', session_id: 't9', last_assistant_message: 'PR opened', input: 'Please resolve #4' });
  });
});

describe('eventLines', () => {
  it('keeps a line still being written for later and skips broken ones', () => {
    const { events, rest } = eventLines('{"a":1}\nnot json\n{"b":2}\n{"c":');
    expect(events).toEqual([{ a: 1 }, { b: 2 }]);
    expect(rest).toBe('{"c":');
  });
});

describe('quoting for a box', () => {
  it('keeps any text as one bash argument', () => {
    expect(shq("it's $HOME `x`")).toBe(`'it'"'"'s $HOME \`x\`'`);
  });

  it("writes a launch script that runs the CLI with its arguments as given and saves its exit code", () => {
    const s = launchScript({ cwd: '/home/boxuser/desks/a__b', file: 'claude', args: ['--', "fix #3: don't break $PATH"], env: { TERM: 'xterm-256color', GH_TOKEN: 'secret' }, exitFile: '/x/exit' });
    expect(s).toContain(`export GH_TOKEN='secret'`);
    expect(s).toContain(`cd '/home/boxuser/desks/a__b' || exit 1`);
    expect(s).toContain(`'claude' '--' 'fix #3: don'"'"'t break $PATH'`);
    expect(s).toContain(`echo $? > '/x/exit'`);
  });
});

describe('desks in a box', () => {
  it('clones once, then resets to the default branch and makes the branch', () => {
    const s = prepareDeskScript('acme/app', { defaultBranch: 'main' }, 'swarm/issue-3-ada');
    expect(s).toContain(`git clone --quiet 'https://github.com/acme/app.git' '/home/boxuser/desks/acme__app'`);
    expect(s).toContain(`'+refs/heads/main:refs/remotes/origin/main'`);
    expect(s).toContain(`git checkout --quiet -B 'swarm/issue-3-ada' 'origin/main'`);
    expect(s).not.toContain('GH_TOKEN=');
  });

  it("checks out a pull request's head for QA and fixes", () => {
    const s = prepareDeskScript('acme/app', { defaultBranch: 'main', pr: 12 }, 'qa/pr-12-bo');
    expect(s).toContain(`'+refs/pull/12/head:refs/remotes/origin/pr-12'`);
    expect(s).toContain(`-B 'qa/pr-12-bo' 'origin/pr-12'`);
  });

  it('passes the GitHub token only through the command environment', () => {
    expect(gitEnv('ghp_x')).toEqual({ GH_TOKEN: 'ghp_x', GIT_TERMINAL_PROMPT: '0' });
    expect(gitEnv(null)).toEqual({ GIT_TERMINAL_PROMPT: '0' });
  });
});

describe('signing in', () => {
  it("reads Claude Code's auth status", () => {
    expect(signInCheck('claude')).toContain('claude auth status --json');
    expect(signedIn('claude', '{\n  "loggedIn": true,\n  "authMethod": "claude.ai"\n}')).toBe(true);
    expect(signedIn('claude', '{"loggedIn": false}')).toBe(false);
    expect(signedIn('claude', 'command not found')).toBe(false);
  });

  it("reads Codex's login status", () => {
    expect(signedIn('codex', 'signed-in\n')).toBe(true);
    expect(signedIn('codex', 'signed-out\n')).toBe(false);
  });
});

describe('the Box API key', () => {
  it('comes from the environment first', () => {
    expect(boxApiKey({ UPSTASH_BOX_API_KEY: 'box_1' }, 'linux')).toBe('box_1');
    expect(boxApiKey({}, 'linux')).toBeNull();
  });

  it("is read from Windows' user environment output", () => {
    const out = '\r\nHKEY_CURRENT_USER\\Environment\r\n    UPSTASH_BOX_API_KEY    REG_SZ    box_abc123\r\n\r\n';
    expect(parseRegValue(out, 'UPSTASH_BOX_API_KEY')).toBe('box_abc123');
    expect(parseRegValue(out, 'OTHER')).toBeNull();
  });
});
