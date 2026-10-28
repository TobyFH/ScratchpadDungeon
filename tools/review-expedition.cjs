const {chromium}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'test-results/expedition-expansion');fs.mkdirSync(out,{recursive:true});
 const html=fs.readFileSync(path.join(root,'index.html')),server=http.createServer((_,r)=>{r.setHeader('Content-Type','text/html');r.end(html)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[],external=[],shots=[];
 try{
  const p=await browser.newPage({viewport:{width:1920,height:1080}});p.on('pageerror',e=>errors.push(e.message));
  p.on('request',r=>{if(!r.url().startsWith(url)&&!r.url().startsWith('data:'))external.push(r.url())});await p.goto(url);
  async function shot(name){await p.evaluate(async()=>{await document.fonts.ready;fitNotebook();requestFitUI()});await p.waitForTimeout(100);await p.screenshot({path:path.join(out,name+'.png'),fullPage:false,animations:'disabled'});shots.push(name);}
  for(const theme of ['cave','overgrown','fungal','ice','lava','crystal','unstable','shadow','maze']){
   await p.setViewportSize({width:1920,height:1080});
   await p.evaluate(theme=>{newRun('fighter');setPace('skip');closeModal();closeSpotlight();characterLuck=()=>.99999;state.depth=6;state.map=generateFloor(6,1,0,[],theme);state.map.forEach(c=>c.seen=true);state.exitFound=true;render();particles=[];},theme);
   await shot(theme+'-1920');
   await p.setViewportSize({width:1280,height:800});await shot(theme+'-1280');
  }
  await p.evaluate(()=>{state.party=[makeHero('Bram','berserker'),makeHero('Mira','mage'),makeHero('Rowan','ranger')];beginEncounter(false,{count:2});finishOpeningRoll();state.party[0].fury=20;state.party[1].stun=1;state.party[2].stimulant={turns:3,power:4,overflow:1,appliedAt:state.actionSerial};render();log('Stun cleared; now Steady.');log('INSPIRED!');});
  await shot('combat-status-language-1280');
  for(const palette of ['dark','warm']){await p.evaluate(palette=>setPalette(palette),palette);await shot('combat-'+palette+'-1280');}
  await p.evaluate(()=>{closeModal();closeSpotlight();state.enemy=null;state.enemies=[];setPalette('default');render();});
  await p.setViewportSize({width:390,height:844});await p.locator('#hover-name').scrollIntoViewIfNeeded();await shot('inspection-390');
  fs.writeFileSync(path.join(out,'visual-report.json'),JSON.stringify({shots,errors,external},null,2));
  if(errors.length||external.length)throw Error(JSON.stringify({errors,external}));console.log(`Saved ${shots.length} expansion captures.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
