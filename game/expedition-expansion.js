// Biome additions, selected by the player. World RNG is used only on generation
// and confirmed gameplay outcomes; drawing/hovering never consumes it.
const EXPEDITION_TUNING = Object.freeze({
  crystalRadius: 1,
  crystalCoverage: 0.5,
  poisonMushroomBase: 1,
  poisonMushroomDepth: 4,
  mushroomBlastBase: 2,
  mushroomBlastDepth: 4,
  furyDecayPerStep: 1,
  nestChance: 0.3,
  motherEggChance: 0.45,
  motherGoldChance: 0.25,
});
const BIOME_DISCOVERIES = Object.freeze({
  nest: { name: "Cave nest", icon: "nest", description: "Take its loot or a large healing egg. Either may bring the broodmother; leaving it alone is safe." },
  fruit: { name: "Fruit bush", icon: "fruit", description: "A single small team heal. Leave the fruit untouched if you want to return later." },
  fairy: { name: "Fairy ring", icon: "fairy", description: "Choose healing or search for loot. Disturbing the ring may wake its guardian." },
  geode: { name: "Resonant geode", icon: "geode", description: "Gild one reel for each hero's next battle. Its ordinary marks gain one rank for two rolls." },
  prism: { name: "Prism stone", icon: "prism", description: "Reveals straight sight-lines in four directions. Walls stop its light; discoveries stay untouched." },
  rubble: { name: "Salvage rubble", icon: "rubble", description: "Search for supplies and coins. A creature may be hiding underneath." },
  shadowduel: { name: "Shadow double", icon: "shadow", description: "Accept a difficult optional duel for rich spoils, or walk away safely." },
  plate: { name: "Pressure plate", icon: "plate", description: "Opens the matching nearby gate permanently. The floor's main route never requires it." },
  door: { name: "Secret door", icon: "door", description: "Stand beside the revealed door and select it to open a permanent shortcut." },
});
function mapLineOfSight(map, from, to) {
  let x=from%W,y=Math.floor(from/W),tx=to%W,ty=Math.floor(to/W);
  const dx=Math.abs(tx-x),dy=Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;
  let err=dx-dy;
  while(x!==tx||y!==ty){
    const twice=2*err,oldX=x,oldY=y;
    if(twice>-dy){err-=dy;x+=sx;}
    if(twice<dx){err+=dx;y+=sy;}
    if(x!==oldX&&y!==oldY&&map[pos(x,oldY)]?.terrain==='stone'&&map[pos(oldX,y)]?.terrain==='stone')return false;
    if(x===tx&&y===ty)return true;
    if(map[pos(x,y)]?.wall&&map[pos(x,y)].terrain!=='river')return false;
  }
  return true;
}
function carveMaze(map) {
  const start=pos(1,7),stack=[start],seen=new Set([start]);
  map.forEach((c,i)=>{
    if(i%W===0||i%W===W-1||i<W||i>=W*(H-1))return;
    c.wall=true;c.terrain='stone';c.room=null;c.structure=false;
    delete c.stalactite;delete c.shadowCovered;
  });
  map[start].wall=false;map[start].terrain='floor';
  while(stack.length){
    const i=stack.at(-1),x=i%W,y=Math.floor(i/W);
    const choices=[[2,0],[-2,0],[0,2],[0,-2]].map(([dx,dy])=>[x+dx,y+dy]).filter(([a,b])=>a>0&&a<W-1&&b>0&&b<H-1&&!seen.has(pos(a,b)));
    if(!choices.length){stack.pop();continue;}
    const [a,b]=pick(choices),j=pos(a,b),mid=pos((x+a)/2,(y+b)/2);
    for(const n of [mid,j])Object.assign(map[n],{wall:false,terrain:'floor'});
    seen.add(j);stack.push(j);
  }
  // Every authored discovery survives. Attach even-coordinate cells to the tree.
  for(let i=0;i<map.length;i++)if(map[i].event&&map[i].wall){
    const q=[i],parent=new Map([[i,null]]);let end=null;
    for(const n of q){
      if(n!==i&&!map[n].wall){end=n;break;}
      for(const j of neighbors(n))if(j%W>0&&j%W<W-1&&j>=W&&j<W*(H-1)&&!parent.has(j)){parent.set(j,n);q.push(j);}
    }
    while(end!==null){Object.assign(map[end],{wall:false,terrain:'floor'});end=parent.get(end);}
  }
  ensureStairsPath(map);ensureStairDistance(map);
}
function placeCrystalFields(map, candidates) {
  const covered=()=>{
    const set=new Set();
    map.forEach((c,s)=>{if(c.terrain==='crystal')map.forEach((other,i)=>{
      if(!other.wall&&tileDistance(i,s)<=EXPEDITION_TUNING.crystalRadius&&mapLineOfSight(map,s,i))set.add(i);
    });});return set;
  };
  const free=candidates.filter(i=>!map[i].event&&!map[i].room&&!map[i].structure);
  // Random order allows overlaps; the union, never the number of sources, is
  // compared with the target. Each candidate must preserve physical connectivity.
  const order=free.map(i=>({i,key:Math.random()})).sort((a,b)=>a.key-b.key);
  for(const {i} of order){
    const open=map.filter(c=>!c.wall).length;
    if(covered().size>=open*EXPEDITION_TUNING.crystalCoverage)break;
    const before=mapDistances(map).size;
    Object.assign(map[i],{wall:true,terrain:'crystal'});
    if(mapDistances(map).size<before-1||!allTilesCanReachStairs(map))Object.assign(map[i],{wall:false,terrain:'floor'});
  }
}
function addExpansionDiscoveries(map,depth,theme) {
  const free=()=>map.map((c,i)=>i).filter(i=>i!==pos(1,7)&&!map[i].wall&&!map[i].event&&!map[i].room&&!map[i].structure&&map[i].terrain==='floor');
  const place=(type)=>{const cells=free();if(!cells.length)return null;const i=pick(cells);Object.assign(map[i],{event:type,feature:type});return i;};
  if(depth>=2&&Math.random()<EXPEDITION_TUNING.nestChance)place('nest');
  if(theme==='overgrown')place('fruit');
  if(theme==='fungal'){
    if(Math.random()<0.65)place('fairy');
    const candidates=map.map((c,i)=>i).filter(i=>!map[i].wall&&!map[i].event&&!map[i].room&&tileDistance(i,pos(1,7))>2&&['floor','mushroom'].includes(map[i].terrain));
    for(const terrain of ['poisonMushroom','poisonMushroom','explodingMushroom'])if(candidates.length)map[candidates.splice(rand(candidates.length),1)[0]].terrain=terrain;
  }
  if(theme==='ice'){
    for(const {i} of free().map(i=>({i,key:Math.random()})).sort((a,b)=>a.key-b.key)){
      if(map.filter(c=>c.terrain==='brittleIce').length>=3)break;
      if(!safeWithClosedTiles(map,[i]))continue;
      map[i].terrain='brittleIce';
      if(!safeWithClosedTiles(map)||!allTilesCanReachStairs(map))map[i].terrain='floor';
    }
  }
  if(theme==='crystal'){place('geode');place('prism');}
  if(theme==='unstable')place('rubble');
  if(theme==='shadow'&&Math.random()<0.65)place('shadowduel');
  if(theme==='maze'){
    // Doors and gates only remove existing walls: the closed tree is always a
    // complete route. They never replace or block an authored discovery.
    const walls=map.map((c,i)=>i).filter(i=>i%W>0&&i%W<W-1&&i>=W&&i<W*(H-1)&&map[i].wall&&!map[i].event&&neighbors(i).filter(j=>!map[j].wall).length>=2);
    if(walls.length){const door=walls.splice(rand(walls.length),1)[0];Object.assign(map[door],{terrain:'secretDoor',event:'door',feature:'door'});}
    if(walls.length){const gate=pick(walls),plate=place('plate');if(plate!==null){Object.assign(map[gate],{terrain:'gate',linkedPlate:plate});map[plate].gateTarget=gate;}}
  }
  if(theme==='lava')map.forEach(c=>{if(c.terrain==='river'||c.terrain==='bridge')c.lavaRiver=true;});
}
function decayTravelFury(){
  for(const h of state.party)if(alive(h)&&h.job==='berserker')h.fury=Math.max(0,(h.fury||0)-EXPEDITION_TUNING.furyDecayPerStep);
}
function collapseBrittleIce(i){
  const c=state.map[i];if(c?.terrain!=='brittleIce')return;
  Object.assign(c,{terrain:'hole',wall:true,event:null,feature:null,room:null});
  burst($(`[data-tile="${i}"]`),'dust',22);GameSound.play('rockDrop');
  log('Brittle ice collapses into an open hole behind the party.');
}
async function expansionStep(i){
  const run=state,c=state.map[i];
  if(c.terrain==='poisonMushroom'){
    const power=EXPEDITION_TUNING.poisonMushroomBase+Math.floor(state.depth/EXPEDITION_TUNING.poisonMushroomDepth);
    const h=state.party.find(alive);
    if(h)damageHero(state.party.indexOf(h),power,'Poison mushroom spores',{piercing:true,impact:{type:'poison'}});
    burst($(`[data-tile="${i}"]`),'poison',28);
    log(`Poison mushrooms release spores: ${power} damage.`,{category:'exploration'});
    await processDeaths();if(checkDefeat())return true;
  }
  const blasts=state.map.map((tile,n)=>tile.terrain==='explodingMushroom'&&tileDistance(n,i)<=1&&lineOfSight(i,n)?n:-1).filter(n=>n>=0);
  for(const n of blasts){await mushroomBlast(n);if(state!==run||state.over)return true;}
  return blasts.length>0;
}
async function mushroomBlast(i){
  const run=state,c=state.map[i];
  markSeen(i);c.terrain='mushroom';renderMap();
  const faces=[{type:'safe',tier:1,weight:6},{type:'trap',tier:1,weight:3},{type:'trap',tier:2,weight:1}];
  showSpotlight('BURSTCAP!','The swollen cap bursts as the party draws near.',`<div class="trap-art mushroom-burst-art">${icon('explodingMushroom')}</div>${drawMachine('mushroom-blast',[faces[0],faces[1],faces[0]])}${criticalSpace()}<div class="stage-result" id="mushroom-blast-result">Duck beneath the shower of spores.</div>`,'mushroom-blast');
  burst($('#stage-card'),'poison',65);shakeElement($('#stage-card'),5,'explosion');GameSound.play('poof');
  const symbols=await runMachine('mushroom-blast',[faces,faces,faces]);
  if(state!==run)return;
  const danger=symbols.reduce((n,f)=>n+(f.type==='trap'?f.tier:0),0);
  const base=danger?danger+EXPEDITION_TUNING.mushroomBlastBase+Math.floor(state.depth/EXPEDITION_TUNING.mushroomBlastDepth):0;
  const multiplier=await rollCritical('Burstcap',symbols,false,{context:'trap',details:[{label:'Spore blast',icon:'trap',value:base}]});
  if(state!==run)return;
  const damage=Math.ceil(base*multiplier);
  state.pendingMushroomBlast={tile:i,damage};save();
  $('#mushroom-blast-result').textContent=damage?`${damage} incoming spore damage.`:'A narrow escape. No damage.';
  await eventChoice([{id:'stage-confirm',label:'Let the spores settle',value:true}]);closeSpotlight();
  if(state!==run)return;
  await settleMushroomBlast();
}
async function settleMushroomBlast(){
  const pending=state.pendingMushroomBlast;if(!pending)return;
  delete state.pendingMushroomBlast;
  const h=state.party.find(alive);if(h&&pending.damage)damageHero(state.party.indexOf(h),pending.damage,'Burstcap spores',{impact:{type:'poison'}});
  log(`Burstcap explodes: ${pending.damage} incoming damage. Only an ordinary mushroom remains.`);
  smokePoof($(`[data-tile="${pending.tile}"]`),true);
  await processDeaths();checkDefeat();render();save();
}
async function expansionBattle({mother=false,shadow=false}={}){
  const hero=state.party.find(alive);
  beginEncounter(false,{elite:mother||shadow,count:1,broodmother:mother,adventurer:shadow?{name:`Shadow of ${hero.name}`,job:hero.job}:null});
  const e=state.enemy;
  if(mother)e.broodmother=true;
  if(shadow)e.shadowDouble=true;
  renderMap();renderEncounter();await encounterEntrance();
}
async function resolveExpansionTile(c){
  const type=c.event,def=BIOME_DISCOVERIES[type];if(!def||type==='door')return false;
  const run=state,bagWarning=type==='nest'&&bagWillOverflow('nestEgg');
  const choices=type==='nest'?[
    {id:'nest-loot',label:'Take the loot · may wake the mother',value:'loot'},
    {id:'nest-egg',label:`Take the egg${bagWarning?' · BAG FULL':''} · may wake the mother`,value:'egg'},
    {id:'biome-leave',label:'Leave the nest untouched',value:'leave'},
  ]:type==='fairy'?[
    {id:'biome-heal',label:'Rest among the caps',value:'heal'},
    {id:'biome-loot',label:'Search the ring',value:'loot'},
    {id:'biome-leave',label:'Leave it alone',value:'leave'},
  ]:[{id:'biome-use',label:type==='fruit'?'Pick the fruit':type==='shadowduel'?'Accept the duel':type==='rubble'?'Search the rubble':type==='plate'?'Press the plate':'Examine it',value:'use'},
    {id:'biome-leave',label:'Leave it untouched',value:'leave'}];
  showSpotlight(def.name,def.description,`<div class="stage-art biome-discovery-art">${icon(def.icon)}</div><div class="stage-result">${type==='nest'?'An egg restores 65% of one hero’s maximum HP. Taking it is riskier than taking the loot.':type==='fruit'?'The fruit restores a small amount of health to each living companion.':type==='shadowduel'?'Your double is stronger than an ordinary foe. Its spoils are richer, too.':'The choice is yours.'}${bagWarning?'<br><b>BAG FULL · you will choose what to keep before collecting the egg.</b>':''}</div>`,'biome-choice');
  $('#stage-card').dataset.biomeKind=type;
  const choice=await eventChoice(choices);closeSpotlight();if(state!==run)return true;
  if(choice==='leave'||choice==='cancel'){
    c.autoDeclined=true;log(`${def.name}: left untouched.`);return true;
  }
  c.feature=type;c.event=null;c.activated=true;c.autoDeclined=false;
  log(`${def.name}: the party investigates.`,{terms:[{name:def.name,description:def.description}]});
  if(type==='nest'){
    if(choice==='egg'){state.pendingItems.push({type:'nestEgg',count:1});await processPendingItems();}
    else await treasureRoll('chest');
    if(state!==run)return true;
    if(Math.random()<(choice==='egg'?EXPEDITION_TUNING.motherEggChance:EXPEDITION_TUNING.motherGoldChance))await expansionBattle({mother:true});
  }else if(type==='fruit')state.party.forEach((h,i)=>{if(alive(h))healHero(i,Math.ceil(h.maxHp*0.1)+2);});
  else if(type==='fairy'){
    if(choice==='heal')state.party.forEach((h,i)=>{if(alive(h))healHero(i,4+state.depth);});
    else await treasureRoll('chest');
    if(state===run&&Math.random()<0.18)await expansionBattle();
  }else if(type==='rubble'){
    if(Math.random()<0.22)await expansionBattle();else await treasureRoll('chest');
  }else if(type==='shadowduel')await expansionBattle({shadow:true});
  else if(type==='geode'){
    state.party.filter(alive).forEach(h=>{h.geodeGift={reel:rand(3),uses:2};burst(entityArt(h),'gold',20);});
    log('Resonant geode: the party carries gilded reels into its next battle.');
  }else if(type==='prism'){
    const origin=state.position,x=origin%W,y=Math.floor(origin/W);let count=0;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(let step=1;step<=4;step++){
      const a=x+dx*step,b=y+dy*step;if(a<0||a>=W||b<0||b>=H)break;
      const i=pos(a,b);if(!state.map[i].seen){markSeen(i);count++;}if(state.map[i].wall)break;
    }
    log(`Prism stone reveals ${count} tiles along four sight-lines.`);
  }else if(type==='plate'&&state.map[c.gateTarget]){
    const gate=state.map[c.gateTarget];Object.assign(gate,{wall:false,terrain:'openGate'});
    if(gate.seen)smokePoof($(`[data-tile="${c.gateTarget}"]`));log('Pressure plate opens its matching gate.');
  }
  render();save();return true;
}
async function openSecretDoor(i){
  if(busy||state.enemy||state.over)return;
  const c=state.map[i];if(!c?.seen||c.event!=='door')return;
  if(tileDistance(i)>1){toast('Stand beside the door to open the shortcut.');return;}
  busy=true;
  try{
    showSpotlight('A secret door','A seam in the masonry leads to another passage.',`<div class="stage-art">${icon('door')}</div><div class="stage-result">Open this shortcut? It will stay open.</div>`,'biome-choice');
    $('#stage-card').dataset.biomeKind='door';
    const choice=await eventChoice([{id:'biome-use',label:'Open the shortcut',value:'use'},{id:'biome-leave',label:'Leave it closed',value:'leave'}]);closeSpotlight();
    if(choice==='use'){Object.assign(c,{wall:false,terrain:'floor',event:null,feature:'door',activated:true});smokePoof($(`[data-tile="${i}"]`));log('Secret door opens a new shortcut.');}
  }finally{busy=false;render();save();}
}
