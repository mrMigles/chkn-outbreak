// Headless multiplayer test bot: joins a room by code, readies up and shoots the nearest chicken.
//   npx tsx tools/bot.ts <CODE> [name] [ws://localhost:2580] [--passive]
import { Client } from 'colyseus.js';
import { decodeEnemies, type Snapshot } from '../src/shared/protocol';
import type { Enemy } from '../src/shared/sim/types';

const [code, name = 'Бот', url = 'ws://localhost:2580'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const passive = process.argv.includes('--passive');
const client = new Client(url);
const room = await client.joinById(code, { name });
console.log('joined', room.roomId, 'as', room.sessionId);
room.send('ready', { ready: true });

let me = { x: 0, y: 0, state: 'alive' };
let enemies: Enemy[] = [];
let chickens: { x: number; y: number }[] = [];
const cache = new Map<number, Enemy>();
let seq = 0;
let t = 0;
room.onMessage('snap', (s: Snapshot) => {
  const p = s.p.find((q) => q.id === room.sessionId);
  if (p) me = { x: p.x!, y: p.y!, state: p.state! };
  enemies = decodeEnemies(s, cache);
  chickens = s.p.filter((q) => q.state === 'chicken' && q.id !== room.sessionId).map((q) => ({ x: q.x!, y: q.y! }));
});
room.onMessage('ev', () => {});
room.onMessage('start', (m) => console.log('start', m));
room.onMessage('end', (m) => console.log('end', JSON.stringify(m)));
room.onMessage('lobby', () => {});

setInterval(() => {
  t += 1 / 30;
  const targets = me.state === 'chicken' ? [] : [...enemies, ...chickens];
  let best: { x: number; y: number } | null = null, bd = 1e9;
  for (const e of targets) { const d = Math.hypot(e.x - me.x, e.y - me.y); if (d < bd) { bd = d; best = e; } }
  const aim = best ? Math.atan2(best.y - me.y, best.x - me.x) : Math.sin(t) * 3;
  room.send('input', { seq: ++seq, x: me.x, y: me.y, aim, fire: !passive && !!best && bd < 700, reload: false, interact: false, weapon: 0 });
}, 1000 / 30);

setInterval(() => console.log(`state=${me.state} pos=${me.x | 0},${me.y | 0} enemies=${enemies.length}`), 5000);
