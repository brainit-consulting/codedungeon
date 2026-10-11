// The agents' in-browser phone check (server/browser-init.js, window.__phoneCheck) on small fixture pages.
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';

const INIT = path.join(import.meta.dirname, '..', 'server', 'browser-init.js');
const VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1">';
type Result = { size: string; touch: boolean; ok: boolean; problems: string[] };
const check = async (page: Page, html: string, head = VIEWPORT): Promise<Result> => {
  await page.addInitScript({ path: INIT });
  await page.goto('about:blank');
  await page.setContent(`<!doctype html>${head}<body style="margin:0">${html}</body>`);
  return page.evaluate(() => (window as unknown as { __phoneCheck: () => Result }).__phoneCheck());
};

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true });

  test('a page that fits passes', async ({ page }) => {
    const r = await check(page, '<button style="min-height:44px;min-width:88px">Save</button><input style="font-size:16px;height:44px" aria-label="Name">');
    expect(r).toMatchObject({ touch: true, ok: true, problems: [] });
  });
  test('sideways overflow fails', async ({ page }) => {
    const r = await check(page, '<div style="width:500px">wide</div>');
    expect(r.ok).toBe(false);
    expect(r.problems.join()).toMatch(/125px wider than the screen/);
  });
  test('a small button and a 13px field fail; a checkbox and a link in a sentence do not', async ({ page }) => {
    const r = await check(page, '<button style="height:30px">Copy</button><input style="font-size:13px;height:44px" aria-label="Email"><input type="checkbox" aria-label="Done"><p>New here? <a href="/signup">Create account</a></p>');
    expect(r.problems.some((p) => p.startsWith('"Copy"'))).toBe(true);
    expect(r.problems.some((p) => /field "Email" has 13px text/.test(p))).toBe(true);
    expect(r.problems.join()).not.toMatch(/Done|Create account/);
  });
  test('a button below the screen in a sticky part that cannot scroll fails', async ({ page }) => {
    const r = await check(page, '<header style="position:sticky;top:0;height:100vh"><div style="height:700px"></div><button style="height:44px;width:100px">Sign out</button></header>');
    expect(r.problems.join()).toMatch(/"Sign out" is off the screen/);
  });
  test('scrollable sidebar passes', async ({ page }) => {
    const r = await check(page, '<header style="position:sticky;top:0;height:100vh;overflow-y:auto"><div style="height:700px"></div><button style="height:44px;width:100px">Sign out</button></header>');
    expect(r.problems.join()).not.toMatch(/off the screen/);
  });
  test('a sticky table header below the fold is reachable by scrolling', async ({ page }) => {
    const r = await check(page, '<div style="height:900px"></div><table><thead><tr><th style="position:sticky;top:0;background:#fff"><button style="height:44px;width:100px">Sort</button></th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>');
    expect(r.problems.join()).not.toMatch(/off the screen/);
  });
  test('screen-reader-only controls and non-text inputs are not judged as thumb targets or zooming fields', async ({ page }) => {
    const srOnly = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';
    const r = await check(page, `<a href="#main" style="${srOnly}">Skip to content</a><input type="file" style="${srOnly}" aria-label="Logo"><input type="submit" value="Send" style="min-height:44px;min-width:88px">`);
    expect(r).toMatchObject({ ok: true, problems: [] });
  });
  test('multi-line label', async ({ page }) => {
    const r = await check(page, '<button style="height:30px">Save<br>"draft"</button>');
    expect(r.problems[0]).toMatch(/^"Save "draft"" is \d+x30px, under 44px$/);
  });
  test('a page without a viewport tag fails', async ({ page }) => {
    const r = await check(page, '<p>hello</p>', '');
    expect(r.problems.join()).toMatch(/no viewport tag/);
  });
});

test.describe('in the touch browser at laptop size', () => {
  // QA's whole session is a touch browser (--mobile), so its laptop-size pass is touch too; a real laptop has a mouse
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  test('touch rules do not apply from 1200px wide, overflow still does', async ({ page }) => {
    const ok = await check(page, '<button style="height:30px">Copy</button><input style="font-size:13px">');
    expect(ok).toMatchObject({ ok: true, problems: [] });
    const wide = await check(page, '<div style="width:1400px">wide</div>');
    expect(wide.problems.join()).toMatch(/120px wider than the screen/);
  });
});

test.describe('on a laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: false });
  test('touch rules do not apply, overflow still does', async ({ page }) => {
    const r = await check(page, '<button style="height:30px">Copy</button><input style="font-size:13px">', '');
    expect(r).toMatchObject({ touch: false, ok: true });
  });
});
