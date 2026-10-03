import type { LogLine, PreviewStatus, PreviewView, RepoView } from '../../../shared/types';
import type { Agent, KanbanCard, KanbanColumns } from '../store';
import { splitIcons } from '../ui/icons';
import { SIGN_INKS, signIcon } from './signIcons';

// 2D canvas painters for everything in the office that shows text: laptop terminals,
// the Kanban whiteboard, signs and name tags.

export const MONO = '"JetBrains Mono", Consolas, "Cascadia Mono", monospace';
// The dungeon's lettering on signs and slates: Alegreya, a calligraphic serif that stays readable.
export const SANS = 'Alegreya, "Iowan Old Style", Georgia, serif';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

// ---------- terminal ----------

const TERM = {
  bg: '#1b1b29',
  bar: '#2a2a3d',
  text: '#e8e8f2',
  tool: '#8be9fd',
  result: '#8d8da8',
  system: '#bd93f9',
  error: '#ff6b6b',
  manager: '#ffb86c',
  done: '#50fa7b',
  thinking: '#f1fa8c',
};

const SPINNER = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
const VERBS = ['Forging', 'Pondering', 'Tinkering', 'Brewing', 'Scribing', 'Scheming', 'Hammering', 'Distilling'];

export function toolVerb(tool: string | null): string {
  if (!tool) return '';
  if (tool.startsWith('mcp__playwright__')) return 'Browsing';
  if (tool === 'Bash' || tool === 'PowerShell') return 'Running';
  if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit') return 'Editing';
  if (tool === 'Read' || tool === 'Grep' || tool === 'Glob') return 'Reading';
  if (tool === 'WebFetch' || tool === 'WebSearch') return 'Researching';
  return tool;
}

export function drawTerminal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  agent: Agent,
  lines: LogLine[],
  shot: HTMLImageElement | null,
  showBrowser: boolean,
  now: number,
  program: string, // the coding agent's command, e.g. claude or codex
) {
  ctx.fillStyle = TERM.bg;
  ctx.fillRect(0, 0, w, h);

  // title bar
  const barH = 30;
  ctx.fillStyle = TERM.bar;
  ctx.fillRect(0, 0, w, barH);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(18 + i * 20, barH / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#b8b8cc';
  ctx.font = `600 14px ${MONO}`;
  ctx.textBaseline = 'middle';
  const job =
    agent.status === 'idle'
      ? 'idle'
      : agent.role === 'ceo'
        ? (agent.issueTitle ?? 'running the dungeon').toLowerCase()
        : agent.task === 'qa'
          ? `QA of PR #${agent.prNumber}`
          : agent.task === 'fix'
            ? `fixing PR #${agent.prNumber}`
            : agent.issueNumber
              ? `issue #${agent.issueNumber}`
              : 'idle';
  const host = agent.role === 'qa' ? 'assay' : agent.role === 'ceo' ? 'keep' : 'dungeon';
  const title = `${agent.name.toLowerCase()}@${host} — ${job} — ${program}`;
  ctx.fillText(title, 84, barH / 2 + 1);

  const termW = showBrowser ? Math.round(w * 0.56) : w;

  if (agent.status === 'idle' && lines.length <= 1) {
    drawScreensaver(ctx, 0, barH, w, h - barH, agent, now);
    return;
  }

  // log lines, newest at the bottom
  const fontSize = 14;
  const lh = 17;
  ctx.font = `${fontSize}px ${MONO}`;
  const charW = ctx.measureText('M').width;
  const cols = Math.max(10, Math.floor((termW - 20) / charW));
  const footer = agent.status === 'working' || agent.status === 'preparing' ? 28 : 8;
  const maxRows = Math.floor((h - barH - 10 - footer) / lh);

  const rows: { text: string; kind: LogLine['kind'] }[] = [];
  for (let i = lines.length - 1; i >= 0 && rows.length < maxRows; i--) {
    const l = lines[i];
    const chunks: string[] = [];
    const text = l.text || ' ';
    for (let p = 0; p < text.length; p += cols) chunks.push(text.slice(p, p + cols));
    for (let c = chunks.length - 1; c >= 0 && rows.length < maxRows; c--) rows.unshift({ text: chunks[c], kind: l.kind });
  }

  let y = barH + 10 + lh / 2;
  for (const r of rows) {
    if (r.kind === 'tool' && r.text.startsWith('⏺')) {
      ctx.fillStyle = TERM.done;
      ctx.fillText('⏺', 10, y);
      ctx.fillStyle = TERM.tool;
      ctx.fillText(r.text.slice(1), 10 + charW, y);
    } else if (r.kind === 'text' && r.text.startsWith('●')) {
      ctx.fillStyle = '#ffffff';
      ctx.fillText('●', 10, y);
      ctx.fillStyle = TERM.text;
      ctx.fillText(r.text.slice(1), 10 + charW, y);
    } else {
      ctx.fillStyle = TERM[r.kind] ?? TERM.text;
      ctx.fillText(r.text, 10, y);
    }
    y += lh;
  }

  if (agent.status === 'working' || agent.status === 'preparing') {
    const frame = Math.floor(now / 120) % SPINNER.length;
    const verb = agent.status === 'preparing' ? 'Setting up worktree' : toolVerb(agent.currentTool) || VERBS[Math.floor(now / 6000) % VERBS.length];
    const secs = agent.startedAt ? Math.floor((Date.now() - agent.startedAt) / 1000) : 0;
    const mm = Math.floor(secs / 60);
    ctx.fillStyle = '#ff9e64';
    ctx.font = `600 ${fontSize}px ${MONO}`;
    ctx.fillText(`${SPINNER[frame]} ${verb}… (${mm}m ${secs % 60}s)`, 10, h - 14);
  }

  if (showBrowser) drawBrowser(ctx, termW, barH, w - termW, h - barH, agent.browserUrl, shot);
}

function drawScreensaver(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, agent: Agent, now: number) {
  const t = now / 1000;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#26264a');
  g.addColorStop(1, '#3b2a55');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const bx = x + w / 2 + Math.sin(t * 0.7) * w * 0.25;
  const by = y + h / 2 + Math.cos(t * 0.9) * h * 0.18;
  ctx.textAlign = 'center';
  ctx.font = `64px ${SANS}`;
  ctx.fillText('✻', bx, by - 20);
  ctx.fillStyle = '#ffd6a5';
  ctx.font = `600 26px ${SANS}`;
  ctx.fillText(`${agent.name} is free`, bx, by + 34);
  ctx.fillStyle = '#b8b8dd';
  ctx.font = `18px ${SANS}`;
  ctx.fillText(agent.role === 'qa' ? 'waiting for a PR to test…' : agent.role === 'ceo' ? 'brooding over the dungeon…' : 'waiting for an issue…', bx, by + 62);
  ctx.textAlign = 'left';
}

function drawBrowser(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, url: string | null, shot: HTMLImageElement | null) {
  ctx.fillStyle = '#e9ecf2';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#d5d9e2';
  ctx.fillRect(x, y, w, 34);
  roundRect(ctx, x + 10, y + 6, w - 20, 22, 11);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.fillStyle = '#4a5160';
  ctx.font = `13px ${SANS}`;
  ctx.textBaseline = 'middle';
  const u = (url ?? 'about:blank').replace(/^https?:\/\//, '');
  ctx.fillText(`🔒 ${u.length > 42 ? `${u.slice(0, 41)}…` : u}`, x + 20, y + 18);
  const area = { x: x + 4, y: y + 38, w: w - 8, h: h - 42 };
  if (shot && shot.complete && shot.naturalWidth > 0) {
    const s = Math.min(area.w / shot.naturalWidth, area.h / shot.naturalHeight);
    const dw = shot.naturalWidth * s;
    const dh = shot.naturalHeight * s;
    ctx.drawImage(shot, area.x + (area.w - dw) / 2, area.y, dw, dh);
  } else {
    ctx.fillStyle = '#9aa1b2';
    ctx.textAlign = 'center';
    ctx.font = `16px ${SANS}`;
    ctx.fillText('🌐 loading page…', area.x + area.w / 2, area.y + area.h / 2);
    ctx.textAlign = 'left';
  }
}

// ---------- kanban whiteboard ----------

const COLS: { key: keyof KanbanColumns; title: string; chip: string; note: string }[] = [
  // parchment slips pinned to a cork board, each column's strip dyed a little differently
  { key: 'backlog', title: '📋 Backlog', chip: '#c9a65a', note: '#e8d9b0' },
  { key: 'progress', title: '🔨 In progress', chip: '#9a7b52', note: '#e4d3ad' },
  { key: 'qa', title: '🔍 In QA', chip: '#b0703e', note: '#ead2b4' },
  { key: 'ready', title: '✅ Ready to merge', chip: '#7d8f4a', note: '#dbdcb0' },
  { key: 'merged', title: '🎉 Merged', chip: '#7a5a78', note: '#dccdc4' },
];

const TONE = { warn: '#e9c991', bad: '#e3b9a8', good: '#d3d9a6' };

export function drawKanban(ctx: CanvasRenderingContext2D, w: number, h: number, repo: RepoView, cols: KanbanColumns) {
  // cork, flecked
  ctx.fillStyle = '#7d5d3b';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(40, 24, 12, 0.25)' : 'rgba(190, 150, 100, 0.18)';
    ctx.fillRect((i * 733) % w, (i * 389) % h, 3 + (i % 4), 3 + ((i * 7) % 3));
  }

  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0e2c2';
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText(repo.fullName, 40, 48);
  ctx.font = `500 26px ${SANS}`;
  ctx.fillStyle = '#d6c39a';
  const synced = repo.lastSync ? `synced ${new Date(repo.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'syncing…';
  ctx.textAlign = 'right';
  ctx.fillText(`${repo.autoAssign ? '⚡ auto-assign on · ' : ''}${synced}`, w - 40, 50);
  ctx.textAlign = 'left';

  const top = 96;
  const colW = (w - 80) / COLS.length;
  COLS.forEach((c, ci) => {
    const x0 = 40 + ci * colW;
    const cards = cols[c.key];
    roundRect(ctx, x0 + 8, top, colW - 16, 52, 26);
    ctx.fillStyle = c.chip;
    ctx.fill();
    ctx.fillStyle = '#21160e';
    ctx.font = `700 30px ${SANS}`;
    ctx.fillText(`${c.title}  ${cards.length}`, x0 + 30, top + 27);
    if (ci > 0) {
      ctx.strokeStyle = 'rgba(30, 18, 10, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, top);
      ctx.lineTo(x0, h - 30);
      ctx.stroke();
    }

    const noteW = (colW - 48) / 2;
    const noteH = 104;
    const perCol = 2;
    const rowsFit = Math.floor((h - top - 70) / (noteH + 12));
    const capacity = rowsFit * perCol;
    const shown = cards.length > capacity ? cards.slice(0, capacity - 1) : cards;
    shown.forEach((card, i) => {
      const nx = x0 + 16 + (i % perCol) * (noteW + 16);
      const ny = top + 68 + Math.floor(i / perCol) * (noteH + 12);
      drawNote(ctx, nx, ny, noteW, noteH, card, card.tone ? TONE[card.tone] : c.note);
    });
    if (cards.length > shown.length) {
      ctx.fillStyle = '#e6d6b0';
      ctx.font = `600 26px ${SANS}`;
      const i = shown.length;
      ctx.fillText(`+${cards.length - shown.length} more`, x0 + 30 + (i % perCol) * (noteW + 16), top + 68 + Math.floor(i / perCol) * (noteH + 12) + noteH / 2);
    }
    if (cards.length === 0) {
      ctx.fillStyle = '#c7b28a';
      ctx.font = `italic 500 26px ${SANS}`;
      ctx.fillText(c.key === 'backlog' ? 'no open issues' : 'nothing here yet', x0 + 30, top + 110);
    }
  });
}

function drawNote(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, card: KanbanCard, color: string) {
  const tilt = (((card.number * 37) % 7) - 3) * 0.006;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(tilt);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(4, 6, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.fillRect(0, 0, w, 10);

  ctx.fillStyle = '#2d3142';
  ctx.font = `700 22px ${SANS}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`${card.prNumber ? 'PR ' : ''}#${card.number}`, 14, 12);
  ctx.font = `500 19px ${SANS}`;
  const lines = wrap(ctx, card.title, w - 28, 2);
  lines.forEach((l, i) => ctx.fillText(l, 14, 38 + i * 21));

  ctx.textBaseline = 'middle';
  if (card.agent) {
    ctx.fillStyle = card.agent.color;
    ctx.beginPath();
    ctx.arc(22, h - 15, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d3142';
    ctx.font = `600 17px ${SANS}`;
    ctx.fillText(card.agent.name, 36, h - 14);
  }
  if (card.note) {
    ctx.font = `500 16px ${SANS}`;
    ctx.fillStyle = '#5c6078';
    ctx.textAlign = 'right';
    ctx.fillText(card.note, w - 12, h - 14);
    ctx.textAlign = 'left';
  }
  ctx.restore();
  ctx.textBaseline = 'middle';
}

// ---------- signs and tags ----------

export function drawTag(ctx: CanvasRenderingContext2D, w: number, h: number, agent: Agent) {
  ctx.clearRect(0, 0, w, h);
  const icon =
    agent.status === 'working'
      ? agent.currentTool?.startsWith('mcp__playwright')
        ? '🌐'
        : agent.currentTool === 'Bash' || agent.currentTool === 'PowerShell'
          ? '▶️'
          : agent.currentTool
            ? '⌨️'
            : '💭'
      : agent.status === 'preparing'
        ? '📦'
        : agent.status === 'done'
          ? '✅'
          : agent.status === 'error'
            ? '❗'
            : agent.status === 'stopped'
              ? '⏸️'
              : agent.role === 'qa'
                ? '🧪'
                : agent.role === 'ceo'
                  ? '🏛️'
                  : '☕';
  // a parchment label edged in the coder's own colour
  roundRect(ctx, 4, 4, w - 8, h - 8, 6);
  ctx.fillStyle = 'rgba(216, 199, 160, 0.95)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = agent.color;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  ctx.font = `38px ${SANS}`;
  ctx.fillText(icon, 22, h / 2 + 2);
  ctx.fillStyle = '#2a1d14';
  ctx.font = `700 40px ${SANS}`;
  const busy = agent.status !== 'idle';
  let label =
    agent.role === 'ceo'
      ? `${agent.name} · DungeonMaster`
      : agent.role === 'qa'
        ? busy && agent.prNumber
          ? `${agent.name} · QA PR #${agent.prNumber}`
          : `${agent.name} · ${agent.title || 'QA'}`
        : busy && agent.task === 'fix' && agent.prNumber
          ? `${agent.name} · 🔧 PR #${agent.prNumber}`
          : busy && agent.task === 'qa' && agent.prNumber
            ? `${agent.name} · 🧪 PR #${agent.prNumber}`
            : busy && agent.issueNumber
              ? `${agent.name} · #${agent.issueNumber}`
              : agent.title
                ? `${agent.name} · ${agent.title}`
                : agent.name;
  while (label.length > 4 && ctx.measureText(label).width > w - 96) label = `${label.slice(0, -2)}…`;
  ctx.fillText(label, 78, h / 2 + 2);
}

/** Name tag for a candidate in the waiting room: who they are and the job they're up for. */
export function drawCandidateTag(ctx: CanvasRenderingContext2D, w: number, h: number, name: string, title: string, floor: number | null, color: string) {
  ctx.clearRect(0, 0, w, h);
  roundRect(ctx, 4, 4, w - 8, h - 8, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.setLineDash([14, 8]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textBaseline = 'middle';
  ctx.font = `44px ${SANS}`;
  ctx.fillText('📄', 20, h / 2 + 2);
  const fit = (text: string, max: number) => {
    let t = text;
    while (t.length > 4 && ctx.measureText(t).width > max) t = `${t.slice(0, -2)}…`;
    return t;
  };
  ctx.fillStyle = '#2a1d14';
  ctx.font = `700 40px ${SANS}`;
  ctx.fillText(fit(`${name} · recruit`, w - 100), 80, h * 0.36);
  ctx.fillStyle = '#5c6078';
  ctx.font = `600 28px ${SANS}`;
  ctx.fillText(fit(`${title}${floor ? ` · chamber ${floor}` : ''}`, w - 100), 80, h * 0.72);
}

/**
 * A sign: in the dungeon, a parchment board edged in `bg` (the house's colour) with iron-gall ink lettering. A
 * transparent `bg` (lettering over a slate) keeps the lines' own colours.
 */
export function drawSign(ctx: CanvasRenderingContext2D, w: number, h: number, lines: { text: string; size: number; color?: string; weight?: number }[], bg: string, fg = '#ffffff') {
  const onSlate = bg === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(bg);
  if (!onSlate) {
    const edge = Math.max(6, Math.round(Math.min(w, h) * 0.05));
    // the edge is copper, tinted by the sign's own colour (cubefarm's bright accents would glare in firelight)
    ctx.fillStyle = mixHex(bg, COPPER, 0.85);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(20, 12, 8, 0.7)';
    ctx.lineWidth = Math.max(2, edge * 0.25);
    ctx.strokeRect(0, 0, w, h);
    ctx.fillStyle = PARCHMENT;
    ctx.fillRect(edge, edge, w - edge * 2, h - edge * 2);
    // a ruled line inside the edge, as on a manuscript page
    ctx.strokeStyle = 'rgba(42, 29, 20, 0.45)';
    ctx.lineWidth = Math.max(1, edge * 0.2);
    ctx.strokeRect(edge * 1.8, edge * 1.8, w - edge * 3.6, h - edge * 3.6);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = lines.reduce((s, l) => s + l.size * 1.25, 0);
  let y = h / 2 - total / 2;
  for (const l of lines) {
    y += (l.size * 1.25) / 2;
    const faded = (l.weight ?? 700) < 600;
    ctx.fillStyle = onSlate ? (l.color ?? fg) : faded ? INK_FADED : INK;
    ctx.font = `${l.weight ?? 700} ${l.size}px ${SANS}`;
    const inks = onSlate ? SIGN_INKS.slate : faded ? SIGN_INKS.faded : SIGN_INKS.parchment;
    fillWithIcons(ctx, l.text, w / 2, y, l.size, l.weight ?? 700, w - 40, inks);
    y += (l.size * 1.25) / 2;
  }
  ctx.textAlign = 'left';
}

/** One centred line of sign text, with the emoji the dungeon has drawings for shown as its woodcut icons. */
function fillWithIcons(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, size: number, weight: number, maxW: number, inks: { ink: string; paper: string }) {
  const runs = splitIcons(text);
  if (!runs.some((r) => 'icon' in r)) {
    let t = text;
    while (t.length > 3 && ctx.measureText(t).width > maxW) t = `${t.slice(0, -2)}…`;
    ctx.fillText(t, cx, y);
    return;
  }
  let px = size;
  const width = () => runs.reduce((sum, r) => sum + ('icon' in r ? px * 1.15 : ctx.measureText(r.text).width), 0);
  let total = width();
  if (total > maxW) {
    // too long for the sign: the whole line gets smaller rather than losing its end
    px = Math.max(10, Math.floor((size * maxW) / total));
    ctx.font = `${weight} ${px}px ${SANS}`;
    total = width();
  }
  ctx.textAlign = 'left';
  let x = cx - total / 2;
  for (const r of runs) {
    if ('icon' in r) {
      const box = px * 1.15;
      const img = signIcon(r.icon, inks.ink, inks.paper);
      if (img) ctx.drawImage(img, x, y - box / 2 - px * 0.04, box, box);
      x += box;
    } else {
      ctx.fillText(r.text, x, y);
      x += ctx.measureText(r.text).width;
    }
  }
  ctx.textAlign = 'center';
}

const PARCHMENT = '#d8c7a0';
const COPPER = '#8a5426';

/** `a` moved `t` of the way to `b` (both #rrggbb; anything else comes back as `b`). */
export function mixHex(a: string, b: string, t: number) {
  const rgb = (h: string) => (/^#[0-9a-f]{6}$/i.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return b;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
const INK = '#2a1d14';
const INK_FADED = '#5a4632';

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, seed: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#74c0fc');
  g.addColorStop(0.7, '#c5e8ff');
  g.addColorStop(1, '#e6f6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // puffy clouds
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 6; i++) {
    const cx = ((seed * 131 + i * 223) % w) + 20;
    const cy = 40 + ((seed * 17 + i * 53) % (h * 0.35));
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(cx + k * 22, cy + (k % 2) * 6, 18 + (k % 3) * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // cartoon skyline
  const palette = ['#8aa4c8', '#9fb6d6', '#7d95bb', '#a8bddb'];
  let x = 0;
  let i = 0;
  while (x < w) {
    const bw = 40 + ((seed + i * 37) % 70);
    const bh = h * (0.18 + (((seed * 7 + i * 29) % 30) / 100));
    ctx.fillStyle = palette[i % palette.length];
    ctx.fillRect(x, h - bh, bw - 4, bh);
    ctx.fillStyle = 'rgba(255,255,230,0.55)';
    for (let wy = h - bh + 10; wy < h - 10; wy += 16) for (let wx = x + 6; wx < x + bw - 12; wx += 12) if ((wx + wy + i) % 3) ctx.fillRect(wx, wy, 5, 7);
    x += bw;
    i++;
  }
}

// ---------- the floor's app monitor ----------

const APP_STEPS: { status: PreviewStatus; label: string }[] = [
  { status: 'preparing', label: 'Checking out the code' },
  { status: 'installing', label: 'Installing dependencies' },
  { status: 'starting', label: 'Starting the app' },
];

const APP_BADGE: Record<PreviewStatus, { text: string; bg: string }> = {
  unconfigured: { text: 'NOT SET UP', bg: '#5c6078' },
  stopped: { text: 'STOPPED', bg: '#5c6078' },
  preparing: { text: 'STARTING', bg: '#f4a261' },
  installing: { text: 'STARTING', bg: '#f4a261' },
  starting: { text: 'STARTING', bg: '#f4a261' },
  running: { text: '● LIVE', bg: '#ef233c' },
  error: { text: 'ERROR', bg: '#e63946' },
};

/** Shorten text with an ellipsis until it fits in max pixels, in the context's current font. */
function fitText(ctx: CanvasRenderingContext2D, text: string, max: number) {
  let t = text;
  while (t.length > 2 && ctx.measureText(t).width > max) t = `${t.slice(0, -2)}…`;
  return t;
}

export interface AppScreenInfo {
  floor: number;
  name: string;
  color: string;
  preview: PreviewView;
  shot: HTMLImageElement | null; // the latest agent screenshot on the floor, shown while the app is live
  shotBy: string | null;
}

/** The wall screen at the front of an office floor: the floor's app and how it's doing. */
export function drawAppScreen(ctx: CanvasRenderingContext2D, w: number, h: number, info: AppScreenInfo) {
  const p = info.preview;
  ctx.fillStyle = TERM.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // header: floor chip, floor name, status badge
  const headH = 118;
  ctx.fillStyle = TERM.bar;
  ctx.fillRect(0, 0, w, headH);
  ctx.fillStyle = info.color;
  ctx.fillRect(0, headH - 6, w, 6);
  ctx.font = `700 34px ${SANS}`;
  const chip = `CHAMBER ${info.floor}`;
  const chipW = ctx.measureText(chip).width + 44;
  roundRect(ctx, 40, 30, chipW, 54, 27);
  ctx.fillStyle = info.color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(chip, 62, 58);

  const badge = APP_BADGE[p.status];
  ctx.font = `700 38px ${SANS}`;
  const badgeW = ctx.measureText(badge.text).width + 52;
  roundRect(ctx, w - 40 - badgeW, 28, badgeW, 58, 29);
  ctx.fillStyle = badge.bg;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(badge.text, w - 40 - badgeW / 2, 58);
  ctx.textAlign = 'left';

  ctx.font = `700 50px ${SANS}`;
  const nameX = 40 + chipW + 26;
  ctx.fillText(fitText(ctx, info.name, w - 40 - badgeW - 26 - nameX), nameX, 58);

  const centred = (text: string, y: number, size: number, color: string, weight = 700) => {
    ctx.font = `${weight} ${size}px ${SANS}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.fillText(fitText(ctx, text, w - 100), w / 2, y);
    ctx.textAlign = 'left';
  };
  const footer = (text: string, color = '#8d8da8') => centred(text, h - 50, 32, color, 600);

  const bodyTop = headH;
  const midY = bodyTop + (h - headH - 100) / 2;
  const ref = p.ref ?? 'the app';

  if (p.status === 'stopped') {
    // a big play button
    const cy = midY - 70;
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(w / 2, cy, 84, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 26, cy - 42);
    ctx.lineTo(w / 2 - 26, cy + 42);
    ctx.lineTo(w / 2 + 44, cy);
    ctx.closePath();
    ctx.fill();
    centred('Press E to open the app', midY + 80, 70, '#ffffff');
    footer("The app isn't running. Start it from the viewer.");
  } else if (p.status === 'unconfigured') {
    centred('⚙️', midY - 90, 110, '#ffffff', 400);
    centred('No run command yet.', midY + 40, 66, '#ffffff');
    centred("Set one in the manager's console.", midY + 120, 44, '#b8b8cc', 600);
    footer('Press E to open the app');
  } else if (p.status === 'error') {
    const firstLine = (p.error ?? '').split(/\r?\n/).find((l) => l.trim())?.trim() || 'The app stopped unexpectedly.';
    ctx.fillStyle = '#e63946';
    ctx.fillRect(0, midY - 120, w, 130);
    ctx.font = `700 44px ${SANS}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fitText(ctx, `⚠ ${firstLine}`, w - 100), 50, midY - 55);
    centred("The app couldn't start.", midY + 90, 52, '#ffffff');
    footer('Press E to see the log and try again', '#ffb4ba');
  } else if (p.status !== 'running') {
    const at = Math.max(0, APP_STEPS.findIndex((s) => s.status === p.status));
    centred(`Getting ${ref} ready…`, bodyTop + 80, 46, '#b8b8cc', 600);
    centred(`${APP_STEPS[at].label}…`, midY - 20, 72, '#ffffff');
    // a three-step progress bar
    const gap = 18;
    const segW = (w - 200 - gap * (APP_STEPS.length - 1)) / APP_STEPS.length;
    APP_STEPS.forEach((s, i) => {
      const x = 100 + i * (segW + gap);
      const y = midY + 90;
      roundRect(ctx, x, y, segW, 34, 17);
      ctx.fillStyle = i < at ? TERM.done : i === at ? '#f4a261' : '#3a3a52';
      ctx.fill();
      ctx.font = `600 28px ${SANS}`;
      ctx.fillStyle = i <= at ? TERM.text : '#6c6c88';
      ctx.textAlign = 'center';
      ctx.fillText(`${i < at ? '✓ ' : ''}${s.label}`, x + segW / 2, y + 70);
      ctx.textAlign = 'left';
    });
    footer(`Step ${at + 1} of ${APP_STEPS.length} · press E to watch`);
  } else {
    // running: where it's served and what's deployed, plus the latest thing an agent on this floor looked at
    const left = 56;
    const colW = info.shot ? w * 0.5 : w - 2 * left;
    ctx.font = `600 34px ${SANS}`;
    ctx.fillStyle = '#b8b8cc';
    ctx.fillText('Serving at', left, bodyTop + 72);
    ctx.font = `700 50px ${MONO}`;
    ctx.fillStyle = TERM.tool;
    ctx.fillText(fitText(ctx, (p.url ?? '').replace(/^https?:\/\//, '').replace(/\/$/, ''), colW), left, bodyTop + 140);

    ctx.font = `700 42px ${SANS}`;
    const refW = ctx.measureText(ref).width + 48;
    roundRect(ctx, left, bodyTop + 208, refW, 64, 32);
    ctx.fillStyle = info.color;
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(ref, left + 24, bodyTop + 241);
    if (p.commit) {
      ctx.font = `600 42px ${MONO}`;
      ctx.fillStyle = TERM.thinking;
      ctx.fillText(p.commit, left + refW + 24, bodyTop + 241);
    }
    if (p.startedAt) {
      ctx.font = `500 32px ${SANS}`;
      ctx.fillStyle = '#8d8da8';
      ctx.fillText(`up since ${new Date(p.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, left, bodyTop + 330);
    }

    if (info.shot) {
      const tw = w - colW - left - 70;
      const th = Math.round(tw * 0.5625);
      const tx = w - 40 - tw;
      const ty = bodyTop + 50;
      ctx.fillStyle = '#3a3a52';
      ctx.fillRect(tx - 6, ty - 6, tw + 12, th + 12);
      // cover-fit, anchored to the top left like a browser viewport
      const img = info.shot;
      const scale = Math.max(tw / img.width, th / img.height);
      ctx.drawImage(img, 0, 0, tw / scale, th / scale, tx, ty, tw, th);
      ctx.font = `500 26px ${SANS}`;
      ctx.fillStyle = '#8d8da8';
      ctx.fillText(fitText(ctx, info.shotBy ? `latest from ${info.shotBy}'s browser` : 'latest agent screenshot', tw), tx, ty + th + 36);
    }
    footer('Press E to open the app', TERM.done);
  }
}
