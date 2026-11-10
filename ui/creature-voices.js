// Cosmetic words never use gameplay RNG. Each species gets a voice, including
// biome creatures and declined/reanimated adventurers; no ellipsis fallback.
const CREATURE_VOICES=Object.freeze({
  smudger:['I know that name.','Your story ends here!','Ink runs thin!','A name forgotten.'],
  gnawer:['Mind my flame.','Scorch and gnaw!','My wick!','Pffft…'],
  bellkeeper:['The bell tolls for you.','DONG!','A cracked note!','The bell falls silent.'],
  revenant:['I have unfinished business.','Remember this blade!','Not again!','Let me rest.'],
  capstalker:['Soft steps in the spores.','Stalk. Strike!','My cap is torn!','Spores to soil.'],
  myconarch:['Bow before the crown of caps.','My spores command you!','The crown cracks!','The colony remains.'],
  cinderhopper:['Krik! Warm feet!','Hot hop!','Sss!','Cold ash…'],
  basaltwyrm:['Stone cannot hold my hunger.','CRUNCH!','Broken scales!','Back to the deep.'],
  rimewarden:['None pass the frozen gate.','Winter takes you!','The ice fractures!','The thaw has come.'],
  rat:['Squeak-squeak!','Teeth first!','Skkree!','Squeee…'],
  slime:['Blorp? Intruder!','GLORP!','Blip?!','Plip… plop.'],
  skull:['Clack. Clack.','RATTLE!','My bones!','Clatter…'],
  skeleton:['Clack. Clack.','RATTLE!','My bones!','Clatter…'],
  ghost:['I remember your footsteps.','Fade with me!','You tear my shroud!','At last… quiet.'],
  goblin:['That purse looks heavy.','Hand it over!','No fair!','Keep your coins…'],
  mimic:['Just a harmless chest…','SURPRISE!','My hinges!','Empty at last.'],
  candle:['Mind the flame.','Burn bright!','My wick!','Fffft…'],
  moth:['Frrr… the light.','Flutter! Snap!','Frrrk!','Wings… still.'],
  rustmite:['Chrrr… iron.','Crunch!','Krik!','Scrrr…'],
  sporepilgrim:['Breathe deeply.','A gift of spores!','My cap!','Back to the roots.'],
  mirrorhound:['Grrr… two of you.','SNARL!','Yelp!','The reflection breaks.'],
  ashcolossus:['The ash remembers.','CRUMBLE!','Stone can bleed!','Dust to dust.'],
  veilweaver:['Let the dark embrace you.','Eyes closed!','My veil tears!','Nothing left to hide.'],
  shalecrab:['Click-clack.','Claws out!','My shell!','Clack…'],
  powderimp:['Tick. Tick. Heehee!','Here comes the bang!','Careful with the fuse!','Fizzle…'],
  rootling:['Who tramples my moss?','Roots, take them!','My bark!','I return to soil.'],
  thornhulk:['Small feet. Loud hearts.','THORNS RISE!','Splinters!','The old wood rests.'],
  sporeling:['Puff?','Puff-puff!','My spores!','Pffff…'],
  frostmite:['Krrr… cold feet.','Snap-freeze!','Crick!','Thawing…'],
  bees:['Bzzzz! Our hive!','BZZZT!','Bzz?!','The swarm scatters.'],
  demon:['Another little flame.','Kneel in the ash!','You dare?!','The fire gutters.'],
  lich:['Your name is already dust.','Wither!','My binding cracks!','The spell… ends.'],
  abomination:['Hungry…','MORE!','It hurts!','No more hunger.'],
  pursuer:['I found your footprints.','Nothing stays written!','You marked me!','Erased…'],
  ogre:['Something smells alive.','SMASH!','Ow! Little blade!','Too… tired.'],
  widow:['A guest for my web.','Hold still!','My silk!','Threads undone.'],
  oracle:['I have seen this meeting.','Your next breath is mine.','That was not foretold!','A different ending…'],
  pageeater:['Fresh pages…','CHOMP!','Bitter ink!','No more pages.'],
});
const CREATURE_REPLIES=Object.freeze({
  entrance:['Stay where I can see you.','You took a wrong turn.'],
  attack:['No further!','Your guard is slipping!'],
  hurt:['That left a mark!','Not finished yet!'],
  defeat:['The passage is yours.','My last stand…'],
});
function creatureSpeech(e,mood) {
  const phase={entrance:0,attack:1,hurt:2,defeat:3}[mood]??0;
  const key=e.baseArt||e.species||e.art||e.job;
  const voice=CREATURE_VOICES[key];
  const line=voice?.[phase]||`${e.name||className(e.job||'enemy')}: ${CREATURE_REPLIES[mood]?.[0]||'You found me.'}`;
  // Species identity remains dominant; another line avoids a single repeated cry.
  return visualPick([line,line,...(CREATURE_REPLIES[mood]||CREATURE_REPLIES.attack)]);
}
function paintEncounterMarkup(markup) {
  const root=$('#encounter'),template=document.createElement('template');template.innerHTML=markup;
  const next=template.content.querySelector('.enemy-label'),old=root.querySelector(':scope > .enemy-label');
  if(old&&next){
    if(old.textContent!==next.textContent)old.textContent=next.textContent;
    next.remove();for(const node of [...root.childNodes])if(node!==old)node.remove();
    root.append(template.content);
  }else root.replaceChildren(template.content);
}
