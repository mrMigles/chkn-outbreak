// Run against npm run server (debug enabled). No browser/UI claims are made here.
import assert from 'node:assert/strict';
import { Client, type Room } from 'colyseus.js';
import { mergeSnapshot, type Snapshot } from '../src/shared/protocol';
import type { SimEvent } from '../src/shared/sim/types';

const client = new Client(process.env.TEST_SERVER ?? 'ws://localhost:2580');
const rooms: Room[] = [];
const snapshots = new Map<string, Snapshot>();
const events: SimEvent[] = [];
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
async function until(check: () => unknown, label: string, timeout = 6000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error('Timed out: ' + label); await pause(30); }
}
function bind(r: Room) {
  rooms.push(r); r.onMessage('snap', (s: Snapshot) => snapshots.set(r.sessionId, mergeSnapshot(snapshots.get(r.sessionId), s)));
  r.onMessage('ev', (e: SimEvent[]) => events.push(...e));
  r.onMessage('start', () => {}); r.onMessage('end', () => {}); r.onMessage('lobby', () => {});
  return r;
}
function player(room: Room, id = room.sessionId) { return snapshots.get(room.sessionId)?.p.find(p => p.id === id); }
try {
  const host = bind(await client.create('game', { name:'QA ведущий', level:'office' }));
  const LOOK = 'f.1.bob.c2452d.blouse.6d8b4e.skirt.3b4f7a.glasses';
  const peer = bind(await client.joinById(host.roomId, { name:'QA друг', look: LOOK }));
  await until(()=>host.state.players?.size===2,'two-player lobby'); peer.send('start'); await pause(250);
  assert.equal(host.state.phase,'lobby','only the host starts');
  peer.send('ready',{ready:true}); await until(()=>host.state.players.get(peer.sessionId)?.ready,'ready flag'); host.send('start');
  await until(()=>player(host) && player(peer),'snapshots');
  console.log('PASS only the host starts, readiness is visible, two client snapshots');
  assert.equal(player(host, peer.sessionId)?.look, LOOK); assert.equal(player(peer, host.sessionId)?.look, '');
  console.log('PASS chosen appearance travels to every client (default slot look when unset)');
  const h=player(host)!, p=player(peer)!;
  const input={seq:1,x:h.x!+60,y:h.y!,aim:0,fire:false,reload:false,interact:false,weapon:0};
  peer.send('input',input); await pause(200); host.send('debug',{cmd:'down'});
  await until(()=>player(host)?.state==='downed','down');
  peer.send('input',{...input,seq:2,interact:true});
  await until(()=>player(host)?.state==='alive','revive',4000);
  assert.equal(player(host)?.hp,45); assert.equal(player(peer)?.supplies?.medkit,1);
  peer.send('input',{...input,seq:3,interact:false});
  console.log('PASS server revival agrees at 45 HP on both clients');
  const token=peer.reconnectionToken, id=peer.sessionId;
  peer.connection.close(); await until(()=>player(host,id)?.connected===false,'disconnected flag');
  snapshots.delete(id);
  const returned=bind(await client.reconnect(token));
  assert.equal(returned.sessionId,id); await until(()=>player(returned)?.connected,'rejoin snapshot');
  assert.equal(player(returned)?.supplies?.medkit,1); assert.equal(player(returned)?.support,null);
  console.log('PASS reconnect retains identity and supplies, resets support');
  await until(()=>snapshots.get(host.sessionId)?.n.some(n=>n.id==='oleg' && n.mutation),'mutation starts',10000);
  const late=bind(await client.joinById(host.roomId,{name:'QA поздний'}));
  await until(()=>snapshots.get(late.sessionId)?.n.some(n=>n.id==='oleg' && n.mutation),'late join mutation',1800);
  console.log('PASS late join sees the active mutation stage');
  await until(()=>Object.values(snapshots.get(late.sessionId)?.appearances ?? {}).some(a=>a.npcId==='oleg'),'appearance survives mutation',3000);
  const fourth=bind(await client.joinById(host.roomId,{name:'QA четвёртый'}));
  await until(()=>snapshots.get(fourth.sessionId)?.p.length===4,'four player snapshot');
  let rejected=false; try { const extra=await client.joinById(host.roomId,{name:'QA пятый'}); await extra.leave(true); } catch { rejected=true; }
  assert.ok(rejected); console.log('PASS four players accepted, fifth rejected');
  await host.leave(true); await until(()=>returned.state.players?.get(id)?.host,'host transfer');
  console.log('PASS intentional host exit transfers leadership');
  console.log('Network regression checks passed');
} catch (error) {
  console.error(error); process.exitCode=1;
} finally {
  await Promise.allSettled(rooms.filter(r=>r.connection?.isOpen).map(r=>r.leave(true)));
}
