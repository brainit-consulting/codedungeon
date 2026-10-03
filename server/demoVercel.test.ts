import { describe, expect, it } from 'vitest';
import { createFakeVercel, fakeShipDir } from './demoVercel.ts';

const setup = async (autoAssign: boolean) => {
  let head = 'aaa';
  const v = createFakeVercel({ buildMs: 0, headOf: () => head });
  const made = await v.createProject('todo', 'demo-team');
  const p = { ...made, scope: 'demo-team' };
  await v.link(fakeShipDir('demo-co/todo'), p);
  await v.gitConnect(fakeShipDir('demo-co/todo'), p);
  await v.setAutoAssign(p, autoAssign);
  return { v, p, push: (sha: string) => ((head = sha), v.merged('demo-co/todo', sha)) };
};

describe('the fake Vercel', () => {
  it('goes live with the current main when first connected', async () => {
    const { v, p } = await setup(true);
    expect((await v.project(p)).live?.sha).toBe('aaa');
  });

  it('holds production builds back while auto-assign is off, and promote puts one live', async () => {
    const { v, p, push } = await setup(false);
    push('bbb');
    const build = (await v.deployments(p))[0];
    expect(build).toMatchObject({ sha: 'bbb', state: 'READY' });
    expect((await v.project(p)).live?.sha).toBe('aaa');
    await v.promote(p, build);
    expect((await v.project(p)).live?.sha).toBe('bbb');
  });

  it('turns auto-assign off after a rollback, as Vercel does', async () => {
    const { v, p, push } = await setup(true);
    push('bbb');
    expect((await v.project(p)).live?.sha).toBe('bbb');
    const first = (await v.deployments(p)).find((d) => d.sha === 'aaa')!;
    await v.rollback(p, first);
    const after = await v.project(p);
    expect(after.live?.sha).toBe('aaa');
    expect(after.autoAssign).toBe(false);
    push('ccc');
    expect((await v.project(p)).live?.sha).toBe('aaa');
  });

  it('deploys from the CLI, adds domains, and refuses when logged out', async () => {
    const { v, p } = await setup(false);
    const url = await v.deploy(fakeShipDir('demo-co/todo'), p, true);
    expect((await v.project(p)).live?.url).toBe(url);
    await v.addDomain(p, 'todo.brainit.site');
    expect((await v.project(p)).domains[0]).toBe('todo.brainit.site');
    v.loggedIn = false;
    await expect(v.whoami()).rejects.toThrow(/vercel login/);
  });
});

describe('the fake Vercel after a restart', () => {
  it('takes back a project it has never seen, connected to the demo repo of that name and live on its main', async () => {
    const v = createFakeVercel({ buildMs: 0, headOf: () => 'zzz', repoFor: (name) => (name === 'todo' ? 'demo-co/todo' : null) });
    const p = { id: 'prj_from_before', name: 'todo', scope: 'demo-team' };
    const info = await v.project(p);
    expect(info.live?.sha).toBe('zzz');
    v.merged('demo-co/todo', 'yyy');
    expect((await v.deployments(p))[0].sha).toBe('yyy');
    await expect(v.project({ id: 'prj_x', name: 'unknown', scope: 'demo-team' })).rejects.toThrow(/No Vercel project/);
  });
});
