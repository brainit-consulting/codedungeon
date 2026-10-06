// Runs an async job one call at a time: a call made while one is running waits for it, then runs. The state file's
// writer uses it (Swarm.writeState): two writes at once trip over the same temp file, and an older one can land last.

/** Wrap `job` so calls never overlap and run in the order made; a failed call doesn't stop the ones after it. */
export function oneAtATime<T>(job: () => Promise<T>): () => Promise<T> {
  let last: Promise<unknown> = Promise.resolve();
  return () => {
    const next = last.then(job, job);
    last = next.catch(() => undefined);
    return next;
  };
}
