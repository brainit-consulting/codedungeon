import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';
import { defaultHome } from './shared/dungeon.mjs';

// Kept apart from vite.config.ts, whose root is client/, so tests in server/, shared/ and scripts/ are found too.
export default defineConfig({
  test: {
    root: '.',
    include: ['{client,server,shared,scripts}/**/*.test.{ts,tsx}'],
    // e2e/ is Playwright's (npm run test:e2e): it needs a browser and a running demo office.
    exclude: [...configDefaults.exclude, 'e2e/**'],
    environment: 'node',
    // Anything a test imports must never see a live office's state or ports, and nothing goes to C:.
    env: { SWARM_HOME: path.join(defaultHome(import.meta.dirname), 'tmp', `vitest-${process.pid}`), SWARM_PORT: '0' },
  },
});
