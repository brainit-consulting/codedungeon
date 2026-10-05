import { hashId } from './appearance';
import { BAR_STOOLS, FEAST_TABLES, RECEPTION } from './layout';

// The great hall's tavern after hours: guild members with nothing to do sit at the bar or the feasting tables with a
// mug, talk among themselves and now and then drink. Pure, so it can be tested; Tavern.tsx draws it.

/** Where the chairs the sitting clips were made for put the seat (RiggedCharacter's SEAT); stools and benches sit higher. */
const CHAIR_SEAT = 0.479;
const STOOL_SEAT = 0.582; // Stool.gltf's top, measured
const BENCH_SEAT = 0.526; // Bench.gltf's top
const BAR_TOP = 1.105; // the bar's top board
const TABLE_TOP = 0.815; // Table_Large.gltf's top

export interface Seat {
  kind: 'stool' | 'bench';
  /** Where the seat's centre is, and which way the sitter faces (Player's yaw convention: forward is (-sin, -cos)). */
  x: number;
  z: number;
  yaw: number;
  /** How much higher the seat is than a bench chair. */
  lift: number;
  /** Where their mug stands while they aren't drinking. */
  mug: { x: number; y: number; z: number };
}

const barFront = RECEPTION.z + RECEPTION.d / 2;

export const TAVERN_SEATS: Seat[] = [
  // at the bar: facing it (north), a little back from the stool's middle so their knees clear the bar's front
  ...BAR_STOOLS.map((s) => ({ kind: 'stool' as const, x: s.x, z: s.z + 0.08, yaw: 0, lift: STOOL_SEAT - CHAIR_SEAT, mug: { x: s.x, y: BAR_TOP, z: barFront - 0.05 } })),
  // at the feasting tables: three to a bench, each side facing the table
  ...FEAST_TABLES.flatMap((t) =>
    [-1, 1].flatMap((side) =>
      [-0.9, 0, 0.9].map((dx) => ({
        kind: 'bench' as const,
        x: t.x + dx,
        z: t.z + side * 0.9,
        yaw: side < 0 ? Math.PI : 0,
        lift: BENCH_SEAT - CHAIR_SEAT,
        mug: { x: t.x + dx, y: TABLE_TOP, z: t.z + side * 0.33 },
      })),
    ),
  ),
];

/** Who goes to the tavern: coders and testers with nothing on. Anyone working, stuck or stopped stays at their bench. */
export function offDuty(a: { role: string; status: string }): boolean {
  return a.role !== 'ceo' && (a.status === 'idle' || a.status === 'done');
}

/**
 * Seats for everyone off duty, keeping whoever is already sat where they are. Newcomers take the first free seat,
 * the bar before the tables; once every seat is taken, the rest stay at their benches.
 */
export function assignSeats(prev: Map<string, number>, ids: string[], seats = TAVERN_SEATS.length): Map<string, number> {
  const out = new Map<string, number>();
  for (const id of ids) {
    const s = prev.get(id);
    if (s !== undefined && s < seats) out.set(id, s);
  }
  const taken = new Set(out.values());
  for (const id of [...ids].sort()) {
    if (out.has(id)) continue;
    let s = 0;
    while (s < seats && taken.has(s)) s++;
    if (s >= seats) break;
    out.set(id, s);
    taken.add(s);
  }
  return out;
}

export interface Drink {
  /** How far the arm has taken over from the sitting clip (0: hands where the clip has them). */
  weight: number;
  /** 0 with the hand at the mug's place on the bar, 1 at the mouth. */
  toMouth: number;
  /** The mug is in the hand (otherwise it stands where it was put down). */
  holding: boolean;
  /** How far the mug is tipped back for the sip. */
  tilt: number;
}

// one drink: reach for the mug, lift it, sip, put it down, let go (seconds)
const REACH = 0.5;
const LIFT = 0.6;
const SIP = 1.1;
const LOWER = 0.6;
const LET_GO = 0.5;
const DRINK_S = REACH + LIFT + SIP + LOWER + LET_GO;
const ease = (k: number) => k * k * (3 - 2 * k);

/** Where a drinker is in their drinking at time t: a drink every 10 to 16 seconds, each drinker at their own pace. */
export function drinkAt(t: number, seed: number): Drink {
  const period = 10 + (seed % 7);
  const k = (t + (seed % 97) * 0.37) % period;
  if (k >= DRINK_S) return { weight: 0, toMouth: 0, holding: false, tilt: 0 };
  if (k < REACH) return { weight: ease(k / REACH), toMouth: 0, holding: false, tilt: 0 };
  let u = k - REACH;
  if (u < LIFT) return { weight: 1, toMouth: ease(u / LIFT), holding: true, tilt: 0 };
  u -= LIFT;
  if (u < SIP) return { weight: 1, toMouth: 1, holding: true, tilt: Math.sin((u / SIP) * Math.PI) };
  u -= SIP;
  if (u < LOWER) return { weight: 1, toMouth: 1 - ease(u / LOWER), holding: true, tilt: 0 };
  u -= LOWER;
  return { weight: 1 - ease(u / LET_GO), toMouth: 0, holding: false, tilt: 0 };
}

/** A drinker's seed for drinkAt, from their id. */
export const drinkSeed = (id: string) => hashId(id) % 10007;

// ---------- what they talk about ----------

export interface ChatterContext {
  mergedToday: number;
  /** QA running now: who is testing which pull request. */
  testing: { tester: string; pr: number }[];
  /** Issues on the boards that could start. */
  backlog: number;
  /** Chambers with work on the board but auto-assign off, so nobody is being sent. */
  idleChambers: string[];
  catKills: number;
}

const ALWAYS = [
  'Fine ale tonight.',
  'Same again, Wystan.',
  'Who keeps leaving darts in the wall?',
  'Mind the chest. It bites.',
  'Merge conflicts. Never again. Until tomorrow.',
  'I wrote a test for my tankard. It passed.',
  "The wolf hasn't moved since the last release.",
];

/** Lines the guild says to each other: some always, some about what is really going on in the dungeon. */
export function chatter(c: ChatterContext): string[] {
  const out = [...ALWAYS];
  if (c.mergedToday === 1) out.push('One merged today. The DungeonMaster is buying.');
  else if (c.mergedToday > 1) out.push(`${c.mergedToday} merged today. The DungeonMaster's buying.`);
  for (const t of c.testing) out.push(`${t.tester.split(' ')[0]} is still testing #${t.pr}. I'll have another while I wait.`);
  if (c.backlog === 0) out.push("Nothing on the board. I'll take the next issue that comes in.");
  for (const ch of c.idleChambers) out.push(`Nobody's handing out work in ${ch} tonight.`);
  if (c.catKills > 0) out.push(`The cat's had ${c.catKills} rat${c.catKills === 1 ? '' : 's'} already.`);
  return out;
}

/** What a guild member says when the Overlord walks up and speaks to them. */
export const GREETINGS = [
  'Evening, Overlord.',
  "Got an issue for me? I'm ready.",
  "Put something on the board and I'm yours.",
  'Just the one, then back to the bench.',
];

/** Wystan the Tapster, behind the bar. */
export const TAPSTER = {
  name: 'Wystan the Tapster',
  lines: ["What'll it be, Overlord?", 'They drink on credit until the next merge.', "Ale's on the house when the build is green.", 'Mind the floor. The cat leaves her rats about.'],
};
