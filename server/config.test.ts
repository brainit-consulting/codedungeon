import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultProjectsDir } from './config.ts';

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cubefarm-config-'));
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('defaultProjectsDir', () => {
  it('is the folder a checkout sits in', () => {
    expect(defaultProjectsDir(path.join(tmp, 'Projects', 'cubefarm'), tmp)).toBe(path.join(tmp, 'Projects'));
  });

  it('is a projects folder in your home when installed from npm', () => {
    const installed = path.join(tmp, 'npm', 'node_modules', 'cubefarm');
    expect(defaultProjectsDir(installed, tmp)).toBe(path.join(tmp, 'Projects'));
    fs.mkdirSync(path.join(tmp, 'code'));
    expect(defaultProjectsDir(installed, tmp)).toBe(path.join(tmp, 'code'));
  });
});

describe('currentVersion', () => {
  it("is package.json's version as it is now", async () => {
    const { currentVersion } = await import('./config.ts');
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect(currentVersion()).toBe(pkg.version);
  });
});

describe('devPage', () => {
  it('is the live page the launcher names in --dev', async () => {
    const { devPage } = await import('./config.ts');
    expect(devPage({ SWARM_DEV_PAGE: 'http://localhost:5417' })).toBe('http://localhost:5417');
  });
  it('is nothing without one, or for anything but a localhost address with a port', async () => {
    const { devPage } = await import('./config.ts');
    expect(devPage({})).toBeNull();
    for (const bad of ['http://evil.example:5417', 'http://localhost', 'localhost:5417', 'http://localhost:5417/x'])
      expect(devPage({ SWARM_DEV_PAGE: bad }), bad).toBeNull();
  });
});
