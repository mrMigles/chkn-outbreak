// QA fixtures position the actor; mouse, keyboard and E then use the normal client input path.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.SMOKE_URL??'http://localhost:2589',out='docs/qa/engagement';
fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('chkn-settings',JSON.stringify({tutorials:false})));
  const load=async level=>{
    await page.goto(`${base}/?level=${level}&loop=timeout`);
    await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.session);
    await page.evaluate(()=>{const w=__game.scene.getScene('game').session.world;w.god=true;w.npcs=[];w.enemies=[];w.cancelWaves();w.flags.escortWaveAt=99999;});
  };
  const at=async(kind,offset=0)=>{
    await page.evaluate(({kind,offset})=>{const w=__game.scene.getScene('game').session.world,p=w.players[0],i=w.incidents.find(i=>i.kind===kind);p.x=p.input.x=i.x;p.y=p.input.y=i.y+offset;p.tp++;},{kind,offset});
    await page.waitForTimeout(850);
  };
  const tap=async()=>{await page.keyboard.down('e');await page.waitForTimeout(120);await page.keyboard.up('e');await page.waitForTimeout(150);};
  const phase=async kind=>page.evaluate(kind=>__game.scene.getScene('game').session.world.incidents.find(i=>i.kind===kind).phase,kind);
  await load('office7');await at('alarm',35);
  const target=await page.evaluate(()=>{
    const s=__game.scene.getScene('game'),w=s.session.world,i=w.incidents.find(i=>i.kind==='alarm');
    const d=w.dprops.find(d=>w.map.objects.find(o=>o.id===d.id)?.props.incidentId===i.id),c=s.cameras.main;
    return {x:(d.x-c.worldView.x)*c.zoom,y:(d.y-65-c.worldView.y)*c.zoom};
  });
  await page.mouse.move(target.x,target.y);await page.mouse.down();await page.waitForTimeout(110);await page.mouse.up();
  assert.equal(await phase('alarm'),'warning');
  await page.screenshot({path:out+'/actual-alarm-shot.png'});
  await tap();assert.equal(await phase('alarm'),'disabled');
  results.push('Actual mouse shot hits the visible red alarm; keyboard E cancels during its countdown.');
  await load('lab');await at('coffee');
  await page.evaluate(()=>{__game.scene.getScene('game').session.world.players[0].hp=50;});
  await tap();assert.equal(await phase('coffee'),'done');
  assert.equal(await page.evaluate(()=>__game.scene.getScene('game').session.world.players[0].hp),65);
  results.push('Actual keyboard E dispenses one coffee and heals the player by15.');
  await at('cache');await tap();assert.equal(await phase('cache'),'active');
  await page.keyboard.down('d');await page.waitForTimeout(1400);await page.keyboard.up('d');
  await page.waitForFunction(()=>__game.scene.getScene('game').session.world.incidents.find(i=>i.kind==='cache').paused===true);
  const remaining=await page.evaluate(()=>__game.scene.getScene('game').session.world.incidents.find(i=>i.kind==='cache').seconds);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>__game.scene.getScene('game').session.world.incidents.find(i=>i.kind==='cache').seconds),remaining);
  await at('cache');
  await page.waitForFunction(()=>__game.scene.getScene('game').session.world.incidents.find(i=>i.kind==='cache').phase==='done',{timeout:18000});
  assert.ok(await page.evaluate(()=>__game.scene.getScene('game').session.world.players[0].achievements.includes('overtime_pay')));
  await page.screenshot({path:out+'/actual-cache-reward.png'});
  results.push('Actual E starts the supply defense; keyboard retreat pauses it; returning completes the reward.');
  assert.deepEqual(errors,[]);fs.writeFileSync(out+'/play-report.json',JSON.stringify({results,errors},null,2));
  console.log(results.map(r=>'PASS '+r).join('\n'));
} finally {await browser.close();}
