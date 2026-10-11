# Tap targets — Apple HIG 44 × 44 minimum

## The rule

Apple HIG specifies a minimum tap target of **44 × 44 points** (≈ 44 × 44 CSS px on the web). Anything smaller is hard to hit accurately, especially with thumbs in landscape, and the failure mode is silent — users miss the tap, don't get feedback, and assume your site is broken.

This applies to **every interactive element**: buttons, links styled as buttons, slideshow arrows, audio toggles, close icons (X), form-control increments, swatches, dots in a slider/carousel.

## The standard pattern

Best version, when you control both visual chrome and HTML:

```css
.icon-button {
  min-height: 44px;
  min-width: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 1rem;       /* visual padding can be whatever you want */
}
```

Why this works:

- `min-height` / `min-width: 44px` enforces the floor — any smaller intrinsic content gets padded out to 44 px.
- `display: inline-flex` + center alignment keeps the visual content (icon, text) centered when the box grows.
- The visible padding (`padding: 0.4rem 1rem` here) controls how the button *looks*. Users see a small button; their thumb gets a 44 × 44 hit area.

This is preferred over making the button visually 44 × 44 — that often breaks the design's rhythm and makes UI feel chunky/childish on desktop.

## When you can't change the visual size — extend hit area with a pseudo-element

For a tiny dot in a paginator (5 × 5 px is normal — making it 44 × 44 destroys the design):

```css
.slide-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--bone-faint);
  cursor: pointer;
  position: relative;          /* needed for the pseudo-element */
}

/* Invisible 44 × 44 hit-area extension */
.slide-dot::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  /* No background — purely a hit area */
}
```

The dot stays visually 5 × 5; thumbs can hit a 44 × 44 invisible box centered on it. Watch for two side effects:

1. **Adjacent dots overlap their hit areas.** If dots are spaced 8 px apart and each has a 44 × 44 hit box, the hit boxes overlap by 36 px. Users mid-tap can't tell which dot will fire. Either accept this (small target, the user can recover by tapping more deliberately), space the dots farther apart, or shrink the hit-area extension to `gap_between_dots + dot_size`.
2. **Hover/active styles on the parent feel weird.** The pseudo-element has `pointer-events` enabled by default, so hover state is triggered when the cursor is anywhere in the 44 × 44 zone, not just over the dot. Usually fine, but if it looks off, set `pointer-events: none` on the visual element and `pointer-events: auto` on the pseudo (or the inverse — whichever fits).

## Spacing between targets

HIG also recommends keeping at least ~8 px (8 pt) of space between adjacent tap targets so users don't accidentally hit the wrong one. For a row of icons:

```css
.action-row {
  display: flex;
  gap: 0.6rem;          /* ~10 px — meets the 8 px minimum */
}
```

## Apple-style controls — buttons, segmented controls, links

For buttons that *look* like normal text buttons (`<button>` or `<a>` styled with text-only):

```css
button.text-link {
  min-height: 44px;     /* don't apply min-width: 44px to text — it'd pad short labels weirdly */
  display: inline-flex;
  align-items: center;
  padding: 0 0.6rem;
}
```

For "Cancel" / "Done" type single-word actions that need the 44 × 44 hit area without looking chunky, this is the right answer.

For segmented controls (horizontal pill row):

```css
.segment {
  min-height: 44px;
  padding: 0 1.2rem;
  /* min-width is implicit from the longest label being padded out */
}
```

## Anchor tags as buttons

If you have `<a class="cta">` styled as a button, you must also handle:

- `display` is `inline` by default, so `min-height` / `min-width` are ignored. Set `display: inline-flex` (or `inline-block` if you don't need flex centering).
- `text-decoration: none` to remove the underline.
- A fallback `:focus-visible` outline for keyboard users — *don't* remove all focus styles for the sake of design. iOS users with external keyboards or VoiceOver depend on them.

```css
a.cta {
  display: inline-flex;
  min-height: 44px;
  min-width: 44px;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.2rem;
  text-decoration: none;
}
a.cta:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
```

## What 44 px means at non-standard zoom

iOS users can enable text scaling in Accessibility settings, which scales the rem unit. If your button is `min-height: 44px`, that's an *absolute* 44 CSS pixels regardless of text scaling. If you wrote `min-height: 2.75rem` (44 ÷ 16), it scales with the user's preference, which is *better* for users who scaled up — they get even larger targets. Both are HIG-compliant; `rem` is more accessible. Use `rem` if your codebase uses it consistently for sizing.

## Verifying

Two ways:

1. **Manual test.** Reduce browser zoom to 100%, switch to a touch viewport in DevTools, and try tapping every interactive element with your fingertip on the screen. If you mis-tap, the target is too small or too close to a neighbor.
2. **Programmatic check.** A simple ruler / outline overlay can highlight every element with `getBoundingClientRect().height < 44 || .width < 44`. Useful in CI as a Playwright assertion if you want to enforce the rule:

```js
await page.locator('button, a[role=button], [tabindex="0"]').evaluateAll(els =>
  els.map(el => {
    const r = el.getBoundingClientRect();
    return { ok: r.width >= 44 && r.height >= 44, w: r.width, h: r.height, html: el.outerHTML.slice(0, 80) };
  })
);
// Assert all entries `ok: true`
```
