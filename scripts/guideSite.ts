// The public Code Dungeon User Guide (codedungeon-guide on Vercel), built from the same chapters as the in-app
// guide (client/src/ui/userGuideChapters.ts), so the two never say different things. Pure: chapters in, a map of
// file paths to contents out. scripts/build-guide-site.ts writes them to a folder.

import { type GuideBlock, type GuideChapter, parseInline, roman } from '../client/src/ui/guideBook.ts';

export const SITE = {
  title: 'The Code Dungeon User Guide',
  description: 'How Code Dungeon works: a medieval dungeon you walk through, where every coder is a real AI coding agent working on your GitHub projects.',
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A line of chapter text with its [[Key]], `code` and **bold** marks turned into HTML. */
export function inlineHtml(line: string): string {
  return parseInline(line)
    .map((p) => (p.kind === 'key' ? `<kbd>${esc(p.text)}</kbd>` : p.kind === 'code' ? `<code>${esc(p.text)}</code>` : p.kind === 'bold' ? `<strong>${esc(p.text)}</strong>` : esc(p.text)))
    .join('');
}

/** A heading's anchor: its words, lower case, joined by dashes (marks dropped). */
export function slug(text: string): string {
  const plain = parseInline(text).map((p) => p.text).join('');
  return plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'section';
}

/** The section headings of a chapter, each with an id unique on its page. */
function sections(c: GuideChapter): { id: string; text: string }[] {
  const seen = new Map<string, number>();
  return c.blocks
    .filter((b): b is Extract<GuideBlock, { kind: 'h' }> => b.kind === 'h')
    .map((b) => {
      const base = slug(b.text);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      return { id: n === 1 ? base : `${base}-${n}`, text: b.text };
    });
}

function blockHtml(b: GuideBlock, first: boolean, id?: string): string {
  switch (b.kind) {
    case 'p':
      return `<p${first ? ' class="opening"' : ''}>${inlineHtml(b.text)}</p>`;
    case 'h':
      return `<h2 id="${id}">${inlineHtml(b.text)}</h2>`;
    case 'list':
      return `<ul>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join('')}</ul>`;
    case 'keys':
      return `<table class="keys"><tbody>${b.rows.map(([k, what]) => `<tr><th scope="row">${esc(k)}</th><td>${inlineHtml(what)}</td></tr>`).join('')}</tbody></table>`;
  }
}

export const chapterFile = (c: GuideChapter) => `${c.id}.html`;

const FILTERS = `<svg class="defs" aria-hidden="true" width="0" height="0">
  <filter id="burn" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="4" seed="11" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="34" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="char" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="4" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="46" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`;

function page(opts: { title: string; description: string; path: string; body: string; toc: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400;0,600;0,700;1,400&family=Alegreya+SC:wght@500;700&family=Courier+Prime&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
${FILTERS}
<div class="book">
${opts.toc}
<main class="leaf">
<div class="char" aria-hidden="true"></div>
<div class="paper" aria-hidden="true"></div>
<div class="ink">
${opts.body}
</div>
</main>
</div>
<script src="/guide.js" defer></script>
</body>
</html>
`;
}

const running = `<p class="running"><a href="/">Code Dungeon · The User Guide</a></p>`;

/**
 * Chapters only the website has, after the in-app ones (so the chapter numbers the text refers to stay right): how to
 * get Code Dungeon onto your own computer. Readers of the in-app guide already have it.
 */
export const SITE_CHAPTERS: GuideChapter[] = [
  {
    id: 'quick-start',
    title: 'Quick start',
    blocks: [
      {
        kind: 'p',
        text: "Code Dungeon is shown at BrainIT Consulting's workshops, running on a real project. Its code is not public yet. It will be published as open source, free to use, and when it is, this chapter will give you the one line that sets it up on your own computer and opens the dungeon in your browser.",
      },
      { kind: 'h', text: 'What to have ready' },
      {
        kind: 'list',
        items: [
          '**A Windows 10 or 11 computer.** Linux works too.',
          '**Node.js** 22 or newer, from nodejs.org.',
          '**git**, from git-scm.com.',
          '**A GitHub account** and the GitHub command line, signed in: install it from cli.github.com, then run `gh auth login`. Every project in the dungeon lives on GitHub.',
          '**A Claude subscription.** The coders are Claude Code; you sign it in once.',
          '**Google Chrome**, so the testers can try your app in a real browser.',
          '**A Vercel account**, only if you want to put your apps on the internet from the dungeon.',
        ],
      },
      { kind: 'h', text: 'When it is published' },
      {
        kind: 'p',
        text: 'You will paste one line into a terminal. It fetches Code Dungeon, checks that your computer has what it needs, and opens the dungeon. A demo mode with pretend projects and pretend coders lets you walk round first without touching your own work or spending any of your subscription.',
      },
      {
        kind: 'p',
        text: 'Until then, the chapters before this one show how it all works, and a workshop is the place to see it running.',
      },
    ],
  },
];

/** Shown only on the website, for readers who have never seen the dungeon. */
const PROLOGUE = [
  'Code Dungeon is a software workshop drawn as a medieval dungeon. You walk through it in first person, from a great hall down a torchlit gallery into a chamber for each of your projects. The people at the workbenches are real AI coding agents, each running in its own terminal on your computer and working through the GitHub issues of that project.',
  'Nothing in it is pretend. The slate on a workbench is that coder\'s live terminal. The notice board is the project\'s real issues and pull requests. When a pull request has passed the testers in the assay room, it is merged on GitHub. You are the Overlord: you set the work, recruit the guild, and step in whenever you like.',
  'It runs on your own machine: Node.js, git, the GitHub command line signed in to your account, and a coding agent (Claude Code by default; Codex or OpenCode if you have them). Code Dungeon is made by BrainIT Consulting.',
];

/** The contents column: every chapter, the one being read marked and opened out to its sections; the text size buttons. */
function toc(chapters: readonly GuideChapter[], current: string | null): string {
  const here = (yes: boolean) => (yes ? ' aria-current="page"' : '');
  const items = chapters
    .map((c, i) => {
      const open = c.id === current;
      const subs = open
        ? `<ol class="sections">${sections(c)
            .map((s) => `<li><a class="section" href="#${s.id}">${inlineHtml(s.text)}</a></li>`)
            .join('')}</ol>`
        : '';
      return `<li${open ? ' class="here"' : ''}><a${here(open)} href="/${c.id}"><span class="num">${roman(i + 1)}</span><span class="name">${esc(c.title)}</span></a>${subs}</li>`;
    })
    .join('');
  return `<nav class="toc" id="contents" aria-label="Contents">
<div class="char" aria-hidden="true"></div>
<div class="paper" aria-hidden="true"></div>
<details class="toc-fold" open>
<summary>Contents</summary>
<p class="toc-title"><a${here(current === null)} href="/">Code Dungeon<span>The User Guide</span></a></p>
<ol class="chapters">${items}</ol>
<div class="textsize" role="group" aria-label="Text size">
<button type="button" data-size="-1" aria-label="Smaller text">A−</button>
<button type="button" data-size="0" aria-label="Normal text size">A</button>
<button type="button" data-size="1" aria-label="Larger text">A+</button>
</div>
</details>
</nav>`;
}

/** A chapter's blocks as HTML, each section heading given its anchor. */
function chapterBody(c: GuideChapter): string {
  const ids = sections(c).map((x) => x.id);
  let h = 0;
  return c.blocks.map((b, k) => blockHtml(b, k === 0, b.kind === 'h' ? ids[h++] : undefined)).join('\n');
}

export function buildSite(chapters: readonly GuideChapter[]): Record<string, string> {
  const files: Record<string, string> = {};
  files['index.html'] = page({
    title: SITE.title,
    description: SITE.description,
    path: '/',
    toc: toc(chapters, null),
    body: `<header class="title-page">
<p class="kicker">Being a true account of</p>
<h1>Code Dungeon</h1>
<p class="subtitle">The User Guide</p>
<p class="mark" aria-hidden="true">✶</p>
${chapters.some((c) => c.id === 'quick-start') ? '<p class="begin"><a href="/quick-start">New here? The quick start →</a></p>' : ''}
</header>
<section class="prologue">
<h2>Before you go down</h2>
${PROLOGUE.map((t, i) => `<p${i === 0 ? ' class="opening"' : ''}>${esc(t)}</p>`).join('\n')}
<p class="begin"><a href="/${chapters[0]?.id ?? ''}">Begin with chapter I →</a></p>
</section>`,
  });
  chapters.forEach((c, i) => {
    const prev = chapters[i - 1];
    const next = chapters[i + 1];
    const link = (ch: GuideChapter, n: number, rel: string, label: string) =>
      `<a rel="${rel}" href="/${chapterFile(ch).replace(/\.html$/, '')}">${label} Chapter ${roman(n)}<span class="name">${esc(ch.title)}</span></a>`;
    files[chapterFile(c)] = page({
      title: `${c.title} · ${SITE.title}`,
      description: `Chapter ${roman(i + 1)} of the Code Dungeon User Guide: ${c.title}.`,
      path: `/${c.id}`,
      toc: toc(chapters, c.id),
      body: `${running}
<article>
<header class="chapter-head"><p class="chapter-num">Chapter ${roman(i + 1)}</p><h1>${esc(c.title)}</h1></header>
${chapterBody(c)}
</article>
<nav class="turn" aria-label="Turn the page">
${prev ? link(prev, i, 'prev', '←') : '<span></span>'}
<a class="to-contents" href="/#contents">Contents</a>
${next ? link(next, i + 2, 'next', '→') : '<span></span>'}
</nav>`,
    });
  });
  return files;
}
