import { describe, expect, it } from 'vitest';
import { chapterIndex, parseInline, roman, stepChapter } from './guideBook';
import { CHAPTERS } from './userGuideChapters';

describe('stepChapter', () => {
  it('turns one chapter at a time', () => {
    expect(stepChapter(2, 1, 9)).toBe(3);
    expect(stepChapter(2, -1, 9)).toBe(1);
  });
  it('stops at the first and last chapter instead of wrapping', () => {
    expect(stepChapter(0, -1, 9)).toBe(0);
    expect(stepChapter(8, 1, 9)).toBe(8);
    expect(stepChapter(3, 50, 9)).toBe(8);
  });
  it('copes with an empty book', () => {
    expect(stepChapter(0, 1, 0)).toBe(0);
  });
});

describe('chapterIndex', () => {
  it('finds a chapter by id and falls back to the first', () => {
    expect(chapterIndex(CHAPTERS, 'quick-start')).toBe(CHAPTERS.length - 1);
    expect(chapterIndex(CHAPTERS, 'keys')).toBe(CHAPTERS.length - 2);
    expect(chapterIndex(CHAPTERS, 'no-such-chapter')).toBe(0);
    expect(chapterIndex(CHAPTERS, undefined)).toBe(0);
  });
});

describe('roman', () => {
  it('numbers chapters the old way', () => {
    expect([1, 4, 9, 14, 40, 1994].map(roman)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL', 'MCMXCIV']);
    expect(roman(0)).toBe('');
  });
});

describe('parseInline', () => {
  it('splits keys, code and bold from plain text', () => {
    expect(parseInline('Press [[E]] then run `gh auth login` and **wait**.')).toEqual([
      { kind: 'text', text: 'Press ' },
      { kind: 'key', text: 'E' },
      { kind: 'text', text: ' then run ' },
      { kind: 'code', text: 'gh auth login' },
      { kind: 'text', text: ' and ' },
      { kind: 'bold', text: 'wait' },
      { kind: 'text', text: '.' },
    ]);
  });
  it('leaves unclosed marks as plain text', () => {
    expect(parseInline('a [[b and `c')).toEqual([{ kind: 'text', text: 'a [[b and `c' }]);
  });
});

describe('the chapters', () => {
  it('have unique ids and titles, and some text', () => {
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
    expect(new Set(CHAPTERS.map((c) => c.title)).size).toBe(CHAPTERS.length);
    for (const c of CHAPTERS) expect(c.blocks.length).toBeGreaterThan(0);
  });
  it('each open with a paragraph that starts with a letter, for the drop cap', () => {
    for (const c of CHAPTERS) {
      const first = c.blocks[0];
      expect(first.kind, c.id).toBe('p');
      expect(first.kind === 'p' && /^[A-Za-z]/.test(first.text), c.id).toBe(true);
    }
  });
  it('close every inline mark they open', () => {
    const lines = CHAPTERS.flatMap((c) =>
      c.blocks.flatMap((b) => (b.kind === 'p' || b.kind === 'h' ? [b.text] : b.kind === 'list' ? b.items : b.kind === 'keys' ? b.rows.flat() : [])),
    );
    for (const line of lines) {
      const plain = parseInline(line)
        .filter((r) => r.kind === 'text')
        .map((r) => r.text)
        .join('');
      expect(plain, line).not.toMatch(/\[\[|\]\]|`|\*\*/);
    }
  });
  it('avoid the words a manual should not use', () => {
    const text = JSON.stringify(CHAPTERS).toLowerCase();
    for (const word of ['delve', 'seamless', 'leverage', 'unlock', 'elevate', 'robust', 'game-changer', 'supercharge']) expect(text, word).not.toContain(word);
  });
});

describe('chapter numbers in the text', () => {
  it('are Roman, like the chapter headings, and name a chapter that exists', () => {
    const text = CHAPTERS.flatMap((c) => c.blocks.flatMap((b) => (b.kind === 'list' ? b.items : b.kind === 'keys' ? b.rows.flat() : [b.text]))).join('\n');
    expect(text).not.toMatch(/chapter \d/i);
    const valid = new Set(CHAPTERS.map((_, i) => roman(i + 1)));
    for (const m of text.matchAll(/chapter ([IVXLC]+)\b/g)) expect(valid, `chapter ${m[1]}`).toContain(m[1]);
  });
});

describe('links in chapter text', () => {
  it('reads [text](https://…) as a link', () => {
    expect(parseInline('Get it from [nodejs.org](https://nodejs.org), then go on.')).toEqual([
      { kind: 'text', text: 'Get it from ' },
      { kind: 'link', text: 'nodejs.org', href: 'https://nodejs.org' },
      { kind: 'text', text: ', then go on.' },
    ]);
  });

  it('leaves anything that is not an http(s) address as plain text', () => {
    expect(parseInline('a [x](javascript:alert(1)) b')).toEqual([{ kind: 'text', text: 'a [x](javascript:alert(1)) b' }]);
    expect(parseInline('[[E]] still a key')[0]).toEqual({ kind: 'key', text: 'E' });
  });
});
