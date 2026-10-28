const CLASS_SKETCHES=Object.freeze({
  execute:'<path d="M-87-8H20v-19L65 0 20 27V8H-87l-20 16 10-24-10-24Z" fill="var(--paper)"/><path d="M-76-3H20M-78 3H20M28-14 49 0 28 14"/>',
  fighter:'<path d="M-34-43 0-55 35-42 30 17Q13 44 0 54-20 38-32 15Z" fill="var(--paper)"/><path d="M-26-37 0-45 27-35 23 14 0 41-24 12ZM0-43v81M-23-2h47"/><path d="M-44-31-58-37m14 41-18 3m20 29-15 10"/>',
  rogue:'<path d="M-55 33 12-43l10 10-66 78Zm28 9 65-74 10 10-65 76Zm-54-35 46-53 10 10-45 55Z" fill="var(--paper)"/><path d="m-55 33 10 10m18-1 10 10m-64-45 10 10M-64 51l-14 14m53-10-12 15m-40-52-12 13"/>',
  mage:'<circle r="43" fill="var(--paper)"/><circle r="35"/><path d="M0-49 12-14 47-15 19 7 29 42 0 22-29 42-18 7-47-15-12-14ZM0-25v49M-20 0h40M-56 0h-10m122 0h10M0-56v-10m0 122v10"/>',
  berserker:'<path d="M-41-25-22-40 0-34 23-43 43-22 34 23 0 45-34 20Z" fill="var(--paper)"/><path d="m-27-17 19 10m16 0 20-12M-21 16 0 29 23 13M-31-20l-9-17m71 14 12-15M-48 7l-17 2m113-1 17 2M-17-10v14M17-10v14M-12 16l5 9m18-9-4 10"/>',
});
async function classSignatureFX(h,e=state.enemy,kind=h.job){
  const from=$('#machine-hero-'+state.party.indexOf(h)),to=kind==='mage'&&['heal','block'].includes(mageResonance(h,h.last))?entityArt(h):enemyArtEl(e);
  if(!from||!to||!CLASS_SKETCHES[kind])return;
  state.lastClassSketch={heroId:h.id,kind,targetId:e?.id,at:Date.now()};
  const utility=kind==='mage'&&mageResonance(h,h.last)==='heal';
  const paint=utility?'heal':kind==='berserker'?'damage':'paper';
  burst(from,paint,30);
  if(skip||sceneFast||preferences().portraitMotion<=0||matchMedia('(prefers-reduced-motion: reduce)').matches){
    burst(to,paint,55);shakeElement(to,kind==='execute'?6:4,'jolt');return;
  }
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
