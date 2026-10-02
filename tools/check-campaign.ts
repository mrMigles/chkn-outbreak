import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { RoomRecording } from '../src/shared/sim/Checkpoint';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { FRIENDS } from '../src/shared/levels/office7';
import { BUFFS, type BuffKind } from '../src/shared/sim/types';
import { encodeSnapshot, decodePickups } from '../src/shared/protocol';
import { WEAPONS } from '../src/shared/weapons';
const json = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const make = (id = 'arena', solo = true) => {
  const w = new World(new GameMap(id, json(id)), LEVELS[id], { solo, seed: 4129 });
  w.addPlayer('me', 'QA', 0); w.start(); return w;
};
const step = (w: World, seconds: number) => { for (let i = 0; i < Math.round(seconds * 30); i++) w.step(1 / 30); };
const place = (w: World, x: number, y: number) => { const p = w.players[0]; p.x = p.input.x = x; p.y = p.input.y = y; };

for (const kind of Object.keys(BUFFS) as BuffKind[]) {
  const w = make(), p = w.players[0]; w.enemies = [];
  w.addPickup(kind, p.x, p.y); step(w, .1);
  assert.ok((p.buffs?.[kind] ?? 0) > 9.8);
  const before = p.hp;
  if (kind === 'invincible') { w.damagePlayer(p, 500, p.x, p.y); assert.equal(p.hp, before); }
  if (kind === 'damage') {
    const e = w.spawnEnemy('fat', p.x + 160, p.y, { aggro: false });
    w.fire(p, 'pistol');
    assert.ok(e.hp < e.maxHp - 25);
    w.fire(p, 'grenade'); assert.equal(w.projectiles[0].dmg, WEAPONS.grenade.damage * 3);
  }
  if (kind === 'sprint') {
    const start = p.x; p.input.x = start + 100; w.step(.1);
    const ordinary = make(), q = ordinary.players[0]; ordinary.enemies = [];
    q.input.x = q.x + 100; const qx = q.x; ordinary.step(.1);
    assert.ok(p.x - start > (q.x - qx) * 1.5, 'authoritative movement accepts the boosted speed while retaining its anti-teleport limit'); p.input.x = p.x;
  }
  if (kind === 'infinite') {
    w.giveWeapon(p, 'smg'); const ammo = p.ammo.smg!; ammo.mag = 0; ammo.reserve = 0;
    p.input.fire = true; p.input.weapon = p.cur; step(w, .2);
    assert.ok(w.events.some(e => e.e === 'shot' && e.w === 'smg')); assert.equal(ammo.mag, 0); assert.equal(ammo.reserve, 0); p.input.fire = false;
  }
  w.god = true; w.enemies = []; w.cancelWaves();
  step(w, 10.1); assert.equal(p.buffs?.[kind], undefined);
  if (kind === 'invincible') { w.god = false; w.damagePlayer(p, 10, p.x, p.y); assert.ok(p.hp < before); }
}
console.log('PASS all four buffs: activation, ammo-free firing, protection, damage and expiry');
{
  const w = make(); const p = w.players[0];
  for (const kind of [...Object.keys(BUFFS), 'achievement']) w.addPickup(kind as BuffKind, p.x + 90, p.y);
  const decoded = decodePickups(encodeSnapshot(w));
  assert.deepEqual(decoded.map(k => k.kind), w.pickups.map(k => k.kind));
  console.log('PASS buff and trophy pickup kinds survive network snapshots');
}
{
  const w = make('office7'); w.god = true;
  for (const id of FRIENDS) {
    w.cancelWaves(); w.enemies = [];
    const n = w.npc(id)!; place(w, n.x - 40, n.y + 20); step(w, .2);
    // nearby workers finish their readable mutation, then the player clears them
    step(w, 3.1); w.cancelWaves(); w.devKillAll('me'); step(w, .2);
    assert.equal(n.rescued, true, id + ' is rescuable'); assert.equal(n.mode, 'follow');
  }
  assert.ok(FRIENDS.every(id => !w.npc(id)?.mutation));
  const manager = w.npc('root_manager')!; place(w, manager.x, manager.y + 100); step(w, .2);
  assert.ok(w.flags.rootStarted); step(w, 3.2);
  const root = w.enemies.find(e => e.appearance?.npcId === 'root_manager')!;
  assert.ok(root && root.maxHp >= 850); assert.notEqual(root.type, 'boss');
  w.killEnemy(root, 0, 'me', false, false); w.devKillAll('me');
  const trophy = w.pickups.find(k => k.kind === 'achievement')!; assert.ok(trophy);
  place(w, trophy.x, trophy.y); step(w, .1); assert.ok(w.players[0].achievements?.includes('root_rooster'));
  const lift = w.object('evacuation')!; place(w, lift.cx, lift.cy);
  step(w, .1); assert.equal(w.finished, false, 'friends must physically arrive, not merely be marked found');
  for (const id of FRIENDS) { const n = w.npc(id)!; n.x = lift.cx; n.y = lift.cy; }
  step(w, .1); assert.equal(w.finished, true);
  assert.ok(w.events.some(e => e.e === 'level' && e.next === 'lab'));
  assert.equal(w.carryOut().npcs.length, 0, 'friends evacuated, not carried into the lab');
  console.log('PASS all five rescues, protected story cast, manager mutation, loot, real escort and lab transition');
}
{
  const w = make('lab'); w.god = true;
  const gen = w.object('generator')!; place(w, gen.cx - 60, gen.cy);
  w.script.onUse!(w, 'generator', w.players[0]);
  assert.ok(w.blackout); assert.ok(w.objects('spawner', 'gen_corridor').every(o => o.cx > 20 * 64));
  step(w, 12); assert.ok(w.countTag('gen') >= 20);
  step(w, 24); assert.equal(w.blackout, false); assert.equal(w.flags.power, true);
  console.log('PASS generator blackout, corridor-only attackers, increased wave count and restored power');
}
const state = (w: World) => JSON.stringify({
  view: encodeSnapshot(w), flags: w.flags, rng: w.rng.state,
  enemies: w.enemies, npcs: w.npcs, tags: [...w.enemyTags],
});
for (const id of ['office', 'office7', 'lab', 'factory', 'boss', 'arena']) {
  const map = json(id);
  const w = new World(new GameMap(id, map), LEVELS[id], { solo: false, seed: 9103, carry: { players: { me: { weapons: ['pistol'], ammo: { pistol: { mag: 12, reserve: -1 } }, hp: 10000, armor: 10000 } }, npcs: [] } });
  const p = w.addPlayer('me', 'QA', 0); w.start(); const recording = new RoomRecording(w);
  for (let i = 0; i < 720; i++) {
    w.setInput(p.id, { ...p.input, seq: i, fire: i % 80 < 60, aim: Math.sin(i / 90), x: p.x, y: p.y });
    recording.step(1 / 30);
  }
  const save = JSON.parse(JSON.stringify(recording.checkpoint()));
  const start = performance.now(); const restored = RoomRecording.restore(map, save);
  assert.equal(state(restored.world), state(w), id + ': exact restore');
  for (let i = 0; i < 90; i++) { recording.step(1 / 30); restored.step(1 / 30); }
  assert.equal(state(restored.world), state(w), id + ': timers/AI still agree after restore');
  restored.resume([{ id: 'new-id', slot: 0, name: 'QA вернулся', look: '', connected: true }]);
  assert.equal(restored.world.players[0].id, 'new-id'); assert.equal(restored.world.players[0].x, w.players[0].x);
  const restoredAgain = RoomRecording.restore(map, JSON.parse(JSON.stringify(restored.checkpoint())));
  assert.equal(state(restoredAgain.world), state(restored.world), id + ': recover and rebind survive a second restart');
  console.log(`PASS ${id}: disk round-trip, timers, random AI, rebind, second restart (${Math.round(performance.now() - start)} ms)`);
}
assert.equal(LEVELS.office.next, 'office7'); assert.equal(LEVELS.office7.next, 'lab');
console.log('Campaign/resume regressions passed');
