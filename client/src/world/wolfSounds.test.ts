import { describe, expect, it } from 'vitest';
import { wolfSounds } from './wolfSounds';

describe("the wolf's sounds", () => {
  it('sighs when he stirs with a sigh or settles, even though he keeps the clip he was in', () => {
    expect(wolfSounds({ action: 'stir', stir: 'sigh', dur: 4 })).toEqual([{ sound: 'sigh', at: 0 }]);
    expect(wolfSounds({ action: 'settle', stir: null, dur: 5 })).toEqual([{ sound: 'sigh', at: 0 }]);
  });

  it('sighs as a glance looks away, whether or not a look came first', () => {
    expect(wolfSounds({ action: 'glance', stir: null, dur: 5 })).toEqual([{ sound: 'sigh', at: 3 }]);
  });

  it('yawns partway into a lying yawn and a stretch', () => {
    expect(wolfSounds({ action: 'stir', stir: 'yawn', dur: 4 })).toEqual([{ sound: 'yawn', at: 1.4 }]);
    expect(wolfSounds({ action: 'stretch', stir: null, dur: 5 })).toEqual([{ sound: 'yawn', at: 2 }]);
  });

  it('is silent for everything else', () => {
    for (const action of ['sleep', 'look', 'rise', 'stand', 'circle', 'lieDown'] as const) expect(wolfSounds({ action, stir: null, dur: 3 })).toEqual([]);
    expect(wolfSounds({ action: 'stir', stir: 'ear', dur: 2 })).toEqual([]);
  });
});
