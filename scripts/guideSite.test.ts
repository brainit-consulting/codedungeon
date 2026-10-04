import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../client/src/ui/userGuideChapters.ts';
import { SITE_CHAPTERS, buildSite, chapterFile, inlineHtml } from './guideSite.ts';

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

describe('the guide as a book with a contents column', () => {
  const files = buildSite(CHAPTERS);
  const pages = Object.entries(files).filter(([name]) => name.endsWith('.html'));

  it('says who makes it and nothing more', () => {
    for (const [, html] of pages) expect(html).not.toMatch(/built on cubefarm|Leon van Zyl/);
  });

  it('shows every chapter in the contents column on every page, and marks the one you are reading', () => {
    for (const [name, html] of pages) {
      const toc = html.slice(html.indexOf('<nav class="toc"'), html.indexOf('</nav>', html.indexOf('<nav class="toc"')));
      for (const c of CHAPTERS) expect(toc, `${name} lists ${c.id}`).toContain(`href="/${c.id}"`);
      const current = [...toc.matchAll(/aria-current="page"[^>]*href="\/([\w-]*)"/g)].map((m) => m[1]);
      expect(current, name).toEqual(name === 'index.html' ? [''] : [name.replace(/\.html$/, '')]);
    }
  });

  it("lists the chapter's sections under it, each pointing at a heading on the page", () => {
    for (const c of CHAPTERS) {
      const html = files[chapterFile(c)];
      const ids = [...html.matchAll(/<h2 id="([\w-]+)"/g)].map((m) => m[1]);
      if (c.blocks.some((b) => b.kind === 'h')) expect(ids.length, `${c.id} has section ids`).toBeGreaterThan(0);
      expect(new Set(ids).size, `${c.id} heading ids are unique`).toBe(ids.length);
      const links = [...html.matchAll(/<a class="section" href="#([\w-]+)"/g)].map((m) => m[1]);
      expect(links, c.id).toEqual(ids);
    }
  });

  it('has the larger and smaller text buttons on every page', () => {
    for (const [name, html] of pages) {
      expect(html, name).toContain('aria-label="Smaller text"');
      expect(html, name).toContain('aria-label="Larger text"');
      expect(html, name).toContain('<script src="/guide.js" defer></script>');
    }
  });
});

describe('the quick start (website only)', () => {
  const files = buildSite([...CHAPTERS, ...SITE_CHAPTERS]);

  it('comes last, so the chapter numbers the text refers to stay right, and the title page points to it', () => {
    expect(SITE_CHAPTERS.map((c) => c.id)).toEqual(['quick-start']);
    expect(files['quick-start.html']).toContain('Quick start');
    expect(files['index.html']).toContain('href="/quick-start"');
    expect(CHAPTERS.map((c) => c.id)).not.toContain('quick-start');
  });

  it("says the code isn't public yet, and what to have ready", () => {
    const html = files['quick-start.html'];
    expect(html).toMatch(/not public yet/i);
    for (const need of ['Node.js', 'git', 'GitHub', 'Claude']) expect(html).toContain(need);
  });
});

describe('icons on the site', () => {
  it('draws an emoji the dungeon has a woodcut for as that woodcut, in plain text and in bold', () => {
    const html = inlineHtml('press **🚢 Ship** or 📜 your scroll');
    expect(html).not.toContain('🚢');
    expect(html).not.toContain('📜');
    expect(html.match(/<svg class="ico"/g)).toHaveLength(2);
    expect(html).toContain('<strong><svg class="ico"');
    expect(html).toContain(' Ship</strong>');
  });

  it('leaves text without emoji exactly as before', () => {
    expect(inlineHtml('a **bold** [[E]] `code` & <tag>')).toBe('a <strong>bold</strong> <kbd>E</kbd> <code>code</code> &amp; &lt;tag&gt;');
  });

  it('puts no raw emoji with a drawing anywhere on the site', () => {
    const pages = Object.values(buildSite([...CHAPTERS, ...SITE_CHAPTERS])).join('\n');
    expect(pages).not.toMatch(/🚢|📜|⚙|🔍|🏰/u);
  });
});
