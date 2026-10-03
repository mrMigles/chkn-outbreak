// D72 visual QA: «Уединение» and Катя, room 87 and Вершков, Валера in the dark, the floor-11 forms, the grandma's
// flock, the getaway car, Толик, GMO roosters, the fat CEO, a chapter summary, the final statistics, «Летопись»
// and the phone weapon picker selecting a tapped weapon (issue #3).
//   node tools/qa-d72.mjs [outDir=docs/qa/d72]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const [out = 'docs/qa/d72'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const settings = JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'], dev: true, devGod: true });
async function open(level, ctxOpts = { viewport: { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(level + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/AudioContext|favicon/.test(m.text())) errors.push(level + ': ' + m.text().slice(0, 200)); });
  await page.addInitScript((s) => localStorage.setItem('chkn-settings', s), settings);
  await page.goto(`${base}/?level=${level}&loop=timeout&nobackguard`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session?.world, null, { timeout: 90000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const W = (page, fn, arg) => page.evaluate(fn, arg);
/** Teleport the player (tile coords) and stop the intro. */
const tp = (page, x, y) => W(page, ([x, y]) => { const sc = window.__game.scene.getScene('game'), w = sc.session.world, p = w.players[0]; p.x = p.input.x = x * 64; p.y = p.input.y = y * 64; p.tp++; sc.introState = 'done'; sc.cineFocus = null; document.getElementById('ui').classList.remove('cine-bars'); sc.introCaption?.remove(); }, [x, y]);
/** Aim the local player at a world point (the client input drives the aim every frame). */
const aimAt = (page, x, y) => W(page, ([x, y]) => { window.__input = { aimX: x, aimY: y }; }, [x, y]);

// 1. floor 7: «Уединение»
{
  const { ctx, page } = await open('office7');
  await tp(page, 10, 20.3);
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; w.cancelWaves(); for (const e of [...w.enemies]) w.killEnemy(e, 0, '', false, false); w.script.onUse(w, 'kink_button', w.players[0]); w.players[0].input.aim = 0; });
  await page.waitForTimeout(1500); await shot(page, 'f7-uedinenie');
  await page.waitForTimeout(6500); await shot(page, 'f7-katya-debug');
  await ctx.close();
}
// 2. floor 8: room 87, Вершков; 3. Валера in the dark
{
  const { ctx, page } = await open('office8');
  await tp(page, 12.5, 36.2);
  await page.waitForTimeout(3000); await shot(page, 'f8-room87');
  await page.waitForTimeout(7500); await shot(page, 'f8-vershkov-sprouts');
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; w.cancelWaves(); for (const e of [...w.enemies]) w.killEnemy(e, 0, '', false, false); const p = w.players[0];
    p.x = p.input.x = 30.5 * 64; p.y = p.input.y = 26 * 64; p.tp++; w.setLight(0.97);
    const v = w.spawnEnemy('fast', p.x + 230, p.y - 40, { aggro: false }); v.appearance = { npcId: 'valera', kind: 'valera', name: 'Петух Тёмной Темы · Валера' }; v.blinkT = 99; v.stunT = 99; w.setBoss(v, 'Петух Тёмной Темы · Валера'); });
  await aimAt(page, 30.5 * 64 - 300, 26 * 64);
  await page.waitForTimeout(1500); await shot(page, 'f8-valera-dark-eyes');
  await aimAt(page, 30.5 * 64 + 230, 26 * 64 - 40);
  await page.waitForTimeout(700); await shot(page, 'f8-valera-in-beam');
  await page.evaluate(() => { window.__input = {}; });
  await ctx.close();
}
// 4. floor 11: a form and its scene
{
  const { ctx, page } = await open('office11');
  await tp(page, 47.6, 16.8);
  await page.waitForTimeout(1800); await shot(page, 'f11-form-headhunter');
  await ctx.close();
}
// 5. street 1: the grandma's flock, her crumbling; the parking lot and the getaway car
{
  const { ctx, page } = await open('street1');
  await tp(page, 13, 33);
  await page.waitForTimeout(2500); await shot(page, 'street1-grandma-flock');
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; w.flags.crumbleAt = w.time; });
  await page.waitForTimeout(3200); await shot(page, 'street1-grandma-hens');
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; Object.assign(w.flags, { pilotMet: true, radioDone: true }); w.cancelWaves(); for (const e of [...w.enemies]) if (w.enemyTags.get(e.id) !== 'lot') w.killEnemy(e, 0, '', false, false); });
  await tp(page, 42, 55.5);
  await page.waitForTimeout(3000); await tp(page, 33, 63.4); await shot(page, 'street1-lot-litovets');
  await page.waitForTimeout(9300); await shot(page, 'street1-getaway');
  await page.waitForTimeout(3500); await shot(page, 'street1-fence-down');
  await ctx.close();
}
// 6. street 2: Толик smokes and throws bottles
{
  const { ctx, page } = await open('street2');
  await tp(page, 75, 37.6);
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; w.script.onTrigger(w, 'garage', w.players[0]); for (const e of [...w.enemies]) if (w.enemyTags.get(e.id) === 'garage') w.killEnemy(e, 0, '', false, false); });
  await page.waitForTimeout(2600); await shot(page, 'street2-tolik');
  await ctx.close();
}
// 7. lab: GMO roosters
{
  const { ctx, page } = await open('lab');
  await tp(page, 6, 6);
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0]; for (let i = 0; i < 3; i++) w.spawnEnemy('gmo', p.x + 220 + i * 70, p.y - 30 + i * 40, { aggro: false }); });
  await page.waitForTimeout(1200); await shot(page, 'lab-gmo');
  await ctx.close();
}
// 8. the fat CEO and the finale with the whole run's statistics
{
  const { ctx, page } = await open('boss');
  await page.waitForTimeout(7000);
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0], b = w.enemies.find(e => e.type === 'boss'); b.x = 18 * 64; b.y = 11 * 64; b.stunT = 5; p.x = p.input.x = b.x + 160; p.y = p.input.y = b.y - 120; p.tp++; const sc = window.__game.scene.getScene('game'); sc.introState = 'done'; sc.cineFocus = null; for (const e of [...w.enemies]) if (e !== b) w.killEnemy(e, 0, '', false, false); w.cancelWaves();
    for (let i = 0; i < 40; i++) { const e = w.spawnEnemy('normal', p.x + 100, p.y, { aggro: true }); w.killEnemy(e, 0, p.id, false, false); } w.moment(p.id, 'Уволил(а) директора в пятницу вечером'); });
  await page.waitForTimeout(1200); await shot(page, 'boss-fat-yellow');
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world; const b = w.enemies.find(e => e.type === 'boss'); w.killEnemy(b, 0, w.players[0].id, false, false); });
  await page.waitForFunction(() => /ПОБЕДА/.test(document.querySelector('.overlay.screen .panel')?.textContent ?? ''), null, { timeout: 30000 });
  await page.waitForTimeout(800); await shot(page, 'finale-final-stats');
  const txt = await page.locator('.overlay.screen .panel').innerText();
  if (!/личная статистика за всю игру/i.test(txt)) errors.push('finale: no personal statistics');
  // «Летопись» from the main menu
  await page.click('[data-a="menu"]'); await page.waitForSelector('[data-a="chronicle"]'); await page.click('[data-a="chronicle"]');
  await page.waitForTimeout(400); await page.locator('details.chron').first().evaluate(d => { d.open = true; }).catch(() => errors.push('chronicle: empty'));
  await shot(page, 'chronicle');
  await ctx.close();
}
// 9. a chapter summary (street 2 → chapter 2)
{
  const { ctx, page } = await open('street2');
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0];
    for (let i = 0; i < 23; i++) { const e = w.spawnEnemy('normal', p.x + 100, p.y, { aggro: true }); w.killEnemy(e, 0, p.id, false, false); }
    w.moment(p.id, 'Помог(ла) Литовцу угнать жёлтую спортивную машину'); w.award('grandma'); w.completeLevel('factory'); });
  await page.waitForFunction(() => /ЭТАП ПРОЙДЕН/.test(document.querySelector('.overlay.screen .panel')?.textContent ?? ''), null, { timeout: 30000 });
  await page.waitForTimeout(500); await shot(page, 'chapter-summary');
  if (!/итоги главы/i.test(await page.locator('.overlay.screen .panel').innerText())) errors.push('chapter summary missing');
  await ctx.close();
}
// 10. phone: hold the weapon panel → picker → tap a tile selects it (issue #3)
{
  const { ctx, page } = await open('office7', { ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  await W(page, () => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0]; w.devArsenal(p); p.cur = 0; p.input.weapon = 0; });
  await page.waitForTimeout(1500);
  const box = await page.locator('.hud-weapon').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForTimeout(600);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const tile = await page.locator('.weapon-picker .wp-item').last().boundingBox();
  const want = await page.locator('.weapon-picker .wp-item').last().getAttribute('data-i');
  const tp2 = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
  await shot(page, 'phone-picker-open');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [tp2] });
  await page.waitForTimeout(80);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(600);
  const cur = await W(page, () => window.__game.scene.getScene('game').session.world.players[0].cur);
  console.log('picker: tapped slot', want, '→ current', cur);
  if (String(cur) !== want) errors.push(`weapon picker: tapped ${want}, current ${cur}`);
  await shot(page, 'phone-picker-selected');
  await ctx.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
