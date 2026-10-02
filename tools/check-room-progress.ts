// Real server restart and team-wipe recovery, through the public room protocol.
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { Client, type Room } from 'colyseus.js';
import type { Snapshot } from '../src/shared/protocol';
const port = Number(process.env.PROGRESS_TEST_PORT || 2583);
const http = `http://127.0.0.1:${port}`, client = new Client(`ws://127.0.0.1:${port}`);
const dir = path.resolve('data/qa-progress');
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => unknown, label: string, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out: ' + label); await pause(40); }
}
let server: ChildProcess | undefined;
let log = '';
const rooms: Room[] = [];
const snapshots = new Map<string, Snapshot>();
async function start() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts', '--debug'], { env: { ...process.env, PORT: String(port), CHKN_SAVE_DIR: dir, TELEGRAM_BOT_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout?.on('data', c => { log += c; }); server.stderr?.on('data', c => { log += c; });
  const deadline = Date.now() + 15000;
  for (;;) {
    try { if ((await fetch(http + '/healthz')).ok) return; } catch {}
    if (Date.now() > deadline) throw new Error('Server startup failed: ' + log);
    await pause(80);
  }
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const stopped = new Promise<void>(resolve => server!.once('exit', () => resolve()));
  server.kill('SIGTERM'); await stopped; server = undefined;
}
function bind(room: Room) {
  rooms.push(room);
  room.onMessage('snap', (s: Snapshot) => snapshots.set(room.sessionId, s));
  for (const kind of ['start', 'end', 'ev', 'lobby']) room.onMessage(kind, () => {});
  return room;
}
const me = (room: Room) => snapshots.get(room.sessionId)?.p.find(p => p.id === room.sessionId);
try {
  await start();
  const room = bind(await client.create('game', { name: 'Прогресс QA', level: 'office7' }));
  const code = room.roomId; room.send('start'); await until(() => me(room), 'initial snapshot');
  const first = me(room)!;
  const target = { x: first.x! + 110, y: first.y! - 70 };
  room.send('input', { seq: 1, ...target, aim: 0, fire: false, reload: false, interact: false, weapon: 0 });
  await until(() => Math.hypot(me(room)!.x! - target.x, me(room)!.y! - target.y) < 5, 'moved away from entry');
  await pause(1200); const beforeDeath = { x: me(room)!.x!, y: me(room)!.y! };
  room.send('debug', { cmd: 'down' }); await until(() => room.state.phase === 'defeat', 'team wipe');
  await pause(6500); assert.equal(room.state.phase, 'defeat', 'failure waits for the host instead of auto-resuming');
  snapshots.delete(room.sessionId);
  room.send('retry');
  await until(() => room.state.phase === 'playing' && me(room)?.state === 'alive', 'restarted floor', 16000);
  assert.ok(Math.hypot(me(room)!.x! - first.x!, me(room)!.y! - first.y!) < 8);
  assert.ok(Math.hypot(me(room)!.x! - beforeDeath.x, me(room)!.y! - beforeDeath.y) > 50);
  assert.ok(me(room)!.hp! >= 60);
  console.log('PASS team wipe waits on defeat; host retries from the floor entrance');
  room.send('input', { seq: 2, ...target, aim: 0, fire: false, reload: false, interact: false, weapon: 0 });
  await until(() => Math.hypot(me(room)!.x! - target.x, me(room)!.y! - target.y) < 5, 'progress before restart');
  const saved = { x: me(room)!.x!, y: me(room)!.y!, weapons: me(room)!.weapons };
  await room.leave(true); await pause(500); await stop(); await start();
  const response = await fetch(http + '/api/rooms/resume', { method: 'POST', body: JSON.stringify({ code }) });
  assert.equal(response.status, 200);
  const returned = bind(await client.joinById(code, { name: 'Прогресс QA' }));
  await until(() => returned.state.level === 'office7', 'saved lobby state');
  assert.equal(returned.state.level, 'office7'); returned.send('start');
  await until(() => me(returned)?.state === 'alive', 'snapshot after server restart');
  assert.ok(Math.hypot(me(returned)!.x! - saved.x, me(returned)!.y! - saved.y) < 8);
  assert.deepEqual(me(returned)!.weapons, saved.weapons);
  console.log('PASS empty-room disposal + server restart + same code preserve floor, position and inventory');
  const legacyCode = 'VONE';
  const legacy = JSON.parse(fs.readFileSync(path.join(dir, code + '.json'), 'utf8'));
  fs.writeFileSync(path.join(dir, legacyCode + '.json'), JSON.stringify({ ...legacy, version: 1 }));
  assert.equal((await fetch(http + '/api/rooms/resume', { method: 'POST', body: JSON.stringify({ code: legacyCode }) })).status, 200);
  const migrated = bind(await client.joinById(legacyCode, { name: 'Старое сохранение QA' }));
  await until(() => migrated.state.phase === 'lobby', 'legacy lobby'); migrated.send('start');
  await until(() => me(migrated)?.state === 'alive', 'legacy floor entry');
  assert.ok(Math.hypot(me(migrated)!.x! - first.x!, me(migrated)!.y! - first.y!) < 8);
  assert.equal(migrated.state.level, 'office7');
  console.log('PASS version-one saves retain the code and current floor without replaying obsolete rules');
  const invalid = await fetch(http + '/api/rooms/resume', { method: 'POST', body: JSON.stringify({ code: '../bad' }) });
  assert.equal(invalid.status, 400);
  console.log('PASS invalid save path rejected');
} catch (error) { console.error(log.slice(-2500)); throw error; }
finally { for (const room of rooms) try { await Promise.race([room.leave(true), pause(300)]); } catch {} await stop(); }
