// Runs in every page of the agents' test browsers, before the page's own scripts (Playwright MCP --init-script).
//
// The agents' browser is headless, but on Windows headless Chrome still applies pointer lock to the real mouse: a
// page that locks the pointer (any 3D app, including the office itself) traps the manager's cursor in an invisible
// window and keeps snapping it to that window's centre. So pages get an in-page stand-in instead. The page sees the
// lock granted and released as usual and keeps receiving mouse events, but the real cursor is never touched.
(() => {
  let locked = null;
  const changed = () => queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
  Object.defineProperty(Document.prototype, 'pointerLockElement', {
    configurable: true,
    get: () => (locked && locked.isConnected ? locked : null),
  });
  Element.prototype.requestPointerLock = function () {
    locked = this;
    changed();
    return Promise.resolve();
  };
  Document.prototype.exitPointerLock = function () {
    if (!locked) return;
    locked = null;
    changed();
  };
})();

// window.__phoneCheck(): the QA tester's phone measurement (Phone-ready checks, server/phoneReady.ts). Sideways
// overflow fails everywhere. On touch screens: no viewport tag (phones then show the page zoomed out), controls under
// 44px and fields under 16px (Safari zooms into those) fail; so does a control off the screen inside a fixed or sticky
// part that can't scroll.
window.__phoneCheck = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  // touch rules up to tablet width (the skill's 1200px line): the phone browser is touch at every size, a laptop isn't
  const touch = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 1200;
  const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('name') || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  // a screen-reader-only control (a skip link, a hidden file input behind a label) is a 1px clipped box: not a target
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    if (r.width <= 1 && r.height <= 1) return false;
    if (/rect\(0(px)?,?\s*0(px)?,?\s*0(px)?,?\s*0(px)?\)/.test(s.clip) || /inset\(50%\)/.test(s.clipPath)) return false;
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  // the fields Safari zooms into: ones you type in, and drop-downs (not buttons, files, sliders or colours)
  const TYPED = 'input:not([type]), input[type=text], input[type=email], input[type=password], input[type=search], input[type=tel], input[type=url], input[type=number], input[type=date], input[type=datetime-local], input[type=month], input[type=time], input[type=week], select, textarea';
  const inSentence = (e) =>
    e.tagName === 'A' && getComputedStyle(e).display === 'inline' && (e.parentElement?.innerText || '').trim().length > (e.innerText || '').trim().length;
  const problems = [];
  const overflow = document.documentElement.scrollWidth - vw;
  if (overflow > 0) problems.push(`page is ${overflow}px wider than the screen`);
  if (touch && !/width\s*=\s*device-width/.test(document.querySelector('meta[name=viewport]')?.getAttribute('content') || ''))
    problems.push('no viewport tag with width=device-width: phones show the page zoomed out');
  const controls = [...document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button]')].filter(shown);
  for (const e of controls) {
    const r = e.getBoundingClientRect();
    if (touch && !e.matches('input[type=checkbox], input[type=radio]') && !inSentence(e) && (r.height < 44 || r.width < 44))
      problems.push(`"${label(e)}" is ${Math.round(r.width)}x${Math.round(r.height)}px, under 44px`);
    if (touch && e.matches(TYPED)) {
      const px = parseFloat(getComputedStyle(e).fontSize);
      if (px < 16) problems.push(`field "${label(e)}" has ${px}px text, under 16px (Safari zooms in)`);
    }
    if (r.bottom > vh || r.right > vw) {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth)) break;
        // a sticky part scrolls with the page until it pins: the control is out of reach only if it can't fit then
        const pinnedRoom = vh - (parseFloat(s.top) || 0);
        const stuck = s.position === 'fixed' || (s.position === 'sticky' && r.bottom - p.getBoundingClientRect().top > pinnedRoom);
        if (stuck) problems.push(`"${label(e)}" is off the screen in a part that doesn't scroll`);
        if (s.position === 'fixed' || s.position === 'sticky') break;
      }
    }
  }
  const unique = [...new Set(problems)].slice(0, 20);
  return { size: `${window.innerWidth}x${vh}`, touch, ok: unique.length === 0, problems: unique };
};
