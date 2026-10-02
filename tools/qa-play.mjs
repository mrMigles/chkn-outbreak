// Visual/perf QA: opens a level, auto-plays (walk + shoot nearest enemy), records frame-time stats and screenshots.
//   node tools/qa-play.mjs <level> <outPrefix> [seconds=12] [gpu=1]
// Needs `npm run dev`. With gpu=1 Chromium uses the real GPU (ANGLE/D3D11) — numbers are indicative only.
import { chromium } from 'playwright';
const [level = 'office', out = 'docs/qa/play', secs = '12', gpu = '1', w = '1280', h = '720'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const args = gpu === '1' ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args, headless: true });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${base}/?level=${level}&loop=timeout${process.env.QA_Q ?? ""}`);
await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session, null, { timeout: 30000 });
console.log('gl:', await page.evaluate(() => { const g = window.__game.renderer.gl; const d = g?.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : window.__game.renderer.type; }));
// optional per-function timing (vite serves the same module instances)
if (process.env.QA_PROF) await page.evaluate(async () => {
  const prof = (window.__prof = {});
  const wrap = (obj, name, label) => { const o = obj[name]; obj[name] = function (...a) { const t = performance.now(); const r = o.apply(this, a); const d = performance.now() - t; const p = prof[label] ??= { n: 0, max: 0, sum: 0 }; p.n++; p.sum += d; p.max = Math.max(p.max, d); return r; }; };
  const P = await import('/src/client/render/Particles.ts'), F = await import('/src/client/render/Fx.ts'), L = await import('/src/client/render/Looks.ts');
  wrap(P.DecalLayer.prototype, 'flush', 'decals.flush'); wrap(P.Particles.prototype, 'update', 'particles.update');
  for (const k of ['kill', 'boom', 'muzzle', 'impact', 'corpse', 'update']) wrap(F.Fx.prototype, k, 'fx.' + k);
  const sc = window.__game.scene.getScene('game');
  for (const k of ['syncWorld', 'handle', 'updateHints', 'updateBubbles', 'updateTutorial', 'updateCamera']) wrap(sc, k, 'scene.' + k);
  wrap(sc.lighting, 'update', 'lighting.update'); wrap(sc.hud, 'update', 'hud.update'); wrap(sc.session, 'poll', 'session.poll');
});
// frame time recorder + autopilot
await page.evaluate(() => {
  const st = (window.__qa = { dts: [], last: performance.now(), shots: 0 });
  st.long = []; st.recent = []; const loop = (t) => { if (t - st.last > 50) st.long.push(Math.round(t - st.last) + "@" + (t / 1000).toFixed(1) + " [" + st.recent.filter(r => r[0] > st.last - 400).map(r => r[1]).join(",") + "]"); st.dts.push(t - st.last); st.last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  st.slow = [];
  const hook = () => {
    const sc = window.__game.scene.getScene('game');
    if (!sc?.update || sc.__hooked) return setTimeout(hook, 200);
    sc.__hooked = true;
    const orig = sc.sys.sceneUpdate.bind(sc);
    sc.sys.sceneUpdate = (t, d) => { const t0 = performance.now(); orig(t, d); const ms = performance.now() - t0; if (ms > 12) st.slow.push(Math.round(ms) + 'ms@' + Math.round(t / 100) / 10 + ' e' + sc.session.view.enemies.length); };
  };
  hook();
  const hook2 = () => { const sc = window.__game.scene.getScene("game"); if (!sc?.handle) return setTimeout(hook2, 200); const o = sc.handle.bind(sc); sc.handle = (ev) => { st.recent.push([performance.now(), ev.e + (ev.t ? ":" + ev.t : "") + (ev.k ? ":" + ev.k : "")]); if (st.recent.length > 200) st.recent.shift(); o(ev); }; }; hook2();
  setInterval(() => {
    const sc = window.__game.scene.getScene('game');
    if (!sc?.session) return;
    const v = sc.session.view, me = v.players.find((p) => p.id === sc.session.myId);
    if (!me) return;
    let best = null, bd = 1e9;
    for (const e of v.enemies) { const d = Math.hypot(e.x - me.x, e.y - me.y); if (d < bd) { bd = d; best = e; } }
    const cam = sc.cameras.main;
    const inp = { fire: false, mx: 0, my: 0 };
    if (best && bd < 700) {
      inp.fire = true;
      const p = cam.getWorldPoint ? null : null;
      inp.aimX = best.x; inp.aimY = best.y - 40; // world coords → Input converts
      if (bd < 160) { inp.mx = -(best.x - me.x) / bd; inp.my = -(best.y - me.y) / bd; }
    } else {
      const t = performance.now() / 1000;
      inp.mx = Math.cos(t * 0.4); inp.my = Math.sin(t * 0.7);
    }
    window.__input = inp;
  }, 100);
});
const n = Math.max(1, Math.round(+secs / 4));
// screenshots stall rendering: measure first, capture after
await page.waitForTimeout(+secs * 1000);
await page.evaluate(() => { window.__qa.measured = window.__qa.dts.length; });
for (let i = 0; i < n; i++) { await page.screenshot({ path: `${out}-${i}.png` }); await page.waitForTimeout(1200); }
const stats = await page.evaluate(() => {
  const d = window.__qa.dts.slice(30, window.__qa.measured).sort((a, b) => a - b);
  const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))]?.toFixed(1);
  const sc = window.__game.scene.getScene('game');
  return { frames: d.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: d[d.length - 1]?.toFixed(1), over50ms: d.filter((x) => x > 50).length,
    enemies: sc.session.view.enemies.length, objects: sc.children.list.length, slowUpdates: window.__qa.slow.slice(0, 30), long: window.__qa.long.slice(0, 40) };
});
console.log('frame ms', JSON.stringify(stats));
if (process.env.QA_PROF) console.log('prof', JSON.stringify(await page.evaluate(() => Object.fromEntries(Object.entries(window.__prof).map(([k, v]) => [k, { n: v.n, max: +v.max.toFixed(1), avg: +(v.sum / v.n).toFixed(2) }])))));
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
await browser.close();
