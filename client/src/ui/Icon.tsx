import { Fragment } from 'react';
import { gearOutline, gearWindows } from './bronzeGear';
import { iconBody, splitIcons, type IconName } from './icons';

// The woodcut icons in the page: ink takes the text colour around them, so they sit in any panel; paper and rust are
// the panels' own colours (styles.css --paper, --accent).
const UI = { ink: 'currentColor', paper: '#ecdfc2', rust: '#a0441c' };

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <svg
      className="ico"
      viewBox="0 0 64 64"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: iconBody(name, UI) }}
    />
  );
}

const BRONZE = '#a8743a';
const GEAR = `${gearOutline(28, 30, 26.6)}${gearWindows(4, 9.5, 21, 0.42)}`;
const arc = (r: number, from: number, to: number) => {
  const p = (a: number) => `${(32 + r * Math.cos((a * Math.PI) / 180)).toFixed(2)} ${(32 + r * Math.sin((a * Math.PI) / 180)).toFixed(2)}`;
  return `M${p(from)}A${r} ${r} 0 0 1 ${p(to)}`;
};

/** The start screen's ancient bronze gear (it turns by the .start-logo animation). */
export function BronzeGear() {
  return (
    <svg className="bronze-gear" viewBox="0 0 64 64" aria-hidden="true">
      <path d={GEAR} fill={BRONZE} fillRule="evenodd" stroke="#2a1d14" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="32" cy="32" r="23.6" fill="none" stroke="#6e4520" strokeWidth="0.9" strokeDasharray="1.2 1.6" />
      <path d={arc(25, 200, 262)} fill="none" stroke="#e0b26a" strokeWidth="1.4" strokeLinecap="round" />
      <path d={arc(25, 20, 82)} fill="none" stroke="#5a3818" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="8" fill="#8a5a2b" stroke="#2a1d14" strokeWidth="1.4" />
      <path d={arc(5.6, 200, 260)} fill="none" stroke="#e0b26a" strokeWidth="1" strokeLinecap="round" />
      <rect x="29.4" y="29.4" width="5.2" height="5.2" fill="#2a1d14" transform="rotate(45 32 32)" />
    </svg>
  );
}

/** A string with every emoji the dungeon has a drawing for shown as that drawing. */
export function IconText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const runs = splitIcons(text);
  if (runs.length <= 1 && !(runs[0] && 'icon' in runs[0])) return <>{text}</>;
  return <>{runs.map((r, i) => ('icon' in r ? <Icon key={i} name={r.icon} /> : <Fragment key={i}>{r.text}</Fragment>))}</>;
}
