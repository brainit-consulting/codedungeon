// A coder writing in the open ledger on their bench (Desk.tsx): where the quill's nib is over time, and the ink it
// leaves, in the bench's frame (its middle at the floor, the coder facing -Z, their right +X). The right-hand page is
// laid out like code: lines at different indents, long and short, now and then one left blank. The nib writes each
// word in small loops, lifts between words and lines, dips in the inkwell twice a page, and goes off to the side
// while the full page is turned. Pure, so it can be tested; writingHands.ts moves the hands with it and Ink.tsx draws
// the ink.

/**
 * Where on the right-hand page they write: its near part, inside the margins (measured on the seated skeleton: the far
 * half is beyond a sitting coder's reach), and the page's top surface at its middle.
 */
export const PAGE = {
  minX: 0.035,
  maxX: 0.235,
  minZ: 0.29,
  maxZ: 0.44,
  top: 0.775,
  middleX: 0.135,
  tilt: 0.04,
};
/** The page tips a little toward its outer edge (Desk.tsx turns it 0.04 rad): its surface height across it. */
export const pageTop = (x: number) => PAGE.top - (x - PAGE.middleX) * Math.sin(PAGE.tilt);
/** The left-hand page: the right one moved across the spine, tipping the other way. */
export const LEFT_SHIFT = -PAGE.middleX * 2;
export const leftPageTop = (x: number) => PAGE.top + (x + PAGE.middleX) * Math.sin(PAGE.tilt);
/** The inkwell, just right of the ledger and near the writing hand (Desk.tsx puts it here): its mouth, and how deep the nib goes. */
export const INKPOT = { x: 0.37, z: 0.41, top: 0.81, depth: 0.025 };
/** Where the left wrist rests: on the left-hand page, the hand flat on it holding the book open. */
export const LEFT_REST = { x: -0.13, y: 0.8, z: 0.4 };

/** Lines on a page, and how long (s) a page takes, whatever is on it. */
export const LINES = 7;
export const PAGE_S = 45;
const LINE_GAP = (PAGE.maxZ - PAGE.minZ) / (LINES - 1);
/** One level of indent. */
const INDENT = 0.016;
/** Back to the start of the next line, the dip in the inkwell (after these lines), and the page turn. */
const RETURN_S = 0.5;
const DIP_S = 1.8;
const DIP_AFTER = [2, 5];
const TURN_S = 2;
/** Between words: a lift and a move at this speed, never quicker than GAP_MIN. */
const GAP_V = 0.1;
const GAP_MIN = 0.12;
/** The slowest it writes (m/s along the line); a page with little on it ends in a pause instead. */
const SLOWEST = 0.011;
/** Handwriting: a loop every LETTER m along the line, running back LOOP m, LETTER_H high. */
const LETTER = 0.004;
const LOOP = 0.0009;
const LETTER_H = 0.0026;
/** The nib off the page between words and lines. */
const LIFT = 0.0008;
/** The ink: sampled every INK_STEP m along a word, drawn a hair above the page. */
const INK_STEP = 0.00025;
const INK_UP = 0.0006;

export interface Word {
  from: number;
  to: number;
  /** Seeds which of its letters are tall or hang down. */
  hand: number;
}
export interface PageLine {
  z: number;
  words: Word[];
}

export interface Nib {
  x: number;
  y: number;
  z: number;
  /** On the page, writing. */
  writing: boolean;
  /** On its way to the inkwell, in it, or on its way back. */
  dipping: boolean;
  /** Off to the side while the full page is turned (and on to the top of the next). */
  turn: boolean;
  /** How far the leaf has turned over, 0 to 1 (0 outside a turn). */
  turning: number;
  /** The page being written, and how far: the ink is down up to `s` m into word `word` of line `line`. */
  page: number;
  line: number;
  word: number;
  s: number;
}

// ---------- randomness: seeded per coder and page ----------

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    // mulberry32
    let t = (a = (a + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pageSeed = (page: number, seed: number) => Math.imul(seed | 0, 73856093) ^ Math.imul(page | 0, 19349663);

// ---------- the page ----------

/** What a page holds: its lines of code, in order down the page. */
export function pageLayout(page: number, seed: number): PageLine[] {
  const r = rng(pageSeed(page, seed));
  const lines: PageLine[] = [];
  let indent = 0;
  let wasBlank = false;
  for (let i = 0; i < LINES; i++) {
    const z = PAGE.minZ + i * LINE_GAP;
    // a blank line between blocks, never two together, nor first or last
    if (i > 0 && i < LINES - 1 && !wasBlank && r() < 0.14) {
      lines.push({ z, words: [] });
      wasBlank = true;
      indent = Math.max(0, indent - (r() < 0.5 ? 1 : 0));
      continue;
    }
    wasBlank = false;
    // the indent walks like code: in after an opening line, out after a closing one
    if (i > 0) {
      const step = r();
      indent = Math.min(3, Math.max(0, indent + (step < 0.33 ? 1 : step < 0.58 ? -1 : 0)));
    }
    const from = PAGE.minX + indent * INDENT;
    if (i > 0 && r() < 0.15) {
      // a closing line: just a brace
      lines.push({
        z,
        words: [{ from, to: from + 0.005, hand: Math.floor(r() * 1e9) }],
      });
      continue;
    }
    const end = from + (PAGE.maxX - from) * (0.35 + 0.65 * r());
    const words: Word[] = [];
    for (let x = from; x < end - 0.004;) {
      const to = Math.min(x + 0.008 + r() * 0.032, end);
      words.push({ from: x, to, hand: Math.floor(r() * 1e9) });
      x = to + 0.007;
    }
    lines.push({ z, words });
  }
  return lines;
}

/** How tall letter n of a word is: most a plain loop, some with a stroke up (l, d, k), a few hanging down (g, p). */
function letterHeight(hand: number, n: number) {
  const h = ((Math.imul(hand ^ (n * 2654435761), 1597334677) >>> 0) % 100) / 100;
  return h < 0.2 ? 2.2 : h < 0.28 ? -1.6 : 1;
}

/** The nib's point `s` m into a word written on the line at `z`: a looping hand, going up the page (-z) and back. */
function letter(w: Word, s: number, z: number) {
  const k = (Math.PI * 2) / LETTER;
  const x = w.from + s - LOOP * Math.sin(k * s);
  const up = ((1 - Math.cos(k * s)) / 2) * LETTER_H * letterHeight(w.hand, Math.floor(s / LETTER));
  return { x, z: z - up };
}

interface Plan {
  lines: PageLine[];
  /** Writing speed (m/s along a line), and the pause at the end of a page with little on it. */
  v: number;
  think: number;
}

const gapTime = (a: Word, b: Word) => Math.max(GAP_MIN, (b.from - a.to) / GAP_V);
const written = (lines: PageLine[]) => lines.flatMap((l, i) => (l.words.length ? [i] : []));
const dipBetween = (i: number, next: number) => DIP_AFTER.some((d) => i <= d && d < next);

const plans = new Map<string, Plan>();
function plan(page: number, seed: number): Plan {
  const key = `${seed}:${page}`;
  const known = plans.get(key);
  if (known) return known;
  const lines = pageLayout(page, seed);
  let ink = 0;
  let fixed = TURN_S;
  for (const l of lines) {
    l.words.forEach((w, j) => {
      ink += w.to - w.from;
      if (j > 0) fixed += gapTime(l.words[j - 1], w);
    });
  }
  const rows = written(lines);
  for (let n = 0; n + 1 < rows.length; n++) fixed += dipBetween(rows[n], rows[n + 1]) ? DIP_S : RETURN_S;
  const v = Math.max(SLOWEST, ink / (PAGE_S - fixed));
  const p = { lines, v, think: Math.max(0, PAGE_S - fixed - ink / v) };
  if (plans.size > 256) plans.clear();
  plans.set(key, p);
  return p;
}

// ---------- the nib ----------

const smooth = (u: number) => u * u * (3 - 2 * u);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
type P3 = { x: number; y: number; z: number };

/** Where the nib is at time t (s) for the coder with this seed. */
export function penAt(t: number, seed: number): Nib {
  const T = Math.max(0, t + (Math.abs(seed) % 97) * 1.3);
  const page = Math.floor(T / PAGE_S);
  let s = T - page * PAGE_S;
  const { lines, v, think } = plan(page, seed);
  const base = {
    page,
    writing: false,
    dipping: false,
    turn: false,
    turning: 0,
  };
  const rows = written(lines);
  for (let n = 0; n < rows.length; n++) {
    const i = rows[n];
    const { words, z } = lines[i];
    for (let j = 0; j < words.length; j++) {
      const w = words[j];
      const d = (w.to - w.from) / v;
      if (s < d) {
        const p = letter(w, s * v, z);
        return {
          ...base,
          x: p.x,
          y: pageTop(p.x),
          z: p.z,
          writing: true,
          line: i,
          word: j,
          s: s * v,
        };
      }
      s -= d;
      if (j + 1 < words.length) {
        const g = gapTime(w, words[j + 1]);
        if (s < g) {
          // lifted a hair, on to the next word
          const a = letter(w, w.to - w.from, z);
          const b = letter(words[j + 1], 0, z);
          const u = smooth(s / g);
          const x = mix(a.x, b.x, u);
          return {
            ...base,
            x,
            y: pageTop(x) + LIFT + Math.sin(u * Math.PI) * 0.003,
            z: mix(a.z, b.z, u),
            line: i,
            word: j + 1,
            s: 0,
          };
        }
        s -= g;
      }
    }
    const last = words[words.length - 1];
    const end = letter(last, last.to - last.from, z);
    const from = { x: end.x, y: pageTop(end.x) + LIFT, z: end.z };
    if (n + 1 < rows.length) {
      const next = rows[n + 1];
      const start = letter(lines[next].words[0], 0, lines[next].z);
      const to = { x: start.x, y: pageTop(start.x) + LIFT, z: start.z };
      const at = { line: next, word: 0, s: 0 };
      if (dipBetween(i, next)) {
        if (s < DIP_S) return { ...base, ...dip(from, to, s / DIP_S), dipping: true, ...at };
        s -= DIP_S;
      } else {
        if (s < RETURN_S)
          return {
            ...base,
            ...arc(from, to, smooth(s / RETURN_S), 0.015),
            ...at,
          };
        s -= RETURN_S;
      }
      continue;
    }
    const done = { line: LINES, word: 0, s: 0 };
    // a page with little on it: a pause, the pen lifted, thinking
    if (s < think)
      return {
        ...base,
        ...from,
        y: from.y + Math.sin(Math.min(1, s / 0.6) * Math.PI * 0.5) * 0.012,
        ...done,
      };
    s -= think;
    const thought = { ...from, y: from.y + (think > 0 ? 0.012 : 0) };
    // the page is full: the hand goes off to the side, the leaf turns over, and the hand comes to the top of the next
    const first = plan(page + 1, seed).lines;
    const top = letter(first[0].words[0], 0, first[0].z);
    const u = Math.min(1, s / TURN_S);
    return {
      ...base,
      ...turn(thought, { x: top.x, y: pageTop(top.x) + LIFT, z: top.z }, u),
      turn: true,
      turning: smooth(Math.min(1, Math.max(0, (u - 0.3) / 0.4))),
      ...done,
    };
  }
  // never reached: every page has a first line
  return {
    ...base,
    x: PAGE.minX,
    y: pageTop(PAGE.minX),
    z: PAGE.minZ,
    line: 0,
    word: 0,
    s: 0,
  };
}

function arc(a: P3, b: P3, u: number, h: number): P3 {
  return {
    x: mix(a.x, b.x, u),
    y: mix(a.y, b.y, u) + Math.sin(u * Math.PI) * h,
    z: mix(a.z, b.z, u),
  };
}

/** From the end of a line to the inkwell, down into the ink and out, and back to the start of the next line. */
function dip(from: P3, to: P3, u: number): P3 {
  const over = { x: INKPOT.x, y: INKPOT.top + 0.03, z: INKPOT.z };
  if (u < 0.35) return arc(from, over, smooth(u / 0.35), 0.03);
  if (u < 0.6)
    return {
      ...over,
      y: over.y - Math.sin(((u - 0.35) / 0.25) * Math.PI) * (0.03 + INKPOT.depth),
    };
  return arc(over, to, smooth((u - 0.6) / 0.4), 0.03);
}

/** Where the hand waits while the leaf turns: up and off the right of the page, clear of it. */
const ASIDE = { x: 0.31, y: PAGE.top + 0.07, z: 0.37 };

function turn(from: P3, to: P3, u: number): P3 {
  if (u < 0.3) return arc(from, ASIDE, smooth(u / 0.3), 0.02);
  if (u < 0.7) return ASIDE;
  return arc(ASIDE, to, smooth((u - 0.7) / 0.3), 0.02);
}

// ---------- the ink ----------

export interface PageInk {
  page: number;
  /** Stroke ends, two per stroke, x y z each, in writing order. */
  positions: Float32Array;
  /** Where each line's and each word's strokes start (vertex index). */
  lineStart: number[];
  wordStart: number[][];
}

/** All the ink on a page, written out (on the left-hand page when `left`: a page written before). */
export function pageInk(page: number, seed: number, left = false): PageInk {
  const { lines } = plan(page, seed);
  const out: number[] = [];
  const lineStart: number[] = [];
  const wordStart: number[][] = [];
  for (const l of lines) {
    lineStart.push(out.length / 3);
    const starts: number[] = [];
    for (const w of l.words) {
      starts.push(out.length / 3);
      const len = w.to - w.from;
      const n = Math.ceil(len / INK_STEP);
      let prev = letter(w, 0, l.z);
      for (let k = 1; k <= n; k++) {
        const p = letter(w, Math.min(len, k * INK_STEP), l.z);
        for (const q of [prev, p]) {
          const x = left ? q.x + LEFT_SHIFT : q.x;
          out.push(x, (left ? leftPageTop(x) : pageTop(x)) + INK_UP, q.z);
        }
        prev = p;
      }
    }
    wordStart.push(starts);
  }
  lineStart.push(out.length / 3);
  return { page, positions: new Float32Array(out), lineStart, wordStart };
}

/** How many of the page's stroke ends are down by the time the nib is at `nib` (always whole strokes). */
export function inkDrawn(ink: PageInk, nib: Pick<Nib, 'page' | 'line' | 'word' | 's'>): number {
  const all = ink.positions.length / 3;
  if (nib.page !== ink.page) return nib.page > ink.page ? all : 0;
  if (nib.line >= LINES) return all;
  const starts = ink.wordStart[nib.line];
  if (nib.word >= starts.length) return ink.lineStart[nib.line + 1];
  const from = starts[nib.word];
  const to = nib.word + 1 < starts.length ? starts[nib.word + 1] : ink.lineStart[nib.line + 1];
  return Math.min(to, from + 2 * Math.floor(nib.s / INK_STEP));
}
