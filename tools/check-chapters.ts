// D69: the new floors of chapters 1–2 played to the end by two autopilot bots inside a room recording
// (as the server does), then restored from the serialized save: the replayed world must be identical
// (scripted beats, elite chickens, Неля's walk, scares, gates). Also checks the chapter structure.
//   npx tsx tools/check-chapters.ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { RoomRecording, type RoomCheckpoint } from '../src/shared/sim/Checkpoint';
import { botStep, makeBot, seedBots } from './sim-play';
import { encodeSnapshot, decodePickups } from '../src/shared/protocol';
import type { SimEvent } from '../src/shared/sim/types';

const json = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const state = (w: World) => JSON.stringify({ t: w.time.toFixed(3), f: w.finished, o: w.objective, p: w.players.map(p => [p.id, Math.round(p.x), Math.round(p.y), Math.round(p.hp), p.state, p.kills]), e: w.enemies.map(e => [e.id, e.type, Math.round(e.x), Math.round(e.y), Math.round(e.hp)]), n: w.npcs.map(n => [n.id, n.mode, Math.round(n.x), Math.round(n.y)]), flags: w.flags, d: w.doors.map(d => [d.id, d.open]) });

for (const id of process.env.SKIP_BOTS ? [] : ['office8', 'office11', 'cafe12', 'street1', 'street2']) {
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
// D72
{
  // in a team every player takes their own gun and ammo from one spot; a bonus stays first-come
  const w = mk('arena', 2); w.enemies = []; w.cancelWaves();
  const [a, b] = w.players; b.x = b.input.x = a.x + 300; b.y = b.input.y = a.y; b.tp++;
  const gun = w.addPickup('weapon', a.x, a.y, { weapon: 'shotgun', ttl: -1 });
  run(w, .1); assert.ok(a.weapons.includes('shotgun') && w.pickups.includes(gun) && gun.ts === 1, 'taken by the first, still there for the second');
  b.x = b.input.x = a.x; b.y = b.input.y = a.y; b.tp++; run(w, .1);
  assert.ok(b.weapons.includes('shotgun') && !w.pickups.includes(gun), 'the second takes their own, then it is gone');
  const buff = w.addPickup('damage', a.x, a.y, { ttl: -1 }); run(w, .1); assert.ok(!w.pickups.includes(buff), 'a bonus is first-come');
  const g2 = w.addPickup('ammo', 10, 10, { ttl: -1 }); g2.ts = 2;
  assert.equal(decodePickups(encodeSnapshot(w)).find(k => k.id === g2.id)!.ts, 2, 'who took it travels in snapshots');
  console.log('PASS shared guns/ammo: each teammate takes their own; bonuses stay first-come');
}
{
  // mini-bosses sometimes drop a part-loaded minigun or laser
  let drops = 0;
  for (let s = 0; s < 12; s++) {
    const w = new World(new GameMap('arena', json('arena')), LEVELS.arena, { solo: true, seed: 100 + s }); w.addPlayer('p0', 'P', 0); w.start();
    const e = w.spawnEnemy('fast', 500, 500, { aggro: true }); e.appearance = { npcId: 'katya', kind: 'katya', name: 'Катя' };
    w.killEnemy(e, 0, 'p0', false, false);
    const k = w.pickups.find(q => q.amount);
    if (k) {
      drops++; const p = w.players[0]; p.weapons = ['pistol']; delete p.ammo.minigun; delete p.ammo.laser;
      p.x = p.input.x = k.x; p.y = p.input.y = k.y; p.tp++; run(w, .1);
      assert.ok(p.weapons.includes(k.weapon!), 'picked the special'); const a = p.ammo[k.weapon!]!;
      assert.ok(a.mag + Math.max(0, a.reserve) <= (k.weapon === 'minigun' ? 140 : 10), 'only part of the ammo');
    }
  }
  assert.ok(drops >= 3 && drops <= 11, 'about half of the mini-bosses drop one (' + drops + '/12)');
  console.log(`PASS mini-boss special drops: ${drops}/12 part-loaded miniguns/lasers`);
}
{
  // Валера blinks next to his prey in the dark, never while a beam holds him
  const w = mk('office8'); w.opts.rules = 7; w.god = true; w.setLight(0.97); w.enemies = []; w.cancelWaves();
  const p = w.players[0]; const v = w.spawnEnemy('fast', p.x + 420, p.y, { aggro: true }); v.appearance = { npcId: 'valera', kind: 'valera', name: 'В' };
  v.blinkT = 0; p.input.aim = Math.PI; w.events = []; run(w, .2);
  assert.ok(w.events.some(e => e.e === 'scare' && e.k === 'blink'), 'blinks in the dark'); assert.ok(Math.hypot(v.x - p.x, v.y - p.y) < 260);
  const w2 = mk('office8'); w2.opts.rules = 7; w2.god = true; w2.setLight(0.97); w2.enemies = []; w2.cancelWaves();
  const q = w2.players[0]; const v2 = w2.spawnEnemy('fast', q.x + 300, q.y, { aggro: true }); v2.appearance = { npcId: 'valera', kind: 'valera', name: 'В' };
  v2.blinkT = 0; q.input.aim = Math.atan2(v2.y - q.y, v2.x - q.x); w2.events = []; run(w2, .3);
  assert.ok(!w2.events.some(e => e.e === 'scare' && e.k === 'blink'), 'a flashlight on him: no blink');
  console.log('PASS office8: Валера blinks through the dark, never in a beam');
}
{
  // Толик lobs bottles that shatter at the player's feet
  const w = mk('street2'); w.enemies = []; w.cancelWaves();
  const p = w.players[0]; const t = w.spawnEnemy('fat', p.x + 330, p.y, { aggro: true }); t.appearance = { npcId: 'tolik', kind: 'tolik', name: 'Т' }; t.blinkT = 0;
  w.events = []; const hp = p.hp; let thrown = false, shattered = false;
  for (let i = 0; i < 60; i++) { w.step(1 / 30); thrown ||= w.events.some(e => e.e === 'proj' && e.k === 'bottle'); shattered ||= w.events.some(e => e.e === 'splat' && e.k === 'bottle'); w.events = []; }
  assert.ok(thrown, 'throws a bottle'); assert.ok(shattered, 'it shatters');
  assert.ok(p.hp < hp, 'the bottle hurts where it lands');
  console.log('PASS street2: Толик throws beer bottles');
}
{
  // street 1: the getaway car runs the flock over and breaks the fence; the floor ends beyond it
  const w = mk('street1'); w.god = true;
  Object.assign(w.flags, { pilotMet: true, radioDone: true });
  const lot = w.object('lot')!; const p = w.players[0]; p.x = p.input.x = lot.cx; p.y = p.input.y = lot.cy; p.tp++;
  const before = w.enemies.filter(e => w.enemyTags.get(e.id) === 'lot').length; run(w, 1);
  assert.ok(w.flags.lotSeen && w.vehicles.length === 1 && !w.vehicles[0].moving);
  run(w, 20); assert.ok(w.flags.carGone, 'the car went through'); assert.ok(!w.dprops.some(d => d.name === 'fence_v'), 'the fence is down');
  assert.ok(w.enemies.filter(e => w.enemyTags.get(e.id) === 'lot').length <= before / 3, 'most of the lot flock is run over');
  const exit = w.object('lot_exit')!; p.x = p.input.x = exit.cx; p.y = p.input.y = exit.cy; p.tp++; run(w, .3);
  assert.ok(w.finished && p.achievements?.includes('gone_in_60'));
  console.log('PASS street1: Литовец steals the car, runs over the flock, breaks the fence; we follow');
}
{
  // a chapter ends with a summary per player; stats and the chronicle ride the carry
  const w = mk('street2', 2); w.god = true;
  const [a] = w.players; for (let i = 0; i < 5; i++) w.killEnemy(w.spawnEnemy('normal', a.x + 200, a.y, { aggro: true }), 0, a.id, false, false);
  w.moment(a.id, 'Тестовый момент'); w.events = []; w.completeLevel();
  const ev = w.events.find(e => e.e === 'chapter') as Extract<SimEvent, { e: 'chapter' }>;
  assert.ok(ev && ev.summary.players.length === 2 && ev.summary.players.find(q => q.id === a.id)!.stats.kills === 5);
  assert.ok(ev.summary.players.find(q => q.id === a.id)!.stats.moments.includes('Тестовый момент'));
  const carry = w.carryOut(); assert.equal(carry.chronicle?.length, 1); assert.equal(carry.players[a.id].stats!.chap.kills, 0, 'a new chapter counts from zero'); assert.equal(carry.players[a.id].stats!.run.kills, 5);
  const next = new World(new GameMap('factory', json('factory')), LEVELS.factory, { solo: false, seed: 3, carry }); next.addPlayer(a.id, 'A', 0); next.start();
  assert.equal(next.players[0].stats!.run.kills, 5, 'run statistics carry to the next floor');
  console.log('PASS chapter summary: per-player kills, moments, achievements; stats and chronicle carried');
}
{
  // a room save recorded on an older revision of a rebuilt floor restarts that floor with its entry loadout
  const w = mk('office8', 1, false); const rec = new RoomRecording(w); for (let i = 0; i < 90; i++) rec.step(1 / 30);
  const save = { ...rec.checkpoint() } as RoomCheckpoint; delete save.rev;
  const back = RoomRecording.restore(json('office8'), save);
  assert.ok(back.world.time < 0.01 && back.data.frames.length === 0 && back.data.rev === LEVELS.office8.rev, 'old-revision save → floor restarts');
  console.log('PASS rebuilt floors: an old save restarts the floor instead of replaying a different map');
}
{
  // office 11: the forms are visible pickups with a scene each
  const w = mk('office11'); w.god = true;
  assert.equal(w.pickups.filter(k => k.kind === 'doc').length, 3, 'three forms lie on the floor');
  const p = w.players[0]; const tr = w.object('scene1')!; p.x = p.input.x = tr.cx; p.y = p.input.y = tr.cy; p.tp++; run(w, 4);
  assert.ok(w.enemies.some(e => w.enemyTags.get(e.id) === 'scene1' && e.aggro && e.appearance?.name.includes('Хэдхантер')), 'the headhunter scene starts');
  const doc = w.pickups.find(k => k.key === 'form1')!; p.x = p.input.x = doc.x; p.y = p.input.y = doc.y; p.tp++; run(w, .2);
  assert.ok(w.flags.form1, 'picking up the form counts it');
  console.log('PASS office11: three visible forms, each with its scene');
}

// D73: new abilities and their rules-7 compatibility.
{
  for (const rules of [7, 8]) {
    const w = mk('arena'); w.opts.rules = rules; w.enemies = []; w.npcs = []; w.cancelWaves();
    const p = w.players[0]; p.x = p.input.x = 900; p.y = p.input.y = 600;
    const e = w.spawnEnemy('fast', 1200, 600, { aggro: true });
    e.appearance = { npcId: 'vershkov', kind: 'vershkov', name: 'Вершков' }; e.blinkT = 0; e.abilityCd = 99;
    w.events = []; run(w, .1);
    assert.equal(w.events.some(ev => ev.e === 'scare' && ev.k === 'roots'), rules >= 8, 'roots only under rules 8');
    run(w, .8);
    assert.equal((p.slowT ?? 0) > 0, rules >= 8, 'roots catch a stationary player');
    if (rules >= 8) {
      assert.ok(p.hp < 100, 'roots deal damage');
      assert.ok(encodeSnapshot(w).p[0].slowT! > 0, 'root duration reaches network clients');
      w.enemies = []; run(w, 3); assert.equal(p.slowT, 0, 'roots expire');
    }
  }
  const w = mk('arena'); w.enemies = []; w.npcs = []; w.cancelWaves();
  const p = w.players[0]; p.x = p.input.x = 900; p.y = p.input.y = 600;
  const e = w.spawnEnemy('fast', 1200, 600, { aggro: true });
  e.appearance = { npcId: 'vershkov', kind: 'vershkov', name: 'В' }; e.blinkT = 0; e.abilityCd = 99;
  run(w, .1); p.y = p.input.y = 800; run(w, .8);
  assert.ok(!(p.slowT ?? 0) && p.hp === 100, 'moving out of the telegraph avoids the roots');
  console.log('PASS D73 roots: warning, damage, snapshot duration, expiry, dodge and rules-7 compatibility');
}
{
  for (const lamp of [false, true]) {
    const w = mk('arena'); w.enemies = []; w.npcs = []; w.cancelWaves(); w.setLight(.99); w.god = true;
    const p = w.players[0]; p.x = p.input.x = 900; p.y = p.input.y = 600; p.input.aim = 0;
    const e = w.spawnEnemy('fast', 1200, 600, { aggro: true });
    e.appearance = { npcId: 'valera', kind: 'valera', name: 'В' }; e.blinkT = 0;
    if (lamp) w.map.objects.push({ id: -1, type: 'light', name: 'qa', x: e.x, y: e.y, cx: e.x, cy: e.y, w: 0, h: 0, rot: 0, props: { kind: 'emergency', radius: 400 } });
    w.events = []; run(w, .1);
    assert.equal(w.events.some(ev => ev.e === 'scare' && ev.k === 'blink'), !lamp, 'a lamp prevents blink; the flashlight does not');
    if (!lamp) assert.ok(e.x < p.x, 'blink lands behind the player');
  }
  console.log('PASS D73 Валера: blinks behind a player through the flashlight, stays in emergency lamplight');
}
