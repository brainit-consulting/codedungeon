# Responsive breakpoints for Apple devices (and the rest)

## Current device viewport sizes (CSS px)

These are the sizes you actually see in practice. Treat them as targets, not breakpoints — design fluidly between them.

### iPhones

| Device                  | Portrait      | Landscape     |
|-------------------------|--------------:|--------------:|
| iPhone SE (3rd gen)     | 375 × 667     | 667 × 375     |
| iPhone 12/13/14/15      | 390 × 844     | 844 × 390     |
| iPhone 14/15 Plus       | 428 × 926     | 926 × 428     |
| iPhone 14/15 Pro        | 393 × 852     | 852 × 393     |
| iPhone 14/15 Pro Max    | 430 × 932     | 932 × 430     |

Notable: the **landscape height of every iPhone is < 500 CSS px**. This is the foundation of the `@media (max-height: 500px) and (orientation: landscape)` rule.

### iPads

| Device                       | Portrait        | Landscape       |
|------------------------------|----------------:|----------------:|
| iPad mini (6th gen)          | 744 × 1133      | 1133 × 744      |
| iPad (10th gen)              | 810 × 1080      | 1080 × 810      |
| iPad Air (11")               | 820 × 1180      | 1180 × 820      |
| iPad Pro 11"                 | 834 × 1194      | 1194 × 834      |
| iPad Pro 12.9" / 13"         | 1024 × 1366     | 1366 × 1024     |

Notable: **iPad Pro 12.9" landscape is 1366 × 1024.** A `max-width: 1024px` query *misses it*. This is why we combine width with `(hover: none) and (pointer: coarse)`.

### MacBooks (relevant for "the desktop case")

| Device              | Default scaled size  |
|---------------------|---------------------:|
| MacBook Air 13"     | 1280 × 832          |
| MacBook Air 15"     | 1440 × 900          |
| MacBook Pro 14"     | 1512 × 982          |
| MacBook Pro 16"     | 1728 × 1117         |

Mac viewports are wide and have `(hover: hover) and (pointer: fine)` — they get the desktop layout regardless of media-query width fallthrough.

## The recommended breakpoint set

Layered from broadest to most specific. Each layer adds overrides to the previous.

```css
/* DEFAULT: desktop / wide layout
   Applies on Macs, Windows desktops, large Android tablets in landscape,
   and any device with width > 1200 px and a fine pointer. */

/* LAYER 1 — Tablet + any touch device */
@media (max-width: 1200px),
       (hover: none) and (pointer: coarse) {
  /*
   * Catches:
   *  - All iPads in any orientation (Pro 12.9" landscape included)
   *  - Phones (will be further overridden below)
   *  - Touch laptops below 1200px
   *
   * Typical changes here:
   *  - Multi-column desktop layout collapses to stacked column
   *  - Image fit changes from cover to contain
   *  - Large-screen-only flourishes hidden
   */
}

/* LAYER 2 — Phone-class viewport */
@media (max-width: 900px) {
  /*
   * Catches phones in portrait, narrow tablets, very narrow desktop windows.
   * Typical changes:
   *  - Hero typography scales down
   *  - Letter-spacing reduces (was generous on desktop)
   *  - Side-by-side controls go full-width
   *  - Padding reduces from rem-scale to tighter values
   */
}

/* LAYER 3 — Phone landscape (short viewport) */
@media (max-height: 500px) and (orientation: landscape) {
  /*
   * The hardest case. The viewport is wide (~750-930 px on iPhones) but
   * shorter than 500 px tall. A width-only query misses it entirely.
   *
   * Typical changes:
   *  - Force a row layout to use horizontal space efficiently
   *    (often needs !important to override LAYER 1's column flip)
   *  - Tighter vertical padding
   *  - Smaller hero type (use vh-based clamp())
   *  - Slide arrows / nav bottom-aligned but compact
   *
   * Why max-height: 500px and not 450px? An iPhone 14 Plus landscape is
   * 428 px tall — well under 500. iPhone 14 Pro Max is 430 px. The 500 px
   * ceiling catches all current iPhones plus older iPads with a large URL bar.
   */
}

/* LAYER 4 — Small phone */
@media (max-width: 480px) {
  /*
   * iPhone SE, very compact phones. Typically only the most cramped layouts
   * need a fourth layer — usually footers and forms get final size cuts.
   */
}
```

## When you need `!important`

Stacking media queries with `(hover: none)` clauses can produce ordering surprises. Specifically: LAYER 1 says "touch device → flex-direction: column", but LAYER 3 says "phone landscape → flex-direction: row" because vertical space is the constraint. LAYER 3 is more specific, but **CSS specificity ignores media-query specificity** — both rules have equal selector specificity, so the source order wins.

If LAYER 1 comes *before* LAYER 3 in source order, LAYER 3 wins by being later. But if you ever refactor and LAYER 1 ends up after, LAYER 3 silently breaks. Defensive `!important` makes the intent explicit:

```css
@media (max-height: 500px) and (orientation: landscape) {
  .slide {
    flex-direction: row !important;   /* explicitly override LAYER 1's column */
  }
}
```

`!important` is normally a code smell, but when overriding cascaded media-query rules with the same selector specificity, it's the right tool. Comment it so a future maintainer doesn't try to "clean it up".

## Image fit on touch / narrow

```css
@media (max-width: 1024px), (hover: none) and (pointer: coarse) {
  .feature-image { object-fit: contain; }
}
```

`object-fit: cover` crops to fill — great for desktop hero shots where you can guarantee the aspect ratio. Bad for narrow viewports where the crop hides important content. Switch to `contain` (with a matte background for letterboxing) on small/touch screens.

## Don't disable horizontal scroll on `body`

A common impulse for fixing mobile layout bugs is `body { overflow-x: hidden }`. This *hides* the symptom but doesn't fix the underlying cause — usually an element overflowing its container by a few pixels. The right fix is to find the overflowing element and constrain it.

If you must use `overflow-x: hidden`, set it on `html` rather than `body` for better Safari behavior, and only as a last resort:

```css
html { overflow-x: hidden; }
```

## Typography at the breakpoints

Letter-spacing tightens at smaller sizes. A heading with `letter-spacing: 0.4em` looks elegant on desktop but punches text out of containers on phones. Decrease both font-size and letter-spacing per breakpoint:

```css
.hero-title {
  font-size: 96px;
  letter-spacing: 0.25em;
}

@media (max-width: 900px) {
  .hero-title {
    font-size: clamp(2.6rem, 13vw, 5rem);
    letter-spacing: 0.18em;
  }
}

@media (max-height: 500px) and (orientation: landscape) {
  .hero-title {
    font-size: clamp(1.8rem, 9vh, 3rem);  /* vh-based, since height is the constraint */
    letter-spacing: 0.15em;
  }
}
```

`clamp()` lets a single rule cover a wide range — `clamp(min, preferred, max)` returns the preferred value clamped to the min/max bounds. The `vw` / `vh` middle value makes type fluid between breakpoints.

## Verifying

If Playwright MCP is available:

```
mcp__playwright__browser_resize → 375 × 667   (iPhone SE portrait)
mcp__playwright__browser_resize → 390 × 844   (iPhone 14 portrait)
mcp__playwright__browser_resize → 844 × 390   (iPhone 14 landscape)
mcp__playwright__browser_resize → 810 × 1080  (iPad portrait)
mcp__playwright__browser_resize → 1366 × 1024 (iPad Pro 12.9" landscape)
mcp__playwright__browser_resize → 1280 × 832  (MacBook Air 13")
mcp__playwright__browser_resize → 1920 × 1080 (Windows desktop / external monitor)
```

Take a screenshot at each. Real device shapes catch what a generic "mobile / tablet / desktop" check misses — especially the iPad Pro 12.9" landscape and iPhone-in-landscape cases.
