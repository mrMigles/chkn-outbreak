// QA: close-ups of the local player holding a weapon in 8 aim directions (idle + walking).
//   node tools/qa-gun.mjs <outPrefix> [look] [level]
import { chromium } from 'playwright';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fs from 'node:fs';
const [out = 'gun', look = 'f.0.curly.d36ba0.tee.6d8b4e.skirt.6d2f35.glasses', level = 'arena'] = process.argv.slice(2);
const URL = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript((l) => { try { const s = JSON.parse(localStorage.getItem('chkn-settings') || '{}'); s.look = l; s.tutorial = false; localStorage.setItem('chkn-settings', JSON.stringify(s)); } catch {} }, look);
await page.goto(`${URL}/?level=${level}`);
await page.waitForTimeout(5000);
const angles = [0, 0.8, 1.57, 2.4, 3.14, -2.4, -1.57, -0.8];
const shots = [];
for (const walk of [0, 1]) for (const a of angles) {
  const box = await page.evaluate(([a, walk]) => {
    const s = window.__game.scene.scenes.find((q) => q.px !== undefined && q.px);
    const w = s.session.world; if (w) { w.enemies.length = 0; w.players[0].hp = 100; }
    s.baseZoom = 3;
    window.__input = { aimX: s.px + Math.cos(a) * 160, aimY: s.py - 36 + Math.sin(a) * 160, mx: walk ? (a > 1.6 || a < -1.6 ? 0.4 : -0.4) : 0, my: 0 };
    return null;
  }, [a, walk]);
  await page.waitForTimeout(walk ? 230 : 400);
  const r = await page.evaluate(() => {
    const s = window.__game.scene.scenes.find((q) => q.px !== undefined && q.px), cam = s.cameras.main, c = document.querySelector('canvas').getBoundingClientRect();
    const k = c.width / s.scale.width;
    return { x: c.x + (s.px - cam.worldView.x) * cam.zoom * k, y: c.y + (s.py - cam.worldView.y) * cam.zoom * k, z: cam.zoom * k };
  });
  const w = 90 * r.z, h = 130 * r.z;
  const file = `${out}_${shots.length}.png`;
  await page.screenshot({ path: file, clip: { x: Math.max(0, r.x - w / 2), y: Math.max(0, r.y - h + 12 * r.z), width: w, height: h } });
  shots.push(file);
}
const imgs = await Promise.all(shots.map((f) => loadImage(f)));
const cw = imgs[0].width, ch = imgs[0].height, sheet = createCanvas(cw * 8, ch * 2), g = sheet.getContext('2d');
imgs.forEach((im, i) => g.drawImage(im, (i % 8) * cw, Math.floor(i / 8) * ch));
fs.writeFileSync(`${out}_sheet.png`, sheet.toBuffer('image/png'));
shots.forEach((f) => fs.unlinkSync(f));
console.log('sheet', `${out}_sheet.png`);
await browser.close();
