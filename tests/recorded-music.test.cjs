const { resumeSavedRun } = require("./helpers/resume-run.cjs");
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {chromium}=require('playwright');
let browser,server,url;
const out=path.resolve(__dirname,'../test-results/recorded-music');
before(async()=>{
  fs.mkdirSync(out,{recursive:true});const html=fs.readFileSync(path.resolve(__dirname,'../index.html'));
  server=http.createServer((_,r)=>{r.setHeader('Content-Type','text/html');r.end(html)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
});
after(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r));});
async function game(t,width=1280,height=800){
  const p=await browser.newPage({viewport:{width,height}}),errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/*',r=>{const u=r.request().url();if(!u.startsWith(url)&&!u.startsWith('data:')){external.push(u);return r.abort()}return r.continue()});
  await p.goto(url);await p.evaluate(()=>CompanyIntro.skip(true));
  await p.evaluate(async()=>{newRun('fighter');setPace('skip');closeModal();closeSpotlight();scheduleStunRecovery=()=>{};characterLuck=()=>.99999;await document.fonts.ready;fitNotebook(true)});
  t.after(async()=>{await p.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[],'music remains offline')});return p;
}
async function sound(p){
  await p.evaluate(()=>{
    window.mediaDecks=[];
    const create=AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource=function(audio){mediaDecks.push(audio);return create.call(this,audio)};
    setPreference('musicVolume',.7);setPreference('ambienceVolume',0);setPreference('sfxVolume',0);
  });
  await p.mouse.click(4,4);await p.evaluate(()=>GameSound.unlock());
  await p.waitForFunction(()=>GameSound.music?.status.playing);
}
test('the six uploaded full tracks loop, decode real audio, use at most two decks and request no files',async t=>{
  const p=await game(t);await sound(p);
  const records=await p.evaluate(async()=>{
    const report=[]; // Native media, not synthesised notes.
    const random=Math.random;let calls=0;Math.random=()=>{calls++;return .5};
    const analyser=GameSound.context.createAnalyser();analyser.fftSize=4096;GameSound.music.output.connect(analyser);
    try{
      const original=musicSelection;musicSelection=()=>({id:window.testTrack||'chill',key:window.testTrack||'chill',scene:'exploration'});
      try{for(const id of ['title','peaceful','chill','mysterious','ominous','battle']){
        window.testTrack=id;GameSound.refreshMusic();
        await new Promise((resolve,reject)=>{const start=performance.now();const check=()=>{const a=mediaDecks.find(a=>a.src===MUSIC_RECORDINGS[id].src&&!a.paused);if(a?.readyState>=3&&a.currentTime>.15)return resolve();if(performance.now()-start>8000)return reject(Error('Cannot play '+id));setTimeout(check,40)};check()});
        await new Promise(r=>setTimeout(r,750));
        const a=mediaDecks.find(a=>a.src===MUSIC_RECORDINGS[id].src&&!a.paused),data=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(data);
        report.push({id,loop:a.loop,duration:a.duration,time:a.currentTime,rms:Math.sqrt(data.reduce((s,n)=>s+n*n,0)/data.length),...GameSound.music.status});
      }}finally{musicSelection=original}
      return {report,calls,notes:GameSound.stats.musicNotes};
    }finally{Math.random=random;analyser.disconnect()}
  });
  for(const r of records.report){assert.ok(r.loop&&r.duration>20&&r.time>.15,JSON.stringify(r));assert.ok(r.rms>.00001,r.id+' produces sound');assert.ok(r.decks<=2);assert.deepEqual(r.errors,[])}
  assert.equal(records.calls,0);assert.equal(records.notes,0,'recordings replace the score rather than layering over it');
  fs.writeFileSync(path.join(out,'tracks.json'),JSON.stringify(records,null,2));
});
test('main menu and camp use Title, every biome has a track, combat overrides it, and utility pages preserve the scene',async t=>{
  const p=await game(t);const result=await p.evaluate(()=>{
    const tracks={};for(const theme of Object.keys(BIOMES)){state.map[0].biome=theme;tracks[theme]=musicSelection().id}
    chooseStartingClass(false);const menu=musicSelection();campPage();const camp=musicSelection();
    openUtilityPage('options');const options=musicSelection();closeUtilityPage();closeModal();
    beginEncounter(false,{count:2});const battle=musicSelection();openUtilityPage('guide');const guide=musicSelection();closeUtilityPage();
    return{tracks,menu,camp,options,battle,guide};
  });
  assert.equal(Object.keys(result.tracks).length,9);assert.equal(result.tracks.overgrown,'peaceful');assert.equal(result.tracks.crystal,'mysterious');assert.equal(result.tracks.ice,'chill');assert.equal(result.tracks.lava,'ominous');
  for(const k of ['menu','camp','options'])assert.equal(result[k].id,'title');
  for(const k of ['battle','guide'])assert.equal(result[k].id,'battle');
});
test('changing floors fades and restarts even the same biome track; rapid changes keep a bounded playback pool',async t=>{
  const p=await game(t);await sound(p);const r=await p.evaluate(async()=>{
    const first=GameSound.music.status.key;state.depth++;GameSound.refreshMusic();const second=GameSound.music.status.key;
    const fade=mediaDecks.filter(a=>!a.paused).length;
    for(let n=0;n<12;n++){state.depth++;GameSound.refreshMusic()}
    await new Promise(r=>setTimeout(r,800));
    return{first,second,fade,status:GameSound.music.status,playing:mediaDecks.filter(a=>!a.paused).length};
  });
  assert.notEqual(r.first,r.second);assert.equal(r.fade,2);assert.equal(r.status.decks,2);assert.equal(r.playing,1);assert.deepEqual(r.status.errors,[]);
});
test('victory and failure jingles duck only the looping background, restore it, and deduplicate outcome events',async t=>{
  const p=await game(t);await sound(p);
  for(const id of ['victory','failure']){
    assert.equal(await p.evaluate(id=>GameSound.stinger(id),id),true);
    await p.waitForFunction(id=>GameSound.music.status.jingle===id&&GameSound.music.status.duck<.2,id);
    const r=await p.evaluate(id=>({status:GameSound.music.status,repeat:GameSound.stinger(id),looping:mediaDecks.filter(a=>a.loop&&!a.paused).length,jingle:mediaDecks.filter(a=>!a.loop&&!a.paused).length}),id);
    assert.equal(r.repeat,false);assert.equal(r.looping,1);assert.equal(r.jingle,1);
    await p.waitForFunction(()=>!GameSound.music.status.jingle&&GameSound.music.status.duck>.99,{}, {timeout:12000});
  }
  const errors=await p.evaluate(()=>GameSound.music.status.errors);assert.deepEqual(errors,[]);
});
test('floor celebration, the final guardian and party defeat call the corresponding outcome jingle',async t=>{
  const p=await game(t);
  await p.evaluate(()=>{window.outcomeSounds=[];window.originalStinger=GameSound.stinger;GameSound.stinger=id=>outcomeSounds.push(id);window.floorCelebration=celebrateFloorClear()});
  await p.locator('#stage-confirm').click();await p.evaluate(()=>floorCelebration);
  const r=await p.evaluate(()=>{
    state.depth=10;finishVictory();newRun('fighter');state.party.forEach(h=>{h.hp=0;h.dead=true});checkDefeat();
    GameSound.stinger=originalStinger;return outcomeSounds;
  });
  assert.deepEqual(r,['victory','victory','failure']);
});
test('background and jingle output obey the actual music slider and master mute',async t=>{
  const p=await game(t);await sound(p);
  const r=await p.evaluate(async()=>{
    // Monitoring the background's output tests that ducking remains upstream of the music bus;
    // the existing public gains separately verify the shared user controls.
    setPreference('musicVolume',0);await new Promise(r=>setTimeout(r,400));
    const off={...GameSound.gains},silent=GameSound.stinger('victory');
    setPreference('musicVolume',.35);setPreference('muted',true);await new Promise(r=>setTimeout(r,400));
    const muted={...GameSound.gains},mutedJingle=GameSound.stinger('failure');
    setPreference('muted',false);await new Promise(r=>setTimeout(r,400));
    return{off,silent,muted,mutedJingle,on:GameSound.gains};
  });
  assert.ok(r.off.music<.0001);assert.equal(r.silent,false);assert.ok(r.muted.master<.0001);assert.equal(r.mutedJingle,false);assert.ok(Math.abs(r.on.music-.35)<.001);
});
test('visibility suspension pauses native loops and jingles, and resume retains their positions',async t=>{
  const p=await game(t);await sound(p);await p.evaluate(()=>GameSound.stinger('victory'));await p.waitForTimeout(200);
  const r=await p.evaluate(async()=>{
    const before=mediaDecks.filter(a=>!a.paused).map(a=>a.currentTime);
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r=>setTimeout(r,180));const paused=mediaDecks.every(a=>a.paused);
    Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));await GameSound.unlock();
    await new Promise(r=>setTimeout(r,250));const after=mediaDecks.filter(a=>!a.paused).map(a=>a.currentTime);
    return{paused,before,after,context:GameSound.context.state};
  });
  assert.ok(r.paused);assert.equal(r.context,'running');assert.equal(r.after.length,r.before.length);for(let i=0;i<r.before.length;i++)assert.ok(r.after[i]>=r.before[i]);
});
test('unplayable music reports once and the score remains available as a fallback',async t=>{
  const p=await game(t);
  await p.evaluate(()=>{HTMLMediaElement.prototype.play=function(){return Promise.reject(Object.assign(new Error('Fixture unsupported recording'),{name:'NotSupportedError'}))}});
  await p.mouse.click(4,4);await p.evaluate(()=>GameSound.unlock());
  await p.waitForFunction(()=>GameSound.stats.musicNotes>0);
  assert.deepEqual(await p.evaluate(()=>GameSound.music.status.errors),['chill']);
});
test('motion defaults equal the old maximum, new sliders reach 300%, and saved preferences survive a new run',async t=>{
  const p=await game(t);const r=await p.evaluate(()=>{
    const defaults=normalisePreferences();setPreference('shake',2.25);setPreference('portraitMotion',2.75);newRun('rogue');
    openUtilityPage('options');optionsPage('display');
    return{defaults,saved:preferences(),cap:normalisePreferences({brightness:8,shake:8,portraitMotion:8}),max:[...document.querySelectorAll('input[type="range"]')].map(n=>[n.dataset.setting||n.id,n.max])};
  });
  assert.equal(r.defaults.shake,1.5);assert.equal(r.defaults.portraitMotion,1.5);assert.equal(r.cap.shake,3);assert.equal(r.cap.portraitMotion,3);assert.equal(r.cap.brightness,1.5);assert.equal(r.saved.shake,2.25);assert.equal(r.saved.portraitMotion,2.75);
  assert.equal(r.max.filter(([,max])=>max==='300').length,2);
  await p.reload();await resumeSavedRun(p);assert.equal(await p.evaluate(()=>preferences().portraitMotion),2.75);
});
test('quartz zones are a steady union with one boundary, no expansion, matching occlusion and reduced-motion support',async t=>{
  const p=await game(t);const r=await p.evaluate(()=>{
    state.map=Array.from({length:W*H},()=>({wall:false,seen:true,event:null,terrain:'floor',activated:true}));
    state.map[0].biome='crystal';for(const i of [pos(4,4),pos(5,4)])Object.assign(state.map[i],{terrain:'crystal',wall:true});
    state.map[pos(4,3)].wall=true;renderMap();
    const zone=$('.quartz-zone'),covered=zone.dataset.zoneCells.split(',').map(Number),animations=zone.getAnimations();
    const fields=new Set();for(const i of [pos(4,4),pos(5,4)])state.map.forEach((c,j)=>{if(j===i||!c.wall&&tileDistance(j,i)<=1&&mapLineOfSight(state.map,i,j))fields.add(j)});
    const frames=animations[0].effect.getKeyframes();return{covered,expected:[...fields].sort((a,b)=>a-b),zones:document.querySelectorAll('.quartz-zone').length,frames:frames.map(f=>({opacity:f.fillOpacity,scale:f.scale,transform:f.transform})),blocked:covered.includes(pos(4,3))};
  });
  assert.deepEqual(r.covered,r.expected);assert.equal(r.zones,1);assert.equal(r.blocked,false);assert.ok(r.frames.every(f=>!f.scale&&!f.transform&&Number(f.opacity)>0));
  await p.screenshot({path:path.join(out,'quartz-union-1280.png')});
  await p.emulateMedia({reducedMotion:'reduce'});assert.equal(await p.locator('.quartz-zone').evaluate(n=>n.getAnimations().length),0);assert.ok(await p.locator('.quartz-zone').evaluate(n=>parseFloat(getComputedStyle(n).fillOpacity)>0));
});
for(const [width,height] of [[1920,1080],[1280,800],[390,844],[320,844]])test(`clear guide and lower panels fit at ${width}`,async t=>{
  const p=await game(t,width,height);await p.evaluate(()=>openUtilityPage('guide'));
  const before=await p.locator('#guide-next').boundingBox();
  for(let i=0;i<6;i++){
    await p.selectOption('#guide-topic',String(i));const r=await p.evaluate(()=>{
      const list=$('.current-topic ul').getBoundingClientRect(),count=$('.guide-page-count').getBoundingClientRect(),next=$('#guide-next').getBoundingClientRect(),modal=$('#modal').getBoundingClientRect();
      const flow=$('.modal-flow'),row=$('.current-topic li');
      return{fit:list.bottom<=count.top+2,next:{x:next.x,y:next.y},outside:modal.right>innerWidth+1,text:$('.current-topic').textContent,font:parseFloat(getComputedStyle(row).fontSize)*Number(flow.style.zoom||1)};
    });assert.ok(r.fit&&!r.outside,JSON.stringify({width,i,...r}));assert.ok(r.font>=(width>=1280?14:12),JSON.stringify({width,i,...r}));assert.ok(Math.abs(r.next.y-before.y)<2);assert.doesNotMatch(r.text,/Walk into the pencil|Traps roll danger|Save a fountain|Wildcard surprises/);
    if(i===0||i===3)await p.screenshot({path:path.join(out,`guide-${width}-${i}.png`)});
  }
  await p.evaluate(()=>{closeUtilityPage();render();fitNotebook(true)});
  if(width>=1260){const r=await p.evaluate(()=>{
    const rect=s=>$(s).getBoundingClientRect(),a=rect('.expedition-boxes'),b=rect('.notes-and-bag'),gold=rect('.sketch-box p:has(#gold)'),relic=rect('#relic-status');
    return{aligned:Math.abs(a.top-b.top)<1&&Math.abs(a.bottom-b.bottom)<1,space:relic.top-gold.bottom,font:parseFloat(getComputedStyle($('#gold').parentNode).fontSize),height:parseFloat(getComputedStyle($('.expedition-boxes')).height)};
  });assert.ok(r.aligned&&r.space>=10,JSON.stringify(r));assert.ok(r.font>=27.9&&r.height>=269.9,JSON.stringify(r))}
  await p.screenshot({path:path.join(out,`panels-${width}.png`),fullPage:width<1260});
});
test('long treasure names and complex map descriptions fit above the taller lower row',async t=>{
  const p=await game(t);
  for(const [width,height] of [[1920,1080],[1280,800],[390,844],[320,844]]){
    await p.setViewportSize({width,height});
    await p.evaluate(()=>{
      state.artefacts=[{id:'long-relic',name:'The Cartographer’s Forgotten Silver Pennant IV',key:'block',power:14,depth:10}];state.equippedArtefact='long-relic';state.gold=123456;
      Object.assign(state.map[state.position],{terrain:'crystal',seen:true,wall:true});render();updateMapInspection();fitNotebook(true);requestFitUI();
    });
    await p.waitForTimeout(80);
    const r=await p.evaluate(()=>{
      const relic=$('#artefact-slot').getBoundingClientRect(),panel=$('#relic-status').closest('section').getBoundingClientRect(),copy=$('#hover-name'),range=document.createRange();range.selectNodeContents(copy);
      return{relicFits:relic.bottom<=panel.bottom+1&&relic.right<=panel.right+1,textFits:range.getBoundingClientRect().bottom<=$('#map-status').getBoundingClientRect().top+1};
    });assert.ok(r.relicFits&&r.textFits,JSON.stringify({width,...r}));
    await p.screenshot({path:path.join(out,`long-copy-${width}.png`),fullPage:width<1260});
  }
});
