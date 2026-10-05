// Run with `npm test` (Vitest).
import { describe, expect, it } from 'vitest';
import { fallsBackToDrag, hushesAfterUse, shouldGrabLook, viewPointer, viewUncovered, type Covering } from './lookLockRules';

const c = (overlay: boolean, confirm = false): Covering => ({ overlay, confirm });
const on = { started: true, enabled: true };

describe('viewUncovered', () => {
  it('is true when the last panel closes (✕, backdrop, Esc, or goToFloor from the elevator/console/phone)', () => {
    expect(viewUncovered(c(true), c(false))).toBe(true);
  });

  it('is true when the hire question is answered with nothing else open', () => {
    expect(viewUncovered(c(false, true), c(false, false))).toBe(true);
  });

  it('is false when a panel opens or swaps for another', () => {
    expect(viewUncovered(c(false), c(true))).toBe(false);
    expect(viewUncovered(c(true), c(true))).toBe(false);
  });

  it('is false when a question inside a panel is answered and the panel stays open', () => {
    expect(viewUncovered(c(true, true), c(true, false))).toBe(false);
  });

  it('is false when a panel closes behind a question still on screen', () => {
    expect(viewUncovered(c(true, true), c(false, true))).toBe(false);
  });

  it('is false when nothing changes or a question appears', () => {
    expect(viewUncovered(c(false), c(false))).toBe(false);
    expect(viewUncovered(c(false, false), c(false, true))).toBe(false);
  });
});

describe('shouldGrabLook', () => {
  it('grabs the mouse after a close when the setting is on', () => {
    expect(shouldGrabLook(c(true), c(false), on)).toBe(true);
    expect(shouldGrabLook(c(false, true), c(false), on)).toBe(true);
  });

  it('leaves the mouse free with the setting off (the old behaviour)', () => {
    expect(shouldGrabLook(c(true), c(false), { ...on, enabled: false })).toBe(false);
  });

  it('never grabs before the office has started', () => {
    expect(shouldGrabLook(c(true), c(false), { ...on, started: false })).toBe(false);
  });

  it('never grabs when nothing closed', () => {
    expect(shouldGrabLook(c(false), c(true), on)).toBe(false);
    expect(shouldGrabLook(c(true, true), c(true), on)).toBe(false);
  });
});

describe('hushesAfterUse', () => {
  it('swallows a double click after clicking something in the world open', () => {
    expect(hushesAfterUse('click')).toBe(true);
  });

  it('leaves the mouse alone after E, so a quick click on the panel that opened still counts', () => {
    expect(hushesAfterUse('key')).toBe(false);
  });
});

describe('fallsBackToDrag', () => {
  it('drags to look when this page has never captured the mouse (the browser refuses it outright)', () => {
    expect(fallsBackToDrag(false)).toBe(true);
  });

  it("keeps trying after a capture has worked: a refusal then is only the browser's pause after Esc", () => {
    // measured 2026-10-04: a click 200 or 600 ms after a real Esc is refused with SecurityError, at 1500 ms it is granted
    expect(fallsBackToDrag(true)).toBe(false);
  });
});

describe('viewPointer', () => {
  const v = (locked: boolean, dragLook: boolean, overlay = false, started = true) => viewPointer({ started, overlay, locked, dragLook });

  it('shows only the crosshair while the mouse is captured', () => {
    expect(v(true, false)).toEqual({ crosshair: true, resumeHint: false, hideArrow: false });
  });

  it('shows only the arrow and the hint while the mouse is free', () => {
    expect(v(false, false)).toEqual({ crosshair: false, resumeHint: true, hideArrow: false });
  });

  it('hides the arrow over the view when looking by dragging, so the crosshair is the one pointer', () => {
    expect(v(false, true)).toEqual({ crosshair: true, resumeHint: false, hideArrow: true });
  });

  it('shows neither over an open panel or before entering', () => {
    const none = { crosshair: false, resumeHint: false, hideArrow: false };
    expect(v(true, false, true)).toEqual(none);
    expect(v(false, true, true)).toEqual(none);
    expect(v(false, false, false, false)).toEqual(none);
  });

  it('never shows the crosshair and the arrow together', () => {
    for (const locked of [true, false])
      for (const dragLook of [true, false]) {
        const p = v(locked, dragLook);
        const arrowShows = !locked && !p.hideArrow;
        expect(p.crosshair && arrowShows).toBe(false);
      }
  });
});
