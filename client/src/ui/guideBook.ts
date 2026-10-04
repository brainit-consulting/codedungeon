// The User Guide's pure parts: the chapter shape, turning pages, and the tiny inline markup the chapters are
// written in ([[Key]] for a key, `code` for a command, **bold**). Kept apart from the component so it can be tested.

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'keys'; rows: [keys: string, what: string][] }
  | { kind: 'command'; text: string }; // one line to paste into a terminal, with a Copy button

export interface GuideChapter {
  /** Stable id, so a chapter can be opened by name. */
  id: string;
  title: string;
  blocks: GuideBlock[];
}

/** Move `delta` chapters from `index`, stopping at the first and last (a book doesn't wrap round). */
export function stepChapter(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + delta));
}

/** The index of chapter `id`, or 0 when there's no such chapter. */
export function chapterIndex(chapters: readonly GuideChapter[], id: string | undefined): number {
  if (!id) return 0;
  const i = chapters.findIndex((c) => c.id === id);
  return i < 0 ? 0 : i;
}

const ROMAN: [number, string][] = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

/** 1 → I, 9 → IX, 14 → XIV. Anything below 1 gives ''. */
export function roman(n: number): string {
  let out = '';
  let left = Math.floor(n);
  for (const [v, s] of ROMAN) {
    while (left >= v) {
      out += s;
      left -= v;
    }
  }
  return out;
}

export type Inline = { kind: 'text' | 'key' | 'code' | 'bold'; text: string } | { kind: 'link'; text: string; href: string };

const MARK = /(\[\[[^\]]+\]\]|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/;
const LINK = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/;

/**
 * Split a line of chapter text into plain text, keys, code, bold and links ([text](https://…), which open in their
 * own tab). Unclosed marks, and links to anything but http(s), stay as plain text.
 */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  for (const part of line.split(MARK)) {
    if (!part) continue;
    const link = LINK.exec(part);
    if (link) out.push({ kind: 'link', text: link[1], href: link[2] });
    else if (part.startsWith('[[') && part.endsWith(']]')) out.push({ kind: 'key', text: part.slice(2, -2) });
    else if (part.length > 1 && part.startsWith('`') && part.endsWith('`')) out.push({ kind: 'code', text: part.slice(1, -1) });
    else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) out.push({ kind: 'bold', text: part.slice(2, -2) });
    else out.push({ kind: 'text', text: part });
  }
  return out;
}
