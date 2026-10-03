import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLIENT_PORT, SERVER_PORT, defaultHome, liveOfficeConflict, parseLocalRules } from './dungeon.mjs';

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

  it('allows a data folder on C: by default, and refuses it only where this machine says so', () => {
    expect(liveOfficeConflict({ ...ok, home: 'C:\\Temp\\dungeon' })).toBeNull();
    expect(liveOfficeConflict({ ...ok, home: 'C:\\Temp\\dungeon', forbidCDrive: true })).toMatch(/C: drive/);
    expect(liveOfficeConflict({ ...ok, forbidCDrive: true })).toBeNull(); // H: is fine either way
  });

  it('ignores drive letters on other platforms', () => {
    expect(liveOfficeConflict({ ports: [SERVER_PORT], home: '/home/me/codedungeon-home', userHome: '/home/me', platform: 'linux' })).toBeNull();
    expect(liveOfficeConflict({ ports: [SERVER_PORT], home: '/home/me/.cubefarm', userHome: '/home/me', platform: 'linux' })).toMatch(/cubefarm/);
  });
});

describe("this machine's own rules (dungeon.local.json, not in git)", () => {
  it('reads the C: drive rule; a missing, unreadable or odd file means no extra rules', () => {
    expect(parseLocalRules('{ "forbidCDrive": true }')).toEqual({ forbidCDrive: true });
    expect(parseLocalRules('{}')).toEqual({ forbidCDrive: false });
    expect(parseLocalRules(null)).toEqual({ forbidCDrive: false });
    expect(parseLocalRules('not json')).toEqual({ forbidCDrive: false });
    expect(parseLocalRules('{ "forbidCDrive": "yes" }')).toEqual({ forbidCDrive: false });
  });
});
