// Letters on the scroll: the Overlord's to the DungeonMaster, and the replies and notices that come back. Never cut
// short without a word: a letter that's too long is refused saying so, and a reply that's too long says it was cut.

/** The longest letter the scroll carries, in characters (a brief with notes pasted in fits). */
export const LETTER_MAX = 20_000;

const n = (x: number) => x.toLocaleString('en-US');

/** Why `text` can't go to the DungeonMaster as it is, or null if it can. */
export function letterProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return 'Empty message';
  if (t.length > LETTER_MAX) return `Too long: ${n(t.length)} characters, and a letter can be ${n(LETTER_MAX)} at most. Send it in two parts.`;
  return null;
}

const CUT = `\n\n[Cut short here: the scroll holds ${n(LETTER_MAX)} characters. The rest is in the terminal.]`;

/** A reply or notice as the scroll keeps it: whole, or cut to fit and saying so at the end. */
export function forTheScroll(text: string): string {
  const t = text.trim();
  return t.length <= LETTER_MAX ? t : t.slice(0, LETTER_MAX - CUT.length) + CUT;
}
