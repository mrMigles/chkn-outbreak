// D74 visual QA: almost opaque frosted glass, closed/open door (desktop + phone).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out = process.argv[2] ?? 'docs/qa/d74';
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
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/report.json`, JSON.stringify({ errors, desktop: true, phone: true }, null, 2));
  console.log('PASS D74 opaque frost on desktop and phone, opens cleanly, no page errors');
} finally { await browser.close(); }

