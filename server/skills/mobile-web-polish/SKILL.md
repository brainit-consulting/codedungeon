---
name: mobile-web-polish
description: Build modern, mobile-responsive websites and webapps that feel native on Apple devices (iPhone, iPad, Mac) while staying clean on Windows desktops and other platforms. Use whenever the user is creating, polishing, or auditing a frontend that will be viewed on an iPhone, iPad, Safari, or any touch device — even if they don't say "HIG". Triggers on phrases like "make it look good on iPhone", "iOS polish", "responsive design", "fix mobile layout", "the URL bar is covering my content", "add to home screen", "notch/Dynamic Island", "tap targets", "Retina/HiDPI", "Safari", "iPad layout", or any time a site needs to work across desktop and Apple mobile. Apply proactively when reviewing or shipping any responsive web UI — undertriggering this skill leaves real iOS bugs (URL-bar overlap, notch clipping, undersized tap targets, blurry Retina canvases, gray tap flashes, hover-only affordances) on the floor.
---

# Apple HIG Compliance for Web

This skill captures the cross-device polish that makes a website feel native on Apple platforms — iPhone (portrait + landscape), iPad (any orientation), macOS Safari — while remaining clean on Windows and Android. The patterns are framework-agnostic: they work in vanilla HTML, React, Next.js, Svelte, Vue, or anything else that ultimately renders CSS and DOM.

The guidance is rooted in Apple's Human Interface Guidelines plus the practical web realities of Safari (URL chrome, safe-area insets, hover semantics on touch). It was distilled from real iOS-polish work on a production site, so the patterns have all survived contact with actual iPhones and iPads.

## When this skill applies

Invoke this skill for **any** of:

- Building a new responsive site or webapp from scratch
- Auditing an existing site for mobile/iOS bugs
- "Make it look good on my phone / iPad" requests
- Anything involving the meta viewport, safe-area insets, hero sections, full-screen layouts, sticky bottom bars, lightboxes, or canvas/WebGL
- Any UI with buttons, taps, hovers, or interactive controls — to verify HIG-minimum tap targets and touch-vs-mouse affordances
- Code review of frontend changes before merging to a branch that will be deployed

If you're not sure, invoke it. The cost of a quick check is tiny; the cost of shipping an iPhone where the URL bar eats the call-to-action is much larger.

## Mental model: design for the smallest reliable viewport, then scale up

The trap on the web is to design at desktop width and add breakpoints later. On Apple platforms specifically, that produces three classes of bug:

1. **iOS Safari URL bar** dynamically takes ~10% of the viewport height on first paint, then collapses on scroll — content sized in `100vh` jolts when this happens, and absolutely-positioned bottom hints get pushed below the fold.
2. **Notch / Dynamic Island / Home indicator** intrude into the visible area in landscape and on the bottom edge — content edged at `padding: 2rem` clips behind them.
3. **Touch is not a mouse** — `:hover` states never fire on touch, `cursor: pointer` is invisible, and a 36×36 px button is hard to hit accurately. iOS adds a gray flash to every tap unless you opt out.

This skill addresses each class explicitly. Apply the patterns even when the user hasn't reported the bug — they're cheap, additive, and most users never file the bug, they just bounce.

## The eight-pattern checklist

When building or auditing, walk through these eight patterns in order. Each has a dedicated reference file with deeper detail and copy-paste-ready snippets — read the relevant one when you need more than the summary.

### 1. Viewport meta + safe-area insets

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

`viewport-fit=cover` is what unlocks `env(safe-area-inset-*)` on iOS. Without it, your layout stays within a default "safe" rectangle and you can never put visuals (a dark hero, a backdrop image) edge-to-edge. With it, you opt into edge-to-edge but you become responsible for keeping content out of the notch / Home indicator using `env()`.

```css
#hero {
  padding:
    10vh
    max(2rem, env(safe-area-inset-right))
    2rem
    max(2rem, env(safe-area-inset-left));
}
```

Use `max()` so the design's normal padding still applies on devices that have no inset (Mac, Windows, Android), and the inset takes over only when it's larger.

See `references/viewport-and-safe-areas.md` for the full pattern including bottom-edge handling and PWA manifest considerations.

### 2. Use `dvh`, not `vh`, for full-screen sections

```css
#hero {
  height: 100vh;        /* fallback for old browsers */
  height: 100dvh;       /* dynamic viewport height — accounts for iOS URL bar */
}
```

`dvh` (dynamic viewport height) updates as the iOS Safari URL bar collapses, instead of locking to the largest possible viewport like `vh`. Always declare both in this order so older browsers get the `vh` fallback.

Apply this to **every** section sized by viewport: hero, slideshow, full-screen lightbox, modal overlays. Use `dvh` for inner heights too (e.g., `height: 65dvh` for a hero image inside the section).

When a section needs an item pinned to the bottom (a "scroll" hint, navigation arrows), prefer `display: flex; flex-direction: column;` with `margin-top: auto` on the bottom item over absolute positioning. Absolute positioning collides with multi-line text on small screens; flex pushes it down only as far as content allows.

### 3. 44×44 px minimum tap targets

Apple HIG specifies a minimum hit area of **44×44 points** for any interactive element. This is the single most-violated rule on the web — designers shrink icons to 28-32 px and hope users have steady hands. They don't.

```css
.icon-button {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;        /* lets you keep visual padding small */
  align-items: center;
  justify-content: center;
  padding: 0.4rem 1rem;        /* visual padding stays whatever you want */
}
```

The trick is `inline-flex` + `min-height/min-width: 44px` — the visible chrome of the button stays small, but the hit area grows to meet the HIG minimum without changing layout. Apply to every `<button>`, `<a>` that acts as a button, slideshow arrows, close icons, audio toggles, anything tappable.

See `references/touch-targets.md` for tap-target patterns including pseudo-element hit-area extension when you really cannot afford the visual size.

### 4. Touch vs hover: detect with `(hover: none) and (pointer: coarse)`

`:hover` never fires on touch devices, so any affordance only revealed on hover is invisible to phone/tablet users. Don't rely on user-agent sniffing — query the input device:

```css
@media (hover: none) and (pointer: coarse) {
  /* Touch devices: persistent affordance instead of hover-reveal */
  .zoom-badge { opacity: 0.55; }

  /* Optional: a one-time pulse when an element first becomes active,
     so the affordance is discoverable but not nagging */
  .slide.active .zoom-badge { animation: badgePulse 2.4s ease-out 1; }
}
```

This media query is true on every iPhone and iPad (including iPad Pro in desktop-class mode where the viewport is wide), and false on Mac and Windows desktops with a real cursor. Use it whenever you have:

- A "click to zoom" / "click to expand" affordance that was hover-only
- A tooltip-style label that appears on hover
- A custom cursor (`cursor: zoom-in` etc.) — invisible on touch, so back it up with a visible badge

Pair it with `-webkit-tap-highlight-color: transparent` on `html` to suppress the gray flash that iOS adds to every tap. The flash is almost always uglier than your intended `:active` style.

```css
html { -webkit-tap-highlight-color: transparent; }
```

See `references/touch-vs-pointer.md` for the full discussion including how to handle iPad in "Request Desktop Site" mode.

### 5. Retina-aware canvas / WebGL

Canvas elements that use `canvas.width = window.innerWidth` render at 1× pixel density and look soft on every Retina iPhone, every Retina Mac, and every recent iPad. Scale the internal buffer by devicePixelRatio (capped at 2 — beyond that, the cost is huge for negligible visible gain):

```js
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  // CSS size stays in CSS pixels
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  // Backing-store size scales for Retina
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  // Scale the drawing context so your code keeps using CSS-pixel coords
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
```

The cap at 2 matters: iPhones report dpr 3, but the human eye stops resolving the difference between 2× and 3× at typical viewing distance. Drawing 9× the pixels for an imperceptible improvement is a battery and FPS regression.

Also respect `prefers-reduced-motion` — Apple users with the OS-level setting enabled expect motion to actually reduce:

```js
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// ... use reducedMotion to skip rAF loops, set velocities to 0, etc.
```

See `references/retina-and-canvas.md` for resize listeners, image-rendering choices, and the `image-set()` CSS pattern for raster art.

### 6. Responsive breakpoints calibrated for Apple devices

A naive breakpoint set (`768px`, `1024px`) misses several real Apple viewports. Use these instead, layered from broadest to most specific:

```css
/* Tablet + any touch device — covers iPad Pro 12.9" landscape (1366 × 1024).
   The (hover: none) clause catches devices that are width-wise desktop-class
   but still touch-only. */
@media (max-width: 1200px), (hover: none) and (pointer: coarse) { /* … */ }

/* Phone-class viewport, any orientation */
@media (max-width: 900px) { /* … */ }

/* Phone in landscape — short viewport, NOT narrow.
   This is the trickiest case: an iPhone in landscape is wide (~844 px on iPhone 14)
   but ~390 px tall, so width-based queries miss it. Query height + orientation. */
@media (max-height: 500px) and (orientation: landscape) { /* … */ }

/* Small phone */
@media (max-width: 480px) { /* … */ }
```

Critical insights:

- **iPad Pro 12.9" landscape is 1366 × 1024.** A `max-width: 1024px` query misses it. Combine with `(hover: none) and (pointer: coarse)` to catch it.
- **Phone landscape is `max-height: 500px and orientation: landscape`.** Don't try to handle it with width-only queries.
- On phone landscape, you may need to *force* a row layout (e.g., `flex-direction: row !important;`) to override the column layout from the broader tablet-stack rule, because vertical space is the constraint, not horizontal.
- On touch-or-narrow viewports, switch image `object-fit` from `cover` to `contain` so important visual content isn't cropped on small screens: `@media (max-width: 1024px), (hover: none) and (pointer: coarse) { img.feature { object-fit: contain; } }`.

See `references/responsive-breakpoints.md` for a tested breakpoint set with notes on the exact viewport sizes for current iPhone, iPad, and MacBook screens.

### 7. Typography that scales without breaking

Use `clamp()` for fluid type that doesn't require breakpoints:

```css
.hero-title { font-size: clamp(2.6rem, 13vw, 5rem); }
.hero-sub   { font-size: clamp(0.85rem, 1.4vw, 1rem); }
```

But know the catch: a high `letter-spacing` (e.g., `0.4em` for a stylized hero) can push a single-word link past the edge of its container at iOS text-scaling settings. On phone-class viewports, drop letter-spacing first, then font-size:

```css
@media (max-width: 900px) {
  .footer-card .footer-link {
    font-size: 0.78rem;
    letter-spacing: 0.18em;   /* down from 0.4em */
  }
}
```

iOS users who have enabled "larger text" in Accessibility get content scaled up beyond your design — give yourself headroom by using `max-width: <Nch>` (character-based widths) so wrapping is graceful.

### 8. Text and UI contrast meets WCAG AA

Color contrast is accessibility compliance, not aesthetic preference — it belongs in this checklist even though color *theory* doesn't (see "What this skill does NOT cover" below).

- Small normal text meets 4.5:1 contrast.
- Large text (18pt+/14pt+ bold) meets 3:1 contrast.
- Non-text controls and focus indicators meet 3:1 against adjacent colors.
- Placeholder text is not the only label and remains legible on its own.
- Muted/secondary text tokens are tested on every background they actually appear against — a token that passes on white can fail on a card or hover state.
- Information does not depend on color alone (a red border also needs an icon or text).

Run the bundled checker rather than eyeballing hex values:

```bash
node scripts/contrast-check.mjs "#736C7F" "#F7F3EA"
```

It prints the exact ratio and whether it clears the 4.5:1 / 3:1 AA thresholds, and exits non-zero on failure — safe to drop into a CI check.

## Workflow when applying this skill

1. **Read the patterns above.** Don't dive into code immediately — confirm which of the eight patterns are missing from the current state.
2. **Group the changes by the eight sections.** Tell the user what you're going to change and why, in HIG terms — they'll catch any place you've over- or under-applied.
3. **Apply the changes top-down** in this order: viewport meta → CSS resets (`-webkit-tap-highlight-color`, `dvh`/`safe-area`) → tap targets → media queries → JS (canvas dpr, reduced-motion). Earlier changes are foundational — applying them last forces re-edits.
4. **Verify in real viewports.** If the user has Playwright MCP available (`mcp__playwright__*` tools), use the responsive harness to check the layout at iPhone SE portrait (375×667), iPhone 14 portrait (390×844), iPhone 14 landscape (844×390), iPad portrait (810×1080), iPad Pro 12.9" landscape (1366×1024), and a desktop width. Real device viewports beat eyeballing media queries.
5. **For interactive features, manually click/tap test** every button at a touch viewport size to confirm tap targets — visually a button might still look the same after applying `min-height: 44px`, but the hit area has grown.

## What this skill does NOT cover

- **Native iOS development** (Swift / SwiftUI) — this is web-only.
- **Detailed animation polish, color theory, or visual design** — the focus here is technical compliance, not aesthetic. For visual quality, pair this with the `frontend-design` skill.
- **App Store distribution / TWA-style wrappers.** If the user wants their site distributed as an iOS app, that's a separate path (Capacitor, Cordova, native shell).
- **Server / framework-level concerns** like service workers, web manifest icons for "Add to Home Screen" — these matter for HIG compliance of installed PWAs but are out of scope here. (If asked, point to the `nextjs` skill or the user's framework docs.)

## Reference files

Read these when the summary in this file isn't enough:

- `references/viewport-and-safe-areas.md` — viewport meta, `env()` insets, PWA notch/home-indicator handling, status bar styling
- `references/touch-targets.md` — 44 px minimum, hit-area extension via pseudo-elements, when to use `display: inline-flex`, accessibility implications
- `references/touch-vs-pointer.md` — `(hover:none) and (pointer:coarse)`, iPadOS desktop mode, suppressing tap highlight, replacing hover-only affordances with persistent ones
- `references/retina-and-canvas.md` — devicePixelRatio scaling, capping at 2×, image-rendering, `image-set()`, `prefers-reduced-motion`
- `references/responsive-breakpoints.md` — tested breakpoint set with current iPhone/iPad/MacBook viewport sizes, why width-only fails for phone landscape, when to use `!important` to override stacking rules
