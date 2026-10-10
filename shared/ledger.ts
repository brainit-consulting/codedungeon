// The Overlord's Ledger, Volume I (the library's book, client/src/world/bookRules.ts): each chamber's merged pull
// requests over the last five days. The server asks GitHub for them (GET /api/ledger); this groups them by day and
// chamber for the book's page. Pure.

/** How many days the ledger covers, today included. */
export const LEDGER_DAYS = 5;
/** Titles shown for a chamber on one day; the rest are counted. */
const SHOWN = 3;

export interface LedgerMerge {
  /** The repo's name without its owner, as the dungeon names chambers. */
  chamber: string;
  number: number;
  title: string;
  url: string;
  mergedAt: string;
}

export interface LedgerView {
  /** The start of the window (ISO). */
  since: string;
  merges: LedgerMerge[];
  /** Chambers GitHub couldn't answer for. */
  failed: string[];
}

export interface LedgerDay {
  date: string;
  chambers: { name: string; count: number; shown: LedgerMerge[]; more: number }[];
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const midnight = (t: number, back = 0) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back).getTime();
};

/** Midnight at the start of the ledger's first day, local time (ISO). */
export function ledgerSince(now: number, days = LEDGER_DAYS): string {
  return new Date(midnight(now, days - 1)).toISOString();
}

/** The ledger's days, newest first: each chamber's merges that day, busiest chamber first, newest merge first. */
export function ledgerDays(merges: LedgerMerge[], now: number, days = LEDGER_DAYS): LedgerDay[] {
  const out: LedgerDay[] = [];
  for (let back = 0; back < days; back++) {
    const start = midnight(now, back);
    const end = midnight(now, back - 1);
    const d = new Date(start);
    const today = merges.filter((p) => {
      const t = Date.parse(p.mergedAt);
      return t >= start && t < end;
    });
    const byChamber = new Map<string, LedgerMerge[]>();
    for (const p of today) byChamber.set(p.chamber, [...(byChamber.get(p.chamber) ?? []), p]);
    const chambers = [...byChamber]
      .map(([name, ps]) => {
        const sorted = [...ps].sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
        return { name, count: ps.length, shown: sorted.slice(0, SHOWN), more: Math.max(0, ps.length - SHOWN) };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    out.push({ date: `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, chambers });
  }
  return out;
}
