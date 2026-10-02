// Real browser fixtures exercise authoritative award snapshots, compact alerts and persisted preferences.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const base = process.env.SMOKE_URL ?? 'http://localhost:5282';
const out = 'docs/qa/engagement';
fs.mkdirSync(out, { recursive: true });
const results = [], errors = [], screenshots = [], layouts = [];
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
async function shot(page, name) {
  const path = `${out}/${name}.png`; await page.screenshot({ path }); screenshots.push(path);
}
async function bounds(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height, scrollWidth:el.scrollWidth, clientWidth:el.clientWidth };
  });
}
try {
  for (const [name, viewport, mobile] of [['desktop',{width:1280,height:720},false],['phone-landscape',{width:844,height:390},true],['phone-portrait',{width:390,height:844},true]]) {
    const context = await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(`${name}: ${e.message}`));
    await page.goto(base+'/?loop=timeout');
    await page.locator('.menu').waitFor();
    await shot(page,name+'-menu');
    await page.locator('[data-a="preferences"]').click();
    await page.locator('.preferences').waitFor();
    for (const key of ['banter','combatText','achievementPopups']) await page.locator(`[data-pref="${key}"]`).uncheck();
    await page.locator('[data-pref="reducedFlashes"]').check();
    await page.locator('[data-pref="shake"]').fill('0'); await page.locator('[data-pref="shake"]').dispatchEvent('input');
    const prefs = await page.evaluate(()=>JSON.parse(localStorage.getItem('chkn-settings')));
    assert.equal(prefs.banter,false); assert.equal(prefs.combatText,false); assert.equal(prefs.achievementPopups,false); assert.equal(prefs.reducedFlashes,true); assert.equal(prefs.shake,0);
    assert.equal(await page.locator('.preference-check').evaluateAll(labels=>labels.every(el=>el.getBoundingClientRect().height>=44)),true);
    await shot(page,name+'-settings');
    await page.locator('[data-a="back"]').click();
    await page.locator('[data-a="achievements"]').click();
    assert.equal(await page.locator('.achievement-entry').count(),15);
    assert.equal(await page.locator('.achievement-entry.earned').count(),0);
    await shot(page,name+'-achievements');
    await page.goto(base+'/?level=office7&loop=timeout');
    await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.session);
    await page.waitForTimeout(3700); // let the level title finish before measuring live combat HUD
    await page.evaluate(()=>{ const s=__game.scene.getScene('game'), w=s.session.world; w.god=true; w.flags.escortWaveAt=99999; w.addPlayer('qa-other','Чужой',1); w.award('field_medic','qa-other'); });
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('chkn-achievements')??'[]').includes('field_medic')),false);
    await page.evaluate(()=>__game.scene.getScene('game').session.world.removePlayer('qa-other'));
    await page.evaluate(()=>{const w=__game.scene.getScene('game').session.world;w.award('coffee_break','me');});
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('chkn-achievements')??'[]').includes('coffee_break'));
    assert.equal(await page.locator('.hud-notice').evaluate(el=>el.classList.contains('show')&&el.textContent.includes('Кофе сильнее страха')),false);
    await page.evaluate(()=>__game.scene.getScene('game').togglePause());
    await page.locator('.pause-menu [data-a="settings"]').click();
    assert.equal(await page.locator('.tip-card').evaluateAll(els=>els.some(el=>getComputedStyle(el).display!=='none')),false,'tutorial cannot cover pause controls');
    await page.locator('.pause-menu [data-pref="achievementPopups"]').check();
    await page.locator('.pause-menu [data-a="back"]').click();
    await page.locator('.pause-menu [data-a="resume"]').click();
    await page.evaluate(()=>{const w=__game.scene.getScene('game').session.world;w.award('quiet_shift','me');});
    await page.waitForFunction(()=>document.querySelector('.hud-notice.show')?.textContent.includes('Без лишнего шума'));
    await page.evaluate(()=>{
      const s=__game.scene.getScene('game'), w=s.session.world,p=w.players[0];
      w.emit({e:'notice',tone:'tip',text:'ПОДСКАЗКА В ОЧЕРЕДИ',sub:'Не перебивает бой.'});
      w.emit({e:'notice',tone:'danger',text:'СИГНАЛКА ЗАДЕТА',sub:'3 секунды до вызова стаи! E у пульта — обесточить.'});
      const i=w.incidents.find(i=>i.kind==='alarm');
      if(i){i.phase='warning';i.seconds=3;i.x=p.x+200;i.y=p.y;}
      else w.incidents.push({id:'qa-alarm',kind:'alarm',phase:'warning',seconds:3,left:24,x:p.x+200,y:p.y,group:'escort',hintShown:true,batches:0,nextBatch:999999});
    });
    await page.waitForFunction(()=>document.querySelector('.hud-notice.show')?.dataset.tone==='danger');
    assert.ok((await page.locator('.hud-incident').textContent()).includes('Стая через'));
    assert.ok((await page.locator('.obj-text').textContent()).length>0);
    const alertBox=await bounds(page,'.hud-notice'), goalBox=await bounds(page,'.hud-incident'), storyBox=await bounds(page,'.hud-obj'), weaponBox=await bounds(page,'.hud-weapon');
    const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
    assert.equal(overlaps(goalBox,storyBox),false,'mini-goal must clear the story objective');
    assert.equal(overlaps(goalBox,weaponBox),false,'mini-goal must clear weapon/ammunition');
    assert.equal(overlaps(alertBox,{x:viewport.width/2-90,y:viewport.height/2-80,width:180,height:160}),false,'alerts must keep the player area clear');
    await page.waitForTimeout(220); // capture the alert after its short fade-in
    for(const b of [alertBox,goalBox]){assert.ok(b.x>=0&&b.x+b.width<=viewport.width+1);assert.ok(b.y>=0&&b.y+b.height<=viewport.height+1);assert.ok(b.scrollWidth<=b.clientWidth+1);}
    layouts.push({name,viewport,alertBox,goalBox,storyBox,weaponBox});
    await shot(page,name+'-alarm');
    await page.evaluate(()=>{
      const s=__game.scene.getScene('game'),w=s.session.world,p=w.players[0];
      for(const i of w.incidents)i.phase='disabled';
      w.incidents.push({id:'qa-cache',kind:'cache',phase:'active',seconds:12,left:12,paused:true,x:p.x+200,y:p.y,group:'escort',hintShown:true,batches:0,nextBatch:999999});
    });
    await page.waitForFunction(()=>document.querySelector('.hud-incident')?.textContent.includes('загрузка на паузе'));
    await shot(page,name+'-cache');
    await page.evaluate(()=>{
      const w=__game.scene.getScene('game').session.world,p=w.players[0];
      const cache=w.incidents.find(i=>i.id==='qa-cache');cache.x=p.x+620;cache.paused=true;
      w.incidents.push({id:'qa-coffee',kind:'coffee',phase:'ready',seconds:0,left:0,x:p.x+150,y:p.y,group:'escort',hintShown:true,batches:0,nextBatch:999999});
    });
    await page.waitForFunction(()=>document.querySelector('.hud-incident')?.textContent.includes('Кофе рядом'));
    await page.evaluate(()=>__app.mainMenu());
    await page.locator('[data-a="achievements"]').click();
    assert.equal(await page.locator('.achievement-entry.earned').count(),2);
    assert.equal(await page.locator('.achievement-entry').evaluateAll(els=>els.some(el=>el.classList.contains('earned')&&el.textContent.includes('Коллега года'))),false);
    await page.reload();
    await page.waitForFunction(()=>window.__game?.scene.getScene('game')?.session);
    await page.evaluate(()=>__app.mainMenu());await page.locator('[data-a="preferences"]').click();
    assert.equal(await page.locator('[data-pref="banter"]').isChecked(),false);
    assert.equal(await page.locator('[data-pref="achievementPopups"]').isChecked(),true);
    results.push(`${name}: menu, 44px preferences, persistent pause settings, own-player awards, queued danger alert, separate mini-goal, paused cache can be skipped for nearby coffee`);
    await context.close();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${out}/ui-report.json`,JSON.stringify({results,errors,screenshots,layouts},null,2));
  console.log(results.map(r=>'PASS '+r).join('\n'));
} catch (error) { console.error('Browser errors:', errors); throw error; }
finally { await browser.close(); }
