// D69: the new floors of chapters 1–2 played to the end by two autopilot bots inside a room recording
// (as the server does), then restored from the serialized save: the replayed world must be identical
// (scripted beats, elite chickens, Неля's walk, scares, gates). Also checks the chapter structure.
//   npx tsx tools/check-chapters.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { RoomRecording } from '../src/shared/sim/Checkpoint';
import { botStep, makeBot, seedBots } from './sim-play';
import { encodeSnapshot } from '../src/shared/protocol';

const json = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const state = (w: World) => JSON.stringify({ t: w.time.toFixed(3), f: w.finished, o: w.objective, p: w.players.map(p => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.hp), p.state, p.kills]), e: w.enemies.map(e => [e.id, e.type, Math.round(e.x), Math.round(e.y), Math.round(e.hp)]), n: w.npcs.map(n => [n.id, n.mode, Math.round(n.x), Math.round(n.y)]), flags: w.flags, d: w.doors.map(d => [d.id, d.open]) });

for (const id of ['office8', 'office11', 'cafe12', 'street1', 'street2']) {
  const t0 = performance.now();
  seedBots(97);
  const w = new World(new GameMap(id, json(id)), LEVELS[id], { solo: false, seed: 2024 });
  w.addPlayer('a', 'A', 0); w.addPlayer('b', 'B', 1);
  for (const p of w.players) { w.giveWeapon(p, 'smg', true); w.giveWeapon(p, 'shotgun', true); }
  const carryLoadout = { players: Object.fromEntries(w.players.map(p => [p.id, { weapons: [...p.weapons], ammo: JSON.parse(JSON.stringify(p.ammo)), hp: 100, armor: 0 }])), npcs: [] };
  // record from a world constructed with the same carry the server would have
  const world = new World(new GameMap(id, json(id)), LEVELS[id], { solo: false, seed: 2024, carry: carryLoadout });
  world.addPlayer('a', 'A', 0); world.addPlayer('b', 'B', 1); world.start();
  const rec = new RoomRecording(world);
  const bots = [makeBot(world, 'a'), makeBot(world, 'b')];
  // saves every 20 s, as the server does; each must replay into exactly the world it was taken from
  const saves: [string, string][] = [];
  while (!world.finished && world.time < 600) {
    for (const b of bots) botStep(world, b, 1);
    world.events.length = 0;
    rec.step(1 / 30);
    if (Math.floor(world.time / 20) !== Math.floor((world.time - 1 / 30) / 20) && !world.finished) saves.push([rec.serialize(), state(world)]);
  }
  assert.ok(world.finished, `${id}: two bots finish the floor (objective: ${world.objective})`);
  for (const [text, st] of saves) assert.equal(state(RoomRecording.restore(json(id), JSON.parse(text)).world), st, `${id}: save replays exactly`);
  console.log(`PASS ${id}: 2 bots finished in ${world.time.toFixed(0)} s, ${saves.length} saves replay identically (${Math.round(performance.now() - t0)} ms)`);
}
// chapter structure
assert.equal(LEVELS.office.chapter, 'Глава 1 · Офис');
assert.ok(LEVELS.cafe12.chapterEnd?.award === 'chapter_office' && LEVELS.street2.chapterEnd?.award === 'chapter_city');
assert.equal(LEVELS.street1.chapter, 'Глава 2 · Город'); assert.equal(LEVELS.factory.chapter, 'Глава 3 · «Провансаль»');
console.log('PASS chapters: 1 «Офис» (6, 7, 8, 11, 12) · 2 «Город» (2 улицы) · 3 «Провансаль» (завод, лаборатория, ангар)');

// network view of the scripted light and an elite's boss bar
{
  const w = new World(new GameMap('office8', json('office8')), LEVELS.office8, { solo: false, seed: 5 });
  w.addPlayer('a', 'A', 0); w.start();
  assert.equal(encodeSnapshot(w).am, undefined, 'no override: the map darkness');
  w.setLight(0.05); const e = w.spawnEnemy('fast', 600, 600, { aggro: true }); e.appearance = { npcId: 'valera', kind: 'valera', name: '' };
  w.setBoss(e, 'Петух Тёмной Темы · Валера');
  const s = encodeSnapshot(w);
  assert.equal(s.am, 0.05); assert.equal(s.bnm, 'Петух Тёмной Темы · Валера'); assert.equal(s.b, e.id);
  console.log('PASS snapshots carry the darkness override and the elite boss bar name');
}
// D71
const mk = (id: string, n = 1, solo = n === 1) => { const w = new World(new GameMap(id, json(id)), LEVELS[id], { solo, seed: 9 }); for (let i = 0; i < n; i++) w.addPlayer('p' + i, 'P' + i, i); w.start(); return w; };
const run = (w: World, s: number) => { for (let i = 0; i < s * 30; i++) w.step(1 / 30); };
{
  const w = mk('lab', 2); w.god = true;
  w.script.onTrigger!(w, 'decon', w.players[0]); run(w, 1);
  assert.ok(w.doors.every(d => !d.locked || d.locked === 'lab' || d.id === 'freight'), 'decontamination doors never lock (rules 6)');
  console.log('PASS lab: the decontamination trap is an alarm and a wave, no locked doors');
}
{
  const duo = mk('office8', 2); duo.god = true; duo.players[1].state = 'dead'; run(duo, 9);
  assert.equal(!!duo.flags.nelyaHelps, false, 'two connected players: Неля stays (even if one is down)');
  assert.equal(duo.npc('nelya')!.mode, 'idle');
  const solo = mk('office8', 1); solo.god = true; run(solo, 9);
  assert.equal(solo.flags.nelyaHelps, true); assert.equal(solo.npc('nelya')!.mode, 'goto');
  console.log('PASS office8: Неля explains and stays with a team, walks to the east release for a lone player');
}
{
  const w = mk('arena'); const p = w.players[0]; w.enemies = []; w.cancelWaves();
  w.giveWeapon(p, 'minigun', true); p.ammo.minigun!.mag = 2; p.input.weapon = p.cur; p.input.fire = true; run(w, 0.5);
  assert.ok(!p.weapons.includes('minigun'), 'a spent minigun is dropped');
  w.giveWeapon(p, 'laser', true); assert.equal(p.ammo.laser!.reserve, 20); w.addPickup('ammo', p.x, p.y); run(w, .1); assert.equal(p.ammo.laser!.reserve, 20, 'ammo boxes do not refill the laser');
  const e = w.spawnEnemy('jumper', p.x + 260, p.y, { aggro: true }); p.input.fire = false;
  let leapt = false; for (let i = 0; i < 60; i++) { w.step(1 / 30); if (e.state === 'charge') leapt = true; }
  assert.ok(leapt, 'a jumper leaps at mid range'); assert.ok(p.hp < 100, 'and lands a peck');
  console.log('PASS minigun dropped when spent, laser not refilled by boxes, jumper leaps and bites');
}
{
  const w = mk('boss'); w.god = true; run(w, 6);
  const b = w.enemies.find(e => e.type === 'boss')!; w.events = [];
  w.killEnemy(b, 0, 'p0', false, false);
  assert.ok(w.events.some(e => e.e === 'cine' && e.k === 'victory'), 'finale cutscene');
  run(w, 10); assert.ok(w.finished, 'the campaign ends after the finale');
  console.log('PASS boss: victory cutscene, then the campaign ends');
}
