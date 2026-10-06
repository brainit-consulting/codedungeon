// A coder writing in the open ledger on their bench (Desk.tsx): where the quill's nib is over time, in the bench's
// frame (its middle at the floor, the coder facing -Z, their right +X). Lines across the right-hand page in small
// strokes, a lift to go back for the next, a dip in the inkpot every few lines, and back to the top when the page is
// full. Pure, so it can be tested; RiggedCharacter.tsx moves the hands with it.

/**
 * Where on the right-hand page they write: its near part, inside the margins (measured on the seated skeleton: the far
 * half is beyond a sitting coder's reach), and the page's top surface at its middle.
 */
export const PAGE = { minX: 0.035, maxX: 0.235, minZ: 0.29, maxZ: 0.44, top: 0.775, middleX: 0.135, tilt: 0.04 };
/** The page tips a little toward its outer edge (Desk.tsx turns it 0.04 rad): its surface height across it. */
export const pageTop = (x: number) => PAGE.top - (x - PAGE.middleX) * Math.sin(PAGE.tilt);
/** The inkwell, just right of the ledger and near the writing hand (Desk.tsx puts it here): its mouth, and how deep the nib goes. */
export const INKPOT = { x: 0.37, z: 0.41, top: 0.81, depth: 0.025 };
/** Where the left wrist rests: on the left-hand page, the hand flat on it holding the book open. */
export const LEFT_REST = { x: -0.13, y: 0.805, z: 0.4 };
/** The right wrist sits up and back from the nib, as a quill is held. */
export const WRIST_ABOVE_NIB = { x: 0.03, y: 0.05, z: 0.08 };

const LINE_GAP = 0.024;
const LINES = Math.floor((PAGE.maxZ - PAGE.minZ) / LINE_GAP) + 1;
const WRITE_S = 3.4;
const RETURN_S = 0.45;
const DIP_EVERY = 3;
const DIP_S = 1.6;
const BLOCK_S = DIP_EVERY * (WRITE_S + RETURN_S) + DIP_S;

export interface Nib {
  x: number;
  y: number;
  z: number;
  /** On the page, writing (or between two words, a hair above it). */
  writing: boolean;
  /** On its way to the inkpot, in it, or on its way back. */
  dipping: boolean;
}

const lineZ = (n: number) => PAGE.minZ + (n % LINES) * LINE_GAP;
const smooth = (u: number) => u * u * (3 - 2 * u);
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

/** Where the nib is at time t (s) for the coder with this seed. */
export function penAt(t: number, seed: number): Nib {
  const pace = 0.85 + (Math.abs(seed) % 7) * 0.05;
  const T = t * pace + (Math.abs(seed) % 97) * 1.3;
  const block = Math.floor(T / BLOCK_S);
  let s = T - block * BLOCK_S;
  for (let k = 0; k < DIP_EVERY; k++) {
    const line = block * DIP_EVERY + k;
    if (s < WRITE_S) {
      // across the line, in small strokes, the nib lifted a hair between words
      const x = mix(PAGE.minX, PAGE.maxX, s / WRITE_S) + Math.sin(T * 28) * 0.004;
      const gap = Math.sin(T * 4.1) > 0.92 ? 0.003 : 0;
      return { x, y: pageTop(x) + gap, z: lineZ(line) + Math.sin(T * 21 + 1) * 0.004, writing: true, dipping: false };
    }
    s -= WRITE_S;
    const last = k === DIP_EVERY - 1;
    if (!last) {
      if (s < RETURN_S) return back(lineZ(line), lineZ(line + 1), s / RETURN_S);
      s -= RETURN_S;
    }
  }
  // after every few lines, a dip: from the end of the line to the inkpot, in, and back to the start of the next
  const line = block * DIP_EVERY + DIP_EVERY - 1;
  const from = { x: PAGE.maxX, y: pageTop(PAGE.maxX), z: lineZ(line) };
  const to = { x: PAGE.minX, y: pageTop(PAGE.minX), z: lineZ(line + 1) };
  const u = s / (DIP_S + RETURN_S);
  const over = { x: INKPOT.x, y: INKPOT.top + 0.03, z: INKPOT.z };
  if (u < 0.35) return arc(from, over, smooth(u / 0.35), 0.03, true);
  if (u < 0.6) {
    const w = (u - 0.35) / 0.25; // down into the ink and out again
    return { x: INKPOT.x, y: over.y - Math.sin(w * Math.PI) * (0.03 + INKPOT.depth), z: INKPOT.z, writing: false, dipping: true };
  }
  return arc(over, to, smooth((u - 0.6) / 0.4), 0.03, true);
}

/** Lifted, back to the start of the next line. */
function back(z0: number, z1: number, u: number): Nib {
  const e = smooth(u);
  const x = mix(PAGE.maxX, PAGE.minX, e);
  return { x, y: pageTop(x) + Math.sin(u * Math.PI) * 0.015, z: mix(z0, z1, e), writing: false, dipping: false };
}

function arc(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, u: number, h: number, dipping: boolean): Nib {
  return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u) + Math.sin(u * Math.PI) * h, z: mix(a.z, b.z, u), writing: false, dipping };
}
