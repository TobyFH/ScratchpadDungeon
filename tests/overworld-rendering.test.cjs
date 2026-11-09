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
  await fs.mkdir(path.resolve(__dirname,'../test-results/overworld-rendering'),{recursive:true});
});
after(async()=>{await browser?.close();await new Promise(r=>server.close(r))});
async function notebook(t){
  const p=await browser.newPage({viewport:{width:1920,height:1080}}), errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url);await p.evaluate(()=>CompanyIntro.skip(true));
  await p.evaluate(async()=>{
    newRun('fighter');closeModal();closeSpotlight();setPace('skip');
    state.autoplay=state.autoresolve=false;state.pursuer=null;state.pursuerSpawned=true;
    state.position=pos(1,7);
    state.map=Array.from({length:W*H},(_,i)=>({wall:i%W===0||i%W===W-1||i<W||i>=W*(H-1),terrain:'floor',seen:true,visited:false,event:null,feature:null,doodle:i%5,corpses:[],lastNearCommand:0}));
    state.map[0].biome='cave';state.map[0].floorName='The slate galleries';
    state.map[pos(9,1)].event=state.map[pos(9,1)].feature='stairs';
    render();await document.fonts.ready;
  });
  t.after(async()=>{await p.close();assert.deepEqual(errors,[])});return p;
}
test('unchanged map refreshes retain all 99 buttons and sketches without live DOM churn',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(async()=>{
    const nodes=[...$('#map').children], drawings=nodes.map(n=>n.firstChild);
    let adds=0,removes=0;const observer=new MutationObserver(rows=>rows.forEach(r=>{adds+=r.addedNodes.length;removes+=r.removedNodes.length}));
    observer.observe($('#map'),{subtree:true,childList:true});
    for(let i=0;i<12;i++)renderMap();await Promise.resolve();observer.disconnect();
    return{retained:nodes.every((n,i)=>n===$('#map').children[i]&&n.firstChild===drawings[i]),adds,removes};
  });assert.deepEqual(r,{retained:true,adds:0,removes:0});
});
test('state changes produce exactly the same tile DOM as a full redraw, with unchanged neighbouring art retained',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const kept=$('[data-tile="13"]'), art=kept.firstChild;
    Object.assign(state.map[12],{seen:false,hint:{text:'A glimmer',kind:'glimmer'}});
    Object.assign(state.map[14],{terrain:'poisonMushroom'});
    Object.assign(state.map[15],{event:'well',feature:'well'});
    Object.assign(state.map[16],{terrain:'river',wall:true});
    Object.assign(state.map[17],{terrain:'bridge'});
    Object.assign(state.map[18],{corpses:[{kind:'rat'}]});
    state.position=pos(2,7);busy=true;renderMap();
    const identity=kept===$('[data-tile="13"]')&&art===kept.firstChild;
    const clean=s=>s.replace(/(?:hero-|horror-)?hatch-\d+/g,'hatch-ID');
    const before=clean($('#map').innerHTML), real=paintMapTiles;
    try{paintMapTiles=tiles=>{$('#map').innerHTML=tiles.join('')};renderMap();}
    finally{paintMapTiles=real;busy=false;}
    return{identity,equal:before===clean($('#map').innerHTML)};
  });assert.deepEqual(r,{identity:true,equal:true});
});
test('external eraser writes and deep SVG mutations invalidate cached contents, and transient attributes reset',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    const cell=$('[data-tile="12"]'), expected=cell.innerHTML;
    cell.querySelector('path').setAttribute('d','M0 0');cell.classList.add('route','erasing');cell.disabled=true;
    renderMap();const deep=cell.innerHTML===expected&&!cell.classList.contains('route')&&!cell.disabled;
    cell.innerHTML='<b>temporary eraser frame</b>';renderMap();
    return{deep,eraser:cell.innerHTML===expected};
  });assert.deepEqual(r,{deep:true,eraser:true});
});
test('crystal pulse nodes keep their animation timeline, but actual occlusion changes and new floors invalidate drawings',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    state.map[0].biome='crystal';Object.assign(state.map[pos(4,4)],{terrain:'crystal',wall:true});
    setPreference('tileMotion',true);renderMap();
    const overlay=$('#crystal-pulse-map'), pulse=overlay.querySelector('.quartz-pulse'), animation=pulse.getAnimations()[0];
    animation.pause();animation.currentTime=1234;const art=$('[data-tile="12"]');
    renderMap();const stable=overlay===$('#crystal-pulse-map')&&animation.currentTime===1234;
    state.map[pos(4,3)].wall=true;renderMap();const changed=overlay!==$('#crystal-pulse-map');
    state.map=JSON.parse(JSON.stringify(state.map));renderMap();
    return{stable,changed,newFloor:art!==$('[data-tile="12"]'),pulses:document.querySelectorAll('.quartz-pulse').length};
  });assert.deepEqual(r,{stable:true,changed:true,newFloor:true,pulses:1});
});
test('render caches consume no gameplay RNG, change no world data, and leave all particles intact',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>{
    particles=[];burst($('#map-player'),'dust',30);
    const world=JSON.stringify(state), fx=JSON.stringify(particles), original=Math.random;
    try{Math.random=()=>{throw Error('cosmetic code consumed gameplay RNG')};for(let i=0;i<4;i++)renderMap();}
    finally{Math.random=original;}
    return{world:JSON.stringify(state)===world,fx:JSON.stringify(particles)===fx,count:particles.length};
  });assert.deepEqual(r,{world:true,fx:true,count:30});
});
test('100% brightness removes only the identity filter; non-default brightness still uses the original control',async t=>{
  const p=await notebook(t);
  const r=await p.evaluate(()=>[.5,1,1.5,1].map(value=>{
    setPreference('brightness',value);return getComputedStyle($('#screen-lighting')).backdropFilter;
  }));assert.deepEqual(r,['brightness(0.5)','none','brightness(1.5)','none']);
});
test('poison mushroom tiles have distinct purple ink and paper in every palette without revealing covered hazards',async t=>{
  const p=await notebook(t);
  for(const palette of ['default','warm','dark']){
    const r=await p.evaluate(palette=>{
      state.palette=palette;
      Object.assign(state.map[12],{terrain:'mushroom'});
      Object.assign(state.map[13],{terrain:'poisonMushroom'});
      Object.assign(state.map[14],{terrain:'poisonMushroom',seen:false});
      Object.assign(state.map[15],{terrain:'poisonMushroom',event:'treasure',feature:'treasure'});
      render();
      const poison=$('[data-tile="13"]'), normal=$('[data-tile="12"]'), hidden=$('[data-tile="14"]');
      return{color:getComputedStyle(poison.querySelector('.biome-cover')).color,
        ink:getComputedStyle(poison).getPropertyValue('--poison').trim(),
        distinct:getComputedStyle(poison).backgroundColor!==getComputedStyle(normal).backgroundColor,
        opacity:getComputedStyle(poison.querySelector('.biome-cover')).opacity,
        hidden:!hidden.className.includes('poisonMushroom')&&!hidden.innerHTML.includes('poisonMushroom'),
        treasure:!!$('[data-tile="15"] .tile-status')};
    },palette);
    assert.equal(r.distinct,true);assert.equal(r.opacity,'0.95');assert.equal(r.hidden,true);assert.equal(r.treasure,true);
    const rgb=r.ink.match(/\w\w/g).map(x=>parseInt(x,16));assert.equal(r.color,`rgb(${rgb.join(', ')})`);
    for(const width of [1920,1280]){
      await p.setViewportSize({width,height:width===1920?1080:800});
      await p.screenshot({path:path.resolve(__dirname,`../test-results/overworld-rendering/poison-${palette}-${width}.png`),animations:'disabled'});
    }
  }
});
