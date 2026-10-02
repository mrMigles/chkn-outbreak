// Combat/AI regression checks: 2.5D hit boxes and headshots, armed NPC fire, companion spacing,
// off-screen wave spawns, office balance.
//   npm run check:combat
import assert from 'node:assert/strict';
import { GameMap, type TiledMap } from '../src/shared/map';
import { World } from '../src/shared/sim/World';
import { enemyBox, HAND_H } from '../src/shared/sim/hitbox';
import { LEVELS } from '../src/shared/levels';
import type { Npc, Player } from '../src/shared/sim/types';

let checks = 0;
function scenario(name: string, run: () => void) { run(); checks++; console.log('PASS', name); }
function setup(size = 40, objects: any[] = []) {
  const n = size * size;
  const tm: TiledMap = { width: size, height: size, tilewidth: 64, tileheight: 64, tilesets: [], layers: [
    { name: 'floor', type: 'tilelayer', data: Array(n).fill(1) },
    { name: 'walls', type: 'tilelayer', data: Array(n).fill(0) },
    { name: 'objects', type: 'objectgroup', objects } as any,
  ] };
  const w = new World(new GameMap('test', tm), { id: 'test', title: '', subtitle: '' }, { solo: true, seed: 7 });
  const p = w.addPlayer('p0', 'Игрок', 0); p.x = 400; p.y = 400; p.input.x = p.x; p.input.y = p.y;
  return { w, p };
}
function step(w: World, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 30); i++) w.step(1 / 30); }
/** Aim like the client: from the hand toward a screen point. */
const aimAt = (p: Player, sx: number, sy: number) => Math.atan2(sy - (p.y - HAND_H), sx - p.x);
function shoot(w: World, p: Player, aim: number) {
  w.events.length = 0;
  w.fireFrom(p.id, 'human', 'rifle', p.x, p.y, aim, null, 1);
  return w.events.filter((e) => e.e === 'hit' && typeof e.id === 'number') as any[];
}

scenario('a shot through the drawn head is a headshot with double damage', () => {
  const { w, p } = setup();
  const e = w.spawnEnemy('normal', 700, 400, { aggro: false });
  const box = enemyBox('normal');
  const body = shoot(w, p, aimAt(p, e.x, e.y - 40));
  assert.equal(body.length, 1); assert.ok(!body[0].hs, 'torso is not a headshot');
  const head = shoot(w, p, aimAt(p, e.x, e.y - box.h + 12));
  assert.equal(head.length, 1); assert.equal(head[0].hs, true);
  assert.ok(head[0].d >= body[0].d * 1.9);
  assert.equal(shoot(w, p, aimAt(p, e.x, e.y - box.h - 30)).length, 0, 'above the comb misses');
});
scenario('heads of enemies north and south of the shooter are hittable', () => {
  const { w, p } = setup();
  const box = enemyBox('normal');
  const n = w.spawnEnemy('normal', 410, 150, { aggro: false });
  const hn = shoot(w, p, aimAt(p, n.x, n.y - box.h + 12));
  assert.equal(hn.length, 1); assert.equal(hn[0].id, n.id); assert.equal(hn[0].hs, true);
  w.enemies.length = 0;
  const s = w.spawnEnemy('normal', 390, 700, { aggro: false });
  const hs = shoot(w, p, aimAt(p, s.x, s.y - box.h + 12));
  assert.equal(hs.length, 1); assert.equal(hs[0].id, s.id);
});
scenario('an enemy standing right behind the shooter does not eat the shot', () => {
  const { w, p } = setup();
  const behind = w.spawnEnemy('normal', 400, 375, { aggro: false });
  const ahead = w.spawnEnemy('normal', 400, 700, { aggro: false });
  const h = shoot(w, p, aimAt(p, ahead.x, ahead.y - 40));
  assert.equal(h.length, 1); assert.equal(h[0].id, ahead.id); void behind;
});
scenario('armed NPCs open fire on visible chickens, also while following', () => {
  const { w, p } = setup();
  w.npcs.push({ id: 'guard', kind: 'petrovich', name: 'Петрович', x: 460, y: 400, angle: Math.PI, hp: 80, maxHp: 80, mode: 'follow', weapon: 'pistol',
    fireCd: 0, follow: p.id, goal: null, lines: [], talkCd: 9, tag: 'guard', rescued: true, vx: 0, vy: 0, hurtT: 0 } as Npc);
  w.spawnEnemy('normal', 900, 420, { aggro: false, dormant: true });
  const before = w.enemies[0].hp;
  let shots = 0;
  for (let i = 0; i < 60; i++) { w.events.length = 0; step(w, 1 / 30); shots += w.events.filter((e) => e.e === 'shot' && e.o === 'guard').length; }
  assert.ok(shots >= 2, 'NPC fired ' + shots + ' shots');
  assert.ok(!w.enemies.length || w.enemies[0].hp < before, 'NPC bullets hit');
});
scenario('companions keep following (no "wait here" on E) and spread out', () => {
  const { w, p } = setup();
  for (let i = 0; i < 4; i++) w.npcs.push({ id: 'c' + i, kind: 'manBlue', name: 'C' + i, x: 700, y: 700, angle: 0, hp: 80, maxHp: 80, mode: 'follow', weapon: null,
    fireCd: 0, follow: p.id, goal: null, lines: [], talkCd: 9, tag: 'c' + i, rescued: true, vx: 0, vy: 0, hurtT: 0 } as Npc);
  step(w, 4);
  // walk next to them and press E: nobody stops following
  p.x = p.input.x = w.npcs[0].x + 30; p.y = p.input.y = w.npcs[0].y;
  w.setInput(p.id, { ...p.input, interact: true }); step(w, 0.1); w.setInput(p.id, { ...p.input, interact: false }); step(w, 3);
  assert.ok(w.npcs.every((n) => n.mode === 'follow'));
  for (const a of w.npcs) for (const b of w.npcs) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 30, `${a.id}/${b.id} overlap`);
});
scenario('wave enemies never spawn on a player screen when a hidden spawner exists', () => {
  const sp = (name: string, x: number, y: number) => ({ id: x * 100 + y, name, type: 'spawner', x, y, width: 0, height: 0, properties: [{ name: 'how', type: 'string', value: 'vent' }] });
  const { w, p } = setup(60, [sp('g', 460, 400), sp('g', 3300, 3300), sp('other', 1500, 400)]);
  step(w, 0.5);
  w.spawnWave('g', ['normal'], 6, 0.2, true, 'g');
  step(w, 3);
  assert.equal(w.enemies.length, 6);
  for (const e of w.enemies) assert.ok(!w.onScreen(e.x, e.y) || Math.hypot(e.x - p.x, e.y - p.y) > 500, 'spawned in view');
  // only on-screen spawners in the group: fall back to a hidden reachable one
  w.enemies.length = 0;
  p.x = p.input.x = 3300; p.y = p.input.y = 3200; step(w, 0.5);
  w.spawnWave('g', ['normal'], 3, 0.2, true, 'g2');
  step(w, 0.3);
  for (const e of w.enemies) assert.ok(!w.onScreen(e.x, e.y), 'fallback spawned in view');
});
scenario('crates and plants break under fire; the crate stops blocking movement', () => {
  const prop = (id: number, name: string, x: number, y: number, w: number, h: number) => ({ id, name, type: 'prop', x, y, width: w, height: h, properties: [] });
  const { w, p } = setup(40, [prop(501, 'crate', 640, 368, 64, 64), prop(502, 'plant', 380, 600, 48, 48)]);
  assert.equal(w.dprops.length, 2);
  const crate = w.map.colliders.find((c) => c.id === 501)!;
  assert.ok(crate);
  for (let i = 0; i < 6 && w.dprops.some((d) => d.id === 501); i++) shoot(w, p, aimAt(p, 672, 400 - 20));
  assert.ok(w.broken.includes(501), 'crate broke');
  assert.ok(!w.map.colliders.includes(crate), 'crate collider removed');
  w.events.length = 0;
  w.fireFrom(p.id, 'human', 'rifle', p.x, p.y, aimAt(p, 404, 624 - 40), null, 1);
  assert.ok(w.broken.includes(502), 'plant broke');
  assert.ok(w.events.some((e) => e.e === 'propbreak' && e.id === 502));
  w.explode(400, 400, 150, 90, p.id, 'gl');
});
scenario('a weapon lying on a table can be picked up from the table edge', () => {
  const prop = { id: 601, name: 'table_long', type: 'prop', x: 560, y: 368, width: 128, height: 64, properties: [] };
  const { w, p } = setup(40, [prop]);
  w.addPickup('weapon', 624, 400, { weapon: 'smg', ttl: -1 });
  p.x = p.input.x = 624; p.y = p.input.y = 400 + 32 + 16; // standing at the table's south edge
  step(w, 0.2);
  assert.ok(p.weapons.includes('smg'));
});
scenario('a cowering survivor: nearby idle chickens attack the rescuer; one behind a wall does not block the rescue', () => {
  const { w, p } = setup();
  const npc = { id: 'sci', kind: 'manBlue', name: 'Учёный', x: 700, y: 700, angle: 0, hp: 80, maxHp: 80, mode: 'cower', weapon: null,
    fireCd: 0, follow: null, goal: null, lines: [], talkCd: 9, tag: 'sci', rescued: false, vx: 0, vy: 0, hurtT: 0 } as Npc;
  w.npcs.push(npc);
  const idle = w.spawnEnemy('normal', 900, 700, { aggro: false });
  w.map.addCollider({ x: 560, y: 520, w: 20, h: 360, bullets: true, round: false, id: 990 });
  const walled = w.spawnEnemy('normal', 500, 700, { aggro: false });
  p.x = p.input.x = 700; p.y = p.input.y = 600; w.god = true;
  step(w, 0.2);
  assert.equal(idle.aggro, true, 'the chicken next to the survivor attacks');
  assert.equal(npc.rescued, false);
  w.killEnemy(idle, 0, p.id, false, false);
  walled.aggro = false; walled.x = 480; walled.vx = walled.vy = 0;
  step(w, 0.1);
  assert.equal(npc.rescued, true, 'the chicken behind the wall does not block the rescue');
});
scenario('office is gentler than the rest of the campaign', () => {
  assert.ok((LEVELS.office.enemyDamage ?? 1) < 1 && (LEVELS.office.enemyHp ?? 1) < 1);
});

console.log(`${checks} combat/AI scenarios passed`);
