const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
let browser,server,url;
const out=path.resolve(__dirname,'../test-results/expedition-expansion');
before(async()=>{
 fs.mkdirSync(out,{recursive:true});const html=fs.readFileSync(path.resolve(__dirname,'../index.html'));
 server=http.createServer((_,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function game(t){
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(url);
 await p.evaluate(async()=>{newRun('fighter');setPace('skip');closeModal();closeSpotlight();characterLuck=()=>.99999;scheduleStunRecovery=()=>{};await document.fonts.ready;});
 t.after(async()=>{await p.close();assert.deepEqual(errors,[])});return p;
}
test('all biome variants preserve a distant exit and approach-safe routes, with dense mazes and bounded crystal fields',async t=>{
 const p=await game(t);const r=await p.evaluate(()=>{
  const report={maze:[],crystal:[],brittle:0,poison:0,burst:0};
  for(let n=0;n<180;n++){
   const theme=Object.keys(BIOMES)[n%Object.keys(BIOMES).length],map=generateFloor(7,1,0,[],theme);
   if(!allTilesCanReachStairs(map))throw Error(theme+' stranded a tile');
   const stairs=map.findIndex(c=>c.event==='stairs'),distance=mapDistances(map).get(stairs);
   if(distance<8)throw Error(theme+' short stairs '+distance);
   if(theme==='maze')report.maze.push(map.filter(c=>c.wall).length);
   if(theme==='ice'&&!safeWithClosedTiles(map))throw Error('unsafe collapsing ice');
   report.brittle+=map.filter(c=>c.terrain==='brittleIce').length;
   report.poison+=map.filter(c=>c.terrain==='poisonMushroom').length;
   report.burst+=map.filter(c=>c.terrain==='explodingMushroom').length;
   if(theme==='crystal'){
    const open=map.filter(c=>!c.wall).length,set=new Set();
    map.forEach((c,s)=>{if(c.terrain==='crystal')map.forEach((other,i)=>{if(!other.wall&&tileDistance(i,s)<=1&&mapLineOfSight(map,s,i))set.add(i)})});
    report.crystal.push(set.size/open);
   }
   if(theme==='lava'&&map.some(c=>['river','bridge'].includes(c.terrain)&&!c.lavaRiver))throw Error('cold river in lava biome');
  }return report;
 });
 assert.ok(r.maze.reduce((a,b)=>a+b)/r.maze.length>48);
 assert.ok(r.crystal.reduce((a,b)=>a+b)/r.crystal.length>=.4);
 assert.ok(r.brittle&&r.poison&&r.burst);
 fs.writeFileSync(path.join(out,'generation.json'),JSON.stringify(r,null,2));
});
test('self-heal faces are legal by class, migrate paid old reels and never spill to wounded allies',async t=>{
 const p=await game(t);const r=await p.evaluate(async()=>{
  const h=makeHero('Bram','berserker'),ally=makeHero('Mira','mage');state.party=[h,ally];
  h.reels[0][0]={type:'heal',tier:3,weight:1,investments:{3:9}};normaliseHeroBuild(h);
  const migrated={...h.reels[0][0]},allowed=editableTypes(h);
  beginEncounter(false,{count:1});finishOpeningRoll();state.enemy.hp=state.enemy.maxHp=10000;state.enemy.countdown=99;state.enemy.passive=null;setEnemyBlock(0);
  h.hp=h.maxHp;ally.hp=1;
  runMachine=async()=>[{type:'selfheal',tier:1},{type:'blank',tier:1},{type:'blank',tier:1}];
  await spin(0);
  return {migrated,allowed,allyHP:ally.hp,selfHP:h.hp,max:h.maxHp,roll:state.lastPlayerRoll};
 });
 assert.equal(r.migrated.type,'selfheal');assert.equal(r.migrated.investments[3],9);
 assert.ok(r.allowed.includes('selfheal')&&!r.allowed.includes('heal'));
 assert.equal(r.allyHP,1);assert.equal(r.selfHP,r.max);assert.equal(r.roll.selfHealing,0);
});
test('Fury survives battle cleanup and reload, loses charge per walked tile, and real healing still spends it',async t=>{
 const p=await game(t);const r=await p.evaluate(()=>{
  const h=makeHero('Bram','berserker');state.party=[h];h.fury=20;h.hp-=6;
  clearBattleStatuses();const afterFight=h.fury;decayTravelFury();decayTravelFury();const travel=h.fury;
  const hp=healHero(0,3),afterHeal=h.fury;save();return {afterFight,travel,hp,afterHeal};
 });assert.deepEqual(r,{afterFight:20,travel:18,hp:3,afterHeal:15});
 await p.reload();assert.equal(await p.evaluate(()=>state.party[0].fury),15);
});
test('stimulant has three timed stacks and further doses build bounded potency with poison-style overflow',async t=>{
 const p=await game(t);const r=await p.evaluate(()=>{
  const h=state.party[0];applyStimulant(h,3);const initial={...h.stimulant};
  applyStimulant(h,2);const two={...h.stimulant};applyStimulant(h,1);const three={...h.stimulant};
  for(let n=0;n<30;n++)applyStimulant(h,4);return {initial,two,three,last:h.stimulant};
 });assert.equal(r.initial.turns,3);assert.equal(r.two.turns,3);assert.equal(r.two.power,3);assert.equal(r.three.power,4);assert.equal(r.last.power,6);assert.equal(r.last.turns,3);
});
test('nearby burstcaps roll once, require confirmation, deal their recorded damage and become ordinary caps',async t=>{
 const p=await game(t);await p.evaluate(()=>{
  state.position=pos(3,3);state.map.forEach(c=>Object.assign(c,{wall:false,event:null,terrain:'floor'}));
  state.map[pos(4,3)].terrain='explodingMushroom';
  runMachine=async()=>[{type:'trap',tier:1},{type:'safe',tier:1},{type:'safe',tier:1}];
 });
 const task=p.evaluate(()=>expansionStep(state.position));
 await p.locator('#stage-confirm').waitFor();
 const before=await p.evaluate(()=>({hp:state.party[0].hp,pending:state.pendingMushroomBlast,kind:$('#spotlight').dataset.kind}));
 assert.equal(before.kind,'mushroom-blast');assert.ok(before.pending.damage>0);
 await p.locator('#stage-confirm').click();assert.equal(await task,true);
 const after=await p.evaluate(()=>({hp:state.party[0].hp,terrain:state.map[pos(4,3)].terrain,pending:state.pendingMushroomBlast}));
 assert.equal(after.hp,before.hp-before.pending.damage);assert.equal(after.terrain,'mushroom');assert.equal(after.pending,undefined);
});
test('a poisonous cap hurts on repeated crossings; brittle ice collapses only after leaving and cannot trap the party',async t=>{
 const p=await game(t);const r=await p.evaluate(async()=>{
  state.map.forEach(c=>{if(c.terrain==='explodingMushroom')c.terrain='mushroom'});
  const i=state.position;state.map[i].terrain='poisonMushroom';const hp=state.party[0].hp;
  await expansionStep(i);await expansionStep(i);const damage=hp-state.party[0].hp;
  const map=generateFloor(6);assignFloorBiome(map,6,{force:'ice'});addExpansionDiscoveries(map,6,'ice');state.map=map;
  const fragile=map.findIndex(c=>c.terrain==='brittleIce');if(fragile<0)throw Error('no fragile fixture');
  const safe=safeWithClosedTiles(map);collapseBrittleIce(fragile);
  return {damage,safe,hole:map[fragile],reachable:allTilesCanReachStairs(map)};
 });assert.equal(r.damage,2);assert.ok(r.safe&&r.reachable);assert.equal(r.hole.terrain,'hole');assert.equal(r.hole.wall,true);
});
test('ignoring a nest is safe and reversible; the horn consumes one item and opens the normal recruit interaction',async t=>{
 const p=await game(t);await p.evaluate(()=>{
  const c=state.map[state.position];c.event=c.feature='nest';window.randomCalls=0;Math.random=()=>{randomCalls++;return .99};
 });
 let task=p.evaluate(()=>resolveExpansionTile(state.map[state.position]));await p.locator('#biome-leave').click();await task;
 const ignored=await p.evaluate(()=>({type:state.map[state.position].event,enemy:!!state.enemy,calls:randomCalls}));
 assert.deepEqual(ignored,{type:'nest',enemy:false,calls:0});
 await p.evaluate(()=>{state.bag={companionHorn:1};});task=p.evaluate(()=>useItem('companionHorn'));
 await p.locator('#recruit-accept').click();assert.equal(await task,true);
 const r=await p.evaluate(()=>({party:state.party.length,horns:state.bag.companionHorn||0}));assert.deepEqual(r,{party:2,horns:0});
});
test('stun and its recovery share one ink while inspiration has its own colour in notices and the event log',async t=>{
 const p=await game(t);const r=await p.evaluate(()=>{
  const h=state.party[0];
  combatCallout(entityArt(h),'STUN CLEARED','heal');combatCallout(entityArt(h),'INSPIRED!','heal');
  log('Stun broken; now Steady.');log('INSPIRED!');
  return {stun:getComputedStyle($('.combat-callout.stun')).color,boon:getComputedStyle($('.combat-callout.boon')).color,heal:getComputedStyle(document.documentElement).getPropertyValue('--green'),terms:document.querySelectorAll('#log .log-term-stun').length};
 });assert.notEqual(r.stun,r.boon);assert.ok(r.terms>=2);
});
test('hover inspection follows the current tile by default and links only revealed tunnel exits without RNG',async t=>{
 const p=await game(t);const r=await p.evaluate(()=>{
  const a=state.position,b=pos(8,2);for(const i of [a,b])Object.assign(state.map[i],{wall:false,seen:true,event:'tunnel'});state.map[a].tunnelTo=b;state.map[b].tunnelTo=a;
  renderMap();let calls=0;const real=Math.random;Math.random=()=>{calls++;return .5};
  updateMapInspection(a);const linked=!!$('#tunnel-hover-link');state.map[b].seen=false;updateMapInspection(a);const hidden=!!$('#tunnel-hover-link');updateMapInspection(null);
  const current=$('#hover-name').textContent;Math.random=real;return {linked,hidden,current,calls};
 });assert.equal(r.linked,true);assert.equal(r.hidden,false);assert.equal(r.calls,0);assert.match(r.current,/Tunnel/);
});

async function discovery(p,type){
 await p.evaluate(type=>{const c=state.map[state.position];c.event=c.feature=type;window.discoveryTask=resolveExpansionTile(c)},type);
}
async function confirmDiscovery(p,id){await p.locator(id).click();await p.evaluate(()=>window.discoveryTask);}
test('fruit stays available when declined and heals only living companions when picked',async t=>{
 const p=await game(t);await p.evaluate(()=>{state.party.push(makeHero('Mira','mage'));state.party.forEach(h=>h.hp=1)});
 await discovery(p,'fruit');await confirmDiscovery(p,'#biome-leave');assert.equal(await p.evaluate(()=>state.map[state.position].event),'fruit');
 await discovery(p,'fruit');await confirmDiscovery(p,'#biome-use');
 const r=await p.evaluate(()=>({event:state.map[state.position].event,hp:state.party.map(h=>h.hp),expected:state.party.map(h=>1+Math.ceil(h.maxHp*.1)+2)}));assert.equal(r.event,null);assert.deepEqual(r.hp,r.expected);
});
test('a resonant geode is saved for the next battle and prism sight-lines stop at walls without activating finds',async t=>{
 const p=await game(t);await discovery(p,'geode');await confirmDiscovery(p,'#biome-use');
 const gift=await p.evaluate(()=>state.party[0].geodeGift);assert.equal(gift.uses,2);
 const battle=await p.evaluate(()=>{beginEncounter(false,{count:1});return {gift:state.party[0].geodeGift,reels:state.party[0].reelGifts}});assert.equal(battle.gift,undefined);assert.ok(battle.reels.some(g=>g.reel===gift.reel&&g.uses===2));
 await p.evaluate(()=>{closeSpotlight();state.enemy=null;state.enemies=[];busy=false;state.position=pos(3,3);state.map.forEach(c=>Object.assign(c,{wall:false,seen:false,event:null,terrain:'floor'}));state.map[pos(5,3)].wall=true;state.map[pos(5,3)].terrain='stone';state.map[pos(4,3)].event='treasure';render()});
 await discovery(p,'prism');await confirmDiscovery(p,'#biome-use');
 const sight=await p.evaluate(()=>({chest:state.map[pos(4,3)].seen,event:state.map[pos(4,3)].event,wall:state.map[pos(5,3)].seen,behind:state.map[pos(6,3)].seen}));assert.deepEqual(sight,{chest:true,event:'treasure',wall:true,behind:false});
});
test('maze plates and secret doors open optional shortcuts only after explicit confirmation',async t=>{
 const p=await game(t);await p.evaluate(()=>{state.map.forEach(c=>Object.assign(c,{wall:false,terrain:'floor',event:null,seen:true}));state.position=pos(3,3);const gate=pos(5,3);Object.assign(state.map[gate],{wall:true,terrain:'gate'});state.map[state.position].gateTarget=gate});
 await discovery(p,'plate');await confirmDiscovery(p,'#biome-use');assert.equal(await p.evaluate(()=>state.map[pos(5,3)].wall),false);
 await p.evaluate(()=>{Object.assign(state.map[pos(4,3)],{wall:true,event:'door',feature:'door',terrain:'secretDoor'});window.doorTask=openSecretDoor(pos(4,3))});
 await p.locator('#biome-leave').click();await p.evaluate(()=>window.doorTask);assert.equal(await p.evaluate(()=>state.map[pos(4,3)].wall),true);
 await p.evaluate(()=>{window.doorTask=openSecretDoor(pos(4,3))});await p.locator('#biome-use').click();await p.evaluate(()=>window.doorTask);assert.equal(await p.evaluate(()=>state.map[pos(4,3)].wall),false);
});
test('taking nest loot can introduce a correctly recorded elite broodmother; leaving never does',async t=>{
 const p=await game(t);await p.evaluate(()=>{treasureRoll=async()=>{};Math.random=()=>0;});await discovery(p,'nest');await p.locator('#nest-loot').click();await p.locator('#stage-confirm').waitFor();
 const r=await p.evaluate(()=>({name:state.enemy.name,art:state.enemy.art,elite:state.enemy.elite,mother:state.enemy.broodmother,kind:$('#spotlight').dataset.kind,eggInLoot:availableLootTypes().includes('nestEgg')}));
 assert.match(r.name,/Broodmother/i);assert.equal(r.art,'widow');assert.ok(r.elite&&r.mother);assert.equal(r.eggInLoot,false);
 await p.locator('#stage-confirm').click();await p.evaluate(()=>window.discoveryTask);
});
test('class sketches are cosmetic, respect Skip and cancel cleanly when the run changes',async t=>{
 const p=await game(t);const r=await p.evaluate(async()=>{beginEncounter(false,{count:1});finishOpeningRoll();render();let calls=0;const real=Math.random;Math.random=()=>{calls++;return .5};for(const kind of ['fighter','rogue','mage','berserker','execute'])await classSignatureFX(state.party[0],state.enemy,kind);Math.random=real;return {calls,remaining:document.querySelectorAll('.class-sketch').length}});assert.deepEqual(r,{calls:0,remaining:0});
 await p.evaluate(()=>{setPace('1');sceneFast=false;window.sketchTask=classSignatureFX(state.party[0],state.enemy,'execute')});await p.locator('.class-sketch-execute').waitFor();await p.evaluate(()=>newRun('fighter'));await p.evaluate(()=>window.sketchTask);assert.equal(await p.locator('.class-sketch').count(),0);
});
test('a shadow duel copies real legal reels before creating its elite enemy and records the correct identity',async t=>{
 const p=await game(t);await discovery(p,'shadowduel');await p.locator('#biome-use').click();await p.locator('#stage-confirm').waitFor();
 const r=await p.evaluate(()=>({name:state.enemy.name,art:state.enemy.art,elite:state.enemy.elite,shadow:state.enemy.shadowDouble,reels:state.enemy.reels.map(r=>r.map(f=>f.type)),hero:state.party[0].name}));
 assert.equal(r.name,'Shadow of '+r.hero);assert.equal(r.art,'fighter');assert.ok(r.elite&&r.shadow);assert.equal(r.reels.length,3);assert.ok(r.reels.flat().includes('selfheal'));assert.ok(!r.reels.flat().includes('class'));
 await p.locator('#stage-confirm').click();await p.evaluate(()=>window.discoveryTask);
});
test('cancelled discovery and secret-door promises cannot close a new run’s confirmation',async t=>{
 const p=await game(t);
 await discovery(p,'nest');
 await p.evaluate(()=>{window.oldDiscovery=window.discoveryTask;newRun('fighter');const c=state.map[state.position];c.event=c.feature='geode';window.discoveryTask=resolveExpansionTile(c)});
 await p.evaluate(()=>window.oldDiscovery);assert.equal(await p.locator('#stage-card').getAttribute('data-biome-kind'),'geode');assert.equal(await p.locator('#spotlight').isVisible(),true);await confirmDiscovery(p,'#biome-leave');
 await p.evaluate(()=>{const i=neighbors(state.position)[0];Object.assign(state.map[i],{seen:true,wall:true,terrain:'secretDoor',event:'door'});window.oldDoor=openSecretDoor(i)});
 await p.locator('#biome-use').waitFor();
 await p.evaluate(()=>{newRun('fighter');const c=state.map[state.position];c.event=c.feature='fruit';window.discoveryTask=resolveExpansionTile(c)});
 await p.evaluate(()=>window.oldDoor);assert.equal(await p.locator('#stage-card').getAttribute('data-biome-kind'),'fruit');assert.equal(await p.locator('#spotlight').isVisible(),true);await confirmDiscovery(p,'#biome-leave');
});
