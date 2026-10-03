// The dungeon's own icons: small woodcut drawings in ink on parchment with one rust accent, standing in for emoji in
// the panels, notices and the 3D signs (never in the coders' terminals). Each is drawn once on a 64-unit grid with
// three colour slots, {ink} {paper} {rust}, filled by the page (CSS colours) or the sign (its own colours).
// Text keeps its emoji; splitIcons() says where an icon goes. An emoji with no drawing yet stays an emoji.

export type IconName = keyof typeof ICONS;

const S = (w: number) => `stroke="{ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const PAPER = `fill="{paper}"`;
const NONE = `fill="none"`;

export const ICONS = {
  castle: `<path d="M6 58H58" ${S(2.6)}/><path d="M8 58V20H11V16H14V20H16V16H19V20H22V58Z" ${PAPER} ${S(2.4)}/><path d="M42 58V20H45V16H48V20H50V16H53V20H56V58Z" ${PAPER} ${S(2.4)}/><path d="M22 58V30H25V27H28V30H31V27H34V30H37V27H40V30H42V58" ${PAPER} ${S(2.4)}/><path d="M27 58V46A5 5 0 0 1 37 46V58" fill="{ink}"/><path d="M30 47V58M34 47V58" stroke="{paper}" stroke-width="1.1"/><path d="M15 27V33M49 27V33M15 40V46M49 40V46" ${S(2.2)}/><path d="M19 50L21 54M19 44L21 48M53 50L55 54M53 44L55 48" ${S(1)}/><path d="M32 27V8" ${S(1.8)}/><path d="M32 8L45 11L32 15Z" fill="{rust}" ${S(1.2)}/>`,
  swords: `<path d="M51 9L17 45" ${S(5.5)}/><path d="M48 13L21 41" stroke="{paper}" stroke-width="1.3" stroke-linecap="round"/><path d="M13 9L47 45" ${S(5.5)}/><path d="M16 13L43 41" stroke="{paper}" stroke-width="1.3" stroke-linecap="round"/><path d="M13 40L23 50M41 50L51 40" ${S(3.6)}/><path d="M18 45L11 52M46 45L53 52" ${S(4)}/><circle cx="9.5" cy="54" r="3.4" fill="{rust}" ${S(1.3)}/><circle cx="54.5" cy="54" r="3.4" fill="{rust}" ${S(1.3)}/>`,
  scroll: `<path d="M14 16H50V52H14Z" ${PAPER} ${S(2.4)}/><rect x="9" y="10" width="46" height="9" rx="4.5" ${PAPER} ${S(2.4)}/><rect x="9" y="48" width="46" height="9" rx="4.5" ${PAPER} ${S(2.4)}/><path d="M20 25H44M20 30H41M20 35H44M20 40H31" ${S(1.6)}/><path d="M45 21L48 24M45 26L48 29M45 31L48 34" ${S(0.9)}/><circle cx="40" cy="45" r="5.2" fill="{rust}" ${S(1.6)}/>`,
  candle: `<ellipse cx="32" cy="55" rx="17" ry="4.5" ${PAPER} ${S(2.4)}/><path d="M25 54V28C25 26 27 25 29 26L31 27L33 25C35 24 37 25 39 27V54Z" ${PAPER} ${S(2.4)}/><path d="M27 27V36M36 26V32" ${S(1.6)}/><path d="M35 34V52M37 30V50" ${S(0.9)}/><path d="M32 26V21" ${S(1.6)}/><path d="M32 6C38.5 13 38 19 32 21.5C26 19 25.5 13 32 6Z" fill="{rust}" ${S(1.5)}/><path d="M32 12C34.5 15 34 18 32 19C30 18 29.5 15 32 12Z" fill="{paper}"/>`,
  key: `<circle cx="17" cy="32" r="10" ${PAPER} ${S(3.4)}/><circle cx="17" cy="32" r="4" ${NONE} ${S(2)}/><path d="M27 32H56" ${S(4.2)}/><path d="M46 33V42H50V38M54 33V44" ${NONE} ${S(3.2)}/><circle cx="17" cy="32" r="1.8" fill="{rust}"/><path d="M8 40L4 48" stroke="{rust}" stroke-width="2.4" stroke-linecap="round"/>`,
  cat: `<path d="M45 54C56 55 60 46 53 40" ${NONE} ${S(3.6)}/><path d="M21 56C17 45 19 36 25 31L23 17L30 25H36L43 17L41 31C47 36 49 45 45 56Z" fill="{ink}" ${S(1.5)}/><ellipse cx="29" cy="31" rx="2.3" ry="1.4" fill="{rust}"/><ellipse cx="37" cy="31" rx="2.3" ry="1.4" fill="{rust}"/><path d="M29 41L31 44M33 40V44M37 41L35 44" stroke="{paper}" stroke-width="1" stroke-linecap="round"/>`,
  gear: `<g ${PAPER} ${S(2.2)}>${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<rect x="28" y="7" width="8" height="10" rx="1" transform="rotate(${a} 32 32)"/>`).join('')}</g><circle cx="32" cy="32" r="16" ${PAPER} ${S(2.6)}/><circle cx="32" cy="32" r="6.5" fill="{rust}" ${S(2)}/><path d="M42 25L45 28M43 33L46 35M38 41L40 44" ${S(1)}/>`,
  lens: `<path d="M37 37L54 54" ${S(7)}/><path d="M45 45L49 49" stroke="{rust}" stroke-width="3" stroke-linecap="round"/><circle cx="26" cy="26" r="15" ${PAPER} ${S(3)}/><path d="M17 22C18 18 21 16 25 15" ${NONE} ${S(1.6)}/><path d="M30 34L34 30M33 37L37 33" ${S(0.9)}/>`,
  check: `<circle cx="32" cy="32" r="22" fill="{rust}" ${S(2.4)}/><circle cx="32" cy="32" r="17" ${NONE} stroke="{paper}" stroke-width="1" stroke-dasharray="2 3"/><path d="M21 33L29 41L44 24" ${NONE} stroke="{paper}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
  tick: `<path d="M12 34L26 48L52 16" ${NONE} ${S(6)}/><path d="M16 35L26 45" stroke="{rust}" stroke-width="1.6" stroke-linecap="round"/>`,
  cross: `<path d="M14 14L50 50M50 14L14 50" ${S(9)}/><path d="M14 14L50 50M50 14L14 50" stroke="{rust}" stroke-width="4" stroke-linecap="round"/>`,
  warning: `<path d="M32 7L59 55H5Z" ${PAPER} ${S(2.8)}/><path d="M32 13L53 51H11Z" ${NONE} ${S(0.8)}/><path d="M32 24V39" stroke="{rust}" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="46.5" r="3" fill="{rust}"/>`,
  hammer: `<path d="M27 25L49 57" ${S(5.5)}/><path d="M44 50L48 56" stroke="{rust}" stroke-width="3" stroke-linecap="round"/><path d="M12 22L32 8L39 18L19 32Z" ${PAPER} ${S(2.4)}/><path d="M17 20L32 10M22 24L35 15" ${S(0.9)}/>`,
  chair: `<path d="M18 8V58M46 8V58" ${S(3.4)}/><path d="M18 14H46M18 22H46" ${S(2.4)}/><rect x="13" y="32" width="38" height="6" rx="1.5" fill="{rust}" ${S(2.2)}/><path d="M18 46H46" ${S(1.6)}/>`,
  letter: `<rect x="8" y="16" width="48" height="33" rx="2" ${PAPER} ${S(2.4)}/><path d="M8 17L32 35L56 17" ${NONE} ${S(2.2)}/><path d="M8 48L25 31M56 48L39 31" ${NONE} ${S(1)}/><circle cx="32" cy="35" r="5.5" fill="{rust}" ${S(1.6)}/>`,
  crown: `<path d="M9 46L13 18L23 32L32 12L41 32L51 18L55 46Z" ${PAPER} ${S(2.4)}/><rect x="9" y="44" width="46" height="9" rx="1.5" ${PAPER} ${S(2.4)}/><circle cx="20" cy="48.5" r="2.6" fill="{rust}"/><circle cx="32" cy="48.5" r="2.6" fill="{rust}"/><circle cx="44" cy="48.5" r="2.6" fill="{rust}"/><circle cx="13" cy="17" r="2.2" fill="{ink}"/><circle cx="32" cy="11" r="2.2" fill="{ink}"/><circle cx="51" cy="17" r="2.2" fill="{ink}"/><path d="M40 36L44 40M45 34L48 37" ${S(0.9)}/>`,
  goblet: `<path d="M17 10H47C47 29 41 36 32 36C23 36 17 29 17 10Z" ${PAPER} ${S(2.4)}/><path d="M32 36V48" ${S(3.4)}/><ellipse cx="32" cy="52" rx="13" ry="4.5" ${PAPER} ${S(2.4)}/><circle cx="32" cy="21" r="3.4" fill="{rust}" ${S(1.2)}/><path d="M40 14L43 17M41 21L43 23M38 27L40 29" ${S(0.9)}/>`,
  anvil: `<path d="M7 22H44C52 22 57 26 58 30H44V34C44 38 40 40 36 40V46H45V53H17V46H26V40C22 40 18 38 18 34V30C11 30 7 26 7 22Z" ${PAPER} ${S(2.4)}/><path d="M22 26H40M30 44H40" ${S(0.9)}/><circle cx="40" cy="13" r="2" fill="{rust}"/><circle cx="47" cy="9" r="1.6" fill="{rust}"/><circle cx="51" cy="15" r="1.4" fill="{rust}"/>`,
  board: `<rect x="7" y="9" width="50" height="40" rx="2" ${PAPER} ${S(3.6)}/><path d="M14 49V58M50 49V58" ${S(3.4)}/><rect x="14" y="17" width="14" height="16" ${PAPER} ${S(1.5)}/><rect x="33" y="19" width="17" height="11" ${PAPER} ${S(1.5)}/><path d="M17 24H25M17 28H23M36 25H47" ${S(1.1)}/><circle cx="21" cy="17" r="2.2" fill="{rust}"/><circle cx="41.5" cy="19" r="2.2" fill="{rust}"/>`,
  bolt: `<path d="M37 5L15 36H29L24 59L49 25H34L41 5Z" fill="{rust}" ${S(2.4)}/>`,
  bell: `<path d="M32 11C20 11 18 22 18 33C18 40 14 44 11 47H53C50 44 46 40 46 33C46 22 44 11 32 11Z" ${PAPER} ${S(2.4)}/><circle cx="32" cy="8" r="3" ${NONE} ${S(2)}/><path d="M38 18C41 22 41 30 41 36M41 40L43 44" ${S(0.9)}/><circle cx="32" cy="52" r="4" fill="{rust}" ${S(1.6)}/><path d="M56 22C60 28 60 36 56 42" ${NONE} ${S(2)}/>`,
  'bell-off': `<path d="M32 11C20 11 18 22 18 33C18 40 14 44 11 47H53C50 44 46 40 46 33C46 22 44 11 32 11Z" ${PAPER} ${S(2.4)}/><circle cx="32" cy="8" r="3" ${NONE} ${S(2)}/><circle cx="32" cy="52" r="4" fill="{rust}" ${S(1.6)}/><path d="M9 57L55 7" stroke="{paper}" stroke-width="8" stroke-linecap="round"/><path d="M9 57L55 7" ${S(3.6)}/>`,
  music: `<path d="M24 14V45M44 9V40" ${S(3)}/><path d="M24 14L44 9" ${S(5.5)}/><path d="M24 21L44 16" ${S(2.4)}/><ellipse cx="18.5" cy="46" rx="6.5" ry="4.8" transform="rotate(-20 18.5 46)" fill="{rust}" ${S(2)}/><ellipse cx="38.5" cy="41" rx="6.5" ry="4.8" transform="rotate(-20 38.5 41)" fill="{rust}" ${S(2)}/>`,
  book: `<path d="M32 16C24 10 14 10 7 12V50C14 48 24 48 32 54Z" ${PAPER} ${S(2.4)}/><path d="M32 16C40 10 50 10 57 12V50C50 48 40 48 32 54Z" ${PAPER} ${S(2.4)}/><path d="M13 20C18 19 23 19 27 21M13 27C18 26 23 26 27 28M13 34C18 33 23 33 27 35M37 21C41 19 46 19 51 20M37 28C41 26 46 26 51 27" ${NONE} ${S(1.2)}/><path d="M32 54V61" stroke="{rust}" stroke-width="2.6" stroke-linecap="round"/>`,
  map: `<path d="M7 14L22 10L42 16L57 12V50L42 54L22 48L7 52Z" ${PAPER} ${S(2.4)}/><path d="M22 10V48M42 16V54" ${S(1.2)}/><path d="M13 42C19 32 27 38 33 30S45 24 49 21" ${NONE} stroke="{rust}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="3 3"/><path d="M46 18L52 24M52 18L46 24" ${S(2.2)}/>`,
  compass: `<circle cx="32" cy="32" r="23" ${PAPER} ${S(2.6)}/><circle cx="32" cy="32" r="18" ${NONE} ${S(0.9)}/><path d="M32 9V14M32 50V55M9 32H14M50 32H55" ${S(2)}/><path d="M32 13L37 32H27Z" fill="{rust}" ${S(1.4)}/><path d="M32 51L37 32H27Z" fill="{ink}" ${S(1.4)}/><circle cx="32" cy="32" r="2.4" fill="{paper}" ${S(1.2)}/>`,
  hourglass: `<path d="M14 7H50M14 57H50" ${S(4)}/><path d="M18 9C18 24 29 28 29 32C29 36 18 40 18 55H46C46 40 35 36 35 32C35 28 46 24 46 9Z" ${PAPER} ${S(2.4)}/><path d="M23 17H41L32 28Z" fill="{rust}"/><path d="M21 53C25 45 39 45 43 53Z" fill="{rust}"/><path d="M32 32V46" stroke="{rust}" stroke-width="1.2" stroke-dasharray="1.5 2"/>`,
  ship: `<path d="M32 7V38" ${S(2.6)}/><path d="M32 9C46 13 49 26 32 35Z" ${PAPER} ${S(2.2)}/><path d="M34 16C40 18 42 24 40 28" ${NONE} stroke="{rust}" stroke-width="3" stroke-linecap="round"/><path d="M32 7L22 10L32 13Z" fill="{rust}" ${S(1)}/><path d="M7 38H57L50 50H14Z" ${PAPER} ${S(2.4)}/><path d="M14 43H50" ${S(1)}/><path d="M5 57C11 53 17 61 23 57S35 53 41 57S53 61 59 57" ${NONE} ${S(1.8)}/>`,
  target: `<circle cx="30" cy="34" r="22" ${PAPER} ${S(2.4)}/><circle cx="30" cy="34" r="15" ${NONE} ${S(2)}/><circle cx="30" cy="34" r="8" fill="{rust}" ${S(1.8)}/><circle cx="30" cy="34" r="2.6" fill="{ink}"/><path d="M33 31L54 10" ${S(2.4)}/><path d="M50 8L56 8L56 14M48 10L54 16" ${NONE} ${S(1.6)}/>`,
  star: `<path d="M32 6L39 24H58L43 36L48 56L32 44L16 56L21 36L6 24H25Z" fill="{rust}" ${S(2.2)}/><path d="M32 16L35 26M32 16L29 26" stroke="{paper}" stroke-width="1" stroke-linecap="round"/>`,
  speech: `<path d="M9 13H55V40H30L18 52V40H9Z" ${PAPER} ${S(2.4)}/><path d="M16 22H48M16 29H40" ${S(1.6)}/><circle cx="46" cy="30" r="2.4" fill="{rust}"/>`,
  quill: `<path d="M52 6C37 11 24 27 18 48L22 50C30 32 41 21 52 6Z" ${PAPER} ${S(2.2)}/><path d="M26 34L33 33M30 27L38 25M35 20L43 17" ${S(1)}/><path d="M19 49L14 57" ${S(2.6)}/><circle cx="11" cy="59" r="2.6" fill="{rust}"/>`,
  banner: `<path d="M14 6V59" ${S(3)}/><path d="M14 9L53 18L14 28Z" fill="{rust}" ${S(2)}/><path d="M18 14L36 17M18 21L32 19" stroke="{paper}" stroke-width="1" stroke-linecap="round"/><circle cx="14" cy="6" r="2.6" fill="{ink}"/>`,
  globe: `<circle cx="32" cy="32" r="23" ${PAPER} ${S(2.6)}/><ellipse cx="32" cy="32" rx="10" ry="23" ${NONE} ${S(1.6)}/><path d="M9 32H55M13 20H51M13 44H51" ${NONE} ${S(1.4)}/><path d="M32 9V55" ${S(1.2)}/><circle cx="44" cy="22" r="2.4" fill="{rust}"/>`,
  chest: `<path d="M9 28C9 15 55 15 55 28Z" ${PAPER} ${S(2.4)}/><rect x="9" y="28" width="46" height="26" rx="1.5" ${PAPER} ${S(2.4)}/><path d="M19 20V54M45 20V54" ${S(2.6)}/><rect x="28.5" y="30" width="7" height="9" rx="1" fill="{rust}" ${S(1.4)}/><path d="M24 40L27 43M24 47L27 50M38 40L41 43" ${S(0.9)}/>`,
  slate: `<path d="M18 40L12 58M46 40L52 58M32 40V58" ${S(2.6)}/><rect x="9" y="8" width="46" height="32" rx="2" fill="{ink}" ${S(2.4)}/><rect x="13" y="12" width="38" height="24" rx="1" ${NONE} stroke="{paper}" stroke-width="0.8"/><path d="M17 18H33M17 23H41M17 28H29" stroke="{paper}" stroke-width="1.6" stroke-linecap="round"/><circle cx="32" cy="6" r="2.6" fill="{rust}"/>`,
  flask: `<path d="M27 8H37M29 8V23L15 49C13 53 15 56 19 56H45C49 56 51 53 49 49L35 23V8" ${PAPER} ${S(2.4)}/><path d="M19.5 41H44.5L48.5 49C50 52 48.5 54 45 54H19C15.5 54 14 52 15.5 49Z" fill="{rust}"/><circle cx="27" cy="34" r="2" ${NONE} ${S(1.2)}/><circle cx="35" cy="29" r="1.5" ${NONE} ${S(1)}/>`,
  hood: `<path d="M7 58C7 46 15 40 24 38C20 34 19 28 20 22C22 12 28 8 32 6C36 8 42 12 44 22C45 28 44 34 40 38C49 40 57 46 57 58Z" fill="{ink}" ${S(1.6)}/><path d="M25 27C25 20 28 16 32 15C36 16 39 20 39 27C39 33 36 37 32 37C28 37 25 33 25 27Z" fill="{paper}"/><path d="M25 27C26 21 29 19 32 19C35 19 38 21 39 27C36 24 28 24 25 27Z" fill="{ink}"/><path d="M29 31C30 32 34 32 35 31" ${NONE} ${S(1)}/><circle cx="32" cy="45" r="3" fill="{rust}"/><path d="M15 48L19 52M49 48L45 52M22 44L24 48M42 44L40 48" stroke="{paper}" stroke-width="1" stroke-linecap="round"/>`,
  padlock: `<path d="M21 30V21C21 11 43 11 43 21V30" ${NONE} ${S(4)}/><rect x="14" y="29" width="36" height="27" rx="3" ${PAPER} ${S(2.4)}/><circle cx="32" cy="40" r="3.6" fill="{rust}"/><path d="M32 41V49" stroke="{rust}" stroke-width="3" stroke-linecap="round"/><path d="M42 34L45 37M42 41L45 44" ${S(0.9)}/>`,
  fire: `<path d="M32 5C42 17 51 26 47 41C45 51 39 57 32 57C24 57 17 51 17 42C17 32 25 28 27 18C31 24 33 29 31 36C37 30 38 18 32 5Z" fill="{rust}" ${S(2.2)}/><path d="M32 33C37 39 39 44 37 49C35 53 29 53 27 49C25 44 28 40 32 33Z" fill="{paper}"/>`,
  mug: `<path d="M42 26C55 26 55 47 42 47" ${NONE} ${S(3.6)}/><rect x="14" y="19" width="28" height="36" rx="2" ${PAPER} ${S(2.4)}/><path d="M14 27H42M14 47H42" ${S(1.4)}/><path d="M37 31V43" ${S(0.9)}/><path d="M13 19C14 12 21 13 23 16C25 10 33 11 34 15C37 11 44 13 43 19Z" fill="{rust}" ${S(1.8)}/>`,
  chain: `<rect x="8" y="27" width="28" height="14" rx="7" transform="rotate(-40 22 34)" ${NONE} ${S(3.6)}/><rect x="28" y="23" width="28" height="14" rx="7" transform="rotate(-40 42 30)" ${NONE} stroke="{rust}" stroke-width="3.6"/>`,
} as const;

/** The emoji each drawing stands in for (without the U+FE0F "show as emoji" marker). */
export const EMOJI: Record<string, IconName> = {
  '🏰': 'castle',
  '🏢': 'castle',
  '🏛': 'crown',
  '⚔': 'swords',
  '📜': 'scroll',
  '🕯': 'candle',
  '🗝': 'key',
  '🐈': 'cat',
  '⚙': 'gear',
  '🔍': 'lens',
  '🔎': 'lens',
  '✅': 'check',
  '✔': 'tick',
  '❌': 'cross',
  '⚠': 'warning',
  '❗': 'warning',
  '🔧': 'hammer',
  '🔨': 'hammer',
  '🛠': 'hammer',
  '🪑': 'chair',
  '📄': 'letter',
  '📨': 'letter',
  '📱': 'letter',
  '🪪': 'letter',
  '🧠': 'crown',
  '👑': 'crown',
  '🏆': 'goblet',
  '⚒': 'anvil',
  '📋': 'board',
  '📊': 'board',
  '⚡': 'bolt',
  '🔊': 'bell',
  '🔇': 'bell-off',
  '🎵': 'music',
  '📖': 'book',
  '🗺': 'map',
  '🧭': 'compass',
  '⏳': 'hourglass',
  '⏱': 'hourglass',
  '🚢': 'ship',
  '🎯': 'target',
  '⭐': 'star',
  '✨': 'star',
  '✳': 'star',
  '💬': 'speech',
  '💭': 'speech',
  '🤔': 'quill',
  '📝': 'quill',
  '🎉': 'banner',
  '🌐': 'globe',
  '📁': 'chest',
  '🗂': 'chest',
  '📦': 'chest',
  '🖥': 'slate',
  '🧪': 'flask',
  '🐙': 'hood',
  '👥': 'hood',
  '👩': 'hood',
  '👨': 'hood',
  '🔒': 'padlock',
  '🔥': 'fire',
  '☕': 'mug',
  '🔗': 'chain',
};

export type IconRun = { icon: IconName } | { text: string };

const graphemes = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;

/** Text split into plain runs and icon runs. A character with no drawing (or a joined emoji like 👩‍💻) stays text. */
export function splitIcons(text: string): IconRun[] {
  const out: IconRun[] = [];
  let buf = '';
  const parts = graphemes ? [...graphemes.segment(text)].map((s) => s.segment) : [...text];
  for (const g of parts) {
    const icon = EMOJI[g.replace(/️/g, '')];
    if (icon) {
      if (buf) out.push({ text: buf });
      buf = '';
      out.push({ icon });
    } else buf += g;
  }
  if (buf) out.push({ text: buf });
  return out;
}

export interface IconColours {
  ink: string;
  paper: string;
  rust: string;
}

/** An icon's drawing with its colour slots filled. */
export function iconBody(name: IconName, c: IconColours): string {
  return ICONS[name].replace(/\{ink\}/g, c.ink).replace(/\{paper\}/g, c.paper).replace(/\{rust\}/g, c.rust);
}

/** A complete SVG document of an icon, for canvases (the 3D signs) that draw it as an image. */
export function iconSvg(name: IconName, c: IconColours): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${iconBody(name, c)}</svg>`;
}
