import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WalkingCycle } from '../src/client/render/WalkingCycle';
import { World } from '../src/shared/sim/World';
import { GameMap } from '../src/shared/map';
import { LEVELS } from '../src/shared/levels';
const json = (id: string) => JSON.parse(fs.readFileSync(`public/assets/maps/${id}.tmj`, 'utf8'));
const step = (w: World, seconds: number) => { for (let i = 0; i < seconds * 60; i++) w.step(1 / 60); };
for (const fps of [30, 60, 120]) {
  const cycle = new WalkingCycle(); cycle.update(0, 0, 1 / fps, true);
  for (let i = 1; i <= fps; i++) cycle.update(i * 224 / fps, 0, 1 / fps, true);
  assert.ok(Math.abs(cycle.phase - 8) < 1e-6, 'same gait per distance at any refresh rate');
  for (let i = 0; i < fps; i++) assert.equal(cycle.update(224, 0, 1 / fps, true), 0);
  assert.equal(cycle.update(1000, 0, 1 / fps, true), 0, 'teleport does not animate walking');
}
const jitter = new WalkingCycle(); jitter.update(0, 0, 1 / 60, true);
for (let i = 0; i < 600; i++) assert.equal(jitter.update(i % 2 ? .08 : 0, 0, 1 / 60, true), 0);
console.log('PASS distance-based gait at 30/60/120 FPS; standing, settling jitter and teleports stay idle');
{
  const source = new World(new GameMap('office7', json('office7')), LEVELS.office7, {solo:true,seed:72});
  const w = new World(new GameMap('arena', json('arena')), {id:'arena',title:'QA',subtitle:''}, {solo:true,seed:72});
  const p = w.addPlayer('me', 'QA', 0); w.start(); p.x = p.input.x = 1400; p.y = p.input.y = 1056;
  w.npcs = source.npcs.filter(n => ['andrey','sergey','vlad','stas','pasha'].includes(n.id));
  w.npcs.forEach((n,i) => { n.x = 1190 + i * 10; n.y = 1056; n.mode = 'follow'; n.follow = 'me'; n.rescued = true; });
  step(w, 15); const before = w.npcs.map(n => [n.x,n.y]); step(w, 1);
  for (const [i,n] of w.npcs.entries()) assert.ok(Math.hypot(n.x-before[i][0],n.y-before[i][1]) < 1, 'stationary group settles instead of oscillating');
  console.log('PASS five followers settle and stand beside a stationary player');
}
for (const height of [-45, 4]) {
  const w = new World(new GameMap('arena', json('arena')), {id:'arena',title:'QA',subtitle:''}, {solo:true,seed:72});
  const p = w.addPlayer('me', 'QA', 0); w.start(); p.x = p.input.x = 1200; p.y = p.input.y = 1000;
  const barrel = {id:999,x:1400,y:1000,hp:30}, chain = {id:1000,x:1470,y:1000,hp:30};
  w.barrels = [barrel, chain]; p.aim = Math.atan2(barrel.y+height-(p.y-36),barrel.x-p.x);
  w.fire(p,'pistol'); w.fire(p,'pistol'); assert.ok(!w.barrels.includes(barrel), 'visible top and base both accept bullets');
  step(w,.4); assert.equal(w.barrels.length,0); assert.equal(w.events.filter(e=>e.e==='boom'&&e.k==='barrel').length,2);
}
for (const id of ['lab','factory','boss']) assert.ok(!new GameMap(id,json(id)).objects.some(o=>o.type==='prop'&&o.name==='hazard_barrel'), 'red hazardous barrels are explosive entities');
console.log('PASS barrel top/base hits, chained explosions and every red barrel is explosive');
