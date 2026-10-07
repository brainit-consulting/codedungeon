import { formatBytes, percentOf, type SystemView } from '../../../shared/system';
import type { UsageView } from '../../../shared/types';
import { todayLine } from '../../../shared/usage';
import { SANS } from './draw';

// The gauge board's face (GaugeBoard.tsx): brass dials for CPU, memory and disk on parchment in an oak frame, and a
// line for Claude's usage and the sessions running. gaugeFace() rounds a reading to what the board can show, so the
// board repaints only when that changes.

export const OAK = '#3a2819';
const BRASS = '#b08d57';
const BRASS_DARK = '#6e5530';
const FACE = '#efe3c4';
const PARCHMENT = '#d8c7a0';
const INK = '#2a1d14';
const INK_FADED = '#5a4632';
const RUST = '#a0441c';
const GOOD = '#4f6b2a';
const DISPLAY = `"Alegreya SC", ${SANS}`;

/** Where a reading points: 240° of sweep, from lower left round to lower right. */
const SWEEP_START = (5 * Math.PI) / 6;
const SWEEP = (4 * Math.PI) / 3;
const angleFor = (pct: number) => SWEEP_START + (SWEEP * Math.min(100, Math.max(0, pct))) / 100;

export interface Dial {
  label: string;
  pct: number | null;
  detail: string;
}

function drawDial(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, d: Dial) {
  // brass bezel and a pale face
  const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ring.addColorStop(0, '#d9bb84');
  ring.addColorStop(0.5, BRASS);
  ring.addColorStop(1, BRASS_DARK);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = ring;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
  ctx.fillStyle = FACE;
  ctx.fill();

  // the red zone, 85-100
  ctx.beginPath();
  ctx.arc(cx, cy, r - 26, angleFor(85), angleFor(100));
  ctx.strokeStyle = RUST;
  ctx.lineWidth = 12;
  ctx.stroke();

  // ticks every 10%, longer at 0, 50 and 100
  ctx.strokeStyle = INK;
  for (let p = 0; p <= 100; p += 10) {
    const a = angleFor(p);
    const long = p % 50 === 0;
    ctx.lineWidth = long ? 5 : 3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18));
    ctx.lineTo(cx + Math.cos(a) * (r - (long ? 44 : 34)), cy + Math.sin(a) * (r - (long ? 44 : 34)));
    ctx.stroke();
  }

  // the needle; it rests at zero with no reading
  const a = angleFor(d.pct ?? 0);
  ctx.strokeStyle = d.pct === null ? INK_FADED : INK;
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(a) * 14, cy - Math.sin(a) * 14);
  ctx.lineTo(cx + Math.cos(a) * (r - 40), cy + Math.sin(a) * (r - 40));
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = BRASS_DARK;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = d.pct !== null && d.pct >= 85 ? RUST : INK;
  ctx.font = `700 46px ${SANS}`;
  ctx.fillText(d.pct === null ? '–' : `${Math.round(d.pct)}%`, cx, cy + r * 0.56);

  ctx.fillStyle = INK;
  ctx.font = `700 40px ${DISPLAY}`;
  ctx.fillText(d.label, cx, cy + r + 34);
  ctx.fillStyle = INK_FADED;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(d.detail, cx, cy + r + 70);
}

/** "14:30" for a time today, as the rest of the dungeon writes it. */
const hm = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** The Claude usage line: what the office knows from Claude's own warnings. */
export function usageLine(u: UsageView): { text: string; tone: 'good' | 'bad' } {
  if (u.state === 'paused') return { text: `paused at the limit${u.until ? ` until ${hm(u.until)}` : ''}`, tone: 'bad' };
  if (u.state === 'pacing') return { text: `pacing new work${u.until ? ` until ${hm(u.until)}` : ''}`, tone: 'bad' };
  return { text: 'normal', tone: 'good' };
}

export interface GaugeFace {
  dials: Dial[];
  usage: { text: string; tone: 'good' | 'bad' };
  sessions: string;
  /** Every session since midnight, at API prices (the usage meter). */
  today: string;
  stale: boolean;
}

/** What the board shows, rounded to what it can show, so equal faces mean no repaint. */
export function gaugeFace(v: SystemView | null, usage: UsageView, failed: boolean): GaugeFace {
  const round = (n: number | null) => (n === null ? null : Math.round(n));
  return {
    dials: [
      { label: 'CPU', pct: round(v?.cpu.pct ?? null), detail: v ? `${v.host.cores} cores` : 'no reading yet' },
      { label: 'Memory', pct: round(v ? percentOf(v.memory.used, v.memory.total) : null), detail: v ? `${formatBytes(v.memory.used)} of ${formatBytes(v.memory.total)}` : '' },
      { label: 'Disk', pct: round(v?.disk ? percentOf(v.disk.total - v.disk.free, v.disk.total) : null), detail: v?.disk ? `${formatBytes(v.disk.free)} free` : '' },
    ],
    usage: usageLine(usage),
    sessions: v ? `${v.sessions.running} session${v.sessions.running === 1 ? '' : 's'} running · dungeon ${formatBytes(v.process.rss)}` : '',
    today: v ? todayLine(v.today) : '',
    stale: failed,
  };
}

export function drawGauges(ctx: CanvasRenderingContext2D, w: number, h: number, f: GaugeFace) {
  // an oak frame with a brass inlay round a parchment face
  ctx.fillStyle = OAK;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = BRASS;
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(22, 22, w - 44, h - 44);
  ctx.strokeStyle = 'rgba(42, 29, 20, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.font = `700 50px ${DISPLAY}`;
  ctx.fillText('The Gauges', w / 2, 82);
  if (f.stale) {
    ctx.fillStyle = RUST;
    ctx.font = `italic 500 24px ${SANS}`;
    ctx.fillText('no fresh reading', w / 2, 118);
  }

  const r = 112;
  f.dials.forEach((d, i) => drawDial(ctx, (w / 6) * (1 + i * 2), 252, r, d));

  // Claude's usage and the sessions, ruled off below the dials
  ctx.strokeStyle = 'rgba(42, 29, 20, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 470);
  ctx.lineTo(w - 60, 470);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${DISPLAY}`;
  ctx.fillText('Claude usage', 64, 508);
  const labelW = ctx.measureText('Claude usage').width;
  ctx.fillStyle = f.usage.tone === 'bad' ? RUST : GOOD;
  ctx.font = `700 34px ${SANS}`;
  ctx.fillText(f.usage.text, 64 + labelW + 18, 508);
  ctx.fillStyle = INK_FADED;
  ctx.font = `500 28px ${SANS}`;
  ctx.fillText(f.sessions, 64, 546);
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(f.today, 64, 584);
}
