import { describe, expect, it } from 'vitest';
import { CHAMBER_DYES, COAT_DYES, periodColor } from './palette';

const OLD_FLOORS = ['#ff8a5b', '#4fb3e8', '#8fd14f', '#c77dff', '#ffc93c', '#ff6fb5', '#2ec4b6', '#f25f5c'];
const OLD_SHIRTS = ['#e63946', '#457b9d', '#2a9d8f', '#f4a261', '#9b5de5', '#f15bb5', '#00bbf9', '#06d6a0', '#ffbe0b', '#8338ec', '#fb5607', '#3a86ff'];

describe('period colours', () => {
  it("turns cubefarm's bright chamber and shirt colours into the dungeon's dyes, one for one", () => {
    OLD_FLOORS.forEach((c, i) => expect(periodColor(c)).toBe(CHAMBER_DYES[i]));
    OLD_SHIRTS.forEach((c, i) => expect(periodColor(c)).toBe(COAT_DYES[i]));
    expect(periodColor('#FF8A5B')).toBe(CHAMBER_DYES[0]);
  });

  it('leaves colours it does not know, and its own dyes, alone', () => {
    expect(periodColor('#123456')).toBe('#123456');
    for (const c of [...CHAMBER_DYES, ...COAT_DYES]) expect(periodColor(c)).toBe(c);
  });

  it('has a distinct dye for every old colour', () => {
    expect(new Set(CHAMBER_DYES).size).toBe(OLD_FLOORS.length);
    expect(new Set(COAT_DYES).size).toBe(OLD_SHIRTS.length);
  });
});
