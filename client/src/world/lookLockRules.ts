// Which state changes should grab the mouse again (see lookLock.ts). Pure, so it can be unit-tested.

export interface Covering {
  /** A panel (terminal, Kanban, phone, console, elevator, help…) is open. */
  overlay: boolean;
  /** A confirm dialog (like "Hire an agent for this desk?") is on screen. */
  confirm: boolean;
}

/** True when going from prev to next closed the last thing covering the office view. */
export function viewUncovered(prev: Covering, next: Covering): boolean {
  const closed = (prev.overlay && !next.overlay) || (prev.confirm && !next.confirm);
  return closed && !next.overlay && !next.confirm;
}

/** Whether that transition should grab the mouse for looking around. */
export function shouldGrabLook(prev: Covering, next: Covering, opts: { started: boolean; enabled: boolean }): boolean {
  return opts.enabled && opts.started && viewUncovered(prev, next);
}

/**
 * Whether using something should swallow mouse presses for a moment: only when it was clicked, so a double click's
 * second half can't land on the panel it opened. After E there is no second click, and a quick click is meant.
 */
export function hushesAfterUse(via: 'key' | 'click'): boolean {
  return via === 'click';
}

/**
 * Whether a refused (or silently ignored) capture means this browser can't capture the mouse at all, so the view is
 * turned by dragging instead. Only while no capture has ever worked on this page: after one has, a refusal is the
 * browser's pause after Esc (Chrome and Edge refuse for about a second, measured 2026-10-04), and the next click works.
 */
export function fallsBackToDrag(everLocked: boolean): boolean {
  return !everLocked;
}

/** What shows over the view. One pointer at a time: the crosshair while looking around, the arrow otherwise. */
export function viewPointer(s: { started: boolean; overlay: boolean; locked: boolean; dragLook: boolean }) {
  const open = s.started && !s.overlay;
  return {
    crosshair: open && (s.locked || s.dragLook),
    resumeHint: open && !s.locked && !s.dragLook,
    /** Looking by dragging: the arrow would sit wherever the drag left it, so it's hidden over the view. */
    hideArrow: open && s.dragLook,
  };
}

/**
 * Whether the mouse may be captured now: only to look round the dungeon in the window in front. A capture at any
 * other time (a panel or question open, another window focused) is let go of at once: on Windows a capture that
 * starts like that can leave the arrow frozen on screen until you switch apps.
 */
export function lockAllowed(s: { started: boolean; overlay: boolean; confirm: boolean; focused: boolean }): boolean {
  return s.started && !s.overlay && !s.confirm && s.focused;
}
