// Phone layout QA: main menu, DEV box, in-game HUD with touch sticks, pause menu (landscape + portrait).
//   node tools/qa-mobile.mjs <outPrefix>
import { chromium, devices } from 'playwright';
const [out = 'mobile'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, vp] of [['land', { width: 915, height: 412 }], ['port', { width: 412, height: 915 }], ['small', { width: 740, height: 360 }]]) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: vp, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ': ' + e));
  await page.goto(`${base}/?dev=1`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.menu', { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}-${name}-menu.png` });
  await page.goto(`${base}/?level=office&loop=timeout`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session, null, { timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}-${name}-game.png` });
  // overlap report: HUD elements' boxes
  const boxes = await page.evaluate(() => [...document.querySelectorAll('.hud > div, .touch-ui *, .tut-card, .dev-hud')].filter((e) => e.offsetParent && e.getBoundingClientRect().width > 0)
    .map((e) => { const r = e.getBoundingClientRect(); return { c: e.className.toString().slice(0, 30), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }));
  console.log(name, JSON.stringify(boxes));
  await ctx.close();
}
console.log('errors', errors.length ? errors : 'none');
await browser.close();
