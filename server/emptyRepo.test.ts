// Run with `npm test` (Vitest).
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { noMainNotice, pushProgress } from './emptyRepo.ts';

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
    expect(n).toContain('Push to GitHub');
    expect(n).not.toMatch(/README/);
  });

  it('says the upload is under way while the dungeon pushes it, with no command to run', () => {
    const n = noMainNotice({ fullName: 'o/wildgauls', branch: 'main', onGitHub: false, localHead: '351fda2', localPath: folder, uploading: true })!;
    expect(n).toMatch(/uploading to GitHub/);
    expect(n).not.toContain('git push');
    expect(noMainNotice({ fullName: 'o/r', branch: 'main', onGitHub: true, localHead: null, localPath: folder, uploading: true })).toBeNull();
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

describe('pushProgress', () => {
  it("reads how far git has got sending the commits", () => {
    expect(pushProgress('Writing objects:  45% (123/273), 1.20 MiB | 600.00 KiB/s')).toBe('sending 45%');
    expect(pushProgress('Writing objects: 100% (273/273), 3.10 MiB | 1.10 MiB/s, done.')).toBe('sending 100%');
  });

  it('reads Git LFS sending the large files, with how many', () => {
    expect(pushProgress('Uploading LFS objects:  30% (3/10), 120 MB | 1.1 MB/s')).toBe('sending large files 30% (3 of 10)');
  });

  it('names the steps before the sending', () => {
    expect(pushProgress('Enumerating objects: 512, done.')).toBe('counting files');
    expect(pushProgress('Counting objects:  50% (256/512)')).toBe('counting files');
    expect(pushProgress('Compressing objects:  12% (5/40)')).toBe('packing 12%');
  });

  it('ignores everything else', () => {
    for (const l of ['', 'To github.com:o/r.git', ' * [new branch]      main -> main', "branch 'main' set up to track 'origin/main'.", 'remote: Resolving deltas: 100% (3/3)']) {
      expect(pushProgress(l)).toBeNull();
    }
  });
});
