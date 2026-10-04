// The Overlord's scroll (Phone.tsx): its wording and its wax seal's outline, kept pure so they can be tested. The hour
// is told the way a hold's bells told it, by the canonical hours, and the DungeonMaster's presence in plain words.

/** The canonical hours, each ringing in a three-hour watch from midnight. */
const HOURS = ['Matins', 'Lauds', 'Prime', 'Terce', 'Sext', 'None', 'Vespers', 'Compline'] as const;

/** The bell hour a time of day falls in: Matins from midnight, Prime from six, Sext from noon, Vespers from six. */
export function canonicalHour(d: Date): (typeof HOURS)[number] {
  return HOURS[Math.floor(d.getHours() / 3)];
}

/** The first letter of a name, for its seal; a name without one gets a "?". */
export function sealInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase() : '?';
}

export interface PresenceInput {
  /** the DungeonMaster has a job running */
  working: boolean;
  /** the running job is answering the Overlord's letter */
  replying: boolean;
  /** the running job's label, e.g. "Reviewing the dungeon" */
  jobLabel?: string;
  /** a letter from the Overlord waits in the DungeonMaster's queue */
  letterQueued: boolean;
  /** the label of the next queued job, if any */
  nextLabel?: string;
  /** sessions running across the dungeon, and the cap (0 or undefined: no cap) */
  running: number;
  sessionLimit?: number;
}

/** One line under the DungeonMaster's name saying what they're doing. */
export function presenceText(p: PresenceInput): string {
  if (p.working) return p.replying ? 'penning a reply…' : `at work: ${lower(p.jobLabel ?? 'busy')}`;
  if (p.letterQueued)
    return p.sessionLimit && p.running >= p.sessionLimit
      ? `will reply when a session slot frees up (${p.running}/${p.sessionLimit} busy)`
      : 'reading your letter…';
  if (p.nextLabel) return `next: ${lower(p.nextLabel)}`;
  return 'at the table';
}

/** A blob of pressed wax round (32, 32) on the 64 grid: a smooth closed outline whose edge swells and dips. */
export function waxOutline(points: number, r: number, wobble: number): string {
  const swell = [1, -0.4, 0.3, -0.8, 0.6];
  const p = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const rr = r + wobble * swell[i % swell.length];
    return [32 + rr * Math.cos(a), 32 + rr * Math.sin(a)];
  });
  const f = (n: number) => n.toFixed(2);
  const mid = (i: number) => {
    const [a, b] = [p[i % points], p[(i + 1) % points]];
    return `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  };
  let d = `M${mid(0)}`;
  for (let i = 1; i <= points; i++) d += `Q${f(p[i % points][0])} ${f(p[i % points][1])} ${mid(i)}`;
  return `${d}Z`;
}

const lower = (s: string) => s.replace(/^\p{Lu}(?!\p{Lu})/u, (c) => c.toLocaleLowerCase());
