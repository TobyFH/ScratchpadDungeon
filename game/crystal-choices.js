// Optional destruction changes only this deposit; overlapping fields remain.
async function crystalEncounter(i) {
  const c=state.map[i];
  if(!c||!c.seen||c.terrain!=='crystal'||state.enemy||state.over||tileDistance(i)>1)return false;
  const run=state;
  showSpotlight('Quartz deposit','Smash it to silence its influence on nearby battles.',`<div class="trap-art">${icon('crystal')}</div><p>The broken stone will no longer seal your reels. You can also leave it intact.</p>`,'crystal-choice');
  const smash=await eventChoice([{id:'crystal-smash',label:'Smash the crystal',value:true},{id:'crystal-leave',label:'Leave it intact',value:false}]);
  closeSpotlight();
  if(state!==run||!(smash===true||smash==='true')||c.terrain!=='crystal')return false;
  c.terrain='brokenCrystal';c.wall=false;c.smashed=true;
  renderMap();const tile=$(`[data-tile="${i}"]`);
  burst(tile,'paper',30);burst(tile,'dust',45);GameSound.play('lockBig');shakeElement(tile,5,'impact');
  log('Quartz shattered. Its blue field fades; other deposits remain active.');save();return true;
}
