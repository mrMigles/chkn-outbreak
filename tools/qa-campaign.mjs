// E2E campaign autopilot: plays the real app (menus, HUD, guide arrow) level after level like a player would:
// walks along the objective arrow, shoots the nearest visible chicken (aiming at the head on screen),
// presses E at terminals/locked doors/allies, picks things up, and clicks «Дальше» between levels.
// Records per level: time, min HP, deaths/retries, stuck periods, page errors; screenshots every N seconds.
//   node tools/qa-campaign.mjs <outDir> [levels=office,lab,factory,boss] [mobile=0] [maxMinPerLevel=6] [god=0|1|arsenal]
//   god=arsenal starts with every weapon (a level tested alone, as if carried from the previous ones)
// Needs the client (npm run dev, SMOKE_URL) — or a production server serving dist (SMOKE_URL=http://localhost:2590).
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const [out = 'docs/qa/campaign', levelsArg = 'office,office7,lab,factory,boss', mobile = '0', maxMin = '6', god = '0'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = mobile === '1'
  ? await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true })
  : await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !/AudioContext|favicon/.test(m.text())) errors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
await page.addInitScript((g) => {
  try { const s = JSON.parse(localStorage.getItem('chkn-settings') || '{}'); s.tutorials = true; s.seenTips = []; s.dev = g !== '0'; s.devGod = g === '1'; s.devArsenal = g === 'arsenal'; localStorage.setItem('chkn-settings', JSON.stringify(s)); } catch {}
}, god);
const levels = levelsArg.split(',');

// autopilot inside the page (init script: survives reloads)
await page.addInitScript(() => {
  const qa = (window.__qa = { log: [], minHp: 100, deaths: 0, stuck: 0, lastPos: null, lastMoveT: performance.now(), level: '', t0: performance.now(), kills: 0, events: {} });
  let interactPulse = 0, wander = 0, wanderA = 0;
  setInterval(() => {
    const sc = window.__game?.scene.getScene('game');
    if (!sc?.session || !sc.scene.isActive()) { window.__input = {}; return; }
    const s = sc.session, v = s.view, me = v.players.find((p) => p.id === s.myId);
    if (!me) return;
    if (qa.level !== s.levelId) { qa.level = s.levelId; qa.t0 = performance.now(); qa.minHp = 100; }
    qa.minHp = Math.min(qa.minHp, me.hp);
    const px = sc.px, py = sc.py, map = s.map;
    // nearest visible enemy
    let best = null, bd = 1e9;
    for (const e of v.enemies) {
      if (e.state === 'rise') continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d < bd && d < 650 && map.lineOfSight(px, py, e.x, e.y, true)) { bd = d; best = e; }
    }
    const inp = { fire: false, mx: 0, my: 0, interact: false };
    // movement: along the guide arrow, else toward unexplored/target; kite when an enemy is close
    let ma = sc.guide?.hud ? sc.guide.hud.angle : null;
    if (best && bd < 150) ma = Math.atan2(py - best.y, px - best.x) + (Math.sin(performance.now() / 700) * 0.6);
    else if (best && bd < 380 && v.objectiveTarget.length === 0) ma = null; // defend: stand and shoot
    if (ma === null && !best) {
      // nothing to do: wander a bit so triggers fire
      wander -= 0.05; if (wander <= 0) { wander = 2 + Math.random() * 2; wanderA = Math.random() * Math.PI * 2; }
      ma = wanderA;
    }
    if (ma !== null) { inp.mx = Math.cos(ma); inp.my = Math.sin(ma); }
    // stuck detection: nudge sideways
    if (!qa.lastPos || Math.hypot(px - qa.lastPos.x, py - qa.lastPos.y) > 24) { qa.lastPos = { x: px, y: py }; qa.lastMoveT = performance.now(); }
    else if (ma !== null && performance.now() - qa.lastMoveT > 2500) {
      qa.stuck++; qa.lastMoveT = performance.now();
      wanderA = (ma ?? 0) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); wander = 1;
      qa.log.push(`stuck ${s.levelId} @${Math.round(px)},${Math.round(py)} obj="${v.objective}"`);
    }
    if (wander > 0 && ma !== null && performance.now() - qa.lastMoveT > 1200) { inp.mx = Math.cos(wanderA); inp.my = Math.sin(wanderA); }
    if (best) {
      const h = { normal: 102, fast: 94, fat: 120, spitter: 102, armored: 110, exploder: 102, boss: 173, chick: 30 }[best.type] ?? 100;
      inp.fire = true; inp.aimX = best.x; inp.aimY = best.y - (best.type === 'chick' ? 14 : h * 0.55);
    } else if (ma !== null) { inp.aimX = px + Math.cos(ma) * 200; inp.aimY = py - 36 + Math.sin(ma) * 200; }
    // E: terminals, locked doors with the key, NPCs to recruit, objective targets in reach
    interactPulse--;
    const near = (x, y, r) => Math.hypot(x - px, y - py) < r;
    let wantE = false;
    for (const o of map.objects) if (o.type === 'use' && near(o.cx, o.cy, 85)) wantE = true;
    for (const d of v.doors) if (!d.open && d.locked && me.keys.includes(d.locked) && near(d.x + d.w / 2, d.y + d.h / 2, 105)) wantE = true;
    for (const n of v.npcs) if (n.mode !== 'follow' && n.mode !== 'dead' && n.mode !== 'gone' && !n.mutation && (n.rescued || n.weapon || v.objectiveTarget.includes(n.id)) && near(n.x, n.y, 75)) wantE = true;
    if (me.hp < 45 && me.supplies.medkit && !best) { inp.interact = true; inp.mx = 0; inp.my = 0; }
    else if (wantE && interactPulse <= 0) { inp.interact = true; interactPulse = 8; }
    // reload when idle
    window.__input = inp;
  }, 50);
  const sc0 = () => window.__game?.scene?.getScene('game');
  const hook = () => {
    const sc = sc0();
    if (!sc?.handle || sc.__qaHooked) return;
    sc.__qaHooked = true;
    const o = sc.handle.bind(sc);
    sc.handle = (ev) => {
      qa.events[ev.e] = (qa.events[ev.e] ?? 0) + 1;
      if (ev.e === 'kill' && ev.by === sc.session.myId) qa.kills++;
      if (ev.e === 'down' && ev.id === sc.session.myId) { qa.deaths++; qa.log.push(`died ${sc.session.levelId} obj="${sc.session.view.objective}"`); }
      if (ev.e === 'obj') qa.log.push(`[${((performance.now() - qa.t0) / 1000).toFixed(0)}s] ${sc.session.levelId}: ${ev.text}`);
      if (ev.e === 'level') qa.log.push(`LEVEL DONE ${sc.session.levelId} → ${ev.next} in ${((performance.now() - qa.t0) / 1000).toFixed(0)}s minHp=${qa.minHp}`);
      o(ev);
    };
  };
  setInterval(hook, 300);
});
await page.goto(`${base}/?level=${levels[0]}&loop=timeout`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session, null, { timeout: 90000 });

const report = [];
let shot = 0;
const deadline = (min) => Date.now() + min * 60000;
const takeQa = () => page.evaluate(() => {
  const q = window.__qa ?? { log: [], minHp: 0, deaths: 0, stuck: 0, kills: 0 };
  const r = { log: q.log.splice(0), minHp: q.minHp, deaths: q.deaths, stuck: q.stuck, kills: q.kills };
  q.deaths = 0; q.stuck = 0; q.kills = 0; return r;
});
for (let li = 0; li < levels.length; li++) {
  const end = deadline(+maxMin);
  let done = false, retries = 0, completedQa;
  while (Date.now() < end && !done) {
    await page.waitForTimeout(5000);
    const st = await page.evaluate(() => {
      const panel = document.querySelector('.overlay.screen .panel');
      const txt = panel?.textContent ?? '';
      const sc = window.__game.scene.getScene('game');
      const v = sc?.session?.view, me = v?.players.find((p) => p.id === sc.session.myId);
      return { txt: txt.slice(0, 120), level: sc?.session?.levelId, obj: v?.objective, hp: me?.hp, enemies: v?.enemies.length, x: Math.round(sc?.px ?? 0), y: Math.round(sc?.py ?? 0) };
    });
    if (shot++ % 3 === 0) await page.screenshot({ path: `${out}/${levels[li]}-${String(shot).padStart(3, '0')}.png` });
    if (/ЭТАП ПРОЙДЕН|ПОБЕДА/.test(st.txt)) {
      done = true;
      completedQa = await takeQa();
      await page.screenshot({ path: `${out}/${levels[li]}-done.png` });
      const next = await page.$('button[data-a="next"]');
      if (next) { await next.click(); await page.waitForTimeout(3000); }
    } else if (/КО-КО-КОНЕЦ/.test(st.txt)) {
      retries++;
      await page.screenshot({ path: `${out}/${levels[li]}-gameover-${retries}.png` });
      await page.click('button[data-a="retry"]');
    }
    process.stdout.write(`${levels[li]} ${new Date().toISOString().slice(11, 19)} obj="${st.obj}" hp=${st.hp} e=${st.enemies} @${st.x},${st.y}${retries ? ' retries=' + retries : ''}\n`);
  }
  const qa = completedQa ?? await takeQa();
  report.push({ level: levels[li], done, retries, ...qa });
  console.log(JSON.stringify(report[report.length - 1], null, 1));
  if (!done) break;
}
fs.writeFileSync(`${out}/report.json`, JSON.stringify({ god, mobile, report, errors }, null, 2));
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
