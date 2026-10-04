import { describe, expect, it } from 'vitest';
import { tagIcon } from './tagIcon';

const a = (over: Partial<Parameters<typeof tagIcon>[0]>) => ({ status: 'idle', role: 'dev', currentTool: null, ...over }) as Parameters<typeof tagIcon>[0];

describe("a name tag's icon", () => {
  it('says what a working coder is doing', () => {
    expect(tagIcon(a({ status: 'working', currentTool: 'mcp__playwright__browser_click' }))).toBe('globe');
    expect(tagIcon(a({ status: 'working', currentTool: 'Bash' }))).toBe('hammer');
    expect(tagIcon(a({ status: 'working', currentTool: 'Edit' }))).toBe('quill');
    expect(tagIcon(a({ status: 'working' }))).toBe('candle');
  });

  it('marks the other states with woodcut icons, never emoji', () => {
    expect(tagIcon(a({ status: 'preparing' }))).toBe('chest');
    expect(tagIcon(a({ status: 'done' }))).toBe('check');
    expect(tagIcon(a({ status: 'error' }))).toBe('warning');
    expect(tagIcon(a({ status: 'stopped' }))).toBe('hourglass');
  });

  it('gives an idle coder a mug, an idle tester a flask and the DungeonMaster a crown', () => {
    expect(tagIcon(a({}))).toBe('mug');
    expect(tagIcon(a({ role: 'qa' }))).toBe('flask');
    expect(tagIcon(a({ role: 'ceo' }))).toBe('crown');
  });
});
