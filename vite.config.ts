import { defineConfig } from 'vite';

// D56: every build has an id. The client knows its own id, dist/version.json carries the deployed
// one (served uncached), and unhashed assets are requested with ?v=<id>, so an update never mixes
// an old page with new maps or keeps a stale page alive.
const BUILD = process.env.BUILD_ID && process.env.BUILD_ID !== 'dev' ? process.env.BUILD_ID.slice(0, 12) : Date.now().toString(36);

export default defineConfig({
  server: { port: 5280, strictPort: true, host: true },
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 },
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{
    name: 'chkn-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); },
  }],
});
