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
