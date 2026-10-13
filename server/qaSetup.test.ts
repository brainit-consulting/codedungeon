import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { deskFacts, qaChecksStep } from './qaSetup.ts';

const ci = { workflows: ['test.yml'], deps: 'abc' };

describe('qaChecksStep: what a tester runs', () => {
  it("leans on GitHub's checks when the repo has workflows: they ran the whole suite 3 times a round (12 Oct, 78% of a tester's time)", () => {
    const t = qaChecksStep(ci, 'abc');
    expect(t).toContain('test.yml');
    expect(t).toMatch(/merges only once its checks are green/);
    expect(t).toMatch(/don't run locally what they already run/i);
    expect(t).toMatch(/tests for the files it adds or changes/);
    expect(t).toMatch(/don't run on pull requests, run the full suite yourself/);
  });
  it('runs the whole suite itself when the repo has no workflows', () => {
    const t = qaChecksStep({ workflows: [], deps: 'abc' }, 'abc');
    expect(t).toMatch(/run the project's test suite, linters, type checks and build/);
    expect(t).not.toMatch(/GitHub Actions/);
  });
  it('still says what to do when Playwright has no browser', () => {
    expect(qaChecksStep(ci, 'abc')).toMatch(/Playwright says a browser isn't installed/);
  });
});

describe('qaChecksStep: installing', () => {
  it('skips the reinstall when the lock files are as they were at its last round on this desk (7–13 min each, 12 Oct)', () => {
    expect(qaChecksStep(ci, 'abc')).toMatch(/unchanged since your last round on this desk: don't reinstall/);
  });
  it('installs when they changed, or on its first round here', () => {
    expect(qaChecksStep(ci, 'old')).toMatch(/Install dependencies: the lock file changed/);
    expect(qaChecksStep(ci, null)).toMatch(/Install dependencies: the lock file changed/);
  });
  it('keeps the plain wording when the project has no lock file the dungeon knows', () => {
    expect(qaChecksStep({ workflows: [], deps: null }, null)).toMatch(/^3\. Install dependencies if needed/);
  });
});

describe('deskFacts', () => {
  const desk = fs.mkdtempSync(path.join(os.tmpdir(), 'desk-'));
  it('finds the workflows and fingerprints the lock files', () => {
    expect(deskFacts(desk)).toEqual({ workflows: [], deps: null });
    fs.mkdirSync(path.join(desk, '.github', 'workflows'), { recursive: true });
    fs.writeFileSync(path.join(desk, '.github', 'workflows', 'test.yml'), 'on: pull_request');
    fs.writeFileSync(path.join(desk, '.github', 'workflows', 'notes.md'), 'not a workflow');
    fs.writeFileSync(path.join(desk, 'package-lock.json'), '{"a":1}');
    const first = deskFacts(desk);
    expect(first.workflows).toEqual(['test.yml']);
    expect(first.deps).toMatch(/^[0-9a-f]{16}$/);
    expect(deskFacts(desk).deps).toBe(first.deps);
    fs.writeFileSync(path.join(desk, 'package-lock.json'), '{"a":2}');
    expect(deskFacts(desk).deps).not.toBe(first.deps);
  });
});
