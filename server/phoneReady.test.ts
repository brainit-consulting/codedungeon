import { describe, expect, it } from 'vitest';
import { PHONE_CHECK, PHONE_SIZES, enforcePhoneCheck, phoneCoderLine, phoneQaStep } from './phoneReady.ts';

const report = (checks: { name: string; result: 'pass' | 'fail' | 'skip'; details: string }[], verdict: 'pass' | 'fail' = 'pass') => ({
  verdict,
  summary: 's',
  checks,
  commands: [],
  screenshots: [] as string[],
  fixInstructions: undefined as string | undefined,
});

describe('phone-ready QA', () => {
  it('checks the four agreed sizes', () => {
    expect(PHONE_SIZES.map((s) => `${s.width}x${s.height}`)).toEqual(['375x667', '844x390', '810x1080', '1280x800']);
  });
  it('tells the tester the check name, the sizes and the function', () => {
    const t = phoneQaStep();
    expect(t).toContain(PHONE_CHECK);
    expect(t).toContain('window.__phoneCheck()');
    for (const s of PHONE_SIZES) expect(t).toContain(`${s.width}x${s.height}`);
  });
  it('points coders at the skill on one line', () => {
    const l = phoneCoderLine('X:/skills/mobile-web-polish/SKILL.md');
    expect(l).toContain('X:/skills/mobile-web-polish/SKILL.md');
    expect(l).not.toContain('\n');
  });
  it('adds a skip when the tester left the check out', () => {
    const r = enforcePhoneCheck(report([{ name: 'Unit tests', result: 'pass', details: '' }]), true);
    expect(r.verdict).toBe('pass');
    expect(r.checks.at(-1)).toEqual({ name: PHONE_CHECK, result: 'skip', details: 'Not checked: the tester left the phone check out.' });
  });
  it('a failed check fails the round even if the tester wrote pass', () => {
    const r = enforcePhoneCheck(report([{ name: PHONE_CHECK, result: 'fail', details: '375x667: "Copy" is 75x30px' }]), true);
    expect(r.verdict).toBe('fail');
    expect(r.fixInstructions).toContain('375x667: "Copy" is 75x30px');
  });
  it('a passed check with no fix instructions stays pass', () => {
    const r = enforcePhoneCheck(report([{ name: PHONE_CHECK, result: 'pass', details: 'all four sizes ok' }]), true);
    expect(r).toMatchObject({ verdict: 'pass' });
    expect(r.fixInstructions).toBeUndefined();
  });
  it('off changes nothing', () => {
    const r = report([{ name: PHONE_CHECK, result: 'fail', details: 'x' }]);
    expect(enforcePhoneCheck(r, false)).toBe(r);
  });
});
