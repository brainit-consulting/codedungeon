#!/usr/bin/env node

function parseHex(value) {
  const clean = value.trim().replace(/^#/, "");
  const expanded = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Invalid hex color: ${value}`);
  }
  return [0, 2, 4].map((offset) => Number.parseInt(expanded.slice(offset, offset + 2), 16));
}

function luminance(rgb) {
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const fg = luminance(parseHex(foreground));
  const bg = luminance(parseHex(background));
  return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
}

const [foreground, background] = process.argv.slice(2);
if (!foreground || !background) {
  console.error('Usage: node contrast-check.mjs "#foreground" "#background"');
  process.exit(2);
}

try {
  const ratio = contrast(foreground, background);
  console.log(JSON.stringify({
    foreground,
    background,
    ratio: Number(ratio.toFixed(3)),
    normalTextAA: ratio >= 4.5,
    largeTextAA: ratio >= 3,
    nonTextAA: ratio >= 3,
  }, null, 2));
  process.exit(ratio >= 4.5 ? 0 : 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
