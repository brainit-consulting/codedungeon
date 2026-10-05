// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { SPIDER_SHARE, SURPRISE_CHANCE, chestOpening, spoilsList } from './spoils';

const pull = (number: number, mergedAt: string | null, title = `PR ${number}`, headRefName = `swarm/issue-${number}-x`) => ({
  number,
  title,
  url: `https://github.com/o/r/pull/${number}`,
  headRefName,
  state: mergedAt ? 'MERGED' : 'OPEN',
  createdAt: '2026-10-01T00:00:00Z',
  mergedAt,
});

describe('spoilsList', () => {
  const repos = [
    { id: 'a', fullName: 'brainit-consulting/wildgauls', pulls: [pull(11, '2026-10-04T21:00:00Z'), pull(12, null), pull(9, '2026-10-03T10:00:00Z')] },
    { id: 'b', fullName: 'o/weather-api', pulls: [pull(4, '2026-10-04T22:00:00Z')] },
  ];
  const agents = [{ name: 'Aldric the Smith', repoId: 'a', role: 'dev' as const, prNumber: 11, branch: null }];

  it('lists merged pull requests from every chamber, newest first, leaving open ones out', () => {
    expect(spoilsList(repos, agents).map((s) => `${s.chamber}#${s.number}`)).toEqual(['weather-api#4', 'wildgauls#11', 'wildgauls#9']);
  });

  it('names who made it when the dungeon still knows', () => {
    const [, eleven, nine] = spoilsList(repos, agents);
    expect(eleven.by).toBe('Aldric the Smith');
    expect(nine.by).toBeNull();
  });

  it('counts a pull request merged by its state, as the board does, even when GitHub gave no merge time', () => {
    const seeded = [{ id: 'a', fullName: 'o/r', pulls: [{ ...pull(3, null), state: 'MERGED', createdAt: '2026-10-02T00:00:00Z' }, pull(4, '2026-10-03T00:00:00Z')] }];
    expect(spoilsList(seeded, []).map((s) => [s.number, s.mergedAt])).toEqual([
      [4, '2026-10-03T00:00:00Z'],
      [3, null],
    ]);
  });

  it('keeps to the newest few', () => {
    const many = [{ id: 'a', fullName: 'o/r', pulls: Array.from({ length: 20 }, (_, i) => pull(i + 1, `2026-10-0${1 + (i % 4)}T0${i % 10}:00:00Z`)) }];
    expect(spoilsList(many, [], 8)).toHaveLength(8);
  });
});

describe('chestOpening', () => {
  const room = { rat: true, spider: true };
  const base = { mimicDone: true, opens: 1, surpriseOut: false, roll: 0, pick: 0.99, room };

  it('snaps at you the very first time, and nothing comes out then', () => {
    expect(chestOpening({ ...base, mimicDone: false, opens: 0 })).toEqual({ mimic: true, surprise: null });
  });

  it('opens plainly once the mimic has had its joke', () => {
    expect(chestOpening({ ...base, opens: 0, roll: 0.99 })).toEqual({ mimic: false, surprise: null });
  });

  it('lets something out now and then, from the second opening of a visit', () => {
    expect(chestOpening({ ...base, opens: 0 }).surprise).toBeNull();
    expect(chestOpening({ ...base, roll: SURPRISE_CHANCE - 0.01 }).surprise).not.toBeNull();
    expect(chestOpening({ ...base, roll: SURPRISE_CHANCE + 0.01 }).surprise).toBeNull();
  });

  it('lets one out by the third opening of a visit at the latest, however the dice fall', () => {
    expect(chestOpening({ ...base, opens: 2, roll: 0.99 }).surprise).not.toBeNull();
  });

  it('only one a visit', () => {
    expect(chestOpening({ ...base, opens: 5, surpriseOut: true }).surprise).toBeNull();
  });

  it('is mostly a rat, and now and then a spider', () => {
    expect(chestOpening({ ...base, pick: SPIDER_SHARE + 0.01 }).surprise).toBe('rat');
    expect(chestOpening({ ...base, pick: SPIDER_SHARE - 0.01 }).surprise).toBe('spider');
    expect(SPIDER_SHARE).toBeLessThan(0.5);
  });

  it('is a spider when there is no room for another rat, and a rat when there is none for another spider', () => {
    expect(chestOpening({ ...base, pick: 0.99, room: { rat: false, spider: true } }).surprise).toBe('spider');
    expect(chestOpening({ ...base, pick: 0, room: { rat: true, spider: false } }).surprise).toBe('rat');
  });

  it('lets nothing out when there is room for neither, and keeps the surprise for a later opening', () => {
    expect(chestOpening({ ...base, opens: 2, room: { rat: false, spider: false } }).surprise).toBeNull();
  });
});
