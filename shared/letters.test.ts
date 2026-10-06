// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { LETTER_MAX, forTheScroll, letterProblem } from './letters';

describe('letters on the scroll', () => {
  it('takes a long letter whole: a brief with notes pasted in, well past the old 4,000', () => {
    expect(LETTER_MAX).toBeGreaterThanOrEqual(20_000);
    expect(letterProblem('a'.repeat(LETTER_MAX))).toBeNull();
  });

  it("refuses one that's too long, saying how long and what to do, rather than cutting it short without a word", () => {
    const problem = letterProblem('a'.repeat(LETTER_MAX + 1234));
    expect(problem).toMatch(/too long/i);
    expect(problem).toContain((LETTER_MAX + 1234).toLocaleString('en-US'));
    expect(problem).toContain(LETTER_MAX.toLocaleString('en-US'));
    expect(problem).toMatch(/two parts/i);
  });

  it('refuses an empty one', () => {
    expect(letterProblem('   \n ')).toMatch(/empty/i);
  });

  it('leaves a reply alone, and one too long for the scroll ends saying it was cut', () => {
    expect(forTheScroll('Done: three issues filed.')).toBe('Done: three issues filed.');
    const long = forTheScroll('b'.repeat(LETTER_MAX + 500));
    expect(long.length).toBeLessThanOrEqual(LETTER_MAX);
    expect(long).toMatch(/cut short/i);
  });
});
