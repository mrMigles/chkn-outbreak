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
const sizes = [['port', 384, 740], ['land', 832, 330], ['land-full', 832, 384]];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];
for (const [name, width, height] of sizes) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2.8, isMobile: true, hasTouch: true, userAgent: UA });
  const page = await ctx.newPage();
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
    s.tutorial.queue.unshift('fat'); s.tutorial.gap = 0;
    const show = s.input2.showInteract.bind(s.input2);
    s.input2.showInteract = () => show('Петрович, за мной');
  });
  await page.waitForSelector('.tip-card.in', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-game.png` });
  const boxes = await page.evaluate(() => {
    const sel = ['.top-hp', '.top-score', '.hud-obj', '.hud-incident', '.hud-notice', '.tip-card', '.hud-effects', '.hud-weapon', '.hud-bottom', '.t-reload', '.t-interact', '.t-pause'];
    return sel.map((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
      return cs.display === 'none' || r.width === 0 || r.height === 0 ? null : { s, x: r.x, y: r.y, w: r.width, h: r.height }; }).filter(Boolean);
  });
  const vis = new Set(boxes.map((b) => b.s));
  for (const must of ['.hud-obj', '.hud-incident', '.hud-notice', '.tip-card', '.hud-weapon', '.hud-bottom', '.t-interact']) if (!vis.has(must)) problems.push(`${name}: ${must} not visible`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) problems.push(`${name}: ${a.s} overlaps ${b.s} (${Math.round(ox)}×${Math.round(oy)})`);
  }
  for (const b of boxes) if (b.x < 0 || b.y < 0 || b.x + b.w > width + 1 || b.y + b.h > height + 1) problems.push(`${name}: ${b.s} leaves the screen`);
  // the centre (player and nearest enemies) stays clear: nothing covers the middle third
  for (const b of boxes) {
    const cx0 = width / 3, cx1 = width * 2 / 3, cy0 = height * 0.38, cy1 = height * 0.62; // around the player
    if (b.x < cx1 && b.x + b.w > cx0 && b.y < cy1 && b.y + b.h > cy0) problems.push(`${name}: ${b.s} covers the centre`);
  }
  console.log(name, boxes.map((b) => `${b.s}@${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}`).join(' | '));
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
