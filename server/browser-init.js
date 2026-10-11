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
  const touch = window.matchMedia('(pointer: coarse)').matches;
  const label = (e) => (e.getAttribute('aria-label') || e.innerText || e.getAttribute('name') || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40);
  const shown = (e) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
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
    if (touch && e.matches('input:not([type=checkbox]):not([type=radio]), select, textarea')) {
      const px = parseFloat(getComputedStyle(e).fontSize);
      if (px < 16) problems.push(`field "${label(e)}" has ${px}px text, under 16px (Safari zooms in)`);
    }
    if (r.bottom > vh || r.right > vw) {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight || p.scrollWidth > p.clientWidth)) break;
        if (s.position === 'fixed' || s.position === 'sticky') {
          problems.push(`"${label(e)}" is off the screen in a part that doesn't scroll`);
          break;
        }
      }
    }
  }
  const unique = [...new Set(problems)].slice(0, 20);
  return { size: `${window.innerWidth}x${vh}`, touch, ok: unique.length === 0, problems: unique };
};
