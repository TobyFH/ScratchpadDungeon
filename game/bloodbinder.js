// Bloodbinder rules: one shared calculation for real rolls, previews and AI.
const BLOOD_BINDING = Object.freeze({ turns: 3, potency: 12, exchange: .25, bossCap: .1 });
function normaliseBloodStatuses(e) {
  for (const key of ['bleeding','clotted']) {
    const s=e[key];
    if(!s || typeof s!=='object'){e[key]=null;continue;}
    s.turns=Math.min(3,Math.max(0,Math.floor(Number(s.turns)||0)));
    if(!s.turns){e[key]=null;continue;}
    if(key==='bleeding'){
      s.duration=Math.min(3,Math.max(s.turns,Math.floor(Number(s.duration)||1)));
      s.damage=Math.min(BLOOD_BINDING.potency,Math.max(1,Math.floor(Number(s.damage)||1)));
      s.healing=s.damage;
    }
  }
}
function applyBloodSeed(e, power, h) {
  if(!alive(e)||!alive(h)||power<=0)return;
  let b=e.bleeding;
  for(let n=0;n<Math.ceil(power);n++) {
    if(!b)b={turns:1,duration:1,damage:1,healing:1,sourceId:h.id};
    else if(b.turns<3)b.turns++;
    else b.damage=Math.min(BLOOD_BINDING.potency,b.damage+1);
    b.duration=Math.max(b.duration,b.turns);b.healing=b.damage;b.sourceId=h.id;
  }
  e.bleeding=b;
  combatCallout(enemyArtEl(e),`BLOOD SEED · ${b.damage} × ${b.turns}`, 'bleeding');
  beam(entityArt(h),enemyArtEl(e),'bloodseed');
  burst(enemyArtEl(e),'damage',20);syncEnemy(e);
  log(`${h.name} plants Blood Seed on ${e.name}: ${b.damage} bleeding damage and up to ${b.healing} shared healing per enemy turn for ${b.turns} turns.`);
}
function bloodExchangePlan(h,e=state.enemy) {
  const allies=state.party.filter(alive);
  if(!alive(e)||!allies.length)return {loss:0,healing:0,ally:null,rate:0};
  const lowest=allies.reduce((a,b)=>a.hp/a.maxHp<=b.hp/b.maxHp?a:b),
    highest=allies.reduce((a,b)=>a.hp/a.maxHp>=b.hp/b.maxHp?a:b),
    enemyRate=e.hp/e.maxHp, difference=enemyRate-lowest.hp/lowest.maxHp;
  if(difference>0){
    const rate=Math.min(difference*BLOOD_BINDING.exchange,e.boss?BLOOD_BINDING.bossCap:1),
      loss=Math.min(e.hp,Math.floor(e.maxHp*rate));
    // Healing uses the percentage actually removed after rounding and boss cap.
    return {loss,healing:Math.floor(lowest.maxHp*loss/e.maxHp),ally:lowest,rate:loss/e.maxHp,transfer:true};
  }
  const rate=Math.max(0,highest.hp/highest.maxHp-enemyRate)*BLOOD_BINDING.exchange;
  return {loss:Math.min(e.hp,Math.floor(e.maxHp*Math.min(rate,e.boss?BLOOD_BINDING.bossCap:1))),healing:0,ally:null,rate,transfer:false};
}
async function bloodExchange(h,e=state.enemy) {
  const run=state;
  const plan=bloodExchangePlan(h,e), enemyMax=e?.maxHp;
  if(!alive(h)||!alive(e))return;
  // Percentage loss is a separate fixed transfer: never crits, cleaves, receives
  // camp/equipment bonuses, or consumes Vulnerable a second time.
  const n=damageEnemy(plan.loss,'Blood Exchange',e,{piercing:true,bloodTransfer:true,impact:{type:'bloodexchange'}});
  h.stats.damageDealt+=n;if(!e.hp&&n)h.stats.kills++;
  const healed=plan.ally?healHero(state.party.indexOf(plan.ally),Math.floor(plan.ally.maxHp*n/enemyMax),{exact:true}):0;
  h.stats.healingDone+=healed;
  combatCallout(enemyArtEl(e),`BLOOD EXCHANGE · −${n}`, 'bleeding');
  const flight=beam(entityArt(h),enemyArtEl(e),'bloodseed');
  if(flight?.then)await flight;
  if(state!==run)return;
  if(healed)beam(enemyArtEl(e),entityArt(plan.ally),'heal');
  if(state.lastPlayerRoll?.heroId===h.id)state.lastPlayerRoll.actualDamage=(state.lastPlayerRoll.actualDamage||0)+n;
  state.lastBloodExchange={heroId:h.id,targetId:e.id,loss:n,healing:healed,allyId:plan.ally?.id||null,transfer:plan.transfer};
  log(`${h.name} · Blood Exchange: ${n} HP taken${healed?`, ${healed} HP restored to ${plan.ally.name}`:''}.`);
}
function distributeBloodHealing(amount,h) {
  let total=0;
  // One shared pool, allocated to the most injured health ratios; no per-ally
  // multiplication and no revival. Shared healHero owns Fury/stun interactions.
  const allocations=new Map(),hp=new Map(state.party.map(a=>[a,a.hp]));
  while(amount-->0){
    const allies=state.party.filter(a=>alive(a)&&hp.get(a)<a.maxHp).sort((a,b)=>hp.get(a)/a.maxHp-hp.get(b)/b.maxHp);
    if(!allies.length)break;
    const ally=allies[0];allocations.set(ally,(allocations.get(ally)||0)+1);hp.set(ally,hp.get(ally)+1);
  }
  for(const [ally,n] of allocations)total+=healHero(state.party.indexOf(ally),n,{exact:true});
  if(h){h.stats.healingDone+=total;if(h.death)h.death.stats.healingDone+=total;}
  return total;
}
async function tickBleeding(e) {
  if(!alive(e)||!state.party.some(alive)||!state.enemy||!e.bleeding)return;
  const b=e.bleeding,owner=state.party.find(h=>h.id===b.sourceId)||state.graveyard.find(h=>h.id===b.sourceId),
    n=damageEnemy(b.damage,'Bleeding',e,{piercing:true,bloodTransfer:true});
  if(owner){owner.stats.damageDealt+=n;if(!e.hp&&n)owner.stats.kills++;}
  const healed=distributeBloodHealing(Math.min(n,b.healing),owner);
  combatCallout(enemyArtEl(e),`BLEEDING · −${n}`, 'bleeding');

  b.turns--;
  log(`${e.name} · Bleeding: ${n} damage; ${healed} HP shared among injured allies.`);
  if(b.turns<=0){
    e.bleeding=null;
    if(alive(e)){e.clotted={turns:b.duration};combatCallout(enemyArtEl(e),'CLOTTED · HALF HEALING','clotted');}
  }
  syncEnemy(e);await feedbackPause(skip?70:180);
}
function finishClottedTurn(e,prior){
  if(prior&&e.clotted===prior&&--prior.turns<=0)e.clotted=null;
}
function enemyRecovery(e,amount) {
  const n=Math.min(Math.max(0,e.maxHp-e.hp),Math.floor(Math.max(0,amount)*(e.clotted?.turns>0?.5:1)));
  if(alive(e)){e.hp+=n;spendFuryOnHealing(e,n);return n;}return 0;
}
function bloodStatusMarkup(e){
  return `${e.bleeding?statusBadge('Bleeding',`${e.bleeding.damage} HP lost each enemy turn; up to ${e.bleeding.healing} HP shared among injured allies. ${e.bleeding.turns} turns left. Then Clotted reduces healing by 50% for ${e.bleeding.duration} turns.`,'bleeding-badge','bloodseed'):''}${e.clotted?statusBadge('Clotted',`Healing received reduced by 50% for ${e.clotted.turns} more enemy turns.`,'clotted-badge','bloodseed'):''}`;
}
