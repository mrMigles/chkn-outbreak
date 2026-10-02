// Captures a Chrome trace while auto-playing and lists what the long frames spend time on.
//   node tools/qa-trace.mjs <level> [seconds=12]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [level = 'office', secs = '12'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/?level=${level}&loop=timeout`);
await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session, null, { timeout: 30000 });
await page.evaluate(() => setInterval(() => {
  const sc = window.__game.scene.getScene('game'); const v = sc.session.view, me = v.players[0];
  let best = null, bd = 1e9; for (const e of v.enemies) { const d = Math.hypot(e.x - me.x, e.y - me.y); if (d < bd) { bd = d; best = e; } }
  window.__input = best && bd < 700 ? { fire: true, mx: 0, my: 0, aimX: best.x, aimY: best.y - 40 } : { fire: false, mx: Math.cos(performance.now() / 2500), my: Math.sin(performance.now() / 1500) };
}, 100));
await page.waitForTimeout(3000);
const file = 'trace.json';
await browser.startTracing(page, { path: file, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute', 'gpu', 'disabled-by-default-gpu.service', 'blink'] });
await page.waitForTimeout(+secs * 1000);
await browser.stopTracing();
await browser.close();
const ev = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents ?? JSON.parse(fs.readFileSync(file, 'utf8'));
const main = ev.filter((e) => e.ph === 'X' && e.dur);
const tasks = main.filter((e) => e.name === 'RunTask' && e.dur > 40000).sort((a, b) => b.dur - a.dur).slice(0, 8);
for (const t of tasks) {
  const kids = main.filter((e) => e.pid === t.pid && e.tid === t.tid && e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur && e !== t && e.dur > 1000);
  const agg = {};
  for (const k of kids) { const n = k.name + (k.args?.data?.functionName ? ':' + k.args.data.functionName : '') + (k.args?.data?.url ? '@' + String(k.args.data.url).split('/').pop() : ''); agg[n] = Math.max(agg[n] ?? 0, k.dur); }
  console.log(`task ${(t.dur / 1000).toFixed(0)}ms tid ${t.tid}:`, Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, d]) => `${n}=${(d / 1000).toFixed(0)}`).join(' | '));
}
const gcs = main.filter((e) => /GC|Scavenge|MajorGC|MinorGC/.test(e.name) && e.dur > 5000);
console.log('GC >5ms:', gcs.length, gcs.slice(0, 10).map((g) => g.name + ' ' + (g.dur / 1000).toFixed(0)).join(', '));
fs.unlinkSync(file);
