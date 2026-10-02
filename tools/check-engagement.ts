import assert from 'node:assert/strict';
import fs from 'node:fs';
import { World } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
import { RoomRecording } from '../src/shared/sim/Checkpoint';
import { encodeSnapshot } from '../src/shared/protocol';
const data = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const make = (id = 'office7') => {
  const w = new World(new GameMap(id, data(id)), {id,title:'QA',subtitle:''}, {solo:true,seed:808});
  w.addPlayer('me','QA',0); w.start(); w.god = true; w.npcs = []; w.enemies = []; return w;
};
const step = (w: World, seconds: number) => { for (let i=0;i<Math.round(seconds*30);i++) w.step(1/30); };
const place = (w: World, x:number,y:number) => {const p=w.players[0]; p.x=p.input.x=x;p.y=p.input.y=y;};
const tap = (w: World) => {
  const p=w.players[0];w.setInput(p.id,{...p.input,interact:true});step(w,.04);
  w.setInput(p.id,{...p.input,interact:false});step(w,.04);
};
{
  const w=make(), alarm=w.incidents.find(i=>i.kind==='alarm')!;
  place(w,alarm.x,alarm.y);tap(w);assert.equal(alarm.phase,'disabled');
  assert.ok(w.players[0].achievements?.includes('quiet_shift'));
  const score=w.players[0].score;step(w,1);tap(w);assert.equal(w.players[0].score,score);
  step(w,15);assert.equal(w.enemies.length,0);
  console.log('PASS real E edge disables the alarm once, without a hyperwave or reward farming');
}
{
  const w=make(),alarm=w.incidents.find(i=>i.kind==='alarm')!;
  const prop=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===alarm.id)!;
  place(w,alarm.x,alarm.y+30);
  const p=w.players[0];p.aim=Math.atan2(prop.y-28-(p.y-36),prop.x-p.x);w.fire(p,'pistol');
  assert.equal(alarm.phase,'warning','an actual bullet, not just a scripted trigger, hits the red panel');
  assert.ok(alarm.seconds>2.9);assert.equal(w.countTag('incident:'+alarm.id),0);
  place(w,alarm.x,alarm.y);tap(w);step(w,4);assert.equal(alarm.phase,'disabled');assert.equal(w.enemies.length,0);
  console.log('PASS stray bullet gives three seconds to cut the alarm before any enemy arrives');
}
{
  for (const height of [55, 100]) {
    const w=make(),alarm=w.incidents.find(i=>i.kind==='alarm')!;
    const prop=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===alarm.id)!;
    place(w,prop.x-110,prop.y-height+36);
    const p=w.players[0];p.aim=0;w.fire(p,'pistol');
    assert.equal(alarm.phase,'warning',`visible alarm body at height ${height} must catch a bullet`);
  }
  console.log('PASS stray shots at the middle and top of the visible alarm body both trigger it');
}
{
  const w=make(),alarm=w.incidents.find(i=>i.kind==='alarm')!;
  const prop=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===alarm.id)!;
  w.damageProp(prop,1,'me');step(w,3.1);assert.equal(alarm.phase,'active');assert.equal(alarm.left,24);
  for(let i=0;i<24;i++){step(w,1);for(const e of [...w.enemies])w.killEnemy(e,0,'me',false,false);}
  step(w,.1);assert.equal(w.events.filter(e=>e.e==='spawn').length,24);assert.equal(alarm.phase,'done');
  assert.ok(w.players[0].achievements?.includes('fire_drill'));assert.equal(w.alarm,false,'optional alarm never hijacks story alarm');
  const score=w.players[0].score;step(w,1);assert.equal(w.players[0].score,score);
  console.log('PASS hyperwave has exactly 24 attackers in finite groups; clearing awards once and keeps story alarm unchanged');
}
{
  const w=make('lab'),coffee=w.incidents.find(i=>i.kind==='coffee')!;
  const p=w.players[0];p.hp=50;place(w,coffee.x,coffee.y);tap(w);
  assert.equal(coffee.phase,'done');assert.equal(p.hp,65);assert.ok(p.buffs!.sprint!>9.8);
  step(w,1);tap(w);assert.equal(p.hp,65);step(w,10);assert.equal(p.buffs?.sprint,undefined);
  console.log('PASS coffee heals 15, boosts for ten seconds and cannot be refilled');
}
{
  const w=make('lab'),coffee=w.incidents.find(i=>i.kind==='coffee')!;
  const prop=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===coffee.id)!;
  w.damageProp(prop,9999,'me');step(w,.04);place(w,coffee.x,coffee.y);tap(w);
  assert.equal(coffee.phase,'disabled');assert.ok(!w.players[0].achievements?.includes('coffee_break'));
  console.log('PASS a destroyed vending machine cannot dispense invisible coffee');
}
{
  const w=make('lab'),coffee=w.incidents.find(i=>i.kind==='coffee')!;
  place(w,coffee.x,coffee.y);const p=w.players[0],ally=w.addPlayer('ally','Друг',1);
  ally.x=coffee.x+40;ally.y=coffee.y;ally.input.x=ally.x;ally.input.y=ally.y;tap(w);
  assert.equal(coffee.phase,'done');assert.ok(ally.achievements?.includes('coffee_break'));assert.equal(p.supplies.ammo,1);
  console.log('PASS a healthy teammate beside the coffee machine does not swallow E; reward reaches both players');
}
{
  const w=make('factory'),cache=w.incidents.find(i=>i.kind==='cache')!;
  place(w,cache.x,cache.y);tap(w);step(w,3);assert.equal(cache.phase,'active');
  const remaining=cache.seconds;place(w,cache.x-400,cache.y);step(w,3);assert.equal(cache.seconds,remaining);assert.equal(cache.paused,true);
  place(w,cache.x,cache.y);step(w,9.2);assert.equal(cache.phase,'done');
  assert.ok(w.players[0].achievements?.includes('overtime_pay'));assert.equal(w.players[0].armor,20);
  assert.ok(w.pickups.some(k=>k.kind==='infinite') || (w.players[0].buffs?.infinite??0)>0);
  console.log('PASS optional defense pauses outside its marked area, then pays armor/ammo/buff after twelve defended seconds');
}
{
  const w=make('factory'),cache=w.incidents.find(i=>i.kind==='cache')!;
  place(w,cache.x,cache.y);
  for(let n=0;n<85;n++)w.spawnEnemy('normal',180+n,180,{aggro:false});
  tap(w);step(w,12.2);assert.equal(cache.phase,'done');
  assert.ok(w.players[0].achievements?.includes('overtime_pay'));
  assert.equal(w.countTag('incident:'+cache.id),0);
  console.log('PASS a busy floor suppresses optional reinforcements but still pays the promised twelve-second cache');
}
{
  const w=make('arena');place(w,1200,1000);
  for(let i=0;i<3;i++)w.spawnEnemy('normal',1320+i*8,1000,{aggro:false}).hp=70;
  w.explode(1340,1000,170,140,'me','barrel');
  assert.ok(w.players[0].achievements?.includes('barrel_barbeque'));
  w.award('barrel_barbeque','me');assert.equal(w.events.filter(e=>e.e==='achievement').length,1);
  const carry=w.carryOut();assert.ok(carry.players.me.achievements?.includes('barrel_barbeque'));
  console.log('PASS one real barrel explosion kills three; achievement is idempotent and carries between floors');
}
{
  const map=data('office7');
  const at=new GameMap('office7',map).objects.find(o=>o.props.incident==='alarm'&&o.type==='use')!;
  for(const layer of map.layers)for(const o of layer.objects??[])if(o.type==='spawn'&&o.name==='player'){o.x=at.cx-(o.width??0)/2;o.y=at.cy+35-(o.height??0)/2;}
  const w=new World(new GameMap('office7',map),LEVELS.office7,{solo:false,seed:909});
  const p=w.addPlayer('me','QA',0);w.start();const r=new RoomRecording(w);
  const alarm=w.incidents.find(i=>i.kind==='alarm')!;
  const prop=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===alarm.id)!;
  p.input.aim=Math.atan2(prop.y-28-(p.y-36),prop.x-p.x);p.input.fire=true;
  for(let i=0;i<65;i++)r.step(1/30);p.input.fire=false;r.step(1/30);
  assert.equal(alarm.phase,'warning');
  const restored=RoomRecording.restore(map,JSON.parse(JSON.stringify(r.checkpoint())));
  assert.deepEqual(restored.world.incidents,w.incidents);
  for(let i=0;i<300;i++){r.step(1/30);restored.step(1/30);}
  assert.deepEqual(encodeSnapshot(restored.world),encodeSnapshot(w));
  assert.ok(encodeSnapshot(w).incidents!.some(i=>i.kind==='alarm'&&i.phase==='active'));
  console.log('PASS disk replay mid-countdown recreates incidental waves/rewards and exact multiplayer snapshots');
}
assert.equal(new World(new GameMap('office',data('office')),LEVELS.office,{solo:true,seed:1}).incidents.length,0);
console.log('PASS original first floor has no added incident hazards');
