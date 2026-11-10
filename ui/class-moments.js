const CLASS_SKETCHES=Object.freeze({
  execute:'<path d="M-87-8H20v-19L65 0 20 27V8H-87l-20 16 10-24-10-24Z" fill="var(--paper)"/><path d="M-76-3H20M-78 3H20M28-14 49 0 28 14"/>',
  fighter:'<path d="M-34-43 0-55 35-42 30 17Q13 44 0 54-20 38-32 15Z" fill="var(--paper)"/><path d="M-26-37 0-45 27-35 23 14 0 41-24 12ZM0-43v81M-23-2h47"/><path d="M-44-31-58-37m14 41-18 3m20 29-15 10"/>',
  mage:'<circle r="43" fill="var(--paper)"/><circle r="35"/><path d="M0-49 12-14 47-15 19 7 29 42 0 22-29 42-18 7-47-15-12-14ZM0-25v49M-20 0h40M-56 0h-10m122 0h10M0-56v-10m0 122v10"/>',
  berserker:'<path d="M-41-25-22-40 0-34 23-43 43-22 34 23 0 45-34 20Z" fill="var(--paper)"/><path d="m-27-17 19 10m16 0 20-12M-21 16 0 29 23 13M-31-20l-9-17m71 14 12-15M-48 7l-17 2m113-1 17 2M-17-10v14M17-10v14M-12 16l5 9m18-9-4 10"/>',
});
async function classSignatureFX(h,e=state.enemy,kind=h.job){
  const from=$('#machine-hero-'+state.party.indexOf(h)),to=kind==='mage'&&['heal','block'].includes(mageResonance(h,h.last))?entityArt(h):enemyArtEl(e);
  if(!from||!to||(!CLASS_SKETCHES[kind]&&kind!=='rogue'))return;
  state.lastClassSketch={heroId:h.id,kind,targetId:e?.id,at:Date.now()};
  const utility=kind==='mage'&&mageResonance(h,h.last)==='heal';
  const paint=utility?'heal':kind==='berserker'?'damage':'paper';
  burst(from,paint,30);
  if(skip||sceneFast||preferences().portraitMotion<=0||matchMedia('(prefers-reduced-motion: reduce)').matches){
    burst(to,paint,55);shakeElement(to,kind==='execute'?6:4,'jolt');return;
  }
  if(kind==='rogue')return rogueBackstabFX(h,e,to);
  const run=state,version=animationVersion,a=from.getBoundingClientRect(),b=to.getBoundingClientRect();
  const sx=a.left+a.width*.5,sy=a.top+a.height*.5,tx=b.left+b.width*.5,ty=b.top+b.height*.45;
  const angle=Math.atan2(ty-sy,tx-sx)*180/Math.PI;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.classList.add('class-sketch',`class-sketch-${kind}`);svg.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);svg.setAttribute('aria-hidden','true');
  svg.innerHTML=`<path class="signature-trail"/><g class="signature-glyph">${CLASS_SKETCHES[kind]}</g>`;
  document.body.append(svg);
  const glyph=svg.querySelector('.signature-glyph'),trail=svg.querySelector('.signature-trail');
  let elapsed=0,last=performance.now();const duration=(kind==='execute'?850:650)/Math.sqrt(pace());
  try{
    await new Promise(resolve=>{
      const frame=now=>{
        if(state!==run||animationVersion!==version||skip||sceneFast||preferences().portraitMotion<=0){resolve();return;}
        if(!utilityOpen&&!document.hidden)elapsed+=Math.min(80,now-last);last=now;
        const p=Math.min(1,elapsed/duration),travel=Math.max(0,Math.min(1,(p-.15)/.65)),ease=travel*travel*(3-2*travel);
        const windup=p<.15?-Math.sin(p/.15*Math.PI)*18:0;
        const x=sx+(tx-sx)*ease+windup,y=sy+(ty-sy)*ease-Math.sin(travel*Math.PI)*38;
        const size=(kind==='execute'?1.15:0.9)*(p>.8?1+Math.sin((p-.8)/.2*Math.PI)*.25:1);
        glyph.setAttribute('transform',`translate(${x} ${y}) rotate(${kind==='execute'?angle:Math.sin(p*Math.PI*2)*8}) scale(${size})`);
        glyph.style.opacity=p>.85?String((1-p)/.15):'1';
        trail.setAttribute('d',`M${sx} ${sy}Q${(sx+x)/2} ${Math.min(sy,y)-22} ${x} ${y}`);
        trail.style.opacity=String(Math.sin(travel*Math.PI)*.6);
        if(p<1)requestAnimationFrame(frame);else resolve();
      };requestAnimationFrame(frame);
    });
    if(state===run){burst(to,paint,kind==='execute'?75:48);shakeElement(to,kind==='execute'?6:4,'jolt');screenFX(utility?'heal':'critical',.55);}
  }finally{svg.remove();}
}

// A travelling illustration, never a travelling button. Flurry's real three
// damage segments still resolve in the caller after this cosmetic promise.
async function rogueBackstabFX(h,e,to){
  const source=entityArt(h),drawing=source?.querySelector(':scope > svg');
  if(!drawing||!to?.isConnected)return;
  const run=state,version=animationVersion,width=innerWidth,height=innerHeight;
  const a=drawing.getBoundingClientRect(),b=to.querySelector('svg')?.getBoundingClientRect()||to.getBoundingClientRect();
  if(!a.width||!a.height||!b.width||!b.height)return;
  const sx=a.left+a.width/2,sy=a.top+a.height/2,tx=b.left+b.width/2,ty=b.top+b.height*.5;
  const scale=a.height/150,targetScale=Math.min(1.12,Math.max(.58,b.height/150*.85));
  const behindX=Math.max(60*targetScale+4,Math.min(width-60*targetScale-4,tx+b.width*.33));
  const behindY=Math.max(75*targetScale+4,Math.min(height-75*targetScale-4,ty-b.height*.08));
  const id='rogue-shadow-'+artSerial++,svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  const centredArt=portraitArt('rogue',h).replace('<svg ', '<svg x="-60" y="-75" width="120" height="150" ');
  const enemyMask=portraitArt(e.art,e).replace('<svg ',`<svg x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" `);
  svg.classList.add('class-sketch','class-sketch-rogue');
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('aria-hidden','true');
  svg.dataset.hero=h.id;svg.dataset.target=e.id;
  // The actual enemy silhouette occludes the Rogue: the shadow really rises
  // behind it, without copying a second visible enemy or filtering the page.
  svg.innerHTML=`<defs><g id="${id}-art">${centredArt}</g><mask id="${id}-cover" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="white" stroke="none"/><g class="rogue-occluder">${enemyMask}</g></mask></defs>
    <g class="rogue-origin" transform="translate(${sx} ${sy}) scale(${scale})"><use href="#${id}-art"/></g>
    <path class="rogue-shadow-trail"/>
    <g mask="url(#${id}-cover)"><g class="rogue-actor"><ellipse class="rogue-foot-shadow" cx="0" cy="67" rx="48" ry="9"/><use href="#${id}-art"/><g class="rogue-dagger"><path d="M-17 23-25-40-12-58-2-39-11 23Z" fill="var(--paper-raised)"/><path d="m-12-49-3 66m-12 8 25-1m-18 5 1 23 9-1-1-23"/><path d="m-17 33 7 4m-7 4 7 4"/></g></g></g>
    <g class="rogue-cuts" transform="translate(${tx} ${ty}) scale(${Math.max(.65,Math.min(1.4,b.height/130))})">${[-1,0,1].map((n)=>`<g class="rogue-cut"><path d="M${-47+n*13} -48Q${37+n*7} -16 ${44+n*7} 43"/><path class="rogue-cut-core" d="M${-47+n*13} -48Q${37+n*7} -16 ${44+n*7} 43"/><path class="rogue-cut-sparks" d="m${43+n*7} 23 15-7m-13 17 18 3m-20 5 10 13"/></g>`).join('')}</g>`;
  document.body.append(svg);
  const actor=svg.querySelector('.rogue-actor'),dagger=svg.querySelector('.rogue-dagger'),trail=svg.querySelector('.rogue-shadow-trail'),cuts=[...svg.querySelectorAll('.rogue-cut')];
  const hidden=new Set(),strikes=[.47,.57,.67],motion=Math.min(1.5,Math.max(0,preferences().portraitMotion));
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
  let elapsed=0,last=performance.now(),hit=0,finished=false,fastForward=false;
  const duration=1050/Math.sqrt(pace());
  const hideSource=()=>{const current=entityArt(h);if(current){current.classList.add('rogue-away');hidden.add(current)}};
  try{
    hideSource();
    await new Promise(resolve=>{
      const frame=now=>{
        if(state!==run||animationVersion!==version||h.hp<=0||e.hp<=0||!to.isConnected||innerWidth!==width||innerHeight!==height){resolve();return;}
        if(skip||sceneFast||preferences().portraitMotion<=0||matchMedia('(prefers-reduced-motion: reduce)').matches){fastForward=true;resolve();return;}
        if(!utilityOpen&&!document.hidden)elapsed+=Math.min(80,now-last);last=now;
        hideSource();
        const p=Math.min(1,elapsed/duration);
        let x=sx,y=sy,size=scale,opacity=1,lean=0;
        const phase=p<.18?'vanish':p<.32?'stealth':p<.45?'behind':p<.75?'slash':'return';
        svg.dataset.phase=phase;svg.dataset.progress=p.toFixed(3);
        if(p<.18){const t=p/.18;opacity=1-smooth(t);y+=Math.sin(t*Math.PI)*9*motion;lean=-12*Math.sin(t*Math.PI)*motion;}
        else if(p<.32){opacity=0;}
        else if(p<.75){
          const t=smooth((p-.32)/.12),lunge=strikes.reduce((v,at)=>v+Math.max(0,1-Math.abs(p-at)/.045),0);
          x=behindX-lunge*20*motion;y=behindY+(1-t)*16*motion;size=targetScale;
          opacity=t*(p>.71?1-smooth((p-.71)/.04):1);lean=-lunge*16*motion;
        }else{
          const t=smooth((p-.75)/.25);x=behindX+(sx-behindX)*t;y=behindY+(sy-behindY)*t-Math.sin(t*Math.PI)*24*motion;
          size=targetScale+(scale-targetScale)*t;opacity=p<.8?0:smooth((p-.8)/.16);lean=-Math.sin(t*Math.PI)*20*motion;
        }
        actor.setAttribute('transform',`translate(${x} ${y}) rotate(${lean}) scale(${size})`);actor.style.opacity=opacity;
        dagger.setAttribute('transform',`translate(-21 10) rotate(${p<.45?-35:Math.sin((p-.45)*Math.PI*24)*55})`);
        const returning=p>=.75,travel=returning?smooth((p-.75)/.25):smooth((p-.12)/.25);
        trail.setAttribute('d',returning?`M${behindX} ${behindY+45*targetScale}Q${(sx+behindX)/2} ${Math.min(sy,behindY)-28} ${x} ${y+45*size}`:`M${sx} ${sy+45*scale}Q${(sx+behindX)/2} ${Math.min(sy,behindY)-28} ${sx+(behindX-sx)*travel} ${sy+(behindY-sy)*travel+45*targetScale}`);
        trail.style.opacity=String(Math.sin(travel*Math.PI)*.42);
        cuts.forEach((cut,i)=>{const t=(p-strikes[i])/.15;cut.style.opacity=t<0||t>1?'0':String(Math.sin(Math.min(1,t*4)*Math.PI/2)*(1-t));cut.style.strokeDashoffset=String(180*(1-smooth(t*4)));});
        if(!utilityOpen&&!document.hidden)while(hit<strikes.length&&p>=strikes[hit]){hit++;burst(to,'paper',14);shakeElement(to,2,'jolt');}
        if(p<1)requestAnimationFrame(frame);else{finished=true;resolve();}
      };requestAnimationFrame(frame);
    });
    if(state===run&&animationVersion===version&&e.hp>0&&to.isConnected&&(finished||fastForward)){
      burst(to,'paper',48);shakeElement(to,4,'jolt');screenFX('critical',.55);
    }
  }finally{
    svg.remove();hidden.forEach(node=>node.classList.remove('rogue-away'));
  }
}
function enemyDeathPoof(e){
  const art=enemyArtEl(e);if(!art)return;
  const species=e.art||'skull',kind=/slime|ghost|veil|shadow/.test(species)?'ink':/spore|myco|cap|root|thorn/.test(species)?'poison':/gnawer|powder|cinder|ash|demon/.test(species)?'gold':'paper';
  smokePoof(art,true);burst(art,'smoke',e.boss?145:100);burst(art,kind,e.boss?75:45);
  const r=art.getBoundingClientRect(),node=document.createElement('div');node.className='enemy-death-cloud '+kind;node.setAttribute('aria-hidden','true');
  node.style.left=r.left+r.width/2+'px';node.style.top=r.top+r.height/2+'px';node.style.width=Math.min(230,r.width*1.7)+'px';
  node.innerHTML='<svg viewBox="0 0 160 120" fill="var(--paper)" stroke="currentColor" stroke-width="1.3"><path d="M24 92Q-4 81 17 61-5 35 28 34 25 4 58 20 76-8 98 18q35-8 33 23 38 5 18 34 20 25-14 31-11 23-40 6-25 15-40-4-25 12-31-16Z"/><path d="M25 47q-12 16 5 20m20-35q18-12 28 2m26 0q21-4 20 19M40 85q-9 18 12 18m43-7q16 13 26-3M67 64q12-20 24-1" fill="none"/></svg>';
  document.body.append(node);
  const a=animate(node,[{opacity:0,transform:'translate(-50%,-50%) scale(.35)'},{opacity:.9,transform:'translate(-50%,-50%) scale(1.12)',offset:.3},{opacity:0,transform:'translate(-50%,-65%) scale(1.35)'}],{duration:skip?260:700,juice:true});
  if(a?.finished)a.finished.catch(()=>{}).finally(()=>node.remove());else setTimeout(()=>node.remove(),400);
}
