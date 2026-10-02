// Smoke test: load every level in headless Chromium (WebGL), auto-fight for a while, report errors & fps.
//   node tools/smoke.mjs [seconds]
import { chromium } from 'playwright';
const secs = +(process.argv[2] ?? 12);
const baseUrl = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
for (const level of ['arena', 'office', 'office7', 'lab', 'factory', 'boss']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${baseUrl}/?level=${level}`);
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    const w = __game.scene.getScene('game').session.world;
    const p = w.players[0]; p.hp = p.maxHp = 1e6;
    for (const k of ['smg', 'shotgun', 'machinegun', 'grenade']) w.giveWeapon(p, k, false);
    let t = 0;
    setInterval(() => {
      t++;
      const pl = w.players[0]; let best = null, bd = 1e9;
      for (const e of w.enemies) { if (!w.map.lineOfSight(pl.x, pl.y, e.x, e.y)) continue; const d = Math.hypot(e.x - pl.x, e.y - pl.y); if (d < bd) { bd = d; best = e; } }
      const slot = Math.floor(t / 150) % pl.weapons.length;
      window.__input = best ? { fire: true, aimX: best.x, aimY: best.y - __game.scene.getScene('game').elevation, slot, mx: Math.sin(t / 40), my: Math.cos(t / 55) } : { fire: false, slot, mx: Math.sin(t / 40), my: Math.cos(t / 55) };
    }, 30);
  });
  await page.waitForTimeout(secs * 1000);
  const info = await page.evaluate(() => {
    const w = __game.scene.getScene('game').session.world;
    return { fps: Math.round(__game.loop.actualFps), kills: w.players[0].kills, enemies: w.enemies.length, objective: w.objective };
  });
  console.log(level.padEnd(8), JSON.stringify(info), errors.length ? 'ERRORS: ' + errors.slice(0, 3).join(' | ') : 'ok');
  if (errors.length) failed++;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
