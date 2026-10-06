// What's on the great hall's feasting tables: bread, cheese and fruit, laid along the middle of each table, clear
// of the candlestick, the plate, and the mugs and resting hands of whoever sits there (tavernRules.ts). Pure, so it
// can be tested; Feast.tsx draws it.

export type Dish = 'loaf' | 'boule' | 'cheese' | 'apples' | 'grapes';

/** How much table each dish takes: the circle it fits in (m). */
export const TABLE_FOOD: Record<Dish, { radius: number }> = {
  loaf: { radius: 0.21 }, // a long loaf on its board
  boule: { radius: 0.11 },
  cheese: { radius: 0.17 }, // the wheel and the wedge cut from it
  apples: { radius: 0.15 }, // a bowl of them
  grapes: { radius: 0.08 },
};

export interface Placed {
  kind: Dish;
  /** In the table's frame (its middle, on the top): x along it, z across it. */
  x: number;
  z: number;
  /** Turned about the vertical (radians). */
  turn: number;
}

/** Each table's spread, by its place in FEAST_TABLES: two different spreads, so the tables don't look stamped out. */
const SPREADS: Placed[][] = [
  [
    { kind: 'loaf', x: -1.15, z: 0, turn: 0.15 },
    { kind: 'grapes', x: -0.55, z: 0.12, turn: 0 },
    { kind: 'cheese', x: 0.62, z: 0.02, turn: 2.2 },
    { kind: 'apples', x: 1.15, z: -0.02, turn: 0.6 },
  ],
  [
    { kind: 'cheese', x: -1.1, z: 0.02, turn: -0.8 },
    { kind: 'boule', x: -0.62, z: 0.14, turn: 0.4 },
    { kind: 'loaf', x: 0.75, z: 0.02, turn: -0.1 },
    { kind: 'apples', x: 1.22, z: 0, turn: 1.9 },
  ],
];

export function tableFood(index: number): Placed[] {
  return SPREADS[index % SPREADS.length];
}
