const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../index.html'));
  server = http.createServer((_, res) => { res.setHeader('Content-Type','text/html'); res.end(html); });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  url = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
});
after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function game(t, width=1920, height=1080) {
  const page = await browser.newPage({viewport:{width,height}}), errors=[];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(async () => {
    newRun('fighter'); setPace('skip'); setPreference('shake',0); setPreference('skipCriticals',true);
    characterLuck = () => .99999; await document.fonts.ready;
  });
  t.after(async () => { await page.close(); assert.deepEqual(errors,[]); });
  return page;
}

test('stimulants last at most three recipient actions, overflow increases potency, and old buffs migrate once', async t => {
  const p=await game(t);
  const r=await p.evaluate(() => {
    const h=state.party[0];
    applyStimulant(h,2); const first={...h.stimulant};
    applyStimulant(h,2); const second={...h.stimulant};
    applyStimulant(h,4); const third={...h.stimulant};
    state.actionSerial++; tickStimulant(h); const tick={...h.stimulant};
    h.stimulant={power:2,turns:6,appliedAt:0}; normaliseStimulant(h); const migrated={...h.stimulant};
    normaliseStimulant(h);
    return {first,second,third,tick,migrated,again:h.stimulant};
  });
  assert.equal(r.first.turns,2); assert.equal(r.second.turns,3); assert.equal(r.second.power,r.first.power); assert.equal(r.second.overflow,1);
  assert.equal(r.third.turns,3); assert.ok(r.third.power>r.second.power); assert.equal(r.tick.turns,2);
  assert.equal(r.migrated.turns,3); assert.equal(r.migrated.power,5); assert.deepEqual(r.again,r.migrated);
});

test('self stimulant stays on its caster; ordinary ally stimulant follows the selected healing target',async t=>{
  const p=await game(t);
  const r=await p.evaluate(async()=>{
    state.party=[makeHero('Rogue','rogue'),makeHero('Mage','mage'),makeHero('Tank','fighter')];
    state.party[2].stats.spins=100; beginEncounter(false,{count:1}); finishOpeningRoll();
    state.enemy.hp=state.enemy.maxHp=10000; state.enemy.countdown=30;
    // Tank has a longer lifetime history; Rogue was actually used more this battle.
    state.party[0].stats.spins+=3;
    state.target=2; render();
    runMachine=async()=>[{type:'stimulant',tier:1},{type:'blank',tier:1},{type:'blank',tier:1}];
    await spin(0);
    const self=state.party.map(h=>!!h.stimulant);
    state.party.forEach(h=>h.stimulant=null);
    runMachine=async()=>[{type:'rally',tier:2},{type:'blank',tier:1},{type:'blank',tier:1}];
    await spin(1);
    const ally=state.party.map(h=>!!h.stimulant);
    const target=supportStimulantTarget(state.party[1]).name;
    state.party=[state.party[1]];
    return {self,ally,target,solo:supportStimulantTarget(state.party[0])===state.party[0]};
  });
  assert.deepEqual(r.self,[true,false,false]); assert.deepEqual(r.ally,[false,false,true]); assert.equal(r.target,'Rogue'); assert.equal(r.solo,true);
});

test('buff and Trick edit palettes, inherited support marks, saves and workshop descriptions share legal types',async t=>{
  const p=await game(t);
  const r=await p.evaluate(()=>{
    const rows=['fighter','rogue','berserker','mage','ranger','jester'].map(job=>{
      const h=makeHero(job,job);
      h.reels[0][0]={type:'stimulant',tier:4,weight:3};
      normaliseHeroBuild(h);
      return {job,types:editableTypes(h),migrated:h.reels[0][0],description:faceDescription({type:job==='jester'?'trick':'rally',tier:4},h)};
    });
    state.party=[makeHero('Fool','jester')]; beginEncounter(false,{count:1}); state.party[0].reels[0][0]={type:'trick',tier:4,weight:2};
    state.party[0].anticipation=4; save(); const loaded=load();
    editor(0);
    return {rows,loaded,meter:state.party[0].anticipation,face:state.party[0].reels[0][0],text:document.querySelector('#modal').textContent};
  });
  for(const row of r.rows){
    const support=['mage','ranger','jester'].includes(row.job);
    assert.equal(row.types.includes('stimulant'),!support); assert.equal(row.types.includes('rally'),support);
    assert.equal(row.types.includes('trick'),row.job==='jester');
    assert.equal(row.migrated.type,support?'rally':'stimulant'); assert.equal(row.migrated.weight,1);
    assert.ok(!row.description.includes('undefined'));
  }
  assert.equal(r.loaded,true); assert.equal(r.meter,4); assert.equal(r.face.type,'trick'); assert.match(r.text,/Punchline/); assert.doesNotMatch(r.text,/Jackpot|backfire/);
});

test('Shield Bash spends up to its level budget while breaking enemy block at twice its HP power', async t=>{
  const p=await game(t);
  const r=await p.evaluate(async()=>{
    beginEncounter(false,{count:1}); finishOpeningRoll();
    const e=state.enemy,h=state.party[0]; e.hp=e.maxHp=1000; e.passive=null; e.countdown=20;
    state.block=6; setEnemyBlock(12); render();
    runMachine=async()=>[{type:'blank',tier:1},{type:'class',tier:1,job:'fighter'},{type:'blank',tier:1}];
    await spin(0);
    const roll=state.lastPlayerRoll;
    return {block:state.block,enemyBlock:enemyBlock(),hp:e.hp,power:roll.bash.power,actual:roll.bash.actual,rage:h.rage,stats:h.stats.damageDealt};
  });
  assert.equal(r.block,2); assert.equal(r.power,6); assert.equal(r.enemyBlock,0);
  assert.equal(r.actual,0); assert.equal(r.hp,1000); assert.equal(r.rage,0); assert.equal(r.stats,0);
});

test('Trick fires one six-mark Punchline from unchanged reels before the enemy clock advances', async t=>{
  const p=await game(t);
  const r=await p.evaluate(async()=>{
    newRun('jester'); setPace('skip'); setPreference('skipCriticals',true);
    beginEncounter(false,{count:1}); finishOpeningRoll(); state.enemy.hp=state.enemy.maxHp=10000; state.enemy.countdown=20;
    const h=state.party[0]; h.anticipation=5; h.reels[0][0]={type:'attack',tier:2,weight:1};
    const purchased=JSON.stringify(h.reels), calls=[];
    runMachine=async(id,reels)=>{
      calls.push({id,rank:reels[0][0].tier,weight:reels[0][0].weight});
      return calls.length===1 ? [{type:'trick',tier:1},{type:'blank',tier:1},{type:'blank',tier:1}] :
        [{type:'attack',tier:3},{type:'trick',tier:4},{type:'heal',tier:1}];
    };
    await spin(0);
    return {calls,preserved:JSON.stringify(h.reels)===purchased,count:state.enemy.countdown,spins:h.stats.spins,meter:h.anticipation,punchlines:h.stats.punchlines,roll:state.lastPlayerRoll,burst:state.lastPunchline};
  });
  assert.equal(r.calls.length,1); assert.equal(r.calls[0].rank,2); assert.equal(r.calls[0].weight,1); assert.equal(r.burst.shots.length,6);
  assert.equal(r.preserved,true); assert.equal(r.count,19); assert.equal(r.spins,1); assert.equal(r.meter,0); assert.equal(r.punchlines,1);
  assert.equal(r.roll.punchline,false); assert.equal(r.roll.multiplier,1);
});

test('a Jester who falls while the initial machine rolls cannot fire a Punchline or suppress enemy clocks', async t=>{
  const p=await game(t);
  const r=await p.evaluate(async()=>{
    newRun('jester'); setPace('skip'); state.party.push(makeHero('Survivor','fighter'));
    beginEncounter(false,{count:1}); finishOpeningRoll();
    const h=state.party[0]; h.anticipation=5; state.enemy.hp=state.enemy.maxHp=10000; state.enemy.countdown=20;
    let calls=0;
    runMachine=async()=>{calls++;h.hp=0;h.dead=true;return [{type:'trick',tier:1},{type:'blank',tier:1},{type:'blank',tier:1}];};
    // Death confirmations are exercised elsewhere; isolate the burst gate.
    tickPoison=async()=>{};
    await spin(0);
    return {calls,count:state.enemy.countdown,spins:h.stats.spins,punchlines:h.stats.punchlines||0};
  });
  assert.deepEqual(r,{calls:1,count:19,spins:1,punchlines:0});
});

test('Jester matching triples use normal critical odds and multipliers; different kinds do not crit or grant encore',async t=>{
  const p=await game(t);
  const r=await p.evaluate(async()=>{
    newRun('jester'); setPace('skip'); setPreference('skipCriticals',true);
    beginEncounter(false,{count:1}); finishOpeningRoll(); state.enemy.hp=state.enemy.maxHp=10000; state.enemy.countdown=20;
    runMachine=async()=>[{type:'attack',tier:1},{type:'heal',tier:1},{type:'block',tier:1}]; await spin(0);
    const different={multiplier:state.lastPlayerRoll.multiplier,spins:state.party[0].stats.spins,count:state.enemy.countdown};
    runMachine=async()=>Array.from({length:3},()=>({type:'attack',tier:1})); await spin(0);
    return {different,multiplier:state.lastPlayerRoll.multiplier,stun:state.party[0].stun,xp:state.party[0].stats.criticalXP,count:state.enemy.countdown};
  });
  assert.deepEqual(r.different,{multiplier:1,spins:1,count:19}); assert.ok([1.5,2,3,4].includes(r.multiplier)); assert.equal(r.stun,0); assert.equal(r.xp,1); assert.equal(r.count,18);
});

test('random recruited temperaments include both sides and trait tooltips separate immutable effects from recorded causes',async t=>{
  const p=await game(t);
  const r=await p.evaluate(()=>{
    const temperaments=Array.from({length:200},()=>prepareRecruit(makeHero('Wanderer','mage')).specialism);
    const h=state.party[0],a=makeHero('Other','rogue'); state.party.push(a);
    grantTrait(h,'focused','Shrugged off an incoming stun.'); grantTrait(a,'focused','Repeatedly disrupted enemy attacks.');
    const texts=state.party.map(traitMarkup);
    a.trait.reason=HERO_TRAITS.focused.description; normaliseTraitRecord(a);
    return {counts:temperaments.reduce((x,t)=>(x[t]=(x[t]||0)+1,x),{}),texts,legacy:traitMarkup(a)};
  });
  assert.ok(r.counts.offence>50&&r.counts.defence>50); for(const text of r.texts) assert.match(text,/\+2 power on stun rolls/);
  assert.match(r.texts[0],/Shrugged off/); assert.match(r.texts[1],/Repeatedly disrupted/);
  assert.match(r.legacy,/original moment was not recorded/); assert.doesNotMatch(r.legacy,/Earned: \+1 power/);
});

test('floor generation recognises reciprocal tunnels across intact water/stone barriers and keeps eight moves to stairs', async t=>{
  const p=await game(t);
  const r=await p.evaluate(()=>{
    let seed=39417; const real=Math.random; Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
    let tunnelOnly=0,riverBarrier=0,stoneBarrier=0,short=0,broken=0;
    for(let n=0;n<350;n++){
      const map=generateFloor(1+n%10,1,0,[]), stair=map.findIndex(c=>c.event==='stairs'), full=mapDistances(map),walking=mapDistances(map,pos(1,7),false);
      if(!full.has(stair)) broken++;
      if(full.get(stair)<8) short++;
      if(!walking.has(stair)) {tunnelOnly++;if(map.some(c=>c.terrain==='river'))riverBarrier++;else stoneBarrier++;}
      if(map.some(c=>c.terrain==='bridge'&&c.event)) broken++;
      for(let i=0;i<map.length;i++)if(map[i].event==='tunnel'&&tunnelDestination(map,i)===null)broken++;
    }
    Math.random=real;
    return {tunnelOnly,riverBarrier,stoneBarrier,short,broken};
  });
  assert.equal(r.broken,0); assert.equal(r.short,0); assert.ok(r.tunnelOnly>0); assert.ok(r.riverBarrier>0); assert.ok(r.stoneBarrier>0);
});

test('known tunnel edges are real long-move routes, keep their optional prompt, and are not carved open during load',async t=>{
  const p=await game(t);
  await p.evaluate(()=>{
    for(let i=0;i<state.map.length;i++){
      const x=i%W,y=Math.floor(i/W),edge=!x||x===W-1||!y||y===H-1;
      Object.assign(state.map[i],{seen:true,event:null,feature:null,wall:edge||x===5,terrain:edge||x===5?'stone':'floor'});
      delete state.map[i].tunnelTo;
    }
    const a=pos(3,7),b=pos(7,3);
    for(const [i,j]of[[a,b],[b,a]])Object.assign(state.map[i],{event:'tunnel',feature:'tunnel',tunnelTo:j});
    Object.assign(state.map[pos(9,1)],{event:'stairs',feature:'stairs'});
    const malformed=state.map.map(c=>({...c})); malformed[b].tunnelTo=null;
    window.invalidTunnelReaches=mapDistances(malformed).has(pos(9,1));
    state.position=a; state.map[b].seen=false; window.currentTunnelGoal=autoplayGoal();
    state.map[b].seen=true;
    state.position=pos(1,7); save(); window.loaded=load();
    render(); window.route=shortestPath(pos(8,3)); window.moving=move(pos(8,3));
  });
  await p.waitForSelector('#tunnel-use'); await p.locator('#tunnel-use').click(); await p.evaluate(()=>window.moving);
  const r=await p.evaluate(()=>({autoGoal:window.currentTunnelGoal,source:pos(3,7),invalid:window.invalidTunnelReaches,loaded:window.loaded,route:window.route,at:state.position,goal:pos(8,3),commands:state.moveCommands,wall:state.map[pos(5,4)].wall,broken:tunnelDestination(state.map,pos(3,7))}));
  assert.equal(r.autoGoal,r.source); assert.equal(r.invalid,false); assert.equal(r.loaded,true); assert.equal(r.at,r.goal); assert.equal(r.commands,1); assert.equal(r.wall,true); assert.equal(typeof r.broken,'number');
});

test('autoplay repairs old stimulant-heavy damage builds and gives a support Mage healing and shields for two damage allies',async t=>{
  const p=await game(t);
  const r=await p.evaluate(()=>{
    state.depth=4;
    const rogue=makeHero('Blade','rogue'),tank=makeHero('Wall','fighter',null,[],{specialism:'offence'}),mage=makeHero('Spark','mage',null,[],{specialism:'defence'}); state.party=[rogue,tank,mage];
    rogue.autoArchetype='enchanter'; rogue.points=50;
    rogue.reels=rogue.reels.map((reel,k)=>reel.map((f,j)=>f.type==='class'?f:{type:j===0?'attack':'stimulant',tier:3,weight:1}));
    const old=faceShare(rogue.reels.flat(),['stimulant']); autoUpgradeHero(rogue);
    mage.points=100; autoUpgradeHero(mage);
    return {old,now:faceShare(rogue.reels.flat(),['stimulant']),damage:directDamageShare(rogue),build:rogue.autoArchetype,mage:expectedHeroEffects(mage),mageBuffs:faceShare(mage.reels.flat(),['rally']),points:rogue.points};
  });
  assert.ok(r.now<r.old); assert.ok(r.now<=.18); assert.ok(r.damage>=.35); assert.notEqual(r.build,'enchanter');
  assert.ok(r.mage.heal+r.mage.teamHeal>2); assert.ok(r.mage.block>1,JSON.stringify(r)); assert.ok(r.mageBuffs<=.23); assert.ok(r.points>=0);
});

test('gold pours have no new rush or gold-critical audio and encounter surprise remains centred as the UI settles',async t=>{
  const p=await game(t,390,844);
  const r=await p.evaluate(()=>{
    const calls=[],real=GameSound.play; GameSound.play=id=>calls.push(id);
    startCoinRain(500,true,document.querySelector('#book')); stopCoinRain();
    playCriticalTheme({context:'treasure'},[{icon:'coin',value:500}]); GameSound.play=real;
    beginEncounter(false,{count:1}); state.opening.surprise=true; state.enemy.ambush=true; render();
    window.entrance=encounterEntrance();
    return {calls,rush:!!SOUND_CUES.coinsRush,gold:!!SOUND_CUES.criticalGold};
  });
  assert.deepEqual(r.calls,[]); assert.equal(r.rush,false); assert.equal(r.gold,false);
  await p.waitForSelector('.encounter-alert');
  for(const wait of [0,100,500]){
    if(wait)await p.waitForTimeout(wait);
    const r=await p.locator('.encounter-alert').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return {x:a.x+a.width/2,parent:b.x+b.width/2};});
    assert.ok(Math.abs(r.x-r.parent)<1);
  }
  await p.locator('#stage-confirm').click(); await p.evaluate(()=>window.entrance);
});
