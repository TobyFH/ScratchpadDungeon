const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright');
let browser, server, url;
before(async()=>{
  const html=await fs.readFile(path.resolve(__dirname,'../index.html'));
  server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html');r.end(html)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  await fs.mkdir(path.resolve(__dirname,'../test-results/layout-performance'),{recursive:true});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r))});
async function settle(p){await p.evaluate(async()=>{requestFitUI();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))))})}
async function notebook(t){
  const p=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.goto(url);await p.evaluate(()=>CompanyIntro.skip(true));
  await p.evaluate(async()=>{
    newRun('fighter',{specialism:'defence'});closeModal();closeSpotlight();setPace('skip');
    state.autoplay=state.autoresolve=false;state.pursuer=null;state.pursuerSpawned=true;
    state.position=pos(1,7);
    state.map=Array.from({length:W*H},(_,i)=>({wall:i%W===0||i%W===W-1||i<W||i>=W*(H-1),terrain:'floor',seen:true,visited:false,event:null,feature:null,doodle:i%5,corpses:[],lastNearCommand:0}));
    state.map[0].biome='cave';state.map[0].floorName='The slate galleries';
    Object.assign(state.map[12],{event:'treasure',feature:'treasure'});
    Object.assign(state.map[13],{event:'well',feature:'well'});
    state.map[pos(9,1)].event=state.map[pos(9,1)].feature='stairs';render();await document.fonts.ready;
  });await settle(p);
  t.after(async()=>{await p.close();assert.deepEqual(errors,[])});return p;
}
test('resizing during the intro never reads a player position before the run is loaded',async t=>{
  const p=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  t.after(async()=>{await p.close();assert.deepEqual(errors,[])});
  await p.addInitScript(()=>{HTMLMediaElement.prototype.play=()=>Promise.resolve()});
  await p.goto(url);
  for(const width of [1280,390,1920]){
    await p.setViewportSize({width,height:width===1920?1080:width===1280?800:844});
    await p.evaluate(()=>window.dispatchEvent(new Event('resize')));
  }
  assert.equal(await p.evaluate(()=>!state&&CompanyIntro.active),true);
  await p.evaluate(()=>CompanyIntro.skip(true));
  assert.equal(await p.evaluate(()=>!!state),true);
});
test('unchanged fitting and keyboard prompts do no size reads or DOM replacements',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const desk=$('.desk'),bar=$('#keyboard-bar'),first=bar.firstChild;
    const get=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'offsetHeight').get;
    let reads=0;
    for(const node of [desk,bar])Object.defineProperty(node,'offsetHeight',{configurable:true,get(){reads++;return get.call(this)}});
    try{for(let i=0;i<25;i++){fitNotebook();updateKeyboardBar()}}
    finally{delete desk.offsetHeight;delete bar.offsetHeight;}
    return{reads,retained:first===bar.firstChild};
  });assert.deepEqual(r,{reads:0,retained:true});
});
test('cached notebook scale agrees with the original formula across desktop and compact resolutions',async t=>{
  const p=await notebook(t);
  for(const [width,height] of [[1920,1080],[1280,800],[1366,768],[1024,768],[390,844],[320,844],[1920,1080]]){
    await p.setViewportSize({width,height});await settle(p);
    const r=await p.evaluate(()=>{
      const desk=$('.desk'),bar=$('#keyboard-bar'),fit=innerWidth>=1260&&innerHeight>=560;
      return{fit:desk.classList.contains('fit-notebook'),scale:desk.style.getPropertyValue('--desk-scale'),
        expected:fit?Math.max(.35,Math.min(1.12,(innerWidth-24)/1800,(innerHeight-bar.offsetHeight-16)/desk.offsetHeight)).toFixed(4):'',
        footer:getComputedStyle(document.documentElement).getPropertyValue('--keyboard-bar-height').trim(),height:bar.offsetHeight+'px'};
    });assert.equal(r.fit,width>=1260&&height>=560);assert.equal(r.scale,r.expected);assert.equal(r.footer,r.height);
  }
});
test('real footer and font-size changes invalidate fitting without a resize loop',async t=>{
  const p=await notebook(t);
  await p.evaluate(()=>{$('#keyboard-bar').style.height='92px';document.fonts.dispatchEvent(new Event('loadingdone'))});await settle(p);
  const r=await p.evaluate(()=>{
    const bar=$('#keyboard-bar'),desk=$('.desk');
    return{height:bar.offsetHeight+'px',variable:document.documentElement.style.getPropertyValue('--keyboard-bar-height'),
      scale:desk.style.getPropertyValue('--desk-scale'),expected:Math.max(.35,Math.min(1.12,(innerWidth-24)/1800,(innerHeight-bar.offsetHeight-16)/desk.offsetHeight)).toFixed(4)};
  });assert.equal(r.height,r.variable);assert.equal(r.scale,r.expected);
  await p.evaluate(()=>{$('#keyboard-bar').style.removeProperty('height')});await settle(p);
  const stable=await p.evaluate(async()=>{
    const desk=$('.desk'),values=[];
    for(let i=0;i<12;i++){await new Promise(r=>requestAnimationFrame(r));values.push(desk.style.getPropertyValue('--desk-scale'))}
    return new Set(values).size;
  });assert.equal(stable,1);
});
test('closed dialogs avoid measurements, while visible options and confirmations still fit',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const toolbar=$('.desk-top'),original=toolbar.getBoundingClientRect;let reads=0;
    toolbar.getBoundingClientRect=function(){reads++;return original.call(this)};
    try{for(let i=0;i<10;i++)fitDialogs();const hidden=reads;optionsPage('display');fitDialogs();return{hidden,visible:reads>hidden}}
    finally{toolbar.getBoundingClientRect=original}
  });assert.deepEqual(r,{hidden:0,visible:true});
  for(const width of [1920,1280,390]){
    await p.setViewportSize({width,height:width===1920?1080:width===1280?800:844});await settle(p);
    assert.equal(await p.locator('#overlay').isVisible(),true);
    await p.screenshot({path:path.resolve(__dirname,`../test-results/layout-performance/options-${width}.png`),animations:'disabled'});
  }
  await p.evaluate(()=>closeModal());await settle(p);
  assert.equal(await p.evaluate(()=>$('#keyboard-bar').textContent.includes('WASD')),true);
});
test('moving between SVG paths within one tile does not repeat route calculations',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const a=$('[data-tile="12"]'),b=$('[data-tile="13"]'),paths=a.querySelectorAll('svg path');
    const original=shortestPath;let calls=0;
    shortestPath=(...args)=>{calls++;return original(...args)};
    try{
      paths[0].dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));
      const entered=calls;
      for(let i=0;i<20;i++){
        const from=paths[(i+1)%paths.length],to=paths[i%paths.length];
        from.dispatchEvent(new PointerEvent('pointerout',{bubbles:true,relatedTarget:to}));
        to.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:from}));
      }
      const inside=calls;
      renderMap();
      paths[0].dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:paths[1]}));
      const refreshed=calls;
      b.querySelector('path').dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:paths[0]}));
      return{entered,inside,refreshed,other:calls,hover:mapHoverIndex};
    }finally{shortestPath=original}
  });assert.deepEqual(r,{entered:1,inside:1,refreshed:2,other:3,hover:13});
});
test('portrait tooltip opens once per entry, but focus and a hidden tooltip still refresh live values',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const portrait=$('#portrait-0'),paths=portrait.querySelectorAll(':scope > svg path'),original=heroStatsMarkup, clock=Date.now, now=Date.now();let calls=0;
    Date.now=()=>now;
    heroStatsMarkup=(...args)=>{calls++;return original(...args)};
    try{
      paths[0].dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:document.body}));
      for(let i=0;i<20;i++){
        const from=paths[(i+1)%paths.length],to=paths[i%paths.length];
        from.dispatchEvent(new PointerEvent('pointerout',{bubbles:true,relatedTarget:to}));
        to.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:from}));
      }
      const inside=calls;
      showStatusTooltip({target:portrait,type:'focusin'});const focus=calls;
      state.party[0].hp--;
      paths[0].dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:paths[1]}));const changed=calls;
      statusTooltip.hidden=true;state.party[0].hp--;
      paths[0].dispatchEvent(new PointerEvent('pointerover',{bubbles:true,relatedTarget:paths[1]}));
      const visible=!statusTooltip.hidden;
      paths[0].dispatchEvent(new PointerEvent('pointerout',{bubbles:true,relatedTarget:document.body}));
      return{inside,focus,changed,reopened:calls,visible,exited:statusTooltip.hidden};
    }finally{heroStatsMarkup=original;Date.now=clock}
  });assert.deepEqual(r,{inside:1,focus:2,changed:3,reopened:4,visible:true,exited:true});
});
test('layout optimisation changes no world data, gameplay randomness or particles',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    particles=[];burst($('#map-player'),'paper',40);
    const world=JSON.stringify(state),fx=JSON.stringify(particles),original=Math.random;
    try{Math.random=()=>{throw Error('layout consumed game RNG')};for(let i=0;i<8;i++){fitNotebook();fitDialogs();updateKeyboardBar()}}
    finally{Math.random=original}
    return{world:world===JSON.stringify(state),fx:fx===JSON.stringify(particles),count:particles.length};
  });assert.deepEqual(r,{world:true,fx:true,count:40});
});
