import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_PORT, SERVER_PORT } from './shared/dungeon.mjs';

const serverPort = Number(process.env.SWARM_PORT ?? SERVER_PORT);
// strictPort: a second office must fail loudly, not quietly take the next port while proxying to this SWARM_PORT.
const clientPort = Number(process.env.SWARM_CLIENT_PORT || CLIENT_PORT);

export default defineConfig({
  root: 'client',
  plugins: [react()],
  server: {
    port: clientPort,
    strictPort: true,
    proxy: {
      '/api': `http://localhost:${serverPort}`,
      '/ws': { target: `ws://localhost:${serverPort}`, ws: true },
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
