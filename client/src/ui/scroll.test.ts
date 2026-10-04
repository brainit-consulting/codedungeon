import { describe, expect, it } from 'vitest';
import { canonicalHour, presenceText, sealInitial, waxOutline, type PresenceInput } from './scroll';

const at = (h: number, m = 0) => new Date(2026, 9, 3, h, m);

describe('the bell hour', () => {
  it('rings the canonical hours in three-hour watches from midnight', () => {
    expect(canonicalHour(at(0))).toBe('Matins');
    expect(canonicalHour(at(2, 59))).toBe('Matins');
    expect(canonicalHour(at(3))).toBe('Lauds');
    expect(canonicalHour(at(6))).toBe('Prime');
    expect(canonicalHour(at(10, 30))).toBe('Terce');
    expect(canonicalHour(at(12))).toBe('Sext');
    expect(canonicalHour(at(16))).toBe('None');
    expect(canonicalHour(at(18))).toBe('Vespers');
    expect(canonicalHour(at(23, 59))).toBe('Compline');
  });
});

describe('the wax seal', () => {
  it('is one smooth closed outline with a curve per point', () => {
    const d = waxOutline(14, 26, 2.5);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/Q/g)).toHaveLength(14);
  });
  it('stays near its radius, swelling and dipping by the wobble', () => {
    const nums = waxOutline(14, 26, 2.5).match(/-?\d+(\.\d+)?/g)!.map(Number);
    const radii = [];
    for (let i = 0; i < nums.length; i += 2) radii.push(Math.hypot(nums[i] - 32, nums[i + 1] - 32));
    expect(Math.max(...radii)).toBeLessThanOrEqual(26 + 2.5 + 0.01);
    expect(Math.min(...radii)).toBeGreaterThan(26 - 2.5 - 1);
    expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(2);
  });
});

describe('the seal initial', () => {
  it('takes the first letter, capitalised', () => {
    expect(sealInitial('aldric')).toBe('A');
    expect(sealInitial('  Wren')).toBe('W');
    expect(sealInitial('Éowyn')).toBe('É');
  });
  it('falls back to a question mark for an empty name', () => {
    expect(sealInitial('')).toBe('?');
    expect(sealInitial('   ')).toBe('?');
  });
});

describe("the DungeonMaster's presence", () => {
  const idle: PresenceInput = { working: false, replying: false, letterQueued: false, running: 0 };

  it('says they are at the table when nothing is on', () => {
    expect(presenceText(idle)).toBe('at the table');
  });
  it('says they are penning a reply while answering a letter', () => {
    expect(presenceText({ ...idle, working: true, replying: true, jobLabel: 'Replying' })).toBe('penning a reply…');
  });
  it('names other work, lower-cased', () => {
    expect(presenceText({ ...idle, working: true, jobLabel: 'Reviewing the dungeon' })).toBe('at work: reviewing the dungeon');
    expect(presenceText({ ...idle, working: true, jobLabel: 'QA sweep' })).toBe('at work: QA sweep');
    expect(presenceText({ ...idle, working: true })).toBe('at work: busy');
  });
  it('says the letter is being read, or waits for a free slot', () => {
    expect(presenceText({ ...idle, letterQueued: true, running: 1, sessionLimit: 4 })).toBe('reading your letter…');
    expect(presenceText({ ...idle, letterQueued: true, running: 4, sessionLimit: 4 })).toBe('will reply when a session slot frees up (4/4 busy)');
    expect(presenceText({ ...idle, letterQueued: true, running: 9 })).toBe('reading your letter…');
  });
  it('names the next job when idle with work queued', () => {
    expect(presenceText({ ...idle, nextLabel: 'Planning a milestone' })).toBe('next: planning a milestone');
  });
});
