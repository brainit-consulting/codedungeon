// server/vercel.test.ts
import { describe, expect, it, vi } from 'vitest';
import { run } from './exec.ts';
import { commandFor, jsonOf, parseDeployUrl, parseProject, realVercel, toDeployment } from './vercel.ts';

// No real CLI in tests: the runner is replaced, so only the arguments and options it gets are checked.
vi.mock('./exec.ts', () => ({ run: vi.fn(async () => 'Production: https://g-new.vercel.app [3s]') }));
vi.mock('./clis.ts', async (real) => ({ ...(await real<typeof import('./clis.ts')>()), resolveCommand: () => '/usr/local/bin/vercel' }));

describe('reading Vercel output', () => {
  it('finds the JSON after a banner line', () => {
    expect(jsonOf<{ a: number }>('Vercel CLI 60.1.3\n{"a":1}')).toEqual({ a: 1 });
    expect(() => jsonOf('Error: no')).toThrow(/without JSON/);
  });

  it('reads a deployment from the project record and from the deployments list', () => {
    const fromProject = { id: 'dpl_AE', url: 'g-bw41.vercel.app', readyState: 'READY', createdAt: 1791045660968, meta: { githubCommitSha: '135e44a7' } };
    expect(toDeployment(fromProject)).toEqual({ id: 'dpl_AE', url: 'g-bw41.vercel.app', sha: '135e44a7', state: 'READY', createdAt: 1791045660968 });
    const fromList = { uid: 'dpl_X', url: 'g-x.vercel.app', state: 'INITIALIZING', created: 5, meta: {} };
    expect(toDeployment(fromList)).toEqual({ id: 'dpl_X', url: 'g-x.vercel.app', sha: null, state: 'BUILDING', createdAt: 5 });
  });

  it('reads the project: live deployment, go-live setting, and addresses with custom ones first', () => {
    const raw = { autoAssignCustomDomains: false, targets: { production: { id: 'dpl_1', url: 'a.vercel.app', readyState: 'READY', createdAt: 1, meta: { githubCommitSha: 'abc' } } } };
    const p = parseProject(raw, { domains: [{ name: 'g.vercel.app' }, { name: 'g.brainit.site' }] });
    expect(p.autoAssign).toBe(false);
    expect(p.live?.id).toBe('dpl_1');
    expect(p.domains).toEqual(['g.brainit.site', 'g.vercel.app']);
    expect(parseProject({}, {}).autoAssign).toBe(true); // Vercel's default when the field is absent
  });

  it('names the team and closes stdin on every call, so a prompt can never hang the dungeon', async () => {
    const p = { id: 'prj_1', name: 'guide', scope: 'team-a' };
    const d = { id: 'dpl_1', url: 'g-1.vercel.app', sha: 'abc', state: 'READY' as const, createdAt: 1 };
    await realVercel.promote(p, d);
    await realVercel.rollback(p, d);
    expect(await realVercel.deploy('H:/x', p, true)).toBe('g-new.vercel.app');
    const calls = vi.mocked(run).mock.calls;
    expect(calls.map((c) => c[1])).toEqual([
      ['promote', 'g-1.vercel.app', '--yes', '--scope', 'team-a'],
      ['rollback', 'g-1.vercel.app', '--yes', '--scope', 'team-a'],
      ['deploy', '--prod', '--yes', '--scope', 'team-a'],
    ]);
    for (const c of calls) expect(c[2]).toMatchObject({ input: '' });
  });

  it('runs a Volta-managed CLI as node on its script, never through cmd.exe, and gives up clearly on a shim it cannot read', () => {
    const voltaShim = '@echo off\r\nvolta run %~n0 %*\r\n';
    // the npm launcher Volta keeps behind its own (measured: Volta\tools\image\packages\vercel\vercel.cmd)
    const npmShim = '@ECHO off\r\nGOTO start\r\n:start\r\nendLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\node_modules\\vercel\\dist\\vc.js" %*\r\n';
    const viaVolta = commandFor('C:/Volta/bin/vercel.cmd', voltaShim, { cmdPath: 'C:/Volta/tools/image/packages/vercel/vercel.cmd', text: npmShim });
    expect(viaVolta?.file).toBe(process.execPath);
    expect(viaVolta?.args[0]).toMatch(/vc\.js$/);
    expect(commandFor('C:/Volta/bin/vercel.cmd', voltaShim, null)).toBeNull();
    expect(commandFor('/usr/local/bin/vercel', null, null)).toEqual({ file: '/usr/local/bin/vercel', args: [] });
    expect(commandFor(null, null, null)).toBeNull();
    expect(commandFor('C:/x/vercel.cmd', '@echo off\r\nsomething else %*\r\n', null)).toBeNull();
  });

  it("takes the deployment's address from `vercel deploy` output", () => {
    expect(parseDeployUrl('Inspect: https://vercel.com/x/y [1s]\nProduction: https://g-abc123.vercel.app [12s]')).toBe('g-abc123.vercel.app');
    expect(() => parseDeployUrl('Error!')).toThrow(/address/);
  });
});
