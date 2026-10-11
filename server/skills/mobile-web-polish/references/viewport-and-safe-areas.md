# Viewport meta and safe-area insets

## The viewport meta tag

Always start every HTML document with:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
```

Three components, each load-bearing:

- `width=device-width` — match the rendering viewport to the physical device width. Without this, mobile Safari renders at ~980 px CSS width and zooms out, causing tiny text.
- `initial-scale=1.0` — start at 1× zoom. Combined with the above, this is the canonical "behave normally on mobile" pair.
- `viewport-fit=cover` — extend the visual viewport into the safe-area regions (the notch row, the Home indicator strip). **Without this, `env(safe-area-inset-*)` is always 0.** With it, you get the actual inset values, which means you become responsible for keeping content out of those regions yourself.

If you only want a default safe rectangle and don't care about edge-to-edge visuals, omit `viewport-fit=cover` and your design will be auto-padded — but you can never put a hero image, dark theme, or video flush to the edges.

## env(safe-area-inset-*)

Once `viewport-fit=cover` is set, four CSS environment variables become available:

```
env(safe-area-inset-top)
env(safe-area-inset-right)
env(safe-area-inset-bottom)
env(safe-area-inset-left)
```

On a device with no safe area (Mac, Windows, most Android), all four are 0. On an iPhone with a notch in portrait, `top` is ~44 px. In landscape, `left` and `right` are ~44 px, and `bottom` is ~21 px (Home indicator).

The right pattern is `max()` — apply the design's normal padding on devices that don't need the inset, and let the inset take over only when it's larger:

```css
#hero {
  padding:
    10vh
    max(2rem, env(safe-area-inset-right))
    2rem
    max(2rem, env(safe-area-inset-left));
}
```

Why `max()` and not just `env()`? Because the design's normal padding might be 2rem (32 px), and the iPhone landscape inset is 44 px. If you write `padding-right: env(safe-area-inset-right)`, you get 0 padding on every device that doesn't have a notch, and your text crashes into the right edge on Mac/Windows/Android. `max()` guarantees a sensible minimum.

For a sticky bottom bar:

```css
.bottom-bar {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
  /* If you have a fixed-height bar, add the inset to the height instead:
     height: calc(4rem + env(safe-area-inset-bottom)); */
}
```

For top-anchored content next to the status bar (less common — usually the URL bar handles it):

```css
.app-bar {
  padding-top: max(1rem, env(safe-area-inset-top));
}
```

## Status bar appearance for installed PWAs

If the site is also installed to the iOS home screen as a PWA, the status bar is visible above your content. Control its appearance with:

```html
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

Values for `apple-mobile-web-app-status-bar-style`:

- `default` — opaque white, normal status bar
- `black` — opaque black status bar
- `black-translucent` — transparent; **your content appears under the status bar**, so combine this with `padding-top: env(safe-area-inset-top)` on your top container

`black-translucent` is the right choice for dark, edge-to-edge designs — it lets your hero gradient show through behind the time/battery icons. Without the safe-area padding, the time/battery overlap your title.

## Common gotchas

- **`100vw` causes horizontal scroll on iOS** when there's a vertical scrollbar elsewhere because Safari includes the scrollbar in `100vw`. Prefer `width: 100%` on the document root and never use `100vw` for full-bleed widths. If you must, pair with `overflow-x: hidden` on `body`.
- **`safe-area-inset-bottom` is 0 in portrait on iPhones without a Home indicator** (older devices, iPads with home button). Don't assume it's always > 0 just because you're on iOS.
- **Embedded webviews (in-app browsers like Twitter/Slack/Instagram)** sometimes don't update the safe-area values correctly when the URL bar collapses. There's no clean fix; the `dvh` pattern from the main SKILL.md is the closest workaround.
- **Standalone PWA mode hides the URL bar permanently**, so `dvh` and `vh` are equivalent. But the status bar inset still applies if `black-translucent`.

## Verifying

To verify safe-area handling, the easiest path is the iOS Simulator on macOS (Xcode → Simulator → choose iPhone 14 Pro / 15 Pro). On Windows, use the Playwright MCP server with a custom viewport that matches a notched iPhone (390 × 844 with a CSS-based notch overlay), or get a friend with an iPhone 14+ to screenshot the page.

Visually inspect:
- Portrait: top of hero shouldn't touch the notch / Dynamic Island
- Landscape: left/right edges shouldn't be eaten by the notch (especially text and tap targets)
- Bottom of any sticky bar / button: shouldn't be under the Home indicator
