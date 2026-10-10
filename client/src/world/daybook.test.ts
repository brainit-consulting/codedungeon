import { describe, expect, it } from 'vitest';
import { daybook } from './daybook';

const now = new Date(2026, 9, 10, 15, 30).getTime();
const today = (h: number) => new Date(2026, 9, 10, h, 0).toISOString();
const yesterday = new Date(2026, 9, 9, 22, 0).toISOString();
const repo = (fullName: string, pulls: { state: string; mergedAt: string | null }[]) => ({ fullName, pulls });
const agent = (name: string, status: string, role = 'dev') => ({ name, status, role });

describe('daybook', () => {
  it("heads the page with today's date", () => {
    expect(daybook({ now, repos: [], agents: [], today: null }).date).toBe('Saturday, 10 October');
  });

  it("counts the pull requests merged since midnight, by chamber, and leaves out yesterday's", () => {
    const d = daybook({
      now,
      repos: [
        repo('brainit-consulting/wildgauls', [
          { state: 'MERGED', mergedAt: today(9) },
          { state: 'MERGED', mergedAt: today(14) },
          { state: 'MERGED', mergedAt: yesterday },
          { state: 'OPEN', mergedAt: null },
        ]),
        repo('brainit-consulting/library-workshops', [{ state: 'MERGED', mergedAt: today(11) }]),
      ],
      agents: [],
      today: null,
    });
    expect(d.lines[0]).toBe('The guild has merged 3 pull requests today: 2 in wildgauls and 1 in library-workshops.');
  });

  it('says so plainly when nothing has merged, nobody is working and nothing is spent', () => {
    const d = daybook({ now, repos: [repo('a/b', [])], agents: [agent('Maud the Scribe', 'idle')], today: null });
    expect(d.lines).toEqual(['No pull request has been merged yet today.', 'Nobody is at work just now.', "Today's work so far: nothing yet."]);
  });

  it("names who is at work now, and today's work at API prices", () => {
    const d = daybook({
      now,
      repos: [repo('a/wildgauls', [{ state: 'MERGED', mergedAt: today(10) }])],
      agents: [agent('Maud the Scribe', 'working'), agent('Godric the Wright', 'preparing'), agent('Aldric the Smith', 'idle'), agent('Gerard the Assayer', 'working', 'qa')],
      today: { tokens: 4_200_000, costUsd: 18.4 },
    });
    expect(d.lines).toEqual([
      'The guild has merged 1 pull request today, in wildgauls.',
      'At work now: Maud the Scribe, Godric the Wright and Gerard the Assayer.',
      "Today's work so far: 4.2M tokens, worth $18.40 at API prices.",
    ]);
  });
});
