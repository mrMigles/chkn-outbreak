// Micro-probe: runs actions in the live game scene and reports the following frames' durations.
//   node tools/qa-probe.mjs
import { chromium } from 'playwright';
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}/?level=lab&loop=timeout`);
await page.waitForFunction(() => window.__game?.scene?.getScene('game')?.session, null, { timeout: 30000 });
await page.waitForTimeout(3000);
const probe = (label, code) => page.evaluate(async ([label, code]) => {
  const sc = window.__game.scene.getScene('game');
  const frames = [];
  let last = performance.now();
  await new Promise((ok) => { let n = 0; const f = (t) => { frames.push(Math.round(t - last)); last = t; if (++n < 2) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
  const t0 = performance.now();
  new Function('sc', code)(sc);
  const js = performance.now() - t0;
  frames.length = 0; last = performance.now();
  await new Promise((ok) => { let n = 0; const f = (t) => { frames.push(Math.round(t - last)); last = t; if (++n < 6) requestAnimationFrame(f); else ok(); }; requestAnimationFrame(f); });
  return `${label}: js ${js.toFixed(1)}ms, frames ${frames.join(' ')}`;
}, [label, code]);
console.log(await probe('noop', ''));
console.log(await probe('say', "sc.say(sc.session.myId, 'Проверка пузыря с текстом подлиннее', 2)"));
console.log(await probe('say2', "sc.say(sc.session.myId, 'Ещё одна реплика', 2)"));
console.log(await probe('text', "sc.add.text(sc.px, sc.py, 'test', { fontSize: '12px' })"));
console.log(await probe('fx.kill', "sc.fx.kill('normal', sc.px + 50, sc.py, 0, false, false, undefined, 30)"));
console.log(await probe('fx.boom', "sc.fx.boom(sc.px + 80, sc.py, 150, 'exploder')"));
console.log(await probe('new mut look', "const L = window.__looks; sc.add.image(sc.px, sc.py, 'office25', 'crate')"));
await browser.close();
