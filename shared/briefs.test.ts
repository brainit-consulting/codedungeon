import { describe, expect, it } from 'vitest';
import { BRIEF_MAX, briefCount, tooLong } from './briefs.ts';

describe('tooLong', () => {
  it('lets a brief at the limit through', () => {
    expect(tooLong('QA brief', 'x'.repeat(BRIEF_MAX), BRIEF_MAX)).toBeNull();
  });

  it('counts the text as saved, without the spaces around it', () => {
    expect(tooLong('QA brief', `  ${'x'.repeat(BRIEF_MAX)}\n\n`, BRIEF_MAX)).toBeNull();
  });

  it('refuses a longer brief and says by how much, instead of cutting it', () => {
    expect(tooLong('QA brief', 'x'.repeat(2612), BRIEF_MAX)).toBe(
      'The QA brief is 2,612 characters, over the 2,500 limit. Shorten it by 112 and save again: nothing was saved.',
    );
  });
});

describe('briefCount', () => {
  it('shows what will be saved against the limit', () => {
    expect(briefCount(` ${'x'.repeat(2346)} `, BRIEF_MAX)).toBe('2,346 / 2,500');
  });
});
