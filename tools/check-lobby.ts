// D58–D62 end-to-end against a real server process (started here, own port and save folder) and a fake
// Telegram Bot API: lobby host election, profile changes, continue vs new game, a closed tab coming back to
// its seat, another window taking the seat over, dead seats waiting for the next floor, joining a running
// floor, «Призвать чат», sharing rare achievements, /install, delta snapshots and PWA files.
//   npm run check:lobby            (npm run build first for the PWA file checks)
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { Client, type Room } from 'colyseus.js';
import { mergeSnapshot, type Snapshot } from '../src/shared/protocol';

const PORT = Number(process.env.LOBBY_TEST_PORT || 2591), TG_PORT = PORT + 1;
const BOT = '4242:lobby-check';
const HTTP = `http://127.0.0.1:${PORT}`;
const client = new Client(`ws://127.0.0.1:${PORT}`);
const dir = path.resolve('data/qa-lobby');
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => unknown, label: string, timeout = 12000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out: ' + label); await pause(30); }
}
let checks = 0;
const pass = (s: string) => { checks++; console.log('PASS', s); };

// ---------------------------------------------------------------- fake Telegram Bot API
const sent: { method: string; body: any }[] = [];
const updates: any[] = [];
const tg = http.createServer((req, res) => {
  let d = '';
  req.on('data', c => { d += c; });
  req.on('end', async () => {
    const method = (req.url ?? '').split('?')[0].split('/').pop()!;
    if (method === 'getUpdates') {
      const batch = updates.splice(0);
      if (!batch.length) await pause(300);
      res.end(JSON.stringify({ ok: true, result: batch }));
      return;
    }
    let body: any = {};
    try { body = JSON.parse(d || '{}'); } catch { /* ignore */ }
    sent.push({ method, body });
    res.end(JSON.stringify({ ok: true, result: { message_id: sent.length } }));
  });
});
await new Promise<void>(r => tg.listen(TG_PORT, '127.0.0.1', () => r()));

// ---------------------------------------------------------------- game server
fs.rmSync(dir, { recursive: true, force: true });
let server: ChildProcess | undefined, log = '';
async function start() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--debug'], {
    env: { ...process.env, PORT: String(PORT), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: BOT, TELEGRAM_API: `http://127.0.0.1:${TG_PORT}`, TELEGRAM_POLL: '1',
      PUBLIC_URL: 'https://chkn.example', SESSION_SECRET: 'lobby-check', CHKN_RECONNECT_S: '2', CHKN_SUMMON_COOLDOWN_MS: '1500' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout?.on('data', c => { log += c; }); server.stderr?.on('data', c => { log += c; });
  const deadline = Date.now() + 20000;
  for (;;) {
    try { if ((await fetch(HTTP + '/healthz')).ok) return; } catch { /* starting */ }
    if (Date.now() > deadline) throw new Error('Server startup failed: ' + log);
    await pause(80);
  }
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise<void>(resolve => server!.once('exit', () => resolve()));
  server.kill('SIGTERM'); await stopped; server = undefined;
}

// ---------------------------------------------------------------- client helpers
const rooms: Room[] = [];
const snaps = new Map<string, Snapshot & { kf?: 1 }>();
const raw = new Map<string, (Snapshot & { kf?: 1 })[]>();
const inbox = new Map<string, { type: string; m: any }[]>();
function bind(r: Room) {
  rooms.push(r);
  const box: { type: string; m: any }[] = []; inbox.set(r.sessionId, box);
  r.onMessage('snap', (s: Snapshot & { kf?: 1 }) => {
    (raw.get(r.sessionId) ?? raw.set(r.sessionId, []).get(r.sessionId)!).push(s);
    snaps.set(r.sessionId, mergeSnapshot(snaps.get(r.sessionId), s));
  });
  for (const t of ['start', 'end', 'ev', 'lobby', 'replaced', 'summoned', 'shared']) r.onMessage(t, (m) => box.push({ type: t, m }));
  return r;
}
const got = (r: Room, type: string) => inbox.get(r.sessionId)?.filter(x => x.type === type) ?? [];
const me = (r: Room) => snaps.get(r.sessionId)?.p.find(p => p.id === r.sessionId);
const seen = (r: Room, id: string) => snaps.get(r.sessionId)?.p.find(p => p.id === id);
const lobbyOf = (r: Room, id = r.sessionId) => r.state.players.get(id);
const join = async (code: string, name: string, pid: string, extra: object = {}) => bind(await client.joinById(code, { name, pid, ...extra }));
const signed = (fields: Record<string, string>) => {
  const p = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), ...fields });
  const data = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const key = crypto.createHmac('sha256', 'WebAppData').update(BOT).digest();
  p.set('hash', crypto.createHmac('sha256', key).update(data).digest('hex'));
  return p.toString();
};
const post = async (url: string, body: object) => { const r = await fetch(HTTP + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
const input = (r: Room, x: number, y: number, seq = 1) => r.send('input', { seq, x, y, aim: 0, fire: false, reload: false, interact: false, weapon: 0 });

try {
  await start();

  // ---- D58 lobby: host election, profile, readiness is only a hint
  const a = bind(await client.create('game', { name: 'Аня', pid: 'pid-anya-0001', level: 'office' }));
  const code = a.roomId;
  const b = await join(code, 'Боря', 'pid-bora-0002');
  await until(() => a.state.players.size === 2, 'two in lobby');
  assert.equal(lobbyOf(a)!.host, true); assert.equal(lobbyOf(a, b.sessionId)!.host, false);
  const LOOK = 'f.1.bob.c2452d.blouse.6d8b4e.skirt.3b4f7a.glasses';
  b.send('profile', { look: LOOK, name: 'Борис', ach: 7 });
  await until(() => lobbyOf(a, b.sessionId)?.look === LOOK, 'look change reaches the host');
  assert.equal(lobbyOf(a, b.sessionId)!.name, 'Борис'); assert.equal(lobbyOf(a, b.sessionId)!.ach, 7);
  b.send('profile', { look: 'not a look' }); await until(() => lobbyOf(a, b.sessionId)?.look === '', 'invalid look falls back to slot default');
  pass('lobby: first player hosts; portraits (look), names and achievement counts update for everyone');

  await a.leave(true);
  await until(() => lobbyOf(b)?.host, 'host transfer on leave');
  const a2 = await join(code, 'Аня', 'pid-anya-0001');
  await until(() => b.state.players.size === 2, 'Аня back');
  assert.equal(lobbyOf(a2)!.host, false, 'returning player does not take leadership back');
  b.connection.close();
  await until(() => lobbyOf(a2)?.host === true, 'host moves when the host drops', 4000);
  await until(() => !a2.state.players.get(b.sessionId), 'dropped host leaves the lobby after the reconnection window', 6000);
  pass('host = earliest connected player; leadership moves at once when the host leaves or drops');

  // ---- continue vs new game
  const c = await join(code, 'Вера', 'pid-vera-0003');
  a2.send('start', { fresh: true });
  await until(() => a2.state.phase === 'playing' && me(a2) && me(c), 'playing office');
  const kf = raw.get(c.sessionId)!.find(s => s.kf);
  assert.ok(kf && kf.p.every(p => typeof p.name === 'string'), 'a keyframe with names after joining');
  await until(() => (raw.get(c.sessionId)?.length ?? 0) > 6, 'some deltas');
  const delta = raw.get(c.sessionId)!.slice(-3).find(s => !s.kf);
  assert.ok(delta && delta.p.every(p => p.look === undefined && p.weapons === undefined), 'deltas omit unchanged sticky fields');
  assert.ok(JSON.stringify(delta).length < JSON.stringify(snaps.get(c.sessionId)).length);
  pass(`delta snapshots: keyframe on join, unchanged names/looks/inventories omitted (${JSON.stringify(delta).length} vs ${JSON.stringify(snaps.get(c.sessionId)).length} bytes)`);

  a2.send('debug', { cmd: 'finish' });
  await until(() => a2.state.saved === 'office7', 'floor 7 saved after finishing floor 6', 10000);
  await until(() => a2.state.phase === 'playing' && a2.state.level === 'office7', 'floor 7 starts', 12000);
  a2.send('debug', { cmd: 'down' }); c.send('debug', { cmd: 'down' });
  await until(() => a2.state.phase === 'defeat', 'team wipe', 25000);
  a2.send('lobby');
  await until(() => a2.state.phase === 'lobby', 'host takes the team back to the lobby');
  assert.equal(a2.state.saved, 'office7', 'defeat → lobby keeps the save to continue');
  a2.send('start', { fresh: false });
  await until(() => a2.state.phase === 'playing' && a2.state.level === 'office7', 'continue = floor 7');
  pass('lobby: «Продолжить» resumes the saved floor (7) after defeat → lobby');

  // ---- D59: a closed tab keeps its seat; the same person reclaims it, another window takes it over
  snaps.delete(a2.sessionId); snaps.delete(c.sessionId);
  await until(() => me(a2) && me(c), 'snapshots on floor 7');
  const target = { x: me(c)!.x! + 90, y: me(c)!.y! - 60 };
  input(c, target.x, target.y);
  await until(() => Math.hypot(me(c)!.x! - target.x, me(c)!.y! - target.y) < 6, 'Вера moved');
  const before = { x: me(c)!.x!, y: me(c)!.y!, slot: me(c)!.slot };
  const oldId = c.sessionId;
  c.connection.close(); // the tab is closed: no «Выйти»
  await until(() => !a2.state.players.get(oldId), 'lobby entry gone after the reconnection window', 8000);
  await until(() => seen(a2, oldId)?.connected === false, 'seat still in the world, disconnected');
  const c2 = await join(code, 'Вера', 'pid-vera-0003');
  await until(() => me(c2), 'Вера back');
  assert.equal(me(c2)!.slot, before.slot);
  assert.ok(Math.hypot(me(c2)!.x! - before.x, me(c2)!.y! - before.y) < 10, 'same position');
  assert.ok(!seen(a2, oldId), 'old connection id gone');
  assert.ok(got(c2, 'start').length, 'returning player is sent straight into the floor');
  pass('closed tab: after the reconnection window the seat waits; same player id → same slot and position');

  const c3 = await join(code, 'Вера', 'pid-vera-0003');
  await until(() => got(c2, 'replaced').length, 'old window told it was replaced');
  await until(() => me(c3), 'new window plays');
  await until(() => !c2.connection.isOpen, 'old window closed by the server');
  assert.equal(me(c3)!.slot, before.slot); assert.equal(a2.state.players.size, 2);
  pass('another window/browser with the same player id takes the seat over; the old one is told and closed');

  // ---- D59: a dead seat stays dead until the next floor; newcomers drop in alive
  const d = await join(code, 'Гоша', 'pid-gosha-004');
  await until(() => me(d)?.state === 'alive', 'Гоша joins the running floor alive');
  pass('a new colleague joins the running floor as a fresh employee');
  d.send('debug', { cmd: 'dead' });
  await until(() => me(d)?.state === 'dead', 'Гоша dies');
  d.connection.close();
  await pause(2600);
  const d2 = await join(code, 'Гоша', 'pid-gosha-004');
  await until(() => me(d2), 'Гоша back');
  assert.equal(me(d2)!.state, 'dead'); assert.equal(me(d2)!.benched, true);
  pass('coming back to a dead character: still dead, benched until the next floor (no respawn by reconnecting)');

  // ---- full room still holds the 4-player limit, the same person can always come back
  const e = await join(code, 'Даша', 'pid-dasha-005');
  let full = false; try { const x = await join(code, 'Лишний', 'pid-extra-006'); await x.leave(true); } catch { full = true; }
  assert.ok(full, 'fifth refused');
  e.connection.close(); await pause(300);
  const e2 = await join(code, 'Даша', 'pid-dasha-005');
  await until(() => me(e2), 'Даша reopens in a full room');
  pass('four players max; reopening the page in a full room still gets your own seat back');
  for (const r of [a2, c3, d2, e2]) await r.leave(true);

  // ---- D62: Telegram chat room, summon, share, /install, game button
  const chat = { id: -100777, title: 'Отдел петушков', type: 'group' };
  const s1 = await post('/api/tg/session', { initData: signed({ user: JSON.stringify({ id: 501, first_name: 'Лёша' }), chat_instance: 'ci-lobby', chat: JSON.stringify(chat) }) });
  assert.equal(s1.status, 200); assert.match(s1.body.pid, /^tg-/); assert.ok(s1.body.link); assert.equal(s1.body.chatId, undefined);
  const s2 = await post('/api/tg/game', { token: s1.body.link });
  assert.equal(s2.body.code, s1.body.code); assert.equal(s2.body.pid, s1.body.pid);
  pass('Telegram session: seat key and a browser link that opens the same room as the same player');

  const t1 = await join(s1.body.code, s1.body.name, s1.body.pid);
  await until(() => t1.state.summon === true, 'chat room offers summon');
  t1.send('summon');
  await until(() => got(t1, 'summoned').length, 'summon answer');
  assert.ok(got(t1, 'summoned')[0].m.ok, JSON.stringify(got(t1, 'summoned')[0].m));
  const post1 = sent.find(x => x.method === 'sendMessage' && String(x.body.chat_id) === String(chat.id));
  assert.ok(post1 && /Лёша зовёт/.test(post1.body.text), 'invitation text');
  assert.ok(sent.some(x => x.method === 'sendGame' && String(x.body.chat_id) === String(chat.id)), 'game button under it');
  t1.send('summon'); await until(() => got(t1, 'summoned').length === 2, 'second summon');
  assert.match(got(t1, 'summoned')[1].m.error, /через/);
  pass('«Призвать чат»: the bot posts an invitation with the game button; repeated calls are rate-limited');

  t1.send('start', { fresh: true });
  await until(() => me(t1), 'chat room playing');
  t1.send('share', { key: 'combo_master' });
  await until(() => got(t1, 'shared').length, 'share refused');
  assert.ok(got(t1, 'shared')[0].m.error, 'cannot share what you did not earn');
  t1.send('debug', { cmd: 'award', level: 'combo_master' });
  await until(() => me(t1)?.achievements?.includes('combo_master'), 'achievement earned');
  t1.send('share', { key: 'combo_master' });
  await until(() => got(t1, 'shared').length === 2, 'share answer');
  assert.ok(got(t1, 'shared')[1].m.ok);
  assert.ok(sent.some(x => x.method === 'sendMessage' && String(x.body.chat_id) === String(chat.id) && /Эффективный менеджер/.test(x.body.text)));
  t1.send('debug', { cmd: 'award', level: 'field_medic' });
  t1.send('share', { key: 'field_medic' });
  await until(() => got(t1, 'shared').length === 3, 'common achievement answer');
  assert.ok(got(t1, 'shared')[2].m.error, 'only rare achievements are shared');
  pass('rare achievement goes to the chat once earned; unearned and common ones are refused');
  await t1.leave(true);

  updates.push(
    { update_id: 1, message: { message_id: 1, chat: { id: -100888, type: 'group', title: 'Бухгалтерия' }, from: { id: 9 }, text: '/install' } },
    { update_id: 2, callback_query: { id: 'cb1', from: { id: 77, first_name: 'Ира' }, chat_instance: 'ci-buh', game_short_name: 'chkn', message: { chat: { id: -100888, title: 'Бухгалтерия' } } } },
  );
  await until(() => sent.some(x => x.method === 'answerCallbackQuery'), 'bot answered the game button', 8000);
  const inst = sent.find(x => x.method === 'sendMessage' && String(x.body.chat_id) === '-100888');
  assert.ok(inst && /\?install=1/.test(JSON.stringify(inst.body.reply_markup)), '/install link');
  const cb = sent.find(x => x.method === 'answerCallbackQuery')!;
  assert.match(cb.body.url, /^https:\/\/chkn\.example\/\?tg=/);
  const s3 = await post('/api/tg/game', { token: new URL(cb.body.url).searchParams.get('tg') });
  const t2 = await join(s3.body.code, s3.body.name, s3.body.pid);
  t2.send('summon'); await until(() => got(t2, 'summoned').length, 'summon from a game-button room');
  assert.ok(got(t2, 'summoned')[0].m.ok);
  assert.ok(sent.some(x => x.method === 'sendMessage' && String(x.body.chat_id) === '-100888' && /Ира зовёт/.test(x.body.text)));
  pass('bot: /install sends the install link; a game-button room learns its chat and can summon it');
  await t2.leave(true);

  // ---- D61: PWA files (needs the client build)
  if (fs.existsSync('dist/index.html')) {
    const m = await fetch(HTTP + '/manifest.webmanifest');
    assert.equal(m.headers.get('content-type'), 'application/manifest+json');
    const man = await m.json() as any;
    assert.ok(man.icons.some((i: any) => i.sizes === '512x512') && man.start_url && man.display);
    const sw = await fetch(HTTP + '/sw.js');
    assert.ok(sw.ok && /no-store/.test(sw.headers.get('cache-control') ?? ''));
    assert.ok((await fetch(HTTP + '/icons/icon-192.png')).headers.get('content-type') === 'image/png');
    const page = await (await fetch(HTTP + '/')).text();
    assert.ok(page.includes('rel="manifest"'));
    const js = /src="\/(assets\/[^"]+\.js)"/.exec(page)![1];
    const r = await fetch(HTTP + '/' + js, { headers: { 'accept-encoding': 'br, gzip' } });
    assert.equal(r.headers.get('content-encoding'), 'br', 'bundles go compressed (D65)');
    const atlas = await fetch(HTTP + '/assets/gen/chars.json?v=' + (await (await fetch(HTTP + '/version.json')).json() as any).build);
    assert.match(atlas.headers.get('cache-control') ?? '', /immutable/, 'assets of the deployed build are immutable');
    pass('PWA: manifest, uncached service worker, icons; brotli bundles and immutable assets of the deployed build');
  } else console.log('SKIP PWA files (run npm run build first)');
  console.log(`${checks} lobby/rejoin/Telegram/PWA checks passed`);
} catch (error) { console.error(log.slice(-3000)); process.exitCode = 1; console.error(error); }
finally {
  await Promise.allSettled(rooms.filter(r => r.connection?.isOpen).map(r => Promise.race([r.leave(true), pause(300)])));
  await stop(); tg.close();
  fs.rmSync(dir, { recursive: true, force: true });
  setTimeout(() => process.exit(process.exitCode ?? 0), 100);
}
