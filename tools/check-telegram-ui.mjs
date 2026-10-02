// Telegram Mini App in a real browser: two phones open the game from the same chat (Telegram passes
// #tgWebAppData in the URL; the official SDK is loaded by the page) and land in one chat room with their
// Telegram names; a third player from another chat does not. Needs a server serving the build (npm start or
// the Docker image; SMOKE_URL, default http://localhost:2580) without TELEGRAM_BOT_TOKEN (unsigned dev data).
//   node tools/check-telegram-ui.mjs [outPrefix]
import { chromium, devices } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.SMOKE_URL ?? 'http://localhost:2580';
const out = process.argv[2];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const chat = 'ui' + Math.random().toString(36).slice(2, 8);
const errors = [];
async function phone(user, chatInstance) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const init = new URLSearchParams({ user: JSON.stringify(user), chat_instance: chatInstance, chat_type: 'supergroup', auth_date: String(Math.floor(Date.now() / 1000)), hash: 'dev' }).toString();
  const hash = new URLSearchParams({ tgWebAppData: init, tgWebAppVersion: '8.0', tgWebAppPlatform: 'android', tgWebAppThemeParams: '{}' }).toString();
  await page.goto(`${base}/#${hash}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  return page;
}
const lobbyOf = async (page) => {
  await page.waitForSelector('.code', { timeout: 150000 });
  return page.evaluate(() => ({ title: document.querySelector('.panel h2')?.textContent, code: document.querySelector('.code')?.textContent, players: [...document.querySelectorAll('.plist .pl b')].map((b) => b.textContent) }));
};
try {
  const a = await phone({ id: 9001, first_name: 'Аня', last_name: 'Петухова' }, chat);
  const la = await lobbyOf(a);
  assert.equal(la.title, 'КОМНАТА ЧАТА'); assert.match(la.code, /^T[A-Z]{3}$/);
  console.log('PASS Mini App opened from a chat goes straight to the chat room lobby', la.code);
  const b = await phone({ id: 9002, first_name: 'Борис' }, chat);
  const lb = await lobbyOf(b);
  assert.equal(lb.code, la.code);
  await a.waitForFunction(() => document.querySelectorAll('.plist .pl').length === 2, null, { timeout: 15000 });
  const names = (await lobbyOf(a)).players.join(' | ');
  assert.ok(names.includes('Аня П.') && names.includes('Борис'), names);
  console.log('PASS second member joins the same room; Telegram names in the lobby:', names);
  const c = await phone({ id: 9003, first_name: 'Вера' }, chat + 'other');
  const lc = await lobbyOf(c);
  assert.notEqual(lc.code, la.code);
  console.log('PASS a member of another chat gets another room');
  // host starts after the guest is ready: both are in the game
  await b.click('button[data-a="ready"]');
  await a.waitForSelector('button[data-a="start"]:not([disabled])', { timeout: 15000 });
  await a.click('button[data-a="start"]');
  for (const p of [a, b]) await p.waitForFunction(() => window.__game?.scene?.getScene('game')?.session?.view?.players?.length === 2, null, { timeout: 150000 });
  console.log('PASS the chat room starts a co-op game for both phones');
  if (out) { await a.waitForTimeout(3000); await a.screenshot({ path: out + '-tg-a.png' }); await b.screenshot({ path: out + '-tg-b.png' }); }
  assert.deepEqual(errors, []);
  console.log('PASS no page errors');
} finally {
  await browser.close();
}
