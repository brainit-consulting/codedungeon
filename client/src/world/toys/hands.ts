import { useStore } from '../../store';
import { noise } from '../../ui/sfx';

// The player's hands. store.held says how many darts are in hand; input (Player.tsx) charges and throws here, and
// the toy world (HandDarts.tsx) turns each throw into a flying dart on its next physics step.

/** Holding the throw button this long (ms) is still a tap, a gentle lob; by `full` the throw is at full power. */
export const CHARGE = { tap: 150, full: 1000 };

/** 0 for a tap up to 1 for a full charge. */
export const chargePower = (ms: number) => Math.min(1, Math.max(0, (ms - CHARGE.tap) / (CHARGE.full - CHARGE.tap)));

// Throws (their power) since the toy world's last physics step, and whether E asked for the darts back.
let throws: number[] = [];
let collect = false;

/** Start winding up a throw (left mouse or F went down). */
export function startCharge() {
  const s = useStore.getState();
  if (s.held && s.chargeAt === null) s.setCharge(performance.now());
}

/** The throw button came up: throw one dart with the power charged so far. */
export function throwHeld() {
  const s = useStore.getState();
  if (!s.held || s.chargeAt === null) return;
  throwDart(chargePower(performance.now() - s.chargeAt));
}

/** Throw the next dart in hand at `power` (0 to 1). Also what the dev-only window.__throwDart calls. */
export function throwDart(power: number) {
  const s = useStore.getState();
  if (!s.held) return;
  const p = Math.min(1, Math.max(0, power));
  throws.push(p);
  noise({ dur: 0.1 + p * 0.06, peak: 0.02 + p * 0.04, filter: 'bandpass', freq: 700, to: 1800 + p * 900, q: 0.9 });
  s.setHeld(s.held.count > 1 ? { kind: 'darts', count: s.held.count - 1 } : null);
}

/** Put the darts down (a panel opening, the mouse being freed): the toy world returns them to the board's ledge. */
export function dropHeld() {
  const s = useStore.getState();
  if (s.held) s.setHeld(null);
}

/** E on the board: every dart, wherever it is, comes back into your hand. */
export function collectDarts() {
  collect = true;
}

/** For the toy world: the throws to make this step, oldest first. */
export function takeThrows(): number[] {
  const t = throws;
  throws = [];
  return t;
}

/** For the toy world: whether the darts were asked back since the last step. */
export function takeCollect(): boolean {
  const c = collect;
  collect = false;
  return c;
}
