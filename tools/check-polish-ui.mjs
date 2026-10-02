// Real browser evidence for idle animation, mutation cleanup, death panels and floor retries.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.SMOKE_URL ?? 'http://localhost:2587';
const out = 'docs/qa/polish'; fs.mkdirSync(out,{recursive:true});
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('chkn-settings',JSON.stringify({tutorials:false,dev:true,devLevel:'office7'})));
  await page.goto(base+'/?level=office7&loop=timeout');
  await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.session);
  await page.evaluate(()=>{
    const w=__game.scene.getScene('game').session.world,p=w.players[0],n=w.npc('andrey');
    w.god=true;w.flags.escortWaveAt=9999;n.x=p.x-90;n.y=p.y;n.mode='follow';n.follow=p.id;n.rescued=true;
  });
  await page.waitForTimeout(1800);
  const idle=await page.evaluate(async()=>{
    const frames=[];
    for(let i=0;i<20;i++){frames.push(__game.scene.getScene('game').npcs.get('andrey').rig.body.frame.name);await new Promise(r=>requestAnimationFrame(r));}
    return frames;
  });
  assert.ok(idle.every(f=>f.endsWith('_0')),JSON.stringify(idle));
  results.push('stationary follower holds the idle pose');
  await page.keyboard.down('d');
  const walk=await page.evaluate(async()=>{
    const frames=[];
    for(let i=0;i<50;i++){frames.push(__game.scene.getScene('game').npcs.get('andrey').rig.body.frame.name);await new Promise(r=>requestAnimationFrame(r));}
    return frames;
  });
  await page.keyboard.up('d');assert.ok(new Set(walk).size>=3);
  results.push('actual walking advances the NPC pose by travel');
  await page.evaluate(()=>{const w=__game.scene.getScene('game').session.world;w.infect(w.npc('andrey'),'normal','fixture');});
  await page.waitForFunction(()=>__game.scene.getScene('game').npcs.get('andrey').warn?.visible);
  await page.waitForFunction(()=>__game.scene.getScene('game').session.world.npc('andrey').mode==='gone');
  assert.equal(await page.evaluate(()=>__game.scene.getScene('game').npcs.get('andrey').warn.visible),false);
  await page.screenshot({path:out+'/mutation-cleared.png'});
  results.push('mutation indicator disappears with the converted NPC');
  await page.evaluate(()=>{const w=__game.scene.getScene('game').session.world,p=w.players[0];w.god=false;p.buffs={};w.damagePlayer(p,9999,p.x,p.y);});
  await page.locator('button[data-a="retry"]').waitFor({timeout:10000});
  await page.screenshot({path:out+'/solo-death.png'});
  await page.locator('button[data-a="retry"]').click();
  await page.waitForFunction(()=>__game.scene.getScene('game').session.world.npc('andrey').mode==='cower');
  assert.equal(await page.evaluate(()=>__game.scene.getScene('game').session.world.flags.elenaStarted),undefined);
  results.push('solo death panel appears; retry resets the current floor');
  await page.goto(base+'/?loop=timeout');
  await page.getByRole('button',{name:'Создать комнату',exact:true}).click();
  await page.locator('button[data-a="start"]').waitFor(); await page.locator('button[data-a="start"]').click();
  await page.waitForFunction(()=>__app.net?.gotSnapshot);
  const entry=await page.evaluate(()=>{const p=__app.net.view.players.find(p=>p.id===__app.net.myId);return {x:p.x,y:p.y};});
  await page.keyboard.down('d');await page.waitForTimeout(700);await page.keyboard.up('d');
  await page.evaluate(()=>__app.room.send('debug',{cmd:'down'}));
  await page.locator('button[data-a="retry-room"]').waitFor({timeout:8000});
  await page.waitForFunction(()=>__app.room.state.phase==='defeat');
  assert.equal(await page.evaluate(()=>__app.room.state.phase),'defeat');
  await page.screenshot({path:out+'/room-death.png'});
  // Reconnect while defeated: schema state must recover the same death panel.
  await page.evaluate(()=>__app.room.connection.close());
  await page.locator('button[data-a="retry-room"]').waitFor({timeout:15000});
  await page.waitForTimeout(700);assert.equal(await page.evaluate(()=>__app.room.state.phase),'defeat');
  await page.locator('button[data-a="retry-room"]').click();
  await page.waitForFunction(()=>__app.net?.gotSnapshot&&__app.room.state.phase==='playing');
  const after=await page.evaluate(()=>{const p=__app.net.view.players.find(p=>p.id===__app.net.myId);return {x:p.x,y:p.y,hp:p.hp};});
  assert.ok(Math.hypot(after.x-entry.x,after.y-entry.y)<12);assert.ok(after.hp>=60);
  results.push('room death panel survives reconnect; host restarts at entrance');
  await page.waitForFunction(()=>!(__app.net.view.players.find(p=>p.id===__app.net.myId)?.buffs?.invincible>0));
  await page.evaluate(()=>__app.room.send('debug',{cmd:'down'}));
  await page.locator('button[data-a="retry-room"]').waitFor();
  await page.waitForFunction(()=>__app.room.state.phase==='defeat');
  const code=await page.evaluate(()=>__app.room.roomId);
  const peer=await browser.newPage({viewport:{width:1280,height:720}});
  peer.on('pageerror',e=>errors.push(e.message));
  await peer.goto(base+'/?loop=timeout');
  await peer.locator('button[data-a="join"]').click();
  await peer.locator('.code-input').fill(code);await peer.locator('button[data-a="go"]').click();
  await peer.getByRole('heading',{name:'КО-КО-КОНЕЦ'}).waitFor();
  assert.equal(await peer.locator('button[data-a="retry-room"]').count(),0);
  await page.locator('button[data-a="leave"]').click();
  await peer.locator('button[data-a="retry-room"]').waitFor();
  await peer.locator('button[data-a="retry-room"]').click();
  await peer.waitForFunction(()=>__app.net?.gotSnapshot&&__app.room.state.phase==='playing');
  results.push('host departure during defeat promotes a teammate and exposes the retry button');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/ui-report.json',JSON.stringify({results,errors,idle,walk},null,2));
  console.log(results.map(r=>'PASS '+r).join('\n'));
} finally {await browser.close();}
