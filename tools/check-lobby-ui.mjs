// D58–D61 in real browsers against the production build (npm run build first). Starts its own server.
// Two players' lobby with portraits, a look change seen by the other, start, a closed tab reopening straight
// into the floor, achievements in the pause menu, Telegram on a computer → «open in the browser» handing the
// seat over, the install page and service worker, phone-sized lobby screenshots in docs/qa/lobby/.
//   npm run build && npm run check:lobby-ui
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.LOBBY_UI_PORT || 2595), base = `http://127.0.0.1:${PORT}`;
const out = 'docs/qa/lobby', dir = path.resolve('data/qa-lobby-ui');
process.env.SESSION_SECRET = 'lobby-ui-check';
const { makeGameToken } = await import('../server/telegram.ts');
fs.mkdirSync(out, { recursive: true }); fs.rmSync(dir, { recursive: true, force: true });
const pause = (ms) => new Promise(r => setTimeout(r, ms));
let log = '';
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--debug'], {
  env: { ...process.env, PORT: String(PORT), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: '', CHKN_RECONNECT_S: '3' }, stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', c => { log += c; }); server.stderr.on('data', c => { log += c; });
for (let i = 0; ; i++) { try { if ((await fetch(base + '/healthz')).ok) break; } catch {} if (i > 200) throw new Error(log); await pause(80); }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], results = [], consoleLog = [];
// the quiet lift foyer of floor 7 (dev level for the room's host): nobody dies while the test waits
const prefs = JSON.stringify({ dev: true, devLevel: 'office7', tutorials: false, seenTips: ['controls', 'move'] });
async function page(ctx, url, name) {
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(`${name}: ${e.message}`));
  p.on('console', m => consoleLog.push(`[${name}] ${m.text()}`));
  const pending = new Set(); p.__pending = pending; p.on('request', r => pending.add(r.url())); p.on('requestfinished', r => pending.delete(r.url())); p.on('requestfailed', r => pending.delete(r.url()));
  try { await p.goto(base + url, { waitUntil: 'domcontentloaded' }); } catch (e) { console.error('PENDING', name, [...pending]); throw e; }
  return p;
}
async function context(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, ...opts });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('chkn-settings')) localStorage.setItem('chkn-settings', s); } catch { /* about:blank */ } }, prefs);
  return ctx;
}
try {
  const hostCtx = await context(), friendCtx = await context();
  const host = await page(hostCtx, '/?loop=timeout', 'host');
  const friend = await page(friendCtx, '/?loop=timeout', 'friend');
  await host.locator('.name').fill('Ведущая'); await host.locator('.name').dispatchEvent('change');
  await host.locator('button[data-a="host"]').click();
  await host.locator('.lobby .code').waitFor();
  const code = (await host.locator('.lobby .code').textContent()).trim();
  await friend.locator('.name').fill('Коллега'); await friend.locator('.name').dispatchEvent('change');
  await friend.locator('button[data-a="join"]').click();
  await friend.locator('.code-input').fill(code);
  await friend.getByRole('button', { name: 'Войти', exact: true }).click();
  await friend.locator('.lobby .code').waitFor();
  await host.waitForFunction(() => document.querySelectorAll('.team .mate:not(.empty)').length === 2);
  const hostCards = await host.locator('.team .mate:not(.empty) b').allTextContents();
  assert.deepEqual(hostCards.map(s => s.replace(' (вы)', '')).sort(), ['Ведущая', 'Коллега']);
  assert.equal(await host.locator('.team .mate:not(.empty) img').count(), 2);
  assert.ok(await host.locator('button[data-a="fresh"]').isVisible(), 'host has the start button');
  // D72: a brand-new room offers a new game only — no «Продолжить», no «продолжить или начать заново»
  const fresh = await host.locator('.lobby-actions').innerText();
  assert.ok(!/продолжить/i.test(fresh) && !(await host.locator('button[data-a="continue"]').count()), 'a new room has nothing to continue: ' + fresh.replace(/\s+/g, ' '));
  assert.ok(!/продолжить/i.test(await friend.locator('.lobby-actions').innerText()), 'the guest is told it is a new game');
  assert.ok(await friend.locator('button[data-a="ready"]').isVisible(), 'guest has «Готов»');
  assert.equal(await friend.locator('button[data-a="fresh"]').count(), 0);
  await host.screenshot({ path: `${out}/desktop-lobby-host.png` });
  results.push('lobby like the main menu: both colleagues with portraits, host sees start, guest sees ready');

  const before = await host.locator('.team .mate:not(.me) img').getAttribute('src');
  await friend.locator('button[data-a="look"]').click();
  await friend.locator('[data-body="f"]').click();
  await friend.locator('[data-a="save"]').click();
  await friend.locator('.lobby .code').waitFor();
  await host.waitForFunction((src) => document.querySelector('.team .mate:not(.me) img')?.getAttribute('src') !== src, before, { timeout: 8000 });
  results.push('a look changed in the lobby redraws that portrait for the host');

  await friend.locator('button[data-a="ready"]').click();
  await host.waitForFunction(() => [...document.querySelectorAll('.team .mate .st')].some(e => e.textContent === 'готов'));
  await host.locator('button[data-a="fresh"]').click();
  for (const p of [host, friend]) await p.waitForFunction(() => window.__app?.net?.gotSnapshot && window.__game?.scene.isActive('game'), null, { timeout: 20000 });
  await host.evaluate(() => __app.room.send('debug', { cmd: 'god' })); // QA server only: patrols must not end the test
  results.push('host starts; both are in the floor');

  // pause → achievements
  await host.keyboard.press('Escape');
  await host.locator('.pause-menu button[data-a="achievements"]').click();
  await host.locator('.pause-menu .achievement-list').waitFor();
  assert.ok(await host.locator('.pause-menu .achievement-entry').count() >= 15);
  await host.screenshot({ path: `${out}/desktop-pause-achievements.png` });
  await host.locator('.pause-menu [data-a="back"]').click(); await host.locator('.pause-menu [data-a="resume"]').click();
  results.push('pause menu shows the achievements list');

  // the friend closes the tab (no «Выйти») and opens the game again later
  const slot = await friend.evaluate(() => __app.net.view.players.find(p => p.id === __app.net.myId).slot);
  await friend.close();
  await host.evaluate(() => __game.loop.sleep()); // software WebGL in one page starves the other's start-up
  await pause(3600); // past the reconnection window: the seat is held by player id
  const back = await page(friendCtx, '/?loop=timeout', 'friend-again');
  await back.waitForFunction(() => window.__app?.net?.gotSnapshot && window.__game?.scene.isActive('game'), null, { timeout: 60000 });
  await pause(500);
  assert.equal(await back.evaluate(() => __app.net.view.players.find(p => p.id === __app.net.myId).slot), slot);
  await host.evaluate(() => __game.loop.wake());
  await host.waitForFunction(() => __app.net.view.players.filter(p => p.connected).length === 2);
  await back.screenshot({ path: `${out}/desktop-reopened.png` });
  results.push('closed tab: opening the game again goes straight back into the floor, same seat, no clicks');
  await back.close(); await host.close();

  // Telegram on a computer: the banner hands the seat to a full browser window
  const tgCtx = await context();
  const token = makeGameToken({ c: 'ci-ui-check', u: 31337, n: 'Тимур', t: Math.floor(Date.now() / 1000), title: 'Отдел QA' });
  const tg = await page(tgCtx, `/?tg=${token}&loop=timeout`, 'telegram');
  await tg.locator('.lobby .code').waitFor({ timeout: 15000 });
  await tg.locator('.tg-desktop').waitFor();
  await tg.screenshot({ path: `${out}/telegram-desktop-lobby.png` });
  const [popup] = await Promise.all([tgCtx.waitForEvent('page'), tg.locator('.tg-desktop button[data-a="browser"]').click()]);
  popup.on('pageerror', e => errors.push('popup: ' + e.message));
  await popup.locator('.lobby .code').waitFor({ timeout: 15000 });
  await tg.getByText('ИГРА ОТКРЫТА В ДРУГОМ ОКНЕ').waitFor({ timeout: 8000 });
  assert.equal(await popup.evaluate(() => __app.room.state.players.size), 1, 'one seat, moved — not a second player');
  await tg.screenshot({ path: `${out}/telegram-handed-over.png` });
  results.push('Telegram on a computer: banner → browser window takes the same seat; the small window says so');
  // D68: the chat lobby has «Одиночный режим», which leaves the chat room for the main menu
  await popup.locator('.lobby [data-a="solo-mode"]').click();
  await popup.locator('.menu [data-a="solo"]').waitFor({ timeout: 8000 });
  assert.equal(await popup.evaluate(() => !!__app.room), false, 'left the chat room');
  await popup.screenshot({ path: `${out}/telegram-solo-mode.png` });
  results.push('chat lobby: «Одиночный режим» leaves the room and opens the main menu with single-player');
  await tgCtx.close();

  // install page + service worker
  const pwaCtx = await context();
  const inst = await page(pwaCtx, '/?install=1', 'install');
  await inst.locator('.install-panel').waitFor();
  assert.ok(await inst.locator('.install-panel .install-how, .install-panel [data-a="prompt"]').count());
  const sw = await inst.evaluate(() => navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  assert.ok(sw, 'service worker active');
  await inst.screenshot({ path: `${out}/install.png` });
  results.push('install link opens the install page; the service worker is active');
  await pwaCtx.close();

  // phone-sized lobby (Galaxy S25 portrait / landscape)
  for (const [name, vp] of [['phone-portrait', { width: 384, height: 740 }], ['phone-landscape', { width: 832, height: 384 }]]) {
    const ctx = await context({ viewport: vp, hasTouch: true, isMobile: true });
    const p = await page(ctx, '/', name);
    await p.locator('button[data-a="resume-room"]').waitFor();
    await p.evaluate((c) => __app.resumeRoom(c), code);
    await p.locator('.lobby .code').waitFor();
    const overflow = await p.evaluate(() => { const m = document.querySelector('.lobby'); return m.scrollWidth - m.clientWidth; });
    assert.ok(overflow <= 1, `${name}: no horizontal overflow (${overflow})`);
    await p.screenshot({ path: `${out}/${name}.png` });
    await ctx.close();
  }
  results.push('phone portrait/landscape lobby fits without horizontal scrolling');
  await hostCtx.close(); await friendCtx.close();
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ renderer: 'Chromium SwiftShader (software)', results, errors }, null, 2));
  console.log(results.map(r => 'PASS ' + r).join('\n'));
} catch (e) { console.error(log.slice(-2000)); console.error(errors, consoleLog.slice(-30).join(' ¶ ')); for (const ctx of browser.contexts()) for (const pg of ctx.pages()) console.error('SCREEN', [...(pg.__pending ?? [])].join(' '), await pg.evaluate(() => document.querySelector('#ui .screen')?.textContent?.slice(0, 160) + ' | room=' + !!window.__app?.room + ' net=' + !!window.__app?.net).catch(() => '?')); throw e; }
finally { await browser.close(); server.kill('SIGTERM'); fs.rmSync(dir, { recursive: true, force: true }); }
