// D71 visual QA: level intro, mega-rooster boss, finale, jumper, minigun and laser, the phone weapon picker.
//   node tools/qa-d71.mjs [outDir=docs/qa/d71]
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const [out = 'docs/qa/d71'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const settings = (dev = true) => JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'], dev, devGod: true });
async function open(level, ctxOpts = { viewport: { width: 1280, height: 720 } }) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(level + ': ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/AudioContext|favicon/.test(m.text())) errors.push(level + ': ' + m.text().slice(0, 200)); });
  await page.addInitScript((s) => localStorage.setItem('chkn-settings', s), settings());
  await page.goto(`${base}/?level=${level}&loop=timeout`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session?.world, null, { timeout: 90000 });
  return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });

// level intro (nobody moves)
{ const { ctx, page } = await open('office7'); await page.waitForTimeout(2600); await shot(page, 'intro-office7'); await ctx.close(); }
// mega rooster + finale
{
  const { ctx, page } = await open('boss');
  await page.waitForTimeout(7000);
  await page.evaluate(() => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0], b = w.enemies.find(e => e.type === 'boss'); b.x = 18 * 64; b.y = 12 * 64; b.stunT = 5; p.x = p.input.x = b.x; p.y = p.input.y = b.y + 280; p.tp++; for (const e of [...w.enemies]) if (e !== b) w.killEnemy(e, 0, '', false, false); w.cancelWaves(); });
  await page.waitForTimeout(1200); await shot(page, 'boss-mega-rooster');
  await page.evaluate(() => { const w = window.__game.scene.getScene('game').session.world; const b = w.enemies.find(e => e.type === 'boss'); w.killEnemy(b, 0, w.players[0].id, false, false); });
  await page.waitForTimeout(2500); await shot(page, 'finale-cutscene');
  await page.waitForFunction(() => /ПОБЕДА/.test(document.querySelector('.overlay.screen .panel')?.textContent ?? ''), null, { timeout: 30000 });
  await page.waitForTimeout(800); await shot(page, 'finale-panel');
  await ctx.close();
}
// jumpers and the minigun
{
  const { ctx, page } = await open('street1');
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene('game'), w = sc.session.world, p = w.players[0];
    p.x = p.input.x = 30 * 64; p.y = p.input.y = 17 * 64; p.tp++;
    w.giveWeapon(p, 'minigun', true);
    for (let i = 0; i < 3; i++) w.spawnEnemy('jumper', p.x + 330 + i * 40, p.y - 60 + i * 60, { aggro: true });
  });
  await page.waitForTimeout(700); await shot(page, 'jumpers');
  await page.evaluate(() => { const p = window.__game.scene.getScene('game').session.world.players[0]; window.__input = { fire: true, slot: p.weapons.indexOf('minigun'), aimX: p.x + 300, aimY: p.y - 36 }; });
  await page.waitForTimeout(600); await shot(page, 'minigun'); await page.evaluate(() => { window.__input = {}; });
  await ctx.close();
}
// laser
{
  const { ctx, page } = await open('lab');
  await page.evaluate(() => {
    const sc = window.__game.scene.getScene('game'), w = sc.session.world, p = w.players[0];
    w.giveWeapon(p, 'laser', true);
    for (let i = 0; i < 4; i++) w.spawnEnemy('normal', p.x + 200 + i * 70, p.y, { aggro: false });
    window.__input = { fire: true, slot: p.weapons.indexOf('laser'), aimX: p.x + 400, aimY: p.y - 36 };
  });
  await page.waitForTimeout(4200); await shot(page, 'laser'); await page.evaluate(() => { window.__input = {}; });
  await ctx.close();
}
// phone: hold the weapon panel → picker
{
  const { ctx, page } = await open('office7', { ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  await page.evaluate(() => { const w = window.__game.scene.getScene('game').session.world, p = w.players[0]; w.devArsenal(p); });
  await page.waitForTimeout(1500);
  const box = await page.locator('.hud-weapon').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const pt = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
  await page.waitForTimeout(600);
  await shot(page, 'phone-weapon-picker');
  const items = await page.locator('.weapon-picker .wp-item').count();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('picker items:', items);
  if (items < 2) errors.push('weapon picker did not open');
  await ctx.close();
}
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
