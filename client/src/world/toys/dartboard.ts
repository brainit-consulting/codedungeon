// The dart board's rules, kept pure so they can be tested: where a dart landed on the board → what it scored, and
// the round tally on the chalkboard beside it. Board coordinates are metres from the centre, +y up and +x right as
// you face the board. Sizes are the regulation ones.

export const BOARD = {
  /** Height of the bull above the floor, and the throw line's distance from the board. */
  height: 1.73,
  throwLine: 2.37,
  bull: 0.00635,
  outerBull: 0.0159,
  treble: [0.099, 0.107] as const,
  double: [0.162, 0.17] as const,
  /** The whole board, including the black number ring round the scoring area. */
  radius: 0.2255,
};

/** Clockwise from the top. */
export const SEGMENTS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export interface Score {
  points: number;
  /** 'T20', 'D16', '25', 'BULL', '5' or 'MISS'. */
  label: string;
}

export const MISS: Score = { points: 0, label: 'MISS' };

export function scoreAt(x: number, y: number): Score {
  const r = Math.hypot(x, y);
  if (r <= BOARD.bull) return { points: 50, label: 'BULL' };
  if (r <= BOARD.outerBull) return { points: 25, label: '25' };
  if (r > BOARD.double[1]) return MISS;
  // Angle clockwise from straight up, shifted half a segment so each segment spans [k, k+1) twentieths.
  const a = (Math.atan2(x, y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2);
  const n = SEGMENTS[Math.floor(a / (Math.PI / 10)) % 20];
  if (r >= BOARD.treble[0] && r <= BOARD.treble[1]) return { points: n * 3, label: `T${n}` };
  if (r >= BOARD.double[0]) return { points: n * 2, label: `D${n}` };
  return { points: n, label: String(n) };
}

// ---------- the chalk tally ----------

export const DARTS_PER_ROUND = 3;

export interface Round {
  throws: Score[];
}

export const emptyRound = (): Round => ({ throws: [] });

/** Add a throw; a fourth throw starts a new round. */
export function throwInto(r: Round, s: Score): Round {
  return r.throws.length >= DARTS_PER_ROUND ? { throws: [s] } : { throws: [...r.throws, s] };
}

export const roundTotal = (r: Round) => r.throws.reduce((sum, t) => sum + t.points, 0);

/** The best finished round so far, given the previous best. */
export function bestRound(best: number, r: Round): number {
  return r.throws.length === DARTS_PER_ROUND ? Math.max(best, roundTotal(r)) : best;
}
