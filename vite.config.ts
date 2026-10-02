import { defineConfig } from 'vite';

// D56: every build has an id. The client knows its own id, dist/version.json carries the deployed
// one (served uncached), and unhashed assets are requested with ?v=<id>, so an update never mixes
// an old page with new maps or keeps a stale page alive.
const BUILD = process.env.BUILD_ID && process.env.BUILD_ID !== 'dev' ? process.env.BUILD_ID.slice(0, 12) : Date.now().toString(36);

export default defineConfig({
  server: { port: 5280, strictPort: true, host: true },
  // D65: Phaser in its own content-hashed chunk: a game update does not make players download the engine again
  build: { target: 'es2020', chunkSizeWarningLimit: 2000, rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/phaser') ? 'phaser' : id.includes('node_modules/colyseus') || id.includes('node_modules/@colyseus') ? 'net' : undefined) } } },
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [{
    name: 'chkn-version',
    generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }); },
  }],
});
