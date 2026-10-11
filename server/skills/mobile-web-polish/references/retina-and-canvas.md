# Retina-aware canvas and HiDPI rendering

## Why naive canvas is blurry on Apple devices

A `<canvas>` has two distinct sizes:

- **CSS size** — what `style.width`/`height` (or layout-driven sizing) tell the browser. Affects layout.
- **Backing-store size** — what `canvas.width`/`canvas.height` set. Determines actual pixel resolution.

If the two are equal (e.g., both 800 × 600), the canvas renders at 1× pixel density. On an iPhone with `devicePixelRatio = 3`, the browser then upscales the 800 × 600 backing store to fill the 2400 × 1800 physical pixels of the CSS box. Result: visibly soft.

The fix: keep the CSS size as designed, but make the backing store larger by `devicePixelRatio`, then scale the drawing context so your code can keep using CSS-pixel coordinates.

## The pattern

```js
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  // CSS size stays in CSS pixels — what the user sees, what flexbox respects
  canvas.style.width  = w + 'px';
  canvas.style.height = h + 'px';

  // Backing store grows to match physical pixel density
  canvas.width  = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);

  // Reset the transform so 1 unit in your drawing code = 1 CSS pixel
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resize();
window.addEventListener('resize', resize);
```

After this, `ctx.fillRect(0, 0, 100, 100)` draws a square that's 100 CSS px wide on screen, but uses 100 × dpr backing-store pixels — sharp at any density.

## Why cap dpr at 2

`Math.min(window.devicePixelRatio || 1, 2)` is intentional. iPhones report dpr 3 (sometimes higher on Pro models). Drawing at 3× means **9× the pixels** of 1×, and beyond 2× the human eye stops resolving improvements at typical phone-viewing distance.

The cost is real:

- 9× pixel-fill is slower
- 9× memory for the backing store
- Battery drain during animation loops scales linearly with pixel work
- WebGL frag-shader cost scales with pixel count

For most artistic / decorative canvases, dpr 2 is the sweet spot. For scientific visualization or fine line art, you might justify dpr 3 — measure first.

## When the canvas resizes

The pattern above re-runs `resize()` on `window.resize`. But `setTransform` resets to dpr-scaled, while any `setTransform` calls inside your draw loop will overwrite this. Two options:

1. **Re-apply after every draw.** Call `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` at the start of each frame.
2. **Use `ctx.save()` / `ctx.restore()`** around any local transforms inside your draw loop, so the dpr-scaled identity transform persists.

Pattern 2 is cleaner if your drawing is complex. Pattern 1 is simpler if you only have a few transforms.

## Image rendering — when to choose pixelated vs smooth

For raster graphics (game sprites, pixel art), browsers default to bilinear smoothing, which makes pixel art blurry on Retina:

```css
.pixel-art {
  image-rendering: pixelated;       /* Chromium */
  image-rendering: crisp-edges;     /* Firefox / Safari */
}
```

For photographs and most UI raster, leave the default smoothing on — it's correct.

For canvas, the equivalent context flag is:

```js
ctx.imageSmoothingEnabled = false;  // sharp pixel scaling
ctx.imageSmoothingQuality = 'high'; // smoothing, when enabled
```

## image-set() for raster art

If you're shipping a logo or icon as a PNG/JPG, provide multiple densities and let the browser pick:

```css
.logo {
  background-image: url('logo@1x.png');
  background-image: image-set(
    url('logo@1x.png') 1x,
    url('logo@2x.png') 2x,
    url('logo@3x.png') 3x
  );
}
```

Modern browsers (including Safari) support this. Better still, for icons and simple graphics, ship SVG — it's resolution-independent and usually smaller than 2× PNG.

## prefers-reduced-motion — respect Apple's accessibility setting

iOS has a system-level "Reduce Motion" toggle in Settings → Accessibility → Motion. Users enable it for vestibular disorders, focus issues, or just personal preference. Honor it:

```js
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reducedMotion) {
  // start the animation loop
  requestAnimationFrame(tick);
} else {
  // draw a single static frame
  drawStaticVersion();
}
```

In CSS:

```css
.scroll-line { animation: drip 2.4s ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .scroll-line { animation: none; }
  *, *::before, *::after {
    /* Belt and suspenders — kill all animations and transitions globally */
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

The global override is harsh but reliable. Apply it as a final guard after individual animation rules; it costs nothing on devices where the user hasn't enabled the setting.

Also listen for live changes — the user might toggle the setting while your tab is open:

```js
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
mq.addEventListener('change', (e) => {
  if (e.matches) stopAnimations();
  else startAnimations();
});
```

## Verifying

- **Visually check on a Retina display.** Open DevTools, simulate iPhone 14, take a screenshot at 1× zoom. If the canvas looks soft, dpr scaling is missing.
- **Toggle Reduce Motion.** macOS: System Settings → Accessibility → Display → Reduce motion. Refresh the page; animations should stop or simplify.
- **Profile a frame.** DevTools → Performance → record 5s of animation. If `Composite Layers` time scales with the canvas, dpr is working; if `Paint` is dominated by image-rescaling time, the browser is upscaling a too-small backing store.
