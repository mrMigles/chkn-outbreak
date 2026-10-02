// Telegram «чат — это комната» against a running server (npm run server; no TELEGRAM_BOT_TOKEN → initData is
// trusted, as in development). Also checks the bot's game-button answer produces a link the server accepts.
//   npm run check:telegram
import assert from 'node:assert/strict';
import { Client, type Room } from 'colyseus.js';
import { makeGameToken, codeForChat, checkInitData } from '../server/telegram';

const WS = process.env.TEST_SERVER ?? 'ws://localhost:2580';
const HTTP = WS.replace(/^ws/, 'http');
let checks = 0;
const pass = (name: string) => { checks++; console.log('PASS', name); };
const initData = (user: object, extra: Record<string, string>) => new URLSearchParams({ user: JSON.stringify(user), auth_date: String(Math.floor(Date.now() / 1000)), ...extra }).toString();
async function session(path: string, body: object) {
  const r = await fetch(HTTP + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
}
const rooms: Room[] = [];
try {
  const chat = 'chk' + Math.random().toString(36).slice(2, 8);
  const a = await session('/api/tg/session', { initData: initData({ id: 101, first_name: 'Аня', last_name: 'Курицына' }, { chat_instance: chat }) });
  const b = await session('/api/tg/session', { initData: initData({ id: 202, first_name: 'Борис' }, { chat_instance: chat }) });
  assert.equal(a.status, 200); assert.equal(b.status, 200);
  assert.equal(a.body.code, b.body.code); assert.match(a.body.code, /^T[A-Z]{3}$/);
  assert.equal(a.body.name, 'Аня К.');
  pass('two members of one chat get the same room code and their Telegram names');

  const other = await session('/api/tg/session', { initData: initData({ id: 303, first_name: 'Вера' }, { chat_instance: chat + 'x' }) });
  assert.notEqual(other.body.code, a.body.code);
  pass('another chat gets another room');

  const client = new Client(WS);
  const ra = await client.joinById(a.body.code, { name: a.body.name }); rooms.push(ra);
  const rb = await client.joinById(b.body.code, { name: b.body.name }); rooms.push(rb);
  for (const r of [ra, rb]) { r.onMessage('snap', () => {}); r.onMessage('ev', () => {}); r.onMessage('start', () => {}); }
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(ra.roomId, rb.roomId); assert.equal(ra.state.players.size, 2);
  assert.equal(ra.state.chat, 'Чат');
  pass('both join the chat room (pre-created by the server) and see each other in its lobby');

  // the bot's «Играть» answer: a signed link for the same chat_instance lands in the same room
  // (needs the server's SESSION_SECRET: CI starts the server with the same value)
  if (process.env.SESSION_SECRET) {
  const token = makeGameToken({ c: 'ci' + chat, u: 404, n: 'Гоша', t: Math.floor(Date.now() / 1000) });
  const g = await session('/api/tg/game', { token });
  assert.equal(g.status, 200); assert.equal(g.body.code, a.body.code); assert.equal(g.body.code, codeForChat('ci' + chat));
  const bad = await session('/api/tg/game', { token: token.slice(0, -2) + 'xx' });
  assert.equal(bad.status, 403);
  pass('game-button links: signed link joins the chat room, a forged one is refused');
  } else console.log('SKIP game-button links (set SESSION_SECRET for this check and the server)');

  // initData signature (as with TELEGRAM_BOT_TOKEN set): verified in-process with a known token
  assert.ok(checkInitData(initData({ id: 1 }, {})), 'dev mode trusts initData without a bot token');
  pass('development without a bot token accepts initData');
  console.log(`${checks} Telegram checks passed`);
} finally {
  for (const r of rooms) await r.leave(true).catch(() => {});
}
process.exit(0);
