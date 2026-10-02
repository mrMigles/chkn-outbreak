// Screenshots of the main menu and the character editor (incl. a click-through of options).
//   node tools/qa-menu.mjs <outPrefix> [w] [h]
import { chromium } from 'playwright';
const [out = 'docs/qa/v2/menu', w = '1280', h = '720'] = process.argv.slice(2);
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base);
await page.waitForSelector('.me-card', { timeout: 30000 });
await page.screenshot({ path: `${out}-main.png` });
await page.click('[data-a=look]');
await page.waitForSelector('.editor');
await page.click('[data-body=f]');
await page.click('[data-cyc=hair][data-d="1"]');
await page.click('.sw[data-k=hairColor] >> nth=7');
await page.click('.sw[data-k=topColor] >> nth=4');
await page.screenshot({ path: `${out}-editor.png` });
await page.click('[data-a=mut]');
await page.screenshot({ path: `${out}-editor-mut.png` });
await page.click('[data-a=save]');
await page.waitForSelector('.me-card');
console.log('saved look:', await page.evaluate(() => JSON.parse(localStorage.getItem('chkn-settings')).look));
if (errors.length) console.log('ERRORS', errors.join('\n'));
await browser.close();
