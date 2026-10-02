// D65: performance budget on the production build (npm run build first). Starts its own server.
// Time to the menu (cold/warm), then a networked floor with constant shooting for PERF_SECONDS: frame times,
// JS heap, DOM nodes and server memory sampled over time — growth means a leak.
//   npm run build && node --import tsx tools/qa-perf.mjs [seconds]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const PORT = 2597, base = `http://127.0.0.1:${PORT}`, secs = Number(process.argv[2] ?? 120);
const dir = path.resolve('data/qa-perf'); fs.rmSync(dir, { recursive: true, force: true });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const server = spawn(process.execPath, ['--expose-gc', '--import', 'tsx', 'server/index.ts', '--debug'], { env: { ...process.env, PORT: String(PORT), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: '', CHKN_MEM_LOG: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; server.stdout.on('data', c => { log += c; }); server.stderr.on('data', c => { log += c; });
for (let i = 0; ; i++) { try { if ((await fetch(base + '/healthz')).ok) break; } catch {} if (i > 200) throw new Error(log); await pause(80); }
const gpu = process.env.QA_GPU !== '0'; // hardware WebGL by default (frame times); QA_GPU=0 for SwiftShader
const browser = await chromium.launch({ args: [...(gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']), '--enable-precise-memory-info'] });
const report = { budget: {}, samples: [] };
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('chkn-settings', JSON.stringify({ dev: true, devLevel: 'office7', tutorials: false, seenTips: ['controls', 'move'] })); } catch {} });
  // mobile network (4G-like): cold and warm start, bytes over the wire
  {
    const mctx = await browser.newContext({ viewport: { width: 832, height: 384 } });
    for (const run of ['cold', 'warm']) {
      const p = await mctx.newPage(), cdp = await mctx.newCDPSession(p);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 85, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
      let bytes = 0; cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
      const t0 = Date.now();
      await p.goto(base + '/', { waitUntil: 'domcontentloaded' });
      await p.locator('button[data-a="host"]').waitFor({ timeout: 90000 });
      report.budget[`mobile4g_menu_${run}_ms`] = Date.now() - t0;
      report.budget[`mobile4g_${run}_KB`] = Math.round(bytes / 1024);
      await p.close();
    }
    await mctx.close();
  }
  for (const run of ['cold', 'warm']) {
    const p = await ctx.newPage(); const t0 = Date.now();
    await p.goto(base + '/?loop=timeout', { waitUntil: 'domcontentloaded' });
    await p.locator('button[data-a="host"]').waitFor({ timeout: 60000 });
    report.budget[`menu_${run}_ms`] = Date.now() - t0;
    if (run === 'cold') await p.close(); else {
      await p.locator('button[data-a="host"]').click();
      await p.locator('button[data-a="fresh"]').click();
      await p.waitForFunction(() => window.__app?.net?.gotSnapshot);
      await p.evaluate(() => __app.room.send('debug', { cmd: 'god' }));
      await p.evaluate(() => {
        // constant fire while walking a circle; frame times recorded by rAF
        let a = 0; window.__frames = []; let last = performance.now();
        const tick = (t) => { window.__frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
        setInterval(() => { a += 0.05; window.__input = { fire: true, mx: Math.cos(a) * 0.6, my: Math.sin(a) * 0.6, aimX: __app.net.view.players[0].x + Math.cos(a * 3) * 200, aimY: __app.net.view.players[0].y + Math.sin(a * 3) * 200 }; }, 100);
      });
      const cdp = await ctx.newCDPSession(p);
      for (let s = 0; s <= secs; s += 15) {
        await pause(s ? 15000 : 3000);
        await cdp.send('HeapProfiler.collectGarbage');
        const m = await p.evaluate(() => {
          const f = window.__frames.splice(0).sort((x, y) => x - y);
          return { heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dom: document.getElementsByTagName('*').length, enemies: __app.net.view.enemies.length,
            p50: +(f[f.length >> 1] ?? 0).toFixed(1), p99: +(f[Math.floor(f.length * 0.99)] ?? 0).toFixed(1), frames: f.length };
        });
        const srv = await (await fetch(base + '/debug/mem')).json().catch(() => ({}));
        report.samples.push({ t: s, ...m, serverHeapMB: srv.heapMB, serverRssMB: srv.rssMB });
        console.log(JSON.stringify(report.samples.at(-1)));
      }
    }
  }
  const first = report.samples[1] ?? report.samples[0], last = report.samples.at(-1);
  report.budget.clientHeapGrowthMB = +(last.heapMB - first.heapMB).toFixed(1);
  report.budget.domGrowth = last.dom - first.dom;
  report.budget.serverHeapGrowthMB = +((last.serverHeapMB ?? 0) - (first.serverHeapMB ?? 0)).toFixed(1);
  console.log('BUDGET', JSON.stringify(report.budget));
  fs.mkdirSync('docs/qa/perf', { recursive: true });
  fs.writeFileSync('docs/qa/perf/report.json', JSON.stringify({ renderer: gpu ? 'Chromium hardware WebGL (d3d11)' : 'Chromium SwiftShader (software) — frame times are pessimistic', ...report }, null, 2));
} finally { await browser.close(); server.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); }
