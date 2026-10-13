// What a tester runs, from what its desk holds. Measured on 12 Oct: a tester spent 78% of its time running the
// project's checks (GitHub then ran them again) and 14% on a fresh install the dependencies rarely needed.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** What the dungeon reads from a desk before a test round. */
export interface DeskFacts {
  /** GitHub Actions workflow files in `.github/workflows`. */
  workflows: string[];
  /** A fingerprint of the lock files, or null when the project has none the dungeon knows. */
  deps: string | null;
}

const LOCK_FILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'uv.lock', 'poetry.lock', 'Pipfile.lock', 'Cargo.lock', 'go.sum', 'Gemfile.lock', 'composer.lock'];

/** Reads a desk's workflows and lock files. */
export function deskFacts(dir: string): DeskFacts {
  let workflows: string[] = [];
  try {
    workflows = fs.readdirSync(path.join(dir, '.github', 'workflows')).filter((f) => /\.ya?ml$/i.test(f)).sort();
  } catch {
    /* no workflows */
  }
  const hash = crypto.createHash('sha256');
  let any = false;
  for (const f of LOCK_FILES) {
    try {
      const body = fs.readFileSync(path.join(dir, f));
      hash.update(`${f}\0`).update(body);
      any = true;
    } catch {
      /* not this one */
    }
  }
  return { workflows, deps: any ? hash.digest('hex').slice(0, 16) : null };
}

/** Step 3 of a tester's instructions: installing, then the checks it runs itself. */
export function qaChecksStep(f: DeskFacts, lastDeps: string | null | undefined): string {
  const install =
    f.deps === null
      ? 'Install dependencies if needed.'
      : f.deps === lastDeps
        ? "Dependencies are installed and unchanged since your last round on this desk: don't reinstall them unless something is missing."
        : 'Install dependencies: the lock file changed since your last round on this desk, or this is your first.';
  const checks = f.workflows.length
    ? `GitHub Actions runs this repository's workflows (${f.workflows.join(', ')}) on pull requests, and the dungeon merges only once its checks are green. Read them, and don't run locally what they already run on this pull request: run the tests for the files it adds or changes, plus anything the workflows don't cover. If they don't run on pull requests, run the full suite yourself.`
    : "Then run the project's test suite, linters, type checks and build (whichever exist).";
  return `3. ${install} ${checks} If Playwright says a browser isn't installed, those tests didn't run: don't count them as passing or push past them; say so (the dungeon offers the Overlord the install).`;
}
