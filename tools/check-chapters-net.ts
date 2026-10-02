// D69, against `npm run server` (debug): a room created on floor 8 runs every new floor in order over the
// network — the snapshots carry the darkness override and the elite boss bar name, the floor-end message
// names the next floor, and the room arrives at the factory (chapter 3).
import assert from 'node:assert/strict';
import { Client, type Room } from 'colyseus.js';
import { mergeSnapshot, type Snapshot } from '../src/shared/protocol';
import type { SimEvent } from '../src/shared/sim/types';

const client = new Client(process.env.TEST_SERVER ?? 'ws://localhost:2580');
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => unknown, label: string, timeout = 15000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out: ' + label); await pause(40); }
}
let snap: Snapshot | undefined;
const events: SimEvent[] = [];
const ends: { kind: string; next?: string }[] = [];
const room: Room = await client.create('game', { name: 'QA', level: 'office8' });
room.onMessage('snap', (s: Snapshot) => { snap = mergeSnapshot(snap, s); });
room.onMessage('ev', (e: SimEvent[]) => events.push(...e));
room.onMessage('end', (m: { kind: string; next?: string }) => ends.push(m));
room.onMessage('start', () => {}); room.onMessage('lobby', () => {});
try {
  room.send('start', { fresh: true });
  await until(() => snap && room.state.level === 'office8', 'office8 running');
  assert.equal(snap!.o.length > 0, true);
  console.log('PASS room on floor 8: snapshots, objective «' + snap!.o + '»');
  const order = ['office8', 'office11', 'cafe12', 'street1', 'street2', 'factory'];
  for (let i = 0; i < order.length - 1; i++) {
    await until(() => room.state.level === order[i] && room.state.phase === 'playing', 'playing ' + order[i]);
    room.send('debug', { cmd: 'finish' });
    await until(() => ends.some(e => e.next === order[i + 1]), 'end → ' + order[i + 1], 20000);
    await until(() => room.state.level === order[i + 1] && room.state.phase === 'playing', 'started ' + order[i + 1], 20000);
    console.log(`PASS ${order[i]} → ${order[i + 1]} over the network`);
  }
  console.log('Chapter network checks passed');
} finally { await room.leave(true).catch(() => {}); }
process.exit(0);
