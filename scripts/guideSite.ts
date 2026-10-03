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

function blockHtml(b: GuideBlock, first: boolean): string {
  switch (b.kind) {
    case 'p':
      return `<p${first ? ' class="opening"' : ''}>${inlineHtml(b.text)}</p>`;
    case 'h':
      return `<h2>${inlineHtml(b.text)}</h2>`;
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

function page(opts: { title: string; description: string; path: string; body: string }): string {
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
<main class="leaf">
<div class="char" aria-hidden="true"></div>
<div class="paper" aria-hidden="true"></div>
<div class="ink">
${opts.body}
</div>
</main>
</body>
</html>
`;
}

const running = `<p class="running"><a href="/">Code Dungeon · The User Guide</a></p>`;

/** Shown only on the website, for readers who have never seen the dungeon. */
const PROLOGUE = [
  'Code Dungeon is a software workshop drawn as a medieval dungeon. You walk through it in first person, from a great hall down a torchlit gallery into a chamber for each of your projects. The people at the workbenches are real AI coding agents, each running in its own terminal on your computer and working through the GitHub issues of that project.',
  'Nothing in it is pretend. The slate on a workbench is that coder\'s live terminal. The notice board is the project\'s real issues and pull requests. When a pull request has passed the testers in the assay room, it is merged on GitHub. You are the Overlord: you set the work, recruit the guild, and step in whenever you like.',
  'It runs on your own machine: Node.js, git, the GitHub command line signed in to your account, and a coding agent (Claude Code by default; Codex or OpenCode if you have them). Code Dungeon is made by BrainIT Consulting, built on cubefarm by Leon van Zyl.',
];

export function buildSite(chapters: readonly GuideChapter[]): Record<string, string> {
  const files: Record<string, string> = {};
  const contents = chapters
    .map((c, i) => `<li><a href="/${chapterFile(c).replace(/\.html$/, '')}"><span class="num">${roman(i + 1)}</span><span class="name">${esc(c.title)}</span></a></li>`)
    .join('');
  files['index.html'] = page({
    title: SITE.title,
    description: SITE.description,
    path: '/',
    body: `<header class="title-page">
<p class="kicker">Being a true account of</p>
<h1>Code Dungeon</h1>
<p class="subtitle">The User Guide</p>
<p class="mark" aria-hidden="true">✶</p>
</header>
<section class="prologue">
<h2>Before you go down</h2>
${PROLOGUE.map((t, i) => `<p${i === 0 ? ' class="opening"' : ''}>${esc(t)}</p>`).join('\n')}
</section>
<nav class="contents" id="contents" aria-label="Chapters">
<h2>Contents</h2>
<ol>${contents}</ol>
</nav>`,
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
      body: `${running}
<article>
<header class="chapter-head"><p class="chapter-num">Chapter ${roman(i + 1)}</p><h1>${esc(c.title)}</h1></header>
${c.blocks.map((b, k) => blockHtml(b, k === 0)).join('\n')}
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
