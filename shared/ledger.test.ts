import { describe, expect, it } from 'vitest';
import { ledgerDays, ledgerSince, type LedgerMerge } from './ledger';

const now = new Date(2026, 9, 10, 15, 30).getTime(); // Saturday 10 October, afternoon
const at = (day: number, h: number) => new Date(2026, 9, day, h, 0).toISOString();
const m = (chamber: string, number: number, day: number, h = 12): LedgerMerge => ({ chamber, number, title: `PR ${number}`, url: `https://github.com/x/${chamber}/pull/${number}`, mergedAt: at(day, h) });

describe('ledgerSince', () => {
  it('starts at midnight four days before today, so the page covers five days', () => {
    expect(new Date(ledgerSince(now)).getTime()).toBe(new Date(2026, 9, 6).getTime());
  });
});

describe('ledgerDays', () => {
  it('lists five days, newest first, each headed with its date', () => {
    const days = ledgerDays([], now);
    expect(days.map((d) => d.date)).toEqual(['Saturday, 10 October', 'Friday, 9 October', 'Thursday, 8 October', 'Wednesday, 7 October', 'Tuesday, 6 October']);
    expect(days.every((d) => d.chambers.length === 0)).toBe(true);
  });

  it("groups a day's merges by chamber, busiest first, newest merge first within a chamber", () => {
    const days = ledgerDays([m('wildgauls', 119, 8, 9), m('wildgauls', 133, 8, 14), m('library-workshops', 94, 8, 11), m('wildgauls', 140, 9)], now);
    const thu = days[2];
    expect(thu.chambers.map((c) => [c.name, c.count])).toEqual([
      ['wildgauls', 2],
      ['library-workshops', 1],
    ]);
    expect(thu.chambers[0].shown.map((p) => p.number)).toEqual([133, 119]);
    expect(days[1].chambers.map((c) => c.name)).toEqual(['wildgauls']);
  });

  it('shows up to three titles a chamber a day and counts the rest', () => {
    const many = [1, 2, 3, 4, 5].map((n) => m('wildgauls', n, 10, 8 + n));
    const [today] = ledgerDays(many, now);
    expect(today.chambers[0].count).toBe(5);
    expect(today.chambers[0].shown.map((p) => p.number)).toEqual([5, 4, 3]);
    expect(today.chambers[0].more).toBe(2);
  });

  it('leaves out anything merged before the five days', () => {
    const days = ledgerDays([m('wildgauls', 1, 5, 23), m('wildgauls', 2, 6, 0)], now);
    expect(days.flatMap((d) => d.chambers.flatMap((c) => c.shown.map((p) => p.number)))).toEqual([2]);
  });
});
