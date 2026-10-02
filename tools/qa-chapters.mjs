// D69 visual QA of the new floors: loads each level in a headless WebGL browser, teleports the player to
// interesting spots (and runs a few script beats: the breaker, lunch and the helicopter), takes screenshots.
//   node tools/qa-chapters.mjs [outDir=docs/qa/chapters] [levels=office8,office11,cafe12,street1,street2] [w=1280] [h=720]
import { chromium } from 'playwright';
import fs from 'node:fs';
const [out = 'docs/qa/chapters', levelsArg = 'office8,office11,cafe12,street1,street2', vw = '1280', vh = '720'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
fs.mkdirSync(out, { recursive: true });
const T = 64;
/** [label, x, y (tiles), aim (rad), js beat to run first] */
const SPOTS = {
  office8: [['lobby', 31.5, 39.5, -1.6], ['west-sleepers', 12, 22, -1.6], ['lever-w', 5.5, 6, -1.7], ['east', 52, 18, -1.2],
    ['den-call', 30.5, 13.5, -1.6, 'beat:door'], ['breaker', 33.5, 5, -1.2, 'beat:breaker'], ['valera-dark', 30.5, 13.5, -1.6, 'wait:4'], ['lights', 30.5, 13, -1.6, 'beat:killvalera']],
  office11: [['lift-hall', 32.5, 6, 1.6], ['reception', 32.5, 15.5, -1.6], ['finance', 11, 14, -1.6], ['hr', 52, 9, 0], ['archive', 11, 38, -1.6], ['boardroom', 32.5, 38, -1.6, 'beat:meeting'], ['director', 50, 36, -1, 'beat:director']],
  cafe12: [['arrival', 29, 7, 3.1], ['table', 16.5, 8.2, -1.6, 'beat:lunch'], ['heli', 16.5, 8.2, -1.6, 'wait:25'], ['heli2', 16.5, 8.2, -1.6, 'wait:3'], ['after', 16.5, 8.2, -1.6, 'wait:4']],
  street1: [['forecourt', 11, 8, 1.6], ['avenue', 30, 17, 0], ['kiosk', 55, 15.5, -1.6], ['park', 12, 31, -1.6], ['square', 62, 38, -1.6], ['south', 42, 45, 1.6]],
  street2: [['arrival', 42, 5, 1.6], ['market', 20, 16, -1.6], ['park', 20, 40, 0], ['yard', 55, 42, 0], ['garage', 76, 37, -1.6], ['gate', 60, 50, 1.6]],
};
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const level of levelsArg.split(',')) {
  const page = await browser.newPage({ viewport: { width: +vw, height: +vh } });
  page.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|favicon/.test(m.text())) errors.push(level + ': ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push(level + ': ' + String(e).slice(0, 300)));
  await page.addInitScript(() => { try { localStorage.setItem('chkn-settings', JSON.stringify({ tutorials: false, seenTips: ['controls', 'move'], dev: true, devGod: true })); } catch { /* */ } });
  await page.goto(`${base}/?level=${level}&loop=timeout`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session?.world, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  for (const [name, x, y, aim, beat] of SPOTS[level] ?? []) {
    const wait = beat?.startsWith('wait:') ? +beat.slice(5) * 1000 : 0;
    await page.evaluate(({ x, y, aim, beat }) => {
      const sc = window.__game.scene.getScene('game'), w = sc.session.world, p = w.players[0];
      w.god = true;
      if (!beat?.startsWith('wait:')) { p.x = p.input.x = x; p.y = p.input.y = y; p.tp++; }
      window.__input = { aimX: p.x + Math.cos(aim) * 200, aimY: p.y - 36 + Math.sin(aim) * 200 };
      const use = (id) => w.script.onUse?.(w, id, p);
      if (beat === 'beat:door') { w.flags.lock_w_t = w.time; w.script.onUse(w, 'lock_e', p); }
      if (beat === 'beat:breaker') { w.flags.denSeen = true; use('breaker'); }
      if (beat === 'beat:killvalera') { const v = w.enemies.find(e => e.appearance?.npcId === 'valera'); if (v) w.killEnemy(v, 0, p.id, false, false); }
      if (beat === 'beat:meeting') { for (const k of ['visa_fin', 'visa_hr', 'visa_law']) p.keys.push(k); w.flags.metZhanna = true; w.script.onNpcUse(w, w.npc('zhanna'), p); }
      if (beat === 'beat:director') { w.flags.meetingEnd = w.time; }
      if (beat === 'beat:lunch') use('lunch');
    }, { x: x * 64, y: y * 64, aim, beat });
    await page.waitForTimeout(wait || 1800);
    await page.screenshot({ path: `${out}/${level}-${name}.png` });
    process.stdout.write(`${level}-${name} `);
  }
  await page.close();
}
console.log('\nerrors:', errors.length ? errors : 'none');
await browser.close();
void T;
