// The start screen's turning gear: an ancient bronze wheel (triangular teeth, four spoke windows), drawn on the same
// 64-unit grid as the woodcut icons.

const C = 32;
const at = (r: number, a: number) => `${(C + r * Math.cos(a)).toFixed(2)} ${(C + r * Math.sin(a)).toFixed(2)}`;

/** The toothed rim: per tooth a short flat at the root, then a triangular tooth up to the tip circle. */
export function gearOutline(teeth: number, tip: number, root: number): string {
  const step = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    pts.push(at(root, a), at(root, a + step * 0.2), at(tip, a + step * 0.6));
  }
  return `M${pts.join('L')}Z`;
}

/** The windows between the spokes, as ring sectors to cut out of the wheel (even-odd fill). */
export function gearWindows(count: number, inner: number, outer: number, spoke: number): string {
  const step = (Math.PI * 2) / count;
  let d = '';
  for (let i = 0; i < count; i++) {
    const a0 = i * step + spoke / 2 - Math.PI / 4;
    const a1 = (i + 1) * step - spoke / 2 - Math.PI / 4;
    d += `M${at(inner, a0)}L${at(outer, a0)}A${outer} ${outer} 0 0 1 ${at(outer, a1)}L${at(inner, a1)}A${inner} ${inner} 0 0 0 ${at(inner, a0)}Z`;
  }
  return d;
}
