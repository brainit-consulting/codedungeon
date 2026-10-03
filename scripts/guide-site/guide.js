// The guide's two helpers: text size (A− A A+, remembered in this browser) and, on a chapter page, the section
// you're reading lit in the contents column. The page reads fine without either.
(() => {
  const SIZES = [0.9, 1, 1.15, 1.3, 1.5, 1.75];
  const KEY = 'codedungeon-guide-text-size';
  let at = 1;
  try {
    const saved = Number(localStorage.getItem(KEY));
    if (Number.isInteger(saved) && SIZES[saved]) at = saved;
  } catch {
    // storage blocked: the size just isn't remembered
  }
  const apply = () => {
    document.documentElement.style.fontSize = `${SIZES[at] * 100}%`;
    for (const b of document.querySelectorAll('[data-size]')) {
      const d = Number(b.getAttribute('data-size'));
      b.disabled = (d < 0 && at === 0) || (d > 0 && at === SIZES.length - 1);
      if (d === 0) b.setAttribute('aria-pressed', String(at === 1));
    }
  };
  apply();
  document.addEventListener('click', (e) => {
    const b = e.target instanceof Element ? e.target.closest('[data-size]') : null;
    if (!b) return;
    const d = Number(b.getAttribute('data-size'));
    at = d === 0 ? 1 : Math.max(0, Math.min(SIZES.length - 1, at + d));
    try {
      localStorage.setItem(KEY, String(at));
    } catch {
      // not remembered
    }
    apply();
  });

  // The contents stand open beside the page on a wide screen, and fold up above it on a narrow one.
  const fold = document.querySelector('.toc-fold');
  const wide = window.matchMedia('(min-width: 960px)');
  const setFold = () => {
    if (fold) fold.open = wide.matches;
  };
  setFold();
  wide.addEventListener('change', setFold);

  // The section in view: the last heading above the top third of the window.
  const links = new Map([...document.querySelectorAll('a.section')].map((a) => [a.getAttribute('href').slice(1), a]));
  const heads = [...document.querySelectorAll('h2[id]')];
  if (!links.size) return;
  let ticking = false;
  const mark = () => {
    ticking = false;
    let current = null;
    for (const h of heads) if (h.getBoundingClientRect().top < window.innerHeight * 0.33) current = h.id;
    for (const [id, a] of links) a.classList.toggle('on', id === current);
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(mark);
      }
    },
    { passive: true },
  );
  mark();
})();
