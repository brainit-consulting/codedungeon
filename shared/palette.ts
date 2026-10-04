// The dungeon's colours for chambers and the people in them: dyes a medieval workshop could make (madder, woad, weld,
// verdigris, oak gall), in place of cubefarm's bright screen colours. periodColor() moves a saved cubefarm colour to
// its dye, so chambers and coders created before the dungeon change with everything else.

/** One per chamber, in order: ochre, woad, moss, purpure, weld, rose madder, verdigris, madder. */
export const CHAMBER_DYES = ['#b8682e', '#3f5f8a', '#5f7a3a', '#6b4470', '#b8962e', '#a8546a', '#3f7f74', '#9c3b2e'];

/** Coats and robes for the guild (the first is gules, the DungeonMaster's default). */
export const COAT_DYES = ['#8e2a22', '#45607a', '#3f7066', '#b0703e', '#5e3a63', '#9a4f62', '#4a6f8f', '#4f6b35', '#a8862e', '#4f3a6b', '#a5512a', '#2f4d7a'];

const OLD_CHAMBERS = ['#ff8a5b', '#4fb3e8', '#8fd14f', '#c77dff', '#ffc93c', '#ff6fb5', '#2ec4b6', '#f25f5c'];
const OLD_COATS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5', '#f15bb5', '#00bbf9', '#06d6a0', '#ffbe0b', '#8338ec', '#fb5607', '#3a86ff'];

/** A saved colour in the dungeon's dyes: cubefarm's own colours map one for one, anything else is kept. */
export function periodColor(hex: string): string {
  const c = hex.toLowerCase();
  const chamber = OLD_CHAMBERS.indexOf(c);
  if (chamber >= 0) return CHAMBER_DYES[chamber];
  const coat = OLD_COATS.indexOf(c);
  return coat >= 0 ? COAT_DYES[coat] : hex;
}
