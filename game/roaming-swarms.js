// A floor-owned Overgrowth traveller. It takes one step per party footstep,
// never from timers, rendering, menus or battle actions.
const SWARM_TUNING = Object.freeze({ chance:.48, noticeRadius:4, chaseChance:.82 });
function seedBeeSwarm(map) {
  const e=environmentState(map);
  if(!e||floorBiome(map)!=='overgrown'||Math.random()>=SWARM_TUNING.chance)return;
  const cells=map.map((c,i)=>i).filter(i=>!map[i].wall&&!map[i].env&&!map[i].structure&&tileDistance(i,pos(1,7))>=5&&!['stairs','tunnel','recruit'].includes(map[i].event));
  if(cells.length)e.swarm={position:pick(cells),steps:0};
}
function renderBeeSwarm(){
  const swarm=environmentState()?.swarm,visible=swarm&&state.map[swarm.position]?.seen;
  let marker=document.querySelector('.swarm-token');
  if(!visible){marker?.remove();return;}
  if(!marker){marker=document.createElement('div');marker.className='swarm-token';marker.setAttribute('aria-hidden','true');marker.innerHTML=beeSwarmArt();$('#map-board').append(marker);}
  marker.style.left=(swarm.position%W)/W*100+'%';marker.style.top=Math.floor(swarm.position/W)/H*100+'%';
  marker.style.width=100/W+'%';marker.style.height=100/H+'%';marker.dataset.position=swarm.position;
}
async function advanceBeeSwarm({move=true}={}){
  const e=environmentState(),swarm=e?.swarm;
  if(!swarm||state.enemy||state.over||utilityOpen||!$("#overlay").hidden||!$("#spotlight").hidden)return false;
  const old=swarm.position;
  if(!Number.isInteger(old)||!state.map[old]||state.map[old].wall){e.swarm=null;renderBeeSwarm();return false;}
  let contact=old===state.position;
  if(move&&!contact){
    const choices=neighbors(old).filter(i=>!state.map[i].wall&&!environmentRoot(state.map[i])&&environmentEdgeOpen(state.map,old,i));
    const close=tileDistance(old)<=SWARM_TUNING.noticeRadius&&mapLineOfSight(state.map,old,state.position);
    const route=close&&Math.random()<SWARM_TUNING.chaseChance?pursuerRoute(old,state.position):[];
    swarm.position=route.length&&choices.includes(route[0])?route[0]:choices.length?pick(choices):old;
    swarm.steps=(swarm.steps||0)+1;contact=swarm.position===state.position;
  }
  renderBeeSwarm();
  if(contact){
    e.swarm=null;travel=null;renderBeeSwarm();
    beginEncounter(false,{swarm:true,count:1});renderEncounter();renderMap();
    log('A bee swarm descends from the canopy!',{category:'combat',terms:[{name:'bee swarm',description:'A roaming jungle swarm. It wanders between footsteps and pursues nearby travellers.'}]});
    smokePoof($(`[data-tile="${state.position}"]`));await encounterEntrance();return true;
  }
  const marker=document.querySelector('.swarm-token');
  if(marker&&state.map[old].seen&&old!==swarm.position){
    animate(marker,[{transform:`translate(${(old%W-swarm.position%W)*100}%,${(Math.floor(old/W)-Math.floor(swarm.position/W))*100}%)`},{transform:'translate(0,0)'}],{duration:260/moveRate()});
  }
  return false;
}
