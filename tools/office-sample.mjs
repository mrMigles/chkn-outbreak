// Controlled render/combat sample, not a claim of a natural campaign playthrough.
import fs from 'node:fs';
import { chromium } from 'playwright';
const base=process.env.SMOKE_URL ?? 'http://localhost:5280';
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/?level=office');
  await page.waitForFunction(()=>window.__game?.scene.isActive('game'));
  await page.evaluate(()=>{
    const scene=__game.scene.getScene('game'), w=scene.session.world, p=w.players[0];
    w.giveWeapon(p,'smg'); scene.desiredWeapon=p.cur; p.ammo.smg.reserve=420; // exercise automatic weapon feel, unchanged live weapon stats
    const trace={shots:0,kills:0}; window.__sampleTrace=trace;
    const emit=w.emit.bind(w); w.emit=ev=>{if(ev.e==='shot' && ev.o===p.id)trace.shots++;if(ev.e==='kill')trace.kills++;emit(ev);};
    window.__sampleLoop=setInterval(()=>{
      let best=null, bd=Infinity;
      for(const e of w.enemies) {const d=Math.hypot(e.x-p.x,e.y-p.y); if(e.state!=='rise' && d<bd && w.map.lineOfSight(p.x,p.y,e.x,e.y,true)){best=e;bd=d;}}
      if(best) {const a=Math.atan2(best.y-p.y,best.x-p.x); window.__input={fire:true,aimX:best.x,aimY:best.y-scene.elevation,mx:bd<100?-Math.cos(a):0,my:bd<100?-Math.sin(a):0};}
      else window.__input={fire:false,aimX:p.x+250,aimY:p.y-scene.elevation,mx:0,my:0};
    },30);
  });
  await page.waitForTimeout(13000);
  const combat=await page.evaluate(()=>({trace:__sampleTrace,state:__game.scene.getScene('game').session.world.players[0].state,fps:Math.round(__game.loop.actualFps)}));
  await page.screenshot({path:'docs/qa/office-25d-combat.png'});
  if(combat.trace.kills<1 || combat.trace.shots<4) throw new Error('Combat sample did not exercise shooting/kills: '+JSON.stringify(combat));
  const sizes=[[1280,720],[640,720],[390,844],[844,390],[1920,1080]];
  for(const [width,height] of sizes) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(300);
    const bounds=await page.evaluate(()=>{
      const hp=document.querySelector('.hp-wrap').getBoundingClientRect(), obj=document.querySelector('.hud-obj').getBoundingClientRect();
      return {overlap:hp.left<obj.right && hp.right>obj.left && hp.top<obj.bottom && hp.bottom>obj.top,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    if(bounds.overlap || bounds.overflow) throw new Error('HUD overlap/overflow at '+width+'x'+height);
    await page.screenshot({path:`docs/qa/office-${width}x${height}.png`});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.evaluate(()=>{
    clearInterval(window.__sampleLoop);
    const scene=__game.scene.getScene('game'),w=scene.session.world,p=w.players[0];
    w.enemies=[]; w.npcs=[];
    const friend=w.addPlayer('qa-friend','Друг',1);
    friend.x=p.x+60; friend.y=p.y; friend.input.x=friend.x; friend.input.y=friend.y;
    friend.state='downed'; friend.hp=0; friend.downT=18;
    window.__input={fire:false,interact:true,mx:0,my:0,aimX:p.x+250,aimY:p.y-scene.elevation};
  });
  await page.waitForTimeout(900);
  const support=await page.evaluate(()=>({shown:document.querySelector('.hud-support').classList.contains('show'),text:document.querySelector('.hud-support span').textContent,progress:__game.scene.getScene('game').session.world.players[0].support?.progress}));
  if(!support.shown || !(support.progress>0 && support.progress<1)) throw new Error('Support HUD missing: '+JSON.stringify(support));
  await page.screenshot({path:'docs/qa/office-support.png'});
  await page.evaluate(()=>window.__input.interact=false);
  await page.waitForTimeout(150);
  if(await page.evaluate(()=>document.querySelector('.hud-support').classList.contains('show'))) throw new Error('Support HUD did not clear after release');
  if(errors.length) throw new Error(errors.join('\n'));
  fs.writeFileSync('docs/qa/office-sample.json',JSON.stringify({renderer:'Chromium WebGL via SwiftShader (software)',combat,sizes,support,errors},null,2));
  console.log(JSON.stringify({combat,viewportChecks:sizes.length,support,errors},null,2));
} finally {await browser.close();}
