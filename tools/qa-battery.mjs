// D67: where a phone spends its battery. Production build, own server, mobile emulation (Galaxy S25 landscape):
// per-second CPU (task/script time), style recalculations, layouts and rendered frames in the menu, the lobby and
// a solo fight. A 120 Hz phone is emulated by measuring frames per second of wall time.
//   npm run build && node --import tsx tools/qa-battery.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const PORT = 2598, base = `http://127.0.0.1:${PORT}`;
const dir = path.resolve('data/qa-battery'); fs.rmSync(dir, { recursive: true, force: true });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--debug'], { env: { ...process.env, PORT: String(PORT), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: '' }, stdio: 'ignore' });
for (let i = 0; ; i++) { try { if ((await fetch(base + '/healthz')).ok) break; } catch {} if (i > 200) throw new Error('server'); await pause(80); }
const gpu = process.env.QA_GPU !== '0';
const browser = await chromium.launch({ args: gpu ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const out = {};
try {
  const ctx = await browser.newContext({ viewport: { width: 832, height: 384 }, deviceScaleFactor: 2.8, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('chkn-settings', JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'], ghostSticks: 9 })); } catch {} });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
  const frames = () => page.evaluate(() => { const n = window.__rafN ?? 0; window.__rafN = 0; return n; });
  await page.addInitScript(() => { window.__rafN = 0; const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => raf((t) => { window.__rafN++; cb(t); }); });
  async function measure(label, seconds = 8) {
    await frames(); const a = await metrics(), t0 = Date.now();
    await pause(seconds * 1000);
    const b = await metrics(), s = (Date.now() - t0) / 1000, f = await frames();
    out[label] = { cpuPct: +((b.TaskDuration - a.TaskDuration) / s * 100).toFixed(1), scriptPct: +((b.ScriptDuration - a.ScriptDuration) / s * 100).toFixed(1),
      stylePerSec: +((b.RecalcStyleCount - a.RecalcStyleCount) / s).toFixed(1), layoutPerSec: +((b.LayoutCount - a.LayoutCount) / s).toFixed(1), rafPerSec: +(f / s).toFixed(1) };
    console.log(label, JSON.stringify(out[label]));
  }
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
  await page.locator('button[data-a="host"]').waitFor({ timeout: 60000 });
  await pause(1500);
  await measure('menu');
  await page.locator('button[data-a="host"]').click();
  await page.locator('.lobby .code').waitFor();
  await pause(1000);
  await measure('lobby');
  await page.locator('button[data-a="leave"]').click();
  await page.evaluate(() => __app.startSolo('office7'));
  await page.waitForFunction(() => __game.scene.isActive('game'));
  await page.evaluate(() => { const w = __game.scene.getScene('game').session.world; w.god = true; let a = 0; setInterval(() => { a += 0.07; window.__input = { fire: true, mx: Math.cos(a) * 0.5, my: Math.sin(a) * 0.5, aimX: w.players[0].x + Math.cos(a * 3) * 200, aimY: w.players[0].y + Math.sin(a * 3) * 200 }; }, 100); });
  await pause(4000);
  await measure('fight', 12);
  if (process.env.MUT) console.log('MUTATIONS', await page.evaluate(() => new Promise((ok) => {
    const counts = {}; const key = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return (e?.className && typeof e.className === 'string' ? e.className.split(' ')[0] : e?.tagName) || '?'; };
    const mo = new MutationObserver((list) => { for (const m of list) { const k = m.type + ':' + key(m.target) + (m.attributeName ? '@' + m.attributeName : ''); counts[k] = (counts[k] ?? 0) + 1; } });
    mo.observe(document.getElementById('ui'), { subtree: true, attributes: true, childList: true, characterData: true });
    setTimeout(() => { mo.disconnect(); ok(Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 25)); }, 2000);
  })));
  fs.mkdirSync('docs/qa/perf', { recursive: true });
  fs.writeFileSync('docs/qa/perf/battery.json', JSON.stringify({ renderer: gpu ? 'hardware WebGL' : 'SwiftShader', viewport: '832x384 @2.8', ...out }, null, 2));
} finally { await browser.close(); server.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); }
