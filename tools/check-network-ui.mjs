// Real two-page app flow. Debug command only sets up a wounded teammate.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base = process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors = [], results = [];
try {
  const host = await browser.newPage({viewport:{width:960,height:720}});
  const friend = await browser.newPage({viewport:{width:960,height:720}});
  for (const page of [host,friend]) {
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/?loop=timeout');
    await page.getByRole('button',{name:'Создать комнату',exact:true}).waitFor();
  }
  await host.locator('.name').fill('QA ведущий');
  await host.getByRole('button',{name:'Создать комнату',exact:true}).click();
  await host.locator('.code').waitFor();
  const code = await host.locator('.code').textContent();
  await friend.locator('.name').fill('QA друг');
  await friend.getByRole('button',{name:'Войти по коду',exact:true}).click();
  await friend.locator('.code-input').fill(code);
  await friend.getByRole('button',{name:'Войти',exact:true}).click();
  await friend.locator('.code').waitFor();
  await friend.getByRole('button',{name:'Готов',exact:true}).click();
  await host.getByRole('button',{name:'Старт',exact:true}).click();
  for (const page of [host,friend]) await page.waitForFunction(() => window.__app?.net?.gotSnapshot && window.__game?.scene.isActive('game'));
  results.push('two app menus → ready → playing');
  const id = await friend.evaluate(() => __app.room.sessionId);
  await friend.evaluate(() => __app.room.send('debug',{cmd:'down'}));
  await host.waitForFunction(id => __app.net.view.players.some(p=>p.id===id && p.state==='downed'), id);
  await host.evaluate(id => {
    window.__approach = setInterval(() => {
      const me=__app.net?.view.players.find(p=>p.id===__app.net.myId), other=__app.net?.view.players.find(p=>p.id===id);
      if (!me || !other) return;
      const d=Math.hypot(me.x-other.x,me.y-other.y);
      window.__input={mx:d>55?(other.x-me.x)/d:0,my:d>55?(other.y-me.y)/d:0,fire:false};
    },30);
  },id);
  await host.waitForFunction(id => {
    const me=__app.net.view.players.find(p=>p.id===__app.net.myId), other=__app.net.view.players.find(p=>p.id===id);
    return Math.hypot(me.x-other.x,me.y-other.y)<=60;
  },id,{timeout:5000});
  await host.evaluate(()=>{clearInterval(window.__approach);delete window.__input;});
  await host.keyboard.down('e');
  await host.locator('.hud-support.show').waitFor();
  await host.screenshot({path:'docs/qa/coop-ui-support.png'});
  await friend.waitForFunction(() => {
    const p=__app.net.view.players.find(p=>p.id===__app.net.myId); return p?.state==='alive' && p.hp===45;
  }, null, {timeout:6500});
  await host.keyboard.up('e');
  results.push('real E hold revives remote player to 45 HP and shows progress');
  const before = await friend.evaluate(() => ({supplies:__app.net.view.players.find(p=>p.id===__app.net.myId).supplies, time:__app.net.view.time}));
  await friend.evaluate(() => {window.__oldRoom=__app.room; __app.room.connection.close();});
  await friend.waitForFunction(id => __app.room && __app.room!==window.__oldRoom && __app.room.sessionId===id && __app.net?.gotSnapshot && __game.scene.isActive('game'), id, {timeout:15000});
  const after = await friend.evaluate(() => ({supplies:__app.net.view.players.find(p=>p.id===__app.net.myId).supplies,time:__app.net.view.time,connected:__app.net.view.players.find(p=>p.id===__app.net.myId).connected}));
  assert.deepEqual(after.supplies,before.supplies); assert.ok(after.time>before.time); assert.equal(after.connected,true);
  await friend.screenshot({path:'docs/qa/coop-ui-rejoined.png'});
  results.push('App automatic reconnect resumes same ID, supplies and live snapshots');
  assert.deepEqual(errors,[]);
  fs.writeFileSync('docs/qa/coop-ui.json',JSON.stringify({renderer:'Chromium SwiftShader (software)',results,errors},null,2));
  console.log(results.map(r=>'PASS '+r).join('\n'));
} finally { await browser.close(); }
