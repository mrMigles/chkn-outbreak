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
  const elena = w.npc('elena')!, gate = w.doors.find(d => d.id === 'castor_lock')!;
  w.script.onNpcUse!(w, elena, w.players[0]); assert.ok(!elena.mutation, 'no pass until the siege is cleared');
  const trapped = w.npc('andrey')!; place(w, trapped.x - 30, trapped.y); step(w, .2);
  assert.equal(trapped.rescued, false, 'cannot recruit through a locked door');
  assert.equal(w.npcTargetable(trapped), false, 'siege does not get stuck attacking immortal friends behind a locked door');
  assert.equal(w.npcTargetable(elena), false, 'waves hunt players instead of an immortal idle administrator');
  w.script.onTrigger!(w, 'siege7', w.players[0]); assert.ok(w.countTag('siege7') >= 22);
  step(w, 3.2); w.devKillAll('me'); step(w, .2); assert.ok(w.flags.siegeCleared);
  place(w, elena.x - 40, elena.y); w.script.onNpcUse!(w, elena, w.players[0]);
  assert.ok(elena.mutation); assert.ok(!w.pickups.some(k => k.key === 'f7_pass'));
  step(w, 3.2); const admin = w.enemies.find(e => e.appearance?.npcId === 'elena')!;
  assert.ok(admin.maxHp >= 320); w.killEnemy(admin, 0, 'me', false, false);
  const pass = w.pickups.find(k => k.key === 'f7_pass')!; assert.ok(pass);
  place(w, pass.x, pass.y); step(w, .1); assert.ok(w.players[0].keys.includes('f7_pass'));
  place(w, gate.x - 45, gate.y + gate.h / 2);
  w.setInput('me', { ...w.players[0].input, interact: true }); step(w, .03);
  w.setInput('me', { ...w.players[0].input, interact: false }); step(w, .5);
  assert.ok(gate.open, 'the recovered pass opens the actual door');
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
  assert.ok(root && root.maxHp >= 2200); assert.notEqual(root.type, 'boss');
  w.cancelWaves(); w.enemies = [root]; root.x = 2800; root.y = 1550;
  place(w, 2950, 1550); root.abilityCd = 0;
  step(w, .7); assert.equal(root.state, 'charge');
  w.god = false; const hp = w.players[0].hp; step(w, 1.3);
  assert.ok(w.players[0].hp < hp, 'root actively rushes and damages the player'); w.god = true;
  w.killEnemy(root, 0, 'me', false, false); w.devKillAll('me');
  const trophy = w.pickups.find(k => k.kind === 'achievement')!; assert.ok(trophy);
  place(w, trophy.x, trophy.y); step(w, .1); assert.ok(w.players[0].achievements?.includes('root_rooster'));
  const lift = w.object('evacuation')!; place(w, lift.cx, lift.cy);
  step(w, .1); assert.equal(w.finished, false, 'friends must physically arrive, not merely be marked found');
  for (const id of FRIENDS) { const n = w.npc(id)!; n.x = lift.cx; n.y = lift.cy; }
  step(w, .1); assert.equal(w.finished, true);
  assert.ok(w.players[0].achievements?.includes('no_one_left'));
  assert.ok(w.events.some(e => e.e === 'level' && e.next === 'lab'));
  assert.equal(w.carryOut().npcs.length, 0, 'friends evacuated, not carried into the lab');
  console.log('PASS Castor siege, locked rescue, Elena mutation/drop, door, five rescues, root charge, trophy, escort and lab');
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
{
  // D55: the server reboot on floor 6 is a real defence — opening rush, growing two-sided waves
  const w = make('office'); w.god = true; w.enemies = [];
  const ids = new Set<number>();
  w.script.onUse!(w, 'reboot', w.players[0]);
  step(w, 3); w.enemies.forEach(e => ids.add(e.id)); assert.ok(w.countTag('blackout') >= 8, 'opening rush');
  // the team keeps shooting: clear the floor every few seconds, as a player would
  for (let t = 0; t < 40; t++) { step(w, 1); w.enemies.forEach(e => ids.add(e.id)); if (t % 4 === 3) w.enemies = []; }
  assert.ok(ids.size >= 30, `reboot brought only ${ids.size} attackers`);
  assert.equal(w.blackout, false); assert.equal(w.flags.power, true);
  console.log(`PASS server reboot: ${ids.size} attackers over 40 s, power restored`);
}
{
  // D57: floor bonuses pay out once and only for player-caused progress
  const w = make('office'); w.god = true; w.enemies = [];
  const p = w.players[0]; p.supplies.medkit = 0; p.supplies.ammo = 0;
  assert.equal(w.bonus?.goal, 25);
  const e0 = w.spawnEnemy('normal', p.x + 300, p.y, { aggro: false }); w.damageEnemy(e0, 9999, 0, 0, 'npc-x', 'bullet');
  assert.equal(w.bonus?.n, 0, 'untagged / non-player kills do not count');
  for (let i = 0; i < 25; i++) { const e = w.spawnEnemy('normal', p.x + 300, p.y, { aggro: false, tag: 'blackout' }); w.damageEnemy(e, 9999, 0, 0, 'me', 'bullet'); }
  assert.equal(w.bonus?.done, true); assert.ok(p.achievements?.includes('sysadmin_day'));
  assert.equal(p.supplies.medkit, 1); assert.equal(p.supplies.ammo, 1);
  const score = p.score; const e1 = w.spawnEnemy('normal', p.x + 300, p.y, { aggro: false, tag: 'blackout' }); w.damageEnemy(e1, 9999, 0, 0, 'me', 'bullet');
  assert.ok(p.score - score < 300, 'bonus pays once');
  const w7 = make('office7'); w7.god = true; const q = w7.players[0];
  for (let i = 0; i < 20; i++) { const e = w7.spawnEnemy('normal', q.x + 300, q.y, { aggro: false }); w7.damageEnemy(e, 9999, 0, 0, 'me', 'bullet', e.x, e.y, true); }
  assert.ok(w7.bonus?.done && q.achievements?.includes('headhunter'));
  assert.equal(encodeSnapshot(w7).bn?.done, true, 'bonus travels in snapshots');
  const wf = make('factory'); wf.god = true; const f = wf.players[0];
  for (let i = 0; i < 50; i++) { const e = wf.spawnEnemy('chick', f.x + 300, f.y, { aggro: false }); wf.damageEnemy(e, 9999, 0, 0, 'me', 'bullet'); }
  assert.ok(wf.bonus?.done && f.achievements?.includes('conveyor') && f.achievements?.includes('combo_master'));
  console.log('PASS floor bonuses: tagged/headshot/combo goals, one payout, achievements, snapshot');
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
