// Phone HUD layout check (D55) at Samsung Galaxy S25 CSS sizes: portrait and landscape with the
// browser bars, plus full-screen landscape. Fills every HUD slot at once (objective, incident,
// notice, radio, tip, buffs, interact button) and fails on any overlap between them.
//   node tools/qa-phone.mjs [outDir]
import { chromium } from 'playwright';
import fs from 'node:fs';
const out = process.argv[2] ?? 'docs/qa/phone';
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
fs.mkdirSync(out, { recursive: true });
const UA = 'Mozilla/5.0 (Linux; Android 15; SM-S931B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
const sizes = [['port', 384, 740, 1], ['land', 832, 330, 1], ['land-full', 832, 384, 1], ['port-large', 384, 740, 1.15], ['land-large', 832, 330, 1.15]];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
for (const [name, width, height, scale] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2.8, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage();
  if (scale !== 1) await page.addInitScript((k) => localStorage.setItem('chkn-settings', JSON.stringify({ hudScale: k })), scale);
  page.on('pageerror', (e) => problems.push(`${name}: page error ${e}`));
  await page.goto(`${base}/?help=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.menu', { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}-menu.png` });
  await page.locator('[data-a="solo"]').click();
  await page.waitForSelector('.pause-menu .controls-panel', { timeout: 60000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-controls.png` });
  await page.locator('.pause-menu [data-a="resume"]').click();
  await page.waitForTimeout(8000);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('game'), w = s.session.world, p = w.players[0];
    s.hud.notice('🚨 Тревога на кухне', 'Стая через 3 секунды — отойдите к стене', 'danger');
    s.hud.radio('Галина (ресепшн)', 'Кто-нибудь! Я на ресепшене, их тут очень много!', 30);
    s.hud.toast('+ ПАТРОНЫ');
    p.buffs = { damage: 9, sprint: 6 };
    p.supplies.medkit = 2;
    w.incidents.push({ id: 'qa', kind: 'coffee', phase: 'ready', seconds: 3, left: 8, paused: false, x: p.x, y: p.y, group: 'x', hintShown: true, batches: 0, nextBatch: 99 });
    w.enemies.forEach(e => { e.aggro = true; }); w.spawnEnemy('normal', p.x - 1300, p.y + 200, { aggro: true });
    s.tutorial.queue.unshift('fat'); s.tutorial.gap = 0;
    const show = s.input2.showInteract.bind(s.input2);
    s.input2.showInteract = () => show('Петрович, за мной');
  });
  // D64: phase 1 — alert + radio + incident share the phone feed; a tip waits for them
  const measure = () => page.evaluate(() => {
    const sel = ['.hud-bonus', '.top-hp', '.top-score', '.hud-obj', '.hud-incident', '.hud-notice', '.hud-radio', '.tip-card', '.hud-effects', '.hud-weapon', '.hud-bottom', '.t-reload', '.t-interact', '.t-pause'];
    return sel.map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      if (cs.display === 'none' || r.width === 0 || r.height === 0) return null;
      // the phone feed clips what does not fit (D64): only the visible part counts
      const f = e.closest('.hud-feed')?.getBoundingClientRect();
      const y0 = f ? Math.max(r.y, f.y) : r.y, y1 = f ? Math.min(r.y + r.height, f.y + f.height) : r.y + r.height;
      return y1 - y0 < 2 ? null : { s, x: r.x, y: y0, w: r.width, h: y1 - y0 }; }).filter(Boolean);
  });
  await page.waitForTimeout(1500);
  if (await page.locator('.tip-card.in').count()) problems.push(`${name}: tip shown together with an alert/radio`);
  const phases = [await measure()];
  await page.screenshot({ path: `${out}/${name}-alerts.png` });
  // phase 2 — the alert and the radio end, the tip takes the feed
  await page.waitForFunction(() => !document.querySelector('.hud-notice.show'), null, { timeout: 15000 });
  await page.evaluate(() => { window.__game.scene.getScene('game').hud.radioTimer = 0; });
  await page.waitForSelector('.tip-card.in', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-game.png` });
  phases.push(await measure());
  const boxes = phases.flat();
  const vis = new Set(boxes.map((b) => b.s));
  for (const must of ['.hud-bonus', '.hud-obj', '.hud-incident', '.hud-radio', '.tip-card', '.hud-weapon', '.t-interact']) if (!vis.has(must)) problems.push(`${name}: ${must} not visible`);
  for (const ph of phases) for (let i = 0; i < ph.length; i++) for (let j = i + 1; j < ph.length; j++) {
    const a = ph[i], b = ph[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) problems.push(`${name}: ${a.s} overlaps ${b.s} (${Math.round(ox)}×${Math.round(oy)})`);
  }
  for (const b of boxes) if (b.x < 0 || b.y < 0 || b.x + b.w > width + 1 || b.y + b.h > height + 1) problems.push(`${name}: ${b.s} leaves the screen`);
  // the centre (player and nearest enemies) stays clear: nothing covers the middle third
  for (const b of boxes) {
    const cx0 = width / 3, cx1 = width * 2 / 3, cy0 = height * (scale > 1 ? 0.42 : 0.38), cy1 = height * 0.62; // around the player (a large HUD is the player's trade-off)
    if (b.x < cx1 && b.x + b.w > cx0 && b.y < cy1 && b.y + b.h > cy0) problems.push(`${name}: ${b.s} covers the centre`);
  }
  const arrows = await page.evaluate(() => [...document.querySelectorAll('.threat')].filter(e => e.style.display === 'block').length);
  if (!arrows) problems.push(`${name}: no off-screen threat arrow`);
  console.log(name, 'arrows', arrows, boxes.map((b) => `${b.s}@${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}`).join(' | '));
  await page.locator('.t-pause').dispatchEvent('touchstart');
  await page.waitForSelector('.pause-menu [data-a="settings"]');
  await page.screenshot({ path: `${out}/${name}-pause.png` });
  await page.locator('.pause-menu [data-a="settings"]').click();
  await page.waitForSelector('.pause-menu .preferences');
  await page.screenshot({ path: `${out}/${name}-settings.png` });
  await ctx.close();
}
await browser.close();
console.log(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'PASS phone layout: no overlaps, centre clear');
process.exit(problems.length ? 1 : 0);
