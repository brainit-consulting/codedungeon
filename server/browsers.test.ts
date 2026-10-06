// Run with `npm test` (Vitest).
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { findPlaywright, installName, installProgress, missingBrowsers, parseDryRun } from './browsers.ts';

// The messages as Playwright 1.63.0 printed them on Windows (measured 2026-10-06).
const MISSING = [
  "browserType.launch: Executable doesn't exist at H:\\codedungeon-home\\ms-playwright\\webkit-2359\\Playwright.exe",
  '╔════════════════════════════════════════════════════════════╗',
  '║ Looks like Playwright was just installed or updated.       ║',
  '║ Please run the following command to download new browsers: ║',
  '║                                                            ║',
  '║     npx playwright install                                 ║',
  '╚════════════════════════════════════════════════════════════╝',
].join('\n');

const DRY_RUN = [
  'WebKit 26.6 (playwright webkit v2359)',
  '  Install location:    H:\\codedungeon-home\\ms-playwright\\webkit-2359',
  '  Download url:        https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2359/webkit-win64.zip',
  '  Download fallback 1: https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/webkit/2359/webkit-win64.zip',
  '  Download fallback 2: https://cdn.playwright.dev/builds/webkit/2359/webkit-win64.zip',
  '',
  'FFmpeg (playwright ffmpeg v1011)',
  '  Install location:    H:\\codedungeon-home\\ms-playwright\\ffmpeg-1011',
  '  Download url:        https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-win64.zip',
  '  Download fallback 1: https://playwright.download.prss.microsoft.com/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-win64.zip',
].join('\n');

describe('missingBrowsers', () => {
  it('reads the browser and build from Playwright\'s "Executable doesn\'t exist" message', () => {
    expect(missingBrowsers(MISSING)).toEqual([{ key: 'webkit-2359', browser: 'webkit', revision: '2359' }]);
  });

  it('reads every build in a run that missed several, once each, in either kind of path', () => {
    const text = [
      "Error: browserType.launch: Executable doesn't exist at C:\\pw\\chromium_headless_shell-1243\\chrome-win\\headless_shell.exe",
      "Error: browserType.launch: Executable doesn't exist at /home/u/.cache/ms-playwright/firefox-1495/firefox/firefox",
      "Error: browserType.launch: Executable doesn't exist at C:\\pw\\chromium_headless_shell-1243\\chrome-win\\headless_shell.exe",
    ].join('\n');
    expect(missingBrowsers(text).map((m) => m.key)).toEqual(['chromium_headless_shell-1243', 'firefox-1495']);
  });

  it('ignores other output', () => {
    expect(missingBrowsers('7 passed (12.3s)\nError: page.goto: net::ERR_CONNECTION_REFUSED')).toEqual([]);
  });
});

describe('installName', () => {
  it("is the name Playwright's install command takes", () => {
    expect(installName('webkit')).toBe('webkit');
    expect(installName('chromium_headless_shell')).toBe('chromium-headless-shell');
  });
});

describe('parseDryRun', () => {
  it('lists what an install would fetch: each part, where it goes, and its address', () => {
    expect(parseDryRun(DRY_RUN)).toEqual([
      {
        title: 'WebKit 26.6',
        location: 'H:\\codedungeon-home\\ms-playwright\\webkit-2359',
        url: 'https://cdn.playwright.dev/dbazure/download/playwright/builds/webkit/2359/webkit-win64.zip',
      },
      {
        title: 'FFmpeg',
        location: 'H:\\codedungeon-home\\ms-playwright\\ffmpeg-1011',
        url: 'https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-win64.zip',
      },
    ]);
  });
});

describe('installProgress', () => {
  it('reads the download bar', () => {
    expect(installProgress('|■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■                        |  70% of 59.8 MiB')).toBe('downloading 70% of 59.8 MiB');
  });

  it('ignores other lines', () => {
    expect(installProgress('WebKit 26.6 (playwright webkit v2359) downloaded to H:\\x\\webkit-2359')).toBeNull();
    expect(installProgress('')).toBeNull();
  });
});

describe('findPlaywright', () => {
  const root = path.join(os.tmpdir(), `find playwright ${process.pid}`);
  const core = async (dir: string, revision: string) => {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'browsers.json'), JSON.stringify({ browsers: [{ name: 'webkit', revision }, { name: 'chromium', revision: '1243' }] }));
    await fs.writeFile(path.join(dir, 'cli.js'), '');
  };
  afterAll(() => fs.rm(root, { recursive: true, force: true }));

  it("finds the project's own Playwright in pnpm's layout in a subfolder, by the build it asked for", async () => {
    const game = path.join(root, 'pnpm', 'game2d');
    await core(path.join(game, 'node_modules', '.pnpm', 'playwright-core@1.62.0', 'node_modules', 'playwright-core'), '2340');
    await core(path.join(game, 'node_modules', '.pnpm', 'playwright-core@1.63.0', 'node_modules', 'playwright-core'), '2359');
    expect(await findPlaywright(path.join(root, 'pnpm'), 'webkit', '2359')).toBe(path.join(game, 'node_modules', '.pnpm', 'playwright-core@1.63.0', 'node_modules', 'playwright-core', 'cli.js'));
  });

  it("finds it in npm's layout at the top, and gives null when no Playwright there wants that build", async () => {
    const app = path.join(root, 'npm');
    await core(path.join(app, 'node_modules', 'playwright-core'), '2359');
    expect(await findPlaywright(app, 'webkit', '2359')).toBe(path.join(app, 'node_modules', 'playwright-core', 'cli.js'));
    expect(await findPlaywright(app, 'webkit', '9999')).toBeNull();
    expect(await findPlaywright(path.join(root, 'nothing here'), 'webkit', '2359')).toBeNull();
  });
});
