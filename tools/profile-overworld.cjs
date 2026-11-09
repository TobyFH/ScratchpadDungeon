// Bounded first-pass benchmark, not a promise about a player's hardware FPS.
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
  const args = process.argv.slice(2), value = (key, fallback) => args.includes(key) ? args[args.indexOf(key)+1] : fallback;
  const html = await fs.readFile(value('--html', path.resolve(__dirname, '../index.html')));
  const output = value('--out', path.resolve(__dirname, '../test-results/overworld-performance'));
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer((q,r) => { r.setHeader('Content-Type','text/html'); r.end(html); });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox'] });
  const p = await browser.newPage({ viewport: {width:1920,height:1080} }), errors=[];
  p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto(`http://127.0.0.1:${server.address().port}`);
    await p.evaluate(() => CompanyIntro.skip(true));
    await p.evaluate(async () => {
      newRun('fighter', {specialism:'defence'}); closeModal(); closeSpotlight();
      setPace('2'); state.autoplay=state.autoresolve=false;
      characterLuck=()=>.99999; minorTravelEvent=async()=>false;
      state.pursuer=null; state.pursuerSpawned=true;
      state.position=pos(1,7);
      state.map=Array.from({length:W*H},(_,i)=>({
        wall:i%W===0||i%W===W-1||i<W||i>=W*(H-1),
        seen:true,visited:false,event:null,feature:null,terrain:'floor',doodle:i%5,corpses:[],lastNearCommand:0,
      }));
      state.map[0].biome='crystal';state.map[0].floorName='The quartz vault';
      for(const i of [pos(2,2),pos(5,2),pos(8,2),pos(3,4),pos(7,4)])Object.assign(state.map[i],{terrain:'crystal',wall:true});
      state.map[pos(9,1)].event=state.map[pos(9,1)].feature='stairs';
      render(); await document.fonts.ready; requestFitUI();
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      Math.random=()=>.99999;
    });
    const cdp=await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await cdp.send('Performance.enable');
    const before=await cdp.send('Performance.getMetrics');
    const refresh=await p.evaluate(async()=>{
      let additions=0, removals=0;
      const observer=new MutationObserver(rows=>rows.forEach(r=>{additions+=r.addedNodes.length;removals+=r.removedNodes.length}));
      observer.observe(document.querySelector('#map'),{childList:true,subtree:true});
      const original=[...document.querySelectorAll('#map > .tile')], times=[];
      for(let n=0;n<24;n++){
        const start=performance.now();renderMap();times.push(performance.now()-start);
        await new Promise(r=>requestAnimationFrame(r));
      }
      await Promise.resolve();observer.disconnect();
      const retained=original.filter((node,i)=>node===document.querySelector('#map').children[i]).length;
      return {times,additions,removals,retained};
    });
    const after=await cdp.send('Performance.getMetrics');
    const travel=await p.evaluate(async()=>{
      const gaps=[];let frame,last=performance.now();const start=last;
      const tick=(now)=>{gaps.push(now-last);last=now;frame=requestAnimationFrame(tick)};
      frame=requestAnimationFrame(tick);
      await move(pos(9,7));cancelAnimationFrame(frame);
      return {gaps,duration:performance.now()-start,position:state.position,steps:state.steps};
    });
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
    await p.screenshot({path:path.join(output,'notebook.png'),animations:'disabled'});
    await p.locator('#map-board').screenshot({path:path.join(output,'map.png'),animations:'disabled'});
    const stats=(xs)=>{const sorted=[...xs].sort((a,b)=>a-b);return{mean:xs.reduce((a,b)=>a+b,0)/xs.length,median:sorted[Math.floor(sorted.length/2)],p95:sorted[Math.floor(sorted.length*.95)],max:Math.max(...xs)}};
    const tracked=['LayoutCount','RecalcStyleCount','LayoutDuration','RecalcStyleDuration','TaskDuration','ScriptDuration','Nodes','JSHeapUsedSize','JSHeapTotalSize'];
    const metrics=Object.fromEntries(after.metrics.filter(m=>tracked.includes(m.name)).map(m=>[m.name,m.value-(before.metrics.find(b=>b.name===m.name)?.value||0)]));
    const report={cpuThrottle:4,refresh:{...refresh,times:stats(refresh.times)},travel:{...travel,gaps:stats(travel.gaps)},metrics,errors};
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
