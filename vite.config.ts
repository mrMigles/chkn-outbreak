import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5280, strictPort: true, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
});
