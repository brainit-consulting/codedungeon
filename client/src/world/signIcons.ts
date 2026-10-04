// The woodcut icons as images for the 3D signs' canvases: the same drawings as the page's (ui/icons.ts), made once per
// colour. preloadSignIcons() decodes the ones the signs use before the dungeon first draws, so a sign never paints
// without them (signs only repaint when their text changes).

import { ICONS, iconSvg, type IconName } from '../ui/icons';

const RUST = '#a0441c';
/** The colour pairs the signs draw icons in: ink and paper on parchment, and light on a dark slate. */
export const SIGN_INKS = {
  parchment: { ink: '#2a1d14', paper: '#d8c7a0' },
  faded: { ink: '#5a4632', paper: '#d8c7a0' },
  slate: { ink: '#ecdfc2', paper: '#221e1b' },
} as const;

const cache = new Map<string, HTMLImageElement>();

function image(name: IconName, ink: string, paper: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  const key = `${name}|${ink}|${paper}`;
  let img = cache.get(key);
  if (!img) {
    img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(name, { ink, paper, rust: RUST }))}`;
    cache.set(key, img);
  }
  return img;
}

/** An icon ready to draw, or null while it's still loading. */
export function signIcon(name: IconName, ink: string, paper: string): HTMLImageElement | null {
  const img = image(name, ink, paper);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/** Load every icon in the signs' colours (a few milliseconds: they're inline SVG). Never rejects. */
export async function preloadSignIcons(): Promise<void> {
  const all: Promise<unknown>[] = [];
  for (const { ink, paper } of Object.values(SIGN_INKS)) {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const img = image(name, ink, paper);
      if (img) all.push(img.decode().catch(() => undefined));
    }
  }
  await Promise.all(all);
}
