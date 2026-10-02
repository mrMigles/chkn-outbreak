// D66 floor 6 additions in the simulation: corridor coworkers turn, strays patrol until the reboot, the lift-hall
// «планёрка» turns when the power returns and must be cleared before the lift; downed timer/radius rules;
// older saves (rules 3) replay the floor exactly as before.
//   npm run check:floor6
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { GameMap, TILE } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { RoomRecording } from '../src/shared/sim/Checkpoint';
import { supportTarget, BLEEDOUT, RULES } from '../src/shared/sim/support';
const map = JSON.parse(fs.readFileSync('public/assets/maps/office.tmj', 'utf8'));
const make = (rules?: number, solo = true) => {
  const w = new World(new GameMap('office', map), LEVELS.office, { solo, seed: 777, rules });
  w.addPlayer('me', 'QA', 0); w.start(); w.god = true; return w;
};
const step = (w: World, s: number) => { for (let i = 0; i < Math.round(s * 30); i++) { w.step(1 / 30); } };
const place = (w: World, x: number, y: number) => { for (const p of w.players) { p.x = p.input.x = x; p.y = p.input.y = y; p.tp++; } };
const clear = (w: World, tag?: string) => { for (const e of [...w.enemies]) if (!tag || w.enemyTags.get(e.id) === tag) w.damageEnemy(e, 99999, 0, 0, 'me', 'bullet'); };
let n = 0; const pass = (s: string) => { n++; console.log('PASS', s); };

// corridor coworkers + strays
{
  const w = make();
  step(w, 12); clear(w);
  place(w, 12 * TILE, 15.5 * TILE); step(w, 0.2);
  assert.deepEqual(['courier', 'zina', 'vitya'].map(id => !!w.npc(id)), [true, true, true]);
  step(w, 9);
  assert.ok(['courier', 'zina', 'vitya'].every(id => { const q = w.npc(id)!; return q.mode === 'gone' || q.mutation; }), 'all three turned');
  assert.ok(w.countTag('corr') >= 3);
  step(w, 20);
  assert.ok(w.countTag('patrol6') > 0, 'strays come down the corridor');
  pass('corridor: three coworkers say a line and turn; strays patrol until the reboot');
}
// lift-hall meeting gates the lift
{
  const w = make();
  step(w, 10); clear(w);
  w.flags.osClear = true; w.flags.petrovich = true;
  for (const p of w.players) p.keys.push('server');
  w.script.onUse?.(w, 'reboot', w.players[0]);
  for (let t = 0; t < 45; t += 1) { step(w, 1); clear(w); }
  assert.ok(w.flags.power, 'power is back');
  assert.ok(w.npc('coach') && w.npc('intern'), 'the meeting stands in the lift hall');
  step(w, 12);
  assert.ok(w.flags.meetingDone && w.countTag('meeting') > 0, 'the meeting turned into chickens');
  const hall = w.objects('trigger', 'elevator')[0];
  w.events = [];
  place(w, hall.x + hall.w / 2, hall.y + hall.h / 2); step(w, 1);
  assert.ok(!w.events.some(e => e.e === 'level'), 'the lift waits for the meeting to be over');
  clear(w, 'meeting'); step(w, 3); clear(w, 'meeting');
  place(w, hall.x + hall.w / 2 + 4, hall.y + hall.h / 2); step(w, 2);
  assert.ok(w.events.some(e => e.e === 'level' && e.next === 'office7') || w.finished, 'the lift goes once the meeting is gone');
  pass('power back → «планёрка» in the lift hall turns; the lift goes only after it is dispersed');
}
// rules 3 = the floor exactly as before
{
  const w = make(3);
  step(w, 10); clear(w);
  place(w, 12 * TILE, 15.5 * TILE); step(w, 25);
  assert.ok(!w.npc('courier') && w.countTag('patrol6') === 0);
  assert.equal(w.rules, 3);
  pass('rules 3 (saves from before D66): no new scenes, identical floor');
}
// revive rules
{
  const w = new World(new GameMap('office', map), LEVELS.office, { solo: false, seed: 5 });
  const a = w.addPlayer('a', 'A', 0), b = w.addPlayer('b', 'B', 1); w.start();
  w.damagePlayer(b, 999, b.x + 5, b.y);
  assert.equal(b.state, 'downed'); assert.equal(b.downT, BLEEDOUT);
  b.x = a.x + 100; b.y = a.y;
  assert.equal(supportTarget(w, w.map, a)?.id, 'b', 'picked up from 100 units');
  const old = new World(new GameMap('office', map), LEVELS.office, { solo: false, seed: 5, rules: 3 });
  const oa = old.addPlayer('a', 'A', 0), ob = old.addPlayer('b', 'B', 1); old.start();
  old.damagePlayer(ob, 999, ob.x + 5, ob.y); ob.x = oa.x + 100; ob.y = oa.y;
  assert.equal(ob.downT, 18); assert.equal(supportTarget(old, old.map, oa), null);
  pass(`downed: ${BLEEDOUT} s to bleed out, pick-up radius 110 (rules 3 saves keep 18 s / 80)`);
}
// replay: the new scenes survive a checkpoint round trip exactly
{
  // a very tough employee (carried into the save) stays alive, so the save covers the whole run
  const carry = { players: { a: { weapons: ['pistol' as const], ammo: { pistol: { mag: 12, reserve: -1 } }, hp: 1e6, armor: 0 } }, npcs: [] };
  const w = new World(new GameMap('office', map), LEVELS.office, { solo: false, seed: 31, carry });
  w.addPlayer('a', 'A', 0); w.start();
  const rec = new RoomRecording(w);
  for (let i = 0; i < 30 * 12; i++) rec.step(1 / 30);
  const p = w.players[0]; p.input.x = 12 * TILE; p.input.y = 15.5 * TILE;
  for (let i = 0; i < 30 * 15; i++) { if (i % 10 === 0) { p.input.x = p.x + (12 * TILE - p.x); p.input.y = p.y + (15.5 * TILE - p.y); } rec.step(1 / 30); }
  const copy = RoomRecording.restore(map, JSON.parse(rec.serialize()));
  assert.equal(copy.world.rules, RULES); assert.equal(copy.world.time, w.time);
  assert.ok(['courier', 'zina', 'vitya'].every(id => copy.world.npc(id)), 'scenes are in the save');
  assert.deepEqual(copy.world.npcs.map(q => [q.id, q.mode, Math.round(q.x)]), w.npcs.map(q => [q.id, q.mode, Math.round(q.x)]));
  assert.deepEqual(copy.world.enemies.map(e => [e.id, Math.round(e.x), Math.round(e.y)]), w.enemies.map(e => [e.id, Math.round(e.x), Math.round(e.y)]));
  pass('room save replays the new floor-6 scenes exactly (rules recorded in the save)');
}
console.log(`${n} floor-6 checks passed`);
