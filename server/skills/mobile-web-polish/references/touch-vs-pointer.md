# Touch vs pointer — feature-detect, don't UA-sniff

The single most useful media query for cross-platform polish:

```css
@media (hover: none) and (pointer: coarse) { /* touch device — no precise pointer */ }
```

It's true on every iPhone, iPad in Touch mode, every Android phone/tablet. False on Mac, Windows desktop, Linux desktop, iPad with a paired Magic Keyboard + trackpad in *some* configurations (caveat below).

`(hover: hover) and (pointer: fine)` is the inverse — true on real-mouse devices.

## What changes when you're on touch

`:hover` never fires on touch devices. So any of the following are invisible / inaccessible to phone and tablet users:

- "Reveal-on-hover" tooltips, captions, controls
- Magnifier badges, "click to zoom" affordances
- Custom cursors (`cursor: zoom-in`, `cursor: grab`, etc.)
- Subtle hover-only color shifts that signal interactivity

The fix is not "remove all hover effects" — they're great on desktop and shouldn't be sacrificed. The fix is **provide a touch-equivalent affordance** scoped to the touch media query.

## Pattern: persistent affordance with a one-time pulse

Hover-only zoom badge (desktop):

```css
.zoom-badge {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.82);
  transition: opacity 0.45s ease, transform 0.45s ease;
}
.image:hover .zoom-badge {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
```

Touch device — keep the badge visible at low opacity, and pulse it once when the element first becomes active so it's discoverable but not constantly demanding attention:

```css
@media (hover: none) and (pointer: coarse) {
  .zoom-badge {
    opacity: 0.55;
    transform: translate(-50%, -50%) scale(1);
  }
  .slide.active .zoom-badge {
    animation: badgePulse 2.4s ease-out 1;
  }
}

@keyframes badgePulse {
  0%   { opacity: 0.85; transform: translate(-50%, -50%) scale(1.12); }
  55%  { opacity: 0.85; transform: translate(-50%, -50%) scale(1.12); }
  100% { opacity: 0.55; transform: translate(-50%, -50%) scale(1); }
}
```

The 0.55 opacity is the key — it's faded enough to feel like a hint, prominent enough to discover. A constant 1.0 opacity reads as a permanent demand on the user's attention.

## Pattern: replace hover affordances on touch

```css
@media (hover: none) and (pointer: coarse) {
  /* Don't crop important content on small touch screens */
  .slide-image { object-fit: contain; }

  /* If a hover state was the only signal of interactivity, add an explicit visual cue */
  .card { border: 1px solid var(--accent); }
}
```

## Suppress the gray iOS tap flash

By default, iOS Safari adds a translucent gray flash to every tappable element on tap. It's almost always uglier than your designed `:active` style. Disable globally:

```css
html { -webkit-tap-highlight-color: transparent; }
```

If you remove the flash, **make sure you have a clear `:active` style**, or the user gets no feedback that their tap registered. On a button:

```css
button:active {
  transform: scale(0.97);
  opacity: 0.9;
}
```

## iPadOS desktop mode caveats

iPadOS in landscape with a Magic Keyboard + trackpad is the trickiest case for feature detection:

- The trackpad provides a "fine" pointer, so `(pointer: fine)` is true.
- The user can also touch the screen, so `(hover: hover)` is *also* true (the system reports the most precise input available).
- Some users have "Show hover effects" disabled in iPadOS Accessibility settings, in which case `(hover: hover)` becomes false even on a connected trackpad.

In practice: `(hover: none) and (pointer: coarse)` on an iPad-with-keyboard is usually false, meaning your design defaults to the desktop hover behavior. That's the right default — if they have a precise pointer, treat it as desktop. If they touch the screen instead, the hover affordance just doesn't fire — but they still have access to the underlying interactivity (the click event still fires on tap).

The corner case to handle is "iPad in Request Desktop Site mode where the viewport is wide but it's still touch-only". That's covered in `responsive-breakpoints.md` — combine `(max-width: 1200px)` *or* `(hover: none) and (pointer: coarse)` so iPad Pro 12.9" landscape (1366 × 1024) gets the touch-tuned layout despite being width-wise larger than typical tablet breakpoints.

## Tap-event timing on iOS

Older iOS versions had a 300 ms delay between tap and click event firing (waiting for a possible double-tap zoom). With `width=device-width` set in the viewport meta, this delay is automatically removed on modern iOS — one of the unsung benefits of the standard viewport tag. If you ever see a "feels laggy on iOS" complaint, double-check the viewport meta is set correctly.

## Don't disable double-tap zoom

Some sites set `user-scalable=no` or `maximum-scale=1.0` to prevent zooming. **Don't.** It's an accessibility violation — users with low vision rely on pinch-zoom to read your content. Modern iOS quietly ignores `user-scalable=no` anyway. If form inputs zoom-in on focus and you find that annoying, the right fix is a 16 px+ font-size on inputs (the default zoom-in trigger is `font-size < 16px` on focused text inputs).

```css
input, select, textarea {
  font-size: 16px;     /* prevents iOS focus-zoom */
}
```
