import { Fragment } from 'react';
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

/** A string with every emoji the dungeon has a drawing for shown as that drawing. */
export function IconText({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const runs = splitIcons(text);
  if (runs.length <= 1 && !(runs[0] && 'icon' in runs[0])) return <>{text}</>;
  return <>{runs.map((r, i) => ('icon' in r ? <Icon key={i} name={r.icon} /> : <Fragment key={i}>{r.text}</Fragment>))}</>;
}
