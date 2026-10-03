import { describe, expect, it } from 'vitest';
import { nextChamber } from './chambers';

describe('nextChamber', () => {
  it('starts at 1 and takes the lowest number no project uses', () => {
    expect(nextChamber([])).toBe(1);
    expect(nextChamber([1, 2, 3])).toBe(4);
    expect(nextChamber([1, 3])).toBe(2); // chamber 2 was disconnected: the next project moves in there
    expect(nextChamber([2, 3])).toBe(1);
  });
});
