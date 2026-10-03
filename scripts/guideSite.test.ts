import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../client/src/ui/userGuideChapters.ts';
import { buildSite, chapterFile, inlineHtml } from './guideSite.ts';

describe('the public User Guide site', () => {
  const files = buildSite(CHAPTERS);

  it('has a title page and one page per chapter of the in-app guide, in order', () => {
    expect(Object.keys(files).sort()).toEqual(['index.html', ...CHAPTERS.map(chapterFile)].sort());
    const index = files['index.html'];
    let at = 0;
    for (const c of CHAPTERS) {
      const found = index.indexOf(`href="/${c.id}"`, at);
      expect(found, c.id).toBeGreaterThan(at);
      at = found;
    }
  });

  it('only links to pages that exist', () => {
    for (const [name, html] of Object.entries(files)) {
      for (const [, href] of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
        if (href === '/' || href === '/style.css' || href === '/favicon.svg') continue;
        expect(files, `${name} links to ${href}`).toHaveProperty(`${href.slice(1)}.html`);
      }
    }
  });

  it('carries every chapter title and its text across, and turns the marks into HTML', () => {
    for (const c of CHAPTERS) expect(files[chapterFile(c)]).toContain(c.title.replace(/'/g, "'"));
    expect(inlineHtml('Press [[E]] then run `gh auth login` **now**')).toBe('Press <kbd>E</kbd> then run <code>gh auth login</code> <strong>now</strong>');
  });

  it('escapes what could be read as HTML', () => {
    expect(inlineHtml('a <script> & "quotes"')).toBe('a &lt;script&gt; &amp; &quot;quotes&quot;');
    expect(inlineHtml('`<b>`')).toBe('<code>&lt;b&gt;</code>');
  });
});
