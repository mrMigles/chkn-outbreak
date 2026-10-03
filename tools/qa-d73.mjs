// D73 visual regressions: closed/open frosted room, roots, shortened flashlights (desktop + phone).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? 'docs/qa/d73';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
try {
  for (const mobile of [false, true]) {
    const ctx = await browser.newContext(mobile ? { ...devices['Pixel 7'], hasTouch: true } : { viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('chkn-settings', JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'], dev: true, devGod: true })));
    const open = async (level, x, y) => {
      await page.goto(`http://localhost:5280/?level=${level}&loop=timeout&nobackguard`);
      await page.waitForFunction(() => window.__game?.scene.getScene('game')?.session?.world);
      await page.waitForTimeout(3500);
      await page.evaluate(([x, y]) => {
        const sc = window.__game.scene.getScene('game'), w = sc.session.world, p = w.players[0];
        sc.introState = 'done'; sc.cineFocus = null; sc.introCaption?.remove(); document.getElementById('ui').classList.remove('cine-bars');
        p.x = p.input.x = x * 64; p.y = p.input.y = y * 64; p.tp++;
        w.cancelWaves(); w.enemies = [];
      }, [x, y]);
      await page.waitForTimeout(800);
    };
    const shot = async name => page.screenshot({ path: `${out}/${mobile ? 'phone' : 'desktop'}-${name}.png` });
    await open('office7', 11, 20.3);
    await shot('frost-closed');
    await page.evaluate(() => { const w = window.__game.scene.getScene('game').session.world; w.script.onUse(w, 'kink_button', w.players[0]); });
    await page.waitForTimeout(1200);
    assert.ok(await page.evaluate(() => window.__game.scene.getScene('game').session.world.doors.find(d => d.id === 'kink_door').open));
    await shot('frost-open');
    await open('office8', 12.5, 36.2);
    await page.evaluate(() => {
      const w = window.__game.scene.getScene('game').session.world, p = w.players[0];
      w.enemies = []; w.npcs = []; const e = w.spawnEnemy('normal', p.x + 120, p.y, { aggro: true });
      e.appearance = { npcId: 'vershkov', kind: 'vershkov', name: 'Вершков' }; e.hp = e.maxHp = 2000; e.blinkT = 0; e.abilityCd = 99; w.setBoss(e, 'Вершков · ботва-петух');
    });
    await page.waitForFunction(() => window.__game.scene.getScene('game').session.world.players[0].slowT > 0, null, { timeout: 10000 }).catch(async err => {
      console.log(await page.evaluate(() => { const w = window.__game.scene.getScene('game').session.world; return { rules: w.rules, time: w.time, p: w.players[0], e: w.enemies, los: w.enemies[0] && w.map.lineOfSight(w.players[0].x, w.players[0].y, w.enemies[0].x, w.enemies[0].y, false) }; })); throw err;
    });
    await shot('roots-held');
    await page.evaluate(() => {
      const w = window.__game.scene.getScene('game').session.world, p = w.players[0]; w.enemies = []; w.setLight(.99);
      p.x = p.input.x = 30.5 * 64; p.y = p.input.y = 26 * 64; p.tp++;
      const v = w.spawnEnemy('fast', p.x + 300, p.y, { aggro: false }); v.appearance = { npcId: 'valera', kind: 'valera', name: 'Валера' }; v.stunT = 99;
      w.setBoss(v, 'Петух Тёмной Темы · Валера'); window.__input = { aimX: p.x + 500, aimY: p.y };
    });
    await page.waitForTimeout(1000); await shot('valera-deep-dark');
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ errors, desktop: true, phone: true }, null, 2));
  console.log('PASS D73 desktop + phone screenshots, door opening, rooted player, no page errors');
} finally { await browser.close(); }
