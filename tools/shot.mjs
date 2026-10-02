// Headless screenshot helper (WebGL via SwiftShader/ANGLE) for visual QA.
//   node tools/shot.mjs <url> <out.png> [waitMs] [js-to-run-after-load]
import { chromium } from 'playwright';
const [url, out, wait = '6000', js = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
await page.goto(url);
await page.waitForTimeout(2500);
if (js) console.log('js:', await page.evaluate(js));
await page.waitForTimeout(+wait);
console.log('renderer:', await page.evaluate(() => window.__game?.renderer?.type));
await page.screenshot({ path: out });
await browser.close();
