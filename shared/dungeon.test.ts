import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENT_PORT, SERVER_PORT, defaultHome, liveOfficeConflict } from './dungeon.mjs';

const win = { userHome: 'C:\\Users\\snake', platform: 'win32' };
const ok = { ports: [SERVER_PORT, CLIENT_PORT], home: 'H:\\codedungeon-home', ...win };

describe('defaults', () => {
  it('uses 4417 and 5417', () => {
    expect([SERVER_PORT, CLIENT_PORT]).toEqual([4417, 5417]);
  });

  it('keeps data in codedungeon-home next to the repo', () => {
    expect(defaultHome(path.join('x', 'codedungeon'))).toBe(path.resolve('x', 'codedungeon-home'));
  });
});

describe('liveOfficeConflict', () => {
  it('allows Code Dungeon on its own ports and H: folder', () => {
    expect(liveOfficeConflict(ok)).toBeNull();
  });

  it('allows port 0 (tests)', () => {
    expect(liveOfficeConflict({ ...ok, ports: [0] })).toBeNull();
  });

  it("refuses the live office's ports", () => {
    expect(liveOfficeConflict({ ...ok, ports: [4317, CLIENT_PORT] })).toMatch(/4317/);
    expect(liveOfficeConflict({ ...ok, ports: [SERVER_PORT, 5317] })).toMatch(/5317/);
  });

  it("refuses the live office's data folder in any case, with or without a trailing slash", () => {
    expect(liveOfficeConflict({ ...ok, home: 'C:\\Users\\snake\\.cubefarm' })).toMatch(/cubefarm/);
    expect(liveOfficeConflict({ ...ok, home: 'c:\\users\\SNAKE\\.cubefarm\\' })).toMatch(/cubefarm/);
  });

  it('refuses any data folder on C:', () => {
    expect(liveOfficeConflict({ ...ok, home: 'C:\\Temp\\dungeon' })).toMatch(/C: drive/);
  });

  it('ignores drive letters on other platforms', () => {
    expect(liveOfficeConflict({ ports: [SERVER_PORT], home: '/home/me/codedungeon-home', userHome: '/home/me', platform: 'linux' })).toBeNull();
    expect(liveOfficeConflict({ ports: [SERVER_PORT], home: '/home/me/.cubefarm', userHome: '/home/me', platform: 'linux' })).toMatch(/cubefarm/);
  });
});
