// D66: screenshots of the new floor-6 scenes in solo (Vite dev server, SMOKE_URL): corridor coworkers turning and
// the lift-hall «планёрка».   node tools/qa-floor6.mjs
import { chromium } from 'playwright';
const base = process.env.SMOKE_URL ?? 'http://localhost:5280', out = 'docs/qa/floor6';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('chkn-settings', JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'] })); } catch {} });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/?level=office&loop=timeout', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__game?.scene.isActive('game'), null, { timeout: 90000 });
  const W = 'window.__game.scene.getScene("game").session.world';
  await page.evaluate(`(() => { const w = ${W}; w.god = true; })()`);
  await page.waitForTimeout(11000);
  await page.evaluate(`(() => { const w = ${W}; for (const e of [...w.enemies]) w.damageEnemy(e, 99999, 0, 0, 'me', 'bullet'); const p = w.players[0]; p.x = p.input.x = 20 * 64; p.y = p.input.y = 15.5 * 64; p.tp++; })()`);
  await page.waitForTimeout(3200);
  await page.screenshot({ path: `${out}/corridor-turning.png` });
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `${out}/corridor-turned.png` });
  await page.evaluate(`(() => { const w = ${W}; for (const e of [...w.enemies]) w.damageEnemy(e, 99999, 0, 0, 'me', 'bullet'); w.flags.osClear = true; w.flags.petrovich = true; w.players[0].keys.push('server'); w.script.onUse(w, 'reboot', w.players[0]); w.after(41.5, () => { const p = w.players[0]; p.x = p.input.x = 53.5 * 64; p.y = p.input.y = 11.6 * 64; p.tp++; }); })()`);
  await page.waitForFunction(`(() => { const w = ${W}; for (const e of [...w.enemies]) if (!w.npc('coach')) w.damageEnemy(e, 99999, 0, 0, 'me', 'bullet'); return !!w.npc('coach'); })()`, null, { timeout: 70000, polling: 500 });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${out}/lift-meeting.png` });
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${out}/lift-meeting-turned.png` });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS floor-6 scenes captured in', out);
} finally { await browser.close(); }
