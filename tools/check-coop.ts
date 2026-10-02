// Authority regression checks, including walls, duplicate edges and mutation snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LEVELS } from '../src/shared/levels';
import { GameMap, type TiledMap } from '../src/shared/map';
import { World } from '../src/shared/sim/World';
import { encodeSnapshot, decodeEnemies } from '../src/shared/protocol';
import type { Player } from '../src/shared/sim/types';

let checks = 0;
function scenario(name: string, run: () => void) { run(); checks++; console.log('PASS', name); }
function setup(count = 2) {
  const tm: TiledMap = { width: 16, height: 16, tilewidth: 64, tileheight: 64, tilesets: [], layers: [
    { name: 'floor', type: 'tilelayer', data: Array(256).fill(1) },
    { name: 'walls', type: 'tilelayer', data: Array(256).fill(0) },
  ] };
  const w = new World(new GameMap('test', tm), { id: 'test', title: '', subtitle: '' }, { solo: false, seed: 1337 });
  for (let i = 0; i < count; i++) { const p = w.addPlayer('p' + i, 'Игрок ' + i, i); p.x = 300 + i * 60; p.y = 300; p.input.x = p.x; p.input.y = p.y; }
  return w;
}
function input(w: World, p: Player, held: boolean, fire = false) {
  w.setInput(p.id, { ...p.input, seq: p.input.seq + 1, x: p.x, y: p.y, interact: held, fire });
}
function step(w: World, seconds: number) { for (let i = 0; i < Math.ceil(seconds * 60); i++) w.step(1 / 60); }
function down(p: Player) { p.state = 'downed'; p.hp = 0; p.downT = 18; }

scenario('revive requires 2.6 seconds; no ammo or medkit expense', () => {
  const w = setup(), [a,b] = w.players; down(b); input(w,a,true); step(w,2.5);
  assert.equal(b.state,'downed'); step(w,0.15); assert.equal(b.state,'alive'); assert.equal(b.hp,45);
  assert.deepEqual(a.supplies,{medkit:1,ammo:1}); assert.equal(w.events.filter(e=>e.e==='revived').length,1);
});
scenario('a wall blocks revival', () => {
  const w=setup(),[a,b]=w.players; down(b);
  w.map.addCollider({x:326,y:260,w:8,h:80,bullets:true,round:false,id:91});
  input(w,a,true); step(w,3); assert.equal(b.state,'downed'); assert.equal(b.reviveT,0);
});
scenario('heal uses one medkit after 1.2 seconds, not on press', () => {
  const w=setup(),[a,b]=w.players; b.hp=40; input(w,a,true); step(w,1);
  assert.equal(b.hp,40); assert.equal(a.supplies.medkit,1); step(w,0.25);
  assert.equal(b.hp,80); assert.equal(a.supplies.medkit,0); step(w,3); assert.equal(b.hp,80);
});
scenario('release cancels healing without consuming or sharing ammo', () => {
  const w=setup(),[a,b]=w.players; b.hp=40; w.giveWeapon(b,'smg'); b.ammo.smg!.reserve=0;
  input(w,a,true); step(w,0.6); input(w,a,false); step(w,0.1);
  assert.equal(b.hp,40); assert.equal(b.ammo.smg!.reserve,0); assert.deepEqual(a.supplies,{medkit:1,ammo:1});
});
scenario('movement and a newly closed wall cancel a fixed target', () => {
  const w=setup(),[a,b]=w.players; b.hp=40; input(w,a,true); step(w,0.5);
  w.setInput(a.id,{...a.input,x:a.x-12}); step(w,1); assert.equal(b.hp,40); assert.equal(a.supplies.medkit,1);
  input(w,a,false); step(w,0.02); input(w,a,true); step(w,0.3);
  w.map.addCollider({x:326,y:260,w:8,h:80,bullets:true,round:false,id:91}); step(w,1);
  assert.equal(b.hp,40); assert.equal(a.supplies.medkit,1);
});
scenario('a tap arriving entirely between ticks shares exactly one magazine', () => {
  const w=setup(),[a,b]=w.players; w.giveWeapon(b,'smg'); b.ammo.smg!.reserve=0;
  input(w,a,true); input(w,a,true); input(w,a,false); input(w,a,false); step(w,0.05);
  assert.equal(b.ammo.smg!.reserve,42); assert.equal(a.supplies.ammo,0); assert.equal(a.supplies.medkit,1);
});
scenario('infinite pistol ammo does not consume a pouch', () => {
  const w=setup(),[a]=w.players; input(w,a,true); input(w,a,false); step(w,0.05); assert.equal(a.supplies.ammo,1);
});
scenario('two helpers do not accelerate or duplicate revival', () => {
  const w=setup(3),[a,b,c]=w.players; a.x=300; b.x=360; c.x=420; down(b);
  input(w,a,true); input(w,c,true); step(w,1.4); assert.equal(b.state,'downed');
  step(w,1.3); assert.equal(b.state,'alive'); assert.equal(w.events.filter(e=>e.e==='revived').length,1);
});
scenario('two healers holding together spend exactly one medkit and heal once', () => {
  const w=setup(3),[a,b,c]=w.players; b.hp=40;
  input(w,a,true); input(w,c,true); step(w,3);
  assert.equal(b.hp,80); assert.equal(a.supplies.medkit+c.supplies.medkit,1);
  assert.equal(w.events.filter(e=>e.e==='help' && e.kind==='heal').length,1);
});
scenario('human bullets cannot hurt teammates', () => {
  const w=setup(),[a,b]=w.players; input(w,a,false,true); step(w,1); assert.equal(b.hp,100);
});
scenario('disconnect cancels support; reconnect does not complete a stale action', () => {
  const w=setup(),[a,b]=w.players; b.hp=40; input(w,a,true); step(w,0.5); a.connected=false; w.resetInput(a.id); step(w,1);
  a.connected=true; step(w,1); assert.equal(b.hp,40); assert.equal(a.supplies.medkit,1);
});
scenario('solo hold heals self and still costs one medkit', () => {
  const w=setup(1),[a]=w.players; a.hp=20; input(w,a,true); step(w,1.25); assert.equal(a.hp,60); assert.equal(a.supplies.medkit,0);
});
scenario('bleedout spectates, then returns human with the same loadout', () => {
  const w=setup(),[,b]=w.players; w.giveWeapon(b,'rifle'); down(b); b.downT=0.05; step(w,0.1);
  assert.equal(b.state,'dead'); step(w,5); assert.equal(b.state,'dead'); w.rallyTeam();
  assert.equal(b.state,'alive'); assert.ok(b.weapons.includes('rifle')); assert.equal(b.tp,1);
});
scenario('no live connected teammate ends the arena immediately', () => {
  const w=setup(); w.players.forEach(down); step(w,0.05); assert.ok(w.over);
});
scenario('NPC mutation stages survive snapshot; no early hostile or duplicate drop', () => {
  const w=setup(); const n={ id:'oleg',kind:'manBrown',name:'Олег',x:500,y:500,angle:0,hp:80,maxHp:80,mode:'follow' as const,
    weapon:'smg' as const,fireCd:0,follow:'p0',goal:null,lines:[],talkCd:0,tag:'coworker',rescued:true,vx:0,vy:0,hurtT:0 };
  w.npcs.push(n); w.infect(n,'normal','os'); w.infect(n,'fast','os'); assert.equal(w.countTag('os'),1);
  step(w,1); const s=encodeSnapshot(w); assert.equal(s.n[0].mutation?.stage,'feathers'); assert.equal(w.enemies.length,0);
  step(w,1.1); assert.equal(w.enemies.length,0); step(w,0.15); assert.equal(w.enemies.length,1);
  assert.equal(w.pickups.filter(p=>p.weapon==='smg').length,1); step(w,0.5);
  assert.equal(w.pickups.filter(p=>p.weapon==='smg').length,1);
  assert.equal(decodeEnemies(encodeSnapshot(w),new Map())[0].appearance?.name,'Олег');
});
scenario('recruitment rolls once; plans and remaining delay survive level carry', () => {
  const w=setup(); const n={id:'friend',kind:'manBlue',name:'Друг',x:500,y:500,angle:0,hp:80,maxHp:80,mode:'follow' as const,
    weapon:null,fireCd:0,follow:'p0',goal:null,lines:[],talkCd:0,tag:'friend',rescued:true,vx:0,vy:0,hurtT:0};
  w.npcs.push(n); step(w,0.1); const plan={...w.npcs[0].betrayal!};
  step(w,1); assert.equal(w.npcs[0].betrayal!.checked,true);
  const carry=w.carryOut(); const next=setup(); next.opts.carry=carry; next.start();
  const carried=next.npc('friend')!; assert.deepEqual(carried.betrayal,carry.npcs[0].betrayal);
  step(next,0.2); assert.equal(carried.betrayal!.remaining < 0,plan.remaining < 0);
});
scenario('random betrayal waits for twenty seconds of help and cannot overlap', () => {
  const w=setup(); w.players.forEach(p=>p.hp=1e6);
  for(let i=0;i<3;i++) w.npcs.push({id:'n'+i,kind:'manBlue',name:'Друг '+i,x:600+i*80,y:600,angle:0,hp:1e6,maxHp:1e6,
    mode:'guard',weapon:null,fireCd:0,follow:'p0',goal:null,lines:[],talkCd:0,tag:'friend',rescued:true,vx:0,vy:0,hurtT:0,
    betrayal:{checked:true,remaining:0,helped:0}});
  step(w,19); assert.ok(w.npcs.every(n=>!n.mutation)); step(w,1.1);
  assert.equal(w.npcs.filter(n=>n.mutation).length,1); step(w,2.3); w.enemies=[];
  step(w,27); assert.equal(w.npcs.filter(n=>n.mutation).length,1);
  step(w,1); assert.equal(w.npcs.filter(n=>n.mutation).length,2); step(w,2.3); w.enemies=[];
  step(w,35); assert.equal(w.npcs.filter(n=>n.mutation).length,2);
});
scenario('office mandatory keys survive NPC mutation and death exactly once', () => {
  const map = new GameMap('office', JSON.parse(fs.readFileSync('public/assets/maps/office.tmj','utf8')));
  const w = new World(map, LEVELS.office, {solo:false,seed:1337}); w.addPlayer('me','QA',0);
  const marat=w.npc('marat')!, guard=w.npc('petrovich')!;
  w.infect(marat); step(w,2.3); w.infect(marat); w.damageNpc(marat,999);
  assert.equal(w.pickups.filter(k=>k.key==='blue').length,1);
  w.damageNpc(guard,999); w.damageNpc(guard,999);
  assert.equal(w.pickups.filter(k=>k.key==='server').length,1);
});
console.log(`${checks} authority regression scenarios passed`);
