// D66 multiplayer fixes in two real browsers on the production build (npm run build first; own server):
// converted survivors leave no silhouette/ring, own shots stay visible after picking up a gun, a downed teammate
// gets an alert, an arrow, a pick-up hint and a 15 s ring, a dead player watches a living teammate.
//   npm run build && npm run check:mp-ui
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.MP_UI_PORT || 2596), base = `http://127.0.0.1:${PORT}`;
const out = 'docs/qa/mp', dir = path.resolve('data/qa-mp-ui');
fs.mkdirSync(out, { recursive: true }); fs.rmSync(dir, { recursive: true, force: true });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
let log = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--debug'], { env: { ...process.env, PORT: String(PORT), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.on('data', c => { log += c; }); server.stderr.on('data', c => { log += c; });
for (let i = 0; ; i++) { try { if ((await fetch(base + '/healthz')).ok) break; } catch {} if (i > 200) throw new Error(log); await pause(80); }
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [], results = [];
const prefs = (level) => JSON.stringify({ dev: true, devLevel: level, tutorials: false, seenTips: ['controls', 'move'] });
async function open(name, level) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript((s) => { try { localStorage.setItem('chkn-settings', s); } catch {} }, prefs(level));
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  await p.goto(base + '/?loop=timeout', { waitUntil: 'domcontentloaded' });
  await p.locator('button[data-a="host"]').waitFor({ timeout: 60000 });
  return p;
}
const scene = 'window.__game.scene.getScene("game")';
try {
  const host = await open('host', 'office'), friend = await open('friend', 'office');
  await host.locator('button[data-a="host"]').click();
  await host.locator('.lobby .code').waitFor();
  const code = (await host.locator('.lobby .code').textContent()).trim();
  await friend.locator('button[data-a="join"]').click();
  await friend.locator('.code-input').fill(code);
  await friend.getByRole('button', { name: 'Войти', exact: true }).click();
  await friend.locator('.lobby .code').waitFor();
  await host.locator('button[data-a="fresh"]').click();
  for (const p of [host, friend]) await p.waitForFunction(() => window.__app?.net?.gotSnapshot && window.__game.scene.isActive('game'), null, { timeout: 30000 });
  await host.evaluate(() => __app.room.send('debug', { cmd: 'god' }));

  // 1. converted survivors leave nothing behind (Олег and the open-space coworkers turn in the first seconds)
  await host.waitForFunction(() => __app.net.view.enemies.length >= 3, null, { timeout: 30000 });
  await host.waitForFunction(() => !__app.net.view.npcs.some(n => n.id === 'oleg'), null, { timeout: 20000 });
  await pause(600); // a few frames for both clients
  for (const p of [host, friend]) {
    const left = await p.evaluate(`[...${scene}.npcs.keys()].filter(id => !__app.net.view.npcs.some(n => n.id === id))`);
    assert.deepEqual(left, [], 'no view (silhouette, ring, bar) for survivors that already turned');
  }
  await host.screenshot({ path: `${out}/after-mutation.png` });
  results.push('converted survivors leave no silhouette, ring or bar on either client');

  // 2. a picked-up gun: the pickup event can come before the snapshot listing it — own shots must stay visible
  await host.evaluate(`(() => { const s = ${scene}; s.__localShots = 0; const h = s.handle.bind(s); s.handle = (ev) => { if (ev.e === 'shot' && ev.o === '__local') s.__localShots++; return h(ev); }; })()`);
  await host.evaluate(`${scene}.handle({ e: 'pick', id: __app.net.myId, k: 'weapon', w: 'smg', text: 'ПП' })`); // ahead of the snapshot
  await host.evaluate(() => __app.room.send('debug', { cmd: 'give', level: 'smg' }));
  await host.waitForFunction(() => __app.net.view.players.find(p => p.id === __app.net.myId).weapons.includes('smg'));
  await pause(300);
  await host.evaluate(() => { window.__input = { fire: true, mx: 0, my: 0, aimX: 0, aimY: 0 }; });
  await pause(1200);
  await host.evaluate(() => { window.__input = { fire: false }; });
  const shot = await host.evaluate(`({ n: ${scene}.__localShots, desired: ${scene}.desiredWeapon, cur: __app.net.view.players.find(p => p.id === __app.net.myId).cur, w: __app.net.view.players.find(p => p.id === __app.net.myId).weapons })`);
  assert.ok(shot.n > 3, `own shots are drawn (${JSON.stringify(shot)})`);
  assert.equal(shot.w[shot.desired], 'smg');
  results.push(`after a gun pickup online, own shots stay visible and audible (${shot.n} drawn in 1.2 s)`);

  // 3. downed teammate: alert, arrow to them, pick-up hint at 100 units, a 15 s ring
  const friendId = await friend.evaluate(() => __app.net.myId);
  const hostPos = await host.evaluate(() => { const p = __app.net.view.players.find(p => p.id === __app.net.myId); return { x: p.x, y: p.y }; });
  await friend.evaluate((xy) => __app.room.send('debug', { cmd: 'tp', level: `${Math.round(xy.x + 420)},${Math.round(xy.y)}` }), hostPos);
  await pause(400);
  await friend.evaluate(() => __app.room.send('debug', { cmd: 'down' }));
  await host.waitForFunction((id) => __app.net.view.players.some(p => p.id === id && p.state === 'downed'), friendId);
  await host.waitForFunction(() => /ранен/.test(document.querySelector('.hud-notice.show b')?.textContent ?? ''), null, { timeout: 5000 });
  const ring = await host.evaluate(`${scene}.players.get('${friendId}').timer.commandBuffer.length`);
  assert.ok(ring > 0, 'bleed-out ring drawn');
  const guide = await host.evaluate(`${scene}.guide.hud`);
  assert.ok(guide && Math.abs(guide.angle) < 0.5, `the arrow points to the downed teammate (${JSON.stringify(guide)})`);
  await host.screenshot({ path: `${out}/downed-alert.png` });
  // step next to them (the radius is 110; the wounded crawl a little)
  const fpos = await host.evaluate((id) => { const p = __app.net.view.players.find(p => p.id === id); return { x: p.x, y: p.y }; }, friendId);
  await host.evaluate((xy) => __app.room.send('debug', { cmd: 'tp', level: `${Math.round(xy.x - 85)},${Math.round(xy.y)}` }), fpos);
  await host.waitForFunction(() => /поднять/.test(document.querySelector('.hud-hint')?.textContent ?? ''), null, { timeout: 5000 });
  await host.screenshot({ path: `${out}/downed-ring.png` });
  const downT = await host.evaluate((id) => __app.net.view.players.find(p => p.id === id).downT, friendId);
  assert.ok(downT <= 15 && downT > 8, `15 s bleed-out (${downT})`);
  await host.keyboard.down('e');
  await friend.waitForFunction(() => __app.net.view.players.find(p => p.id === __app.net.myId).state === 'alive', null, { timeout: 8000 });
  await host.keyboard.up('e');
  results.push('downed teammate: alert, arrow, «поднять» hint at 85 units, 15 s ring, revived with E');

  // 4. a dead player watches a living teammate
  const hostId = await host.evaluate(() => __app.net.myId);
  await friend.evaluate(() => __app.room.send('debug', { cmd: 'dead' }));
  await friend.waitForFunction(() => __app.net.view.players.find(p => p.id === __app.net.myId).state === 'dead', null, { timeout: 8000 });
  await pause(800);
  const watch = await friend.evaluate(`({ id: ${scene}.spectating?.id, cam: { x: ${scene}.cameras.main.midPoint.x, y: ${scene}.cameras.main.midPoint.y }, host: (() => { const p = __app.net.view.players.find(p => p.id === '${hostId}'); return { x: p.x, y: p.y }; })(), text: document.querySelector('.hud-state')?.textContent })`);
  assert.equal(watch.id, hostId);
  assert.ok(Math.hypot(watch.cam.x - watch.host.x, watch.cam.y - watch.host.y) < 200, `camera on the teammate (${JSON.stringify(watch)})`);
  assert.match(watch.text, /следим за/);
  await friend.screenshot({ path: `${out}/spectate.png` });
  results.push('a dead player follows a living teammate with the camera («следим за …»)');

  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ renderer: 'Chromium hardware WebGL', results, errors }, null, 2));
  console.log(results.map(r => 'PASS ' + r).join('\n'));
} catch (e) { console.error(log.slice(-1500)); console.error(errors); for (const c of browser.contexts()) for (const pg of c.pages()) console.error('SCREEN', await pg.evaluate(() => (document.querySelector('#ui .screen')?.textContent ?? '').slice(0, 200) + ' | phase=' + window.__app?.room?.state?.phase).catch(() => '?')); throw e; }
finally { await browser.close(); server.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); }
