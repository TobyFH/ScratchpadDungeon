// Semantic feedback colour is selected once, regardless of who emits the text.
function feedbackKind(text, fallback='event') {
  if(/\bstun(?:ned)?\b|\bsteady\b|unshaken|shake free|shake(?:s)? free/i.test(text))return 'stun';
  if(/inspired|inspiration|heroic|keen eye|lesson learned|listen closely/i.test(text))return 'boon';
  if(/poison|spore damage/i.test(text))return 'poison';
  if(/stimulant|powered up|\bpower \d/i.test(text))return 'stimulant';
  return fallback;
}
const BIOME_MARGIN_PATHS=Object.freeze({
  cave:'M19 5 10 27 21 49 8 73 20 101 9 131 20 160 8 187 20 216 10 246 19 278 9 309 20 341 11 375M11 27l17 5m-20 41 18-5m-17 63 15 3m-16 53 18-5m-16 67 16 4m-16 54 16-6',
  overgrown:'M16 390Q1 345 18 300T16 210 18 120 16 5M16 342q-23-25-12-35 18 0 12 35m1-51q24-23 11-34-17 3-11 34m-1-66q-22-22-12-33 17 2 12 33m1-65q25-21 11-34-16 5-11 34m-2-68Q-7 67 4 56 22 60 15 92m2-56q24-25 11-34-17 4-11 34',
  fungal:'M17 390V5M16 350v-25m-13 1q3-35 25-9l2 9Zm14-56v-19m-12 1q4-29 22-5l3 5Zm11-56v-23m-13 1q6-32 25-7l2 7Zm12-62v-24m-12 1q4-31 23-6l2 6Zm10-65V31m-12 1q4-26 23-5l2 5Z',
  lava:'M8 0q12 35 0 66t0 68 0 69 0 69 0 68 0 50M17 0q10 30 0 64t0 68 0 70 0 69 0 69 0 50M26 0q-8 35 0 66t0 68 0 69 0 69 0 68 0 50M5 92l8 7m4 43 10-6m-22 64 8 7m4 54 10-6m-22 64 8 7m3 47 12-8',
  ice:'M16 0v390M2 35l14-16 14 16-14 16Zm0 80 14-16 14 16-14 16Zm0 80 14-16 14 16-14 16Zm0 80 14-16 14 16-14 16Zm0 80 14-16 14 16-14 16ZM16 19v32m0 48v32m0 48v32m0 48v32m0 48v32',
  crystal:'M9 390 3 350l13-22 13 22-6 40m-7-62v62M10 296 2 259l13-22 14 22-7 37m-7-59v59M10 204 2 167l13-22 14 22-7 37m-7-59v59M10 112 2 75l13-22 14 22-7 37m-7-59v59M16 16v18m-8-9h16',
  unstable:'M5 0l7 44 5-44m5 0 7 30 2-30M3 101l10 37 5-37m5 0 6 23 3-23M3 200l10 37 5-37m5 0 6 23 3-23M3 300l10 37 5-37m5 0 6 23 3-23M8 66l8 8 9-8M8 167l8 8 9-8M8 267l8 8 9-8M8 367l8 8 9-8',
  shadow:'M15 0q-23 39 0 76t0 77 0 77 0 77 0 83M24 0q-22 39 0 76t0 77 0 77 0 77 0 83M5 38l10 6m0 66 13 6M5 187l10 6m0 67 13 6M5 339l10 6',
  maze:'M6 0v48h21V22H15v13M27 52v50H6V75h11v14M6 106v49h21v-27H15v13M27 160v49H6v-27h11v14M6 214v49h21v-27H15v13M27 268v49H6v-27h11v14M6 322v49h21v-27H15v13',
});
function updateBiomeMargins(){
  const theme=floorBiome(),wrap=$('#map-wrap');if(!wrap)return;
  if(wrap.dataset.marginBiome===theme)return;
  wrap.dataset.marginBiome=theme;
  wrap.querySelectorAll('.biome-margin').forEach(el=>el.remove());
  for(const side of ['left','right']){
    const el=document.createElement('div');el.className=`biome-margin ${side}`;el.setAttribute('aria-hidden','true');
    el.innerHTML=`<svg class="pencil-art" viewBox="0 0 34 390" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="${pencilPath(BIOME_MARGIN_PATHS[theme],0.35)}"/><path opacity=".25" transform="translate(.7 .3)" d="${BIOME_MARGIN_PATHS[theme]}"/>${Array.from({length:5},(_,i)=>`<g class="margin-mote" style="--mote:${i}"><path d="M${5+i%3*9} ${35+i*68}l3 5-3 4-2-4Z"/></g>`).join('')}</svg>`;
    wrap.append(el);
  }
}
let mapHoverIndex=null;
function mapTileDescription(c){
  if(!c.seen)return tileName(c);
  const environmental=environmentDescription(c);
  if(environmental)return environmental+(c.event?` · ${c.event[0].toUpperCase()+c.event.slice(1)}${c.activated?" - activated":" - active"}`:"");
  if(BIOME_DISCOVERIES[c.event])return BIOME_DISCOVERIES[c.event].name+' — '+BIOME_DISCOVERIES[c.event].description;
  const extra={
    poisonMushroom:'Poison mushrooms — spores harm the leading companion every time you cross.',
    explodingMushroom:'Burstcap — explodes when you come within one tile. Roll to avoid its spores; it becomes an ordinary mushroom afterwards.',
    brittleIce:'Brittle ice — slides like ice, then collapses into an impassable hole after you leave.',
    hole:'Open hole — impassable. The ice has fallen away.',
    gate:'Closed gate — a matching pressure plate opens this shortcut.',
    openGate:'Open gate — a permanent shortcut.',
  };
  if(extra[c.terrain])return extra[c.terrain];
  if(c.lavaRiver)return c.terrain==='bridge'?'Lava bridge — a safe crossing above the molten river.':'Lava river — impassable molten rock. Cross on a bridge or use a tunnel.';
  if(c.terrain==='crystal')return 'Quartz — impassable. Its 1-tile field seals two reels every 3 party rolls. Overlapping fields do not stack.';
  if(c.event==='tunnel'){const to=tunnelDestination(state.map,state.map.indexOf(c));return tileName(c)+(to!==null&&state.map[to].seen?' — linked to the highlighted entrance.':' — its other entrance is still unknown.');}
  return tileName(c);
}
function updateMapInspection(index=null){
  mapHoverIndex=Number.isInteger(index)&&state.map[index]?index:null;
  const i=mapHoverIndex??state.position;
  $('#hover-name').textContent=mapTileDescription(state.map[i]);
  document.querySelectorAll('.tile.inspect-hover,.tile.tunnel-linked').forEach(el=>el.classList.remove('inspect-hover','tunnel-linked'));
  document.getElementById('tunnel-hover-link')?.remove();
  if(mapHoverIndex===null)return;
  $(`[data-tile="${i}"]`)?.classList.add('inspect-hover');
  const to=tunnelDestination(state.map,i);
  if(!state.map[i].seen||to===null||!state.map[to].seen)return;
  $(`[data-tile="${to}"]`)?.classList.add('tunnel-linked');
  const a={x:(i%W)+.5,y:Math.floor(i/W)+.5},b={x:(to%W)+.5,y:Math.floor(to/W)+.5};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='tunnel-hover-link';svg.classList.add('map-link-overlay');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=`<defs><marker id="tunnel-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1 6 4 1 7" fill="none"/></marker></defs><path d="M${a.x} ${a.y} Q${(a.x+b.x)/2} ${Math.max(.5,Math.min(a.y,b.y)-1)} ${b.x} ${b.y}" marker-end="url(#tunnel-arrow)"/>`;
  $('#map-board').append(svg);
}
function renderCrystalPulses(){
  document.getElementById('crystal-pulse-map')?.remove();
  const sources=state.map.map((c,i)=>c.seen&&c.terrain==='crystal'?i:-1).filter(i=>i>=0);
  if(!sources.length)return;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='crystal-pulse-map';svg.classList.add('crystal-pulse-map');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=sources.map((i,n)=>{
    const x=i%W+.5,y=Math.floor(i/W)+.5,r=EXPEDITION_TUNING.crystalRadius+.5;
    const clip=state.map.map((c,j)=>(j===i||!c.wall&&tileDistance(j,i)<=EXPEDITION_TUNING.crystalRadius&&mapLineOfSight(state.map,i,j))?`<rect x="${j%W}" y="${Math.floor(j/W)}" width="1" height="1"/>`:'').join('');
    return `<defs><clipPath id="quartz-clip-${i}">${clip}</clipPath></defs><g clip-path="url(#quartz-clip-${i})"><rect class="quartz-pulse" x="${x-r}" y="${y-r}" width="${r*2}" height="${r*2}" rx=".18" style="transform-origin:${x}px ${y}px;animation-delay:${-n*.31}s"/></g>`;
  }).join('');$('#map-board').append(svg);
}
