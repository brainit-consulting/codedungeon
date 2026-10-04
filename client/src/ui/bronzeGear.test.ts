import { describe, expect, it } from 'vitest';
import { gearOutline } from './bronzeGear';

describe('the bronze gear', () => {
  it('draws one closed outline with a tip and a root for every tooth', () => {
    const d = gearOutline(24, 30, 26);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/L/g)).toHaveLength(24 * 3 - 1);
  });

  it('keeps every point between the root and tip circles', () => {
    const nums = gearOutline(12, 30, 26).match(/-?\d+(\.\d+)?/g)!.map(Number);
    for (let i = 0; i < nums.length; i += 2) {
      const r = Math.hypot(nums[i] - 32, nums[i + 1] - 32);
      expect(r).toBeGreaterThan(25.9);
      expect(r).toBeLessThan(30.1);
    }
  });
});
