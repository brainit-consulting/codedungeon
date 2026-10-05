// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { BAR_STOOLS, FEAST_TABLES } from './layout';
import { TAVERN_SEATS, assignSeats, chatter, drinkAt, offDuty } from './tavernRules';

describe('offDuty', () => {
  it('sends free coders and testers to the tavern', () => {
    expect(offDuty({ role: 'dev', status: 'idle' })).toBe(true);
    expect(offDuty({ role: 'dev', status: 'done' })).toBe(true);
    expect(offDuty({ role: 'qa', status: 'idle' })).toBe(true);
  });

  it('keeps anyone working, setting up, stuck or stopped at their bench, and the DungeonMaster at her table', () => {
    for (const status of ['working', 'preparing', 'error', 'stopped']) expect(offDuty({ role: 'dev', status })).toBe(false);
    expect(offDuty({ role: 'ceo', status: 'idle' })).toBe(false);
  });
});

describe('TAVERN_SEATS', () => {
  it('has the four bar stools first, then three a side at each feasting table', () => {
    expect(TAVERN_SEATS).toHaveLength(BAR_STOOLS.length + FEAST_TABLES.length * 6);
    expect(TAVERN_SEATS.slice(0, 4).every((s) => s.kind === 'stool')).toBe(true);
  });

  it('puts each mug in front of its drinker, on the bar or the table', () => {
    for (const s of TAVERN_SEATS) {
      const ahead = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) }; // seated people face -Z in their seat's frame
      const toMug = { x: s.mug.x - s.x, z: s.mug.z - s.z };
      expect(ahead.x * toMug.x + ahead.z * toMug.z).toBeGreaterThan(0.3);
    }
  });
});

describe('assignSeats', () => {
  it('gives everyone off duty a seat of their own, up to the number of seats', () => {
    const seats = assignSeats(new Map(), ['a', 'b', 'c'], 4);
    expect(new Set(seats.values()).size).toBe(3);
    expect(assignSeats(new Map(), ['a', 'b', 'c', 'd', 'e', 'f'], 4).size).toBe(4);
  });

  it('keeps everyone where they sat when someone leaves or comes in', () => {
    const before = assignSeats(new Map(), ['a', 'b', 'c'], 16);
    const after = assignSeats(before, ['a', 'c', 'd'], 16);
    expect(after.get('a')).toBe(before.get('a'));
    expect(after.get('c')).toBe(before.get('c'));
    expect(after.has('b')).toBe(false);
    expect([...after.values()].filter((v) => v === after.get('d'))).toHaveLength(1);
  });

  it('fills the bar first', () => {
    expect(assignSeats(new Map(), ['only'], 16).get('only')).toBeLessThan(4);
  });
});

describe('drinkAt', () => {
  it('spends most of the time with the mug on the bar', () => {
    let resting = 0;
    for (let t = 0; t < 60; t += 0.1) if (drinkAt(t, 7).weight === 0) resting++;
    expect(resting / 600).toBeGreaterThan(0.6);
  });

  it('reaches, lifts, sips with the mug tilted, lowers and lets go', () => {
    const seen = new Set<string>();
    for (let t = 0; t < 40; t += 0.05) {
      const d = drinkAt(t, 3);
      if (d.weight > 0 && !d.holding) seen.add('reach');
      if (d.holding && d.toMouth > 0.99 && d.tilt > 0.5) seen.add('sip');
    }
    expect(seen).toEqual(new Set(['reach', 'sip']));
  });

  it('drinks out of step with the others', () => {
    const at = (seed: number) => Array.from({ length: 200 }, (_, i) => drinkAt(i * 0.1, seed).weight > 0);
    expect(at(1)).not.toEqual(at(2));
  });
});

describe('chatter', () => {
  const quiet = { mergedToday: 0, testing: [], backlog: 3, idleChambers: [], catKills: 0 };

  it('always has something to say', () => {
    expect(chatter(quiet).length).toBeGreaterThan(3);
  });

  it('talks about what the guild is really doing', () => {
    const lines = chatter({ mergedToday: 3, testing: [{ tester: 'Gerard the Assayer', pr: 12 }], backlog: 0, idleChambers: ['wildgauls'], catKills: 2 });
    expect(lines).toContain("3 merged today. The DungeonMaster's buying.");
    expect(lines.some((l) => l.includes('Gerard') && l.includes('#12'))).toBe(true);
    expect(lines.some((l) => /nothing on the board/i.test(l))).toBe(true);
    expect(lines.some((l) => l.includes('2 rats'))).toBe(true);
  });

  it("says when a chamber's work isn't being handed out", () => {
    expect(chatter({ ...quiet, idleChambers: ['wildgauls'] }).some((l) => l.includes('wildgauls'))).toBe(true);
  });
});
