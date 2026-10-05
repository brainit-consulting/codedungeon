// Run with `npm test` (Vitest).
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { noMainNotice } from './emptyRepo.ts';

const folder = path.join('H:', 'wildgauls');

describe('noMainNotice', () => {
  it('says nothing once GitHub has the branch', () => {
    expect(noMainNotice({ fullName: 'o/r', branch: 'main', onGitHub: true, localHead: null, localPath: folder })).toBeNull();
  });

  it('names the push when the commits are in the folder but not on GitHub (the wildgauls case)', () => {
    const n = noMainNotice({ fullName: 'o/wildgauls', branch: 'main', onGitHub: false, localHead: '351fda2', localPath: folder })!;
    expect(n).toContain('351fda2');
    expect(n).toContain(folder);
    expect(n).toContain('git push -u origin main');
    expect(n).not.toMatch(/README/);
  });

  it('asks for a first commit when the repo is empty everywhere', () => {
    const n = noMainNotice({ fullName: 'o/r', branch: 'main', onGitHub: false, localHead: null, localPath: null })!;
    expect(n).toMatch(/no main branch/);
    expect(n).toMatch(/README/);
  });

  it('uses the repo\'s own default branch name', () => {
    const n = noMainNotice({ fullName: 'o/r', branch: 'trunk', onGitHub: false, localHead: 'abc1234', localPath: folder })!;
    expect(n).toContain('git push -u origin trunk');
  });
});
