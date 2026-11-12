// Short, cosmetic speech banks. Selection never consumes gameplay randomness.
const HERO_LINES=Object.freeze({
  "fighter": {
    "attack": [
      "Behind me!",
      "Hold the line!",
      "Shields up!",
      "Stand your ground!",
      "I have this!"
    ],
    "hurt": [
      "Still standing.",
      "Just a scratch.",
      "That got through!",
      "Armour held. Mostly."
    ],
    "panic": [
      "Need some help!",
      "Shield is slipping!",
      "Stay with me!",
      "I can hold a little longer!"
    ],
    "block": [
      "Not getting past!",
      "Safe behind me!",
      "Caught it!",
      "Hold that shield!"
    ],
    "relief": [
      "Back on my feet.",
      "Much better.",
      "Ready for another.",
      "You have my thanks."
    ],
    "idle": [
      "Check your straps.",
      "Watch the doorway.",
      "Keep close.",
      "Rest when we are clear."
    ]
  },
  "rogue": {
    "attack": [
      "Too slow.",
      "You never saw me.",
      "Quick and quiet.",
      "Found an opening.",
      "Right behind you."
    ],
    "hurt": [
      "They saw that one.",
      "That stings.",
      "Careless of me.",
      "Caught my sleeve!"
    ],
    "panic": [
      "A little help!",
      "Time to move!",
      "Too close!",
      "Cover me!"
    ],
    "block": [
      "Missed me.",
      "Try again.",
      "Just out of reach.",
      "Not today."
    ],
    "relief": [
      "Good as new.",
      "I owe you one.",
      "Better. Much better.",
      "Back to work."
    ],
    "idle": [
      "Keep your voice down.",
      "Let me check that lock.",
      "Fresh tracks here.",
      "Something moved ahead."
    ]
  },
  "mage": {
    "attack": [
      "Stand clear!",
      "One more spell!",
      "This should do it.",
      "Keep them busy!",
      "I have a clear shot."
    ],
    "hurt": [
      "Lost my focus!",
      "Keep them off me!",
      "That burned!",
      "I felt that."
    ],
    "panic": [
      "I need cover!",
      "My hands are shaking!",
      "Someone, help!",
      "Cannot hold much longer!"
    ],
    "block": [
      "The ward held!",
      "Stay inside the ward!",
      "That bought us time.",
      "Spell still holding."
    ],
    "relief": [
      "Steady again.",
      "My thanks.",
      "I can focus now.",
      "That helped."
    ],
    "idle": [
      "Let me catch my breath.",
      "Save your strength.",
      "The air feels strange.",
      "Stay within the light."
    ]
  },
  "ranger": {
    "attack": [
      "Hold. Loose!",
      "A clear shot.",
      "Right on target.",
      "There is my opening!",
      "Take the shot!"
    ],
    "hurt": [
      "Keep steady.",
      "Too close for comfort.",
      "My shooting arm!",
      "I need some room."
    ],
    "panic": [
      "Keep it back!",
      "Give me a clear path!",
      "Need cover!",
      "I am cornered!"
    ],
    "block": [
      "A narrow miss.",
      "Safe for now.",
      "Good cover!",
      "Arrow still nocked."
    ],
    "relief": [
      "Steady hands again.",
      "Ready to draw.",
      "That is better.",
      "Thanks for the cover."
    ],
    "idle": [
      "Watch the far passage.",
      "Count your arrows.",
      "Tracks lead this way.",
      "Listen before we move."
    ]
  },
  "berserker": {
    "attack": [
      "Come closer!",
      "Hit harder!",
      "My turn!",
      "You will feel this!",
      "Again!"
    ],
    "hurt": [
      "Now I am angry.",
      "That all you have?",
      "You will pay for that.",
      "I felt that one!"
    ],
    "panic": [
      "Not finished yet!",
      "Still got one swing!",
      "Keep me standing!",
      "One more hit!"
    ],
    "block": [
      "Try harder!",
      "Barely felt it.",
      "Still here!",
      "Bring another!"
    ],
    "relief": [
      "Ready for more!",
      "That cooled me down.",
      "Back in the fight.",
      "Good. Now move!"
    ],
    "idle": [
      "Which way is the fight?",
      "Keep those weapons ready.",
      "I hear something.",
      "Do not slow down."
    ]
  },
  "jester": {
    "attack": [
      "Watch closely!",
      "Surprise!",
      "Pick a card!",
      "Here comes trouble!",
      "My best trick yet!"
    ],
    "hurt": [
      "Ouch! Tough crowd.",
      "That was not rehearsed!",
      "Mind the hat!",
      "I meant to dodge that."
    ],
    "panic": [
      "A little help backstage!",
      "Time for my escape!",
      "This joke needs a rescue!",
      "Not the face!"
    ],
    "block": [
      "Ta-da! Still alive.",
      "Missed the punchline!",
      "Lucky me!",
      "All part of the show."
    ],
    "relief": [
      "Encore!",
      "I needed that.",
      "The show goes on!",
      "Back by popular demand!"
    ],
    "idle": [
      "Keep an eye on my hands.",
      "Anyone know a good trick?",
      "No applause. Too loud.",
      "I hear our next audience."
    ]
  },
  "bloodbinder": {
    "attack": [
      "Their strength is ours.",
      "Hold still.",
      "A drop is enough.",
      "This will mend us.",
      "Let the Seeds take hold."
    ],
    "hurt": [
      "I can stop the bleeding.",
      "Keep the wound covered.",
      "Hold the binding!",
      "Not too deep."
    ],
    "panic": [
      "I need a moment!",
      "Do not let me fall!",
      "Too much blood!",
      "Keep them back!"
    ],
    "block": [
      "A moment to breathe.",
      "The binding held.",
      "We are safe for now.",
      "Keep your guard."
    ],
    "relief": [
      "My pulse is steady.",
      "That will hold.",
      "We can keep going.",
      "Strength returning."
    ],
    "idle": [
      "Let me check your wounds.",
      "Keep that bandage tight.",
      "Tell me if it hurts.",
      "Take a slow breath."
    ]
  },
  "necromancer": {
    "attack": [
      "Rise, my servants!",
      "Your soul is mine.",
      "Guard your master!",
      "Return to me.",
      "Let the dead through."
    ],
    "hurt": [
      "Not my time yet.",
      "Protect me!",
      "That was too close.",
      "Hold them back."
    ],
    "panic": [
      "To my side!",
      "Do not fail me now!",
      "Guard me!",
      "I need another soul!"
    ],
    "block": [
      "Faithful servants.",
      "The dead stand firm.",
      "Well done.",
      "Hold your ground."
    ],
    "relief": [
      "A soul returned.",
      "Strength from the fallen.",
      "Life returns.",
      "That will sustain me."
    ],
    "idle": [
      "Keep the bones together.",
      "We are not alone here.",
      "Something stirs ahead.",
      "The dead are listening."
    ]
  }
});
const CREATURE_VOICES=Object.freeze({
  "rat": [
    [
      "Squeak?",
      "Sniff-sniff…"
    ],
    [
      "Skree!",
      "Squeak-squeak!"
    ],
    [
      "Eek!",
      "Skkree!"
    ],
    [
      "Squeee…",
      "A faint squeak."
    ]
  ],
  "slime": [
    [
      "Blorp?",
      "Glup…"
    ],
    [
      "GLOOP!",
      "Splort!"
    ],
    [
      "Blip!",
      "Plip?!"
    ],
    [
      "Splosh…",
      "Plop."
    ]
  ],
  "skull": [
    [
      "Clack… clack.",
      "Dry bones rattle."
    ],
    [
      "RATTLE!",
      "Clack-clack!"
    ],
    [
      "Crack!",
      "A brittle snap."
    ],
    [
      "Clatter…",
      "Bones tumble."
    ]
  ],
  "ghost": [
    [
      "Who walks there?",
      "Leave me be."
    ],
    [
      "Join me!",
      "Your warmth… mine!"
    ],
    [
      "No!",
      "My shroud!"
    ],
    [
      "At last…",
      "Peace…"
    ]
  ],
  "goblin": [
    [
      "That purse is mine.",
      "You picked the wrong cave!"
    ],
    [
      "Hand it over!",
      "Get them!"
    ],
    [
      "No fair!",
      "That hurt!"
    ],
    [
      "Keep your coins…",
      "I give… up."
    ]
  ],
  "mimic": [
    [
      "A quiet wooden creak.",
      "The latch twitches."
    ],
    [
      "SNAP!",
      "CHOMP!"
    ],
    [
      "Krrrk!",
      "Splinter!"
    ],
    [
      "A final creak.",
      "The lid falls shut."
    ]
  ],
  "gnawer": [
    [
      "Snff… warm!",
      "A hungry hiss."
    ],
    [
      "GNAASH!",
      "Fsssh!"
    ],
    [
      "My wick!",
      "Sss! Hot!"
    ],
    [
      "Pffft…",
      "The flame gutters."
    ]
  ],
  "bellkeeper": [
    [
      "The bell tolls for you.",
      "No passage."
    ],
    [
      "DONG!",
      "Hear your doom!"
    ],
    [
      "A cracked note!",
      "My bell!"
    ],
    [
      "One last toll…",
      "The bell falls silent."
    ]
  ],
  "revenant": [
    [
      "You will not pass.",
      "I remember this blade."
    ],
    [
      "Stand and fight!",
      "This ends now!"
    ],
    [
      "Not again!",
      "Still standing!"
    ],
    [
      "Let me rest.",
      "My watch is ended."
    ]
  ],
  "capstalker": [
    [
      "A soft rustle.",
      "A cap tilts toward you."
    ],
    [
      "Pfff!",
      "A sharp hiss."
    ],
    [
      "Krrk!",
      "A burst of spores."
    ],
    [
      "Fffff…",
      "The stalk folds."
    ]
  ],
  "myconarch": [
    [
      "Leave my colony.",
      "You tread on my kin."
    ],
    [
      "Breathe my spores!",
      "The colony rises!"
    ],
    [
      "My crown!",
      "You will pay!"
    ],
    [
      "The colony remains…",
      "Back to the soil."
    ]
  ],
  "cinderhopper": [
    [
      "Krik-krik!",
      "A hot, dry click."
    ],
    [
      "KRIIK!",
      "Sssnap!"
    ],
    [
      "Sss!",
      "Krik?!"
    ],
    [
      "A dying hiss.",
      "Krrr…"
    ]
  ],
  "basaltwyrm": [
    [
      "Grrrr…",
      "Stone grinds below."
    ],
    [
      "ROAR!",
      "CRUNCH!"
    ],
    [
      "Rrragh!",
      "Scales crack."
    ],
    [
      "A deep rumble.",
      "The jaws fall still."
    ]
  ],
  "rimewarden": [
    [
      "None pass this gate.",
      "Turn back."
    ],
    [
      "Winter takes you!",
      "Freeze where you stand!"
    ],
    [
      "The ice cracks!",
      "You will not pass!"
    ],
    [
      "The thaw…",
      "My watch ends."
    ]
  ],
  "moth": [
    [
      "Frrrr…",
      "Wings scrape the stone."
    ],
    [
      "Frr-CHIK!",
      "A sudden wingbeat."
    ],
    [
      "Frrrk!",
      "A dry flutter."
    ],
    [
      "Wings fall still.",
      "A fading rustle."
    ]
  ],
  "rustmite": [
    [
      "Chrrr…",
      "Metal scrapes."
    ],
    [
      "KRIK!",
      "Crunch-crunch!"
    ],
    [
      "Tik?!",
      "A harsh click."
    ],
    [
      "Scrrr…",
      "A last scrape."
    ]
  ],
  "sporepilgrim": [
    [
      "Breathe deeply.",
      "You look tired."
    ],
    [
      "A gift for you!",
      "Sleep among the spores."
    ],
    [
      "My cap!",
      "Too rough!"
    ],
    [
      "Back to the roots.",
      "The spores drift on."
    ]
  ],
  "mirrorhound": [
    [
      "Grrrr…",
      "A low growl."
    ],
    [
      "SNARL!",
      "RRAFF!"
    ],
    [
      "Yelp!",
      "Rrgh!"
    ],
    [
      "A faint whine.",
      "The reflection fades."
    ]
  ],
  "ashcolossus": [
    [
      "Who wakes me?",
      "Leave this place."
    ],
    [
      "CRUMBLE!",
      "I will crush you!"
    ],
    [
      "The stone cracks!",
      "You dare!"
    ],
    [
      "Dust…",
      "A long collapse."
    ]
  ],
  "veilweaver": [
    [
      "Come into the dark.",
      "You cannot see me."
    ],
    [
      "Eyes closed!",
      "Lost already?"
    ],
    [
      "My veil!",
      "How did you see?"
    ],
    [
      "Nothing… left.",
      "The veil falls."
    ]
  ],
  "shalecrab": [
    [
      "Click-clack.",
      "A scrape of claws."
    ],
    [
      "CLACK!",
      "Snap-snap!"
    ],
    [
      "Krrik!",
      "A hollow crack."
    ],
    [
      "Clack…",
      "Its claws go slack."
    ]
  ],
  "powderimp": [
    [
      "Tick, tick… heehee!",
      "Mind the fuse!"
    ],
    [
      "Here comes the bang!",
      "Too late to run!"
    ],
    [
      "Careful!",
      "My fuse!"
    ],
    [
      "Fizzle…",
      "A last spark."
    ]
  ],
  "rootling": [
    [
      "Who tramples here?",
      "Mind the roots."
    ],
    [
      "Stay still!",
      "Roots, hold them!"
    ],
    [
      "My bark!",
      "Splinters!"
    ],
    [
      "Back to the soil.",
      "The roots loosen."
    ]
  ],
  "thornhulk": [
    [
      "Who breaks my branches?",
      "Leave my grove."
    ],
    [
      "THORNS RISE!",
      "I will root you here!"
    ],
    [
      "My bark!",
      "Cracking wood."
    ],
    [
      "The old wood rests.",
      "A long, wooden creak."
    ]
  ],
  "sporeling": [
    [
      "Puff?",
      "A tiny rustle."
    ],
    [
      "Puff-puff!",
      "PFF!"
    ],
    [
      "Pip?!",
      "A startled puff."
    ],
    [
      "Pffff…",
      "The cap droops."
    ]
  ],
  "frostmite": [
    [
      "Krrr…",
      "Ice clicks softly."
    ],
    [
      "KRIK!",
      "Snap!"
    ],
    [
      "Crick!",
      "A brittle squeal."
    ],
    [
      "A faint crackle.",
      "The frost melts."
    ]
  ],
  "bees": [
    [
      "Bzzzz…",
      "A warning buzz."
    ],
    [
      "BZZZT!",
      "A furious drone."
    ],
    [
      "Bzz?!",
      "A ragged buzz."
    ],
    [
      "The buzzing fades.",
      "The swarm scatters."
    ]
  ],
  "demon": [
    [
      "Another intruder.",
      "You smell afraid."
    ],
    [
      "Kneel!",
      "Burn!"
    ],
    [
      "You dare?!",
      "I will break you!"
    ],
    [
      "The fire fades…",
      "Not… yet."
    ]
  ],
  "lich": [
    [
      "Your life is forfeit.",
      "I have waited long enough."
    ],
    [
      "Wither!",
      "Your strength is mine!"
    ],
    [
      "My binding!",
      "Impossible!"
    ],
    [
      "The spell… ends.",
      "At last, silence."
    ]
  ],
  "abomination": [
    [
      "Hungry…",
      "Closer…"
    ],
    [
      "MORE!",
      "MINE!"
    ],
    [
      "It hurts!",
      "GRAAH!"
    ],
    [
      "No more hunger.",
      "A fading groan."
    ]
  ],
  "pursuer": [
    [
      "I found you.",
      "There you are."
    ],
    [
      "NOWHERE TO RUN!",
      "You cannot hide!"
    ],
    [
      "You cannot stop me!",
      "Rrraah!"
    ],
    [
      "Gone…",
      "A hollow sigh."
    ]
  ],
  "ogre": [
    [
      "Something smells alive.",
      "Little intruders!"
    ],
    [
      "SMASH!",
      "Stay still!"
    ],
    [
      "OW!",
      "Little blade hurts!"
    ],
    [
      "Too… tired.",
      "The club drops."
    ]
  ],
  "widow": [
    [
      "A faint hiss.",
      "Silk tightens."
    ],
    [
      "HSSSS!",
      "Fangs click."
    ],
    [
      "Skrrr!",
      "A sharp hiss."
    ],
    [
      "Threads fall loose.",
      "A last twitch."
    ]
  ],
  "oracle": [
    [
      "I saw you coming.",
      "This meeting was foretold."
    ],
    [
      "Your time is here!",
      "I know your weakness!"
    ],
    [
      "Not as I saw it!",
      "That cannot be!"
    ],
    [
      "I was… wrong.",
      "The vision fades."
    ]
  ],
  "pageeater": [
    [
      "Snff… paper.",
      "A wet, hungry snort."
    ],
    [
      "CHOMP!",
      "GRAUNCH!"
    ],
    [
      "Bitter!",
      "Hrrk!"
    ],
    [
      "A final gulp.",
      "The jaws fall open."
    ]
  ],
  "smudger": [
    [
      "You should not be here.",
      "I know your name."
    ],
    [
      "Your story ends here!",
      "No way past me!"
    ],
    [
      "Not finished!",
      "That left a mark!"
    ],
    [
      "A name forgotten.",
      "I am fading…"
    ]
  ],
  "skeleton": [
    [
      "Clack… clack.",
      "Dry bones rattle."
    ],
    [
      "RATTLE!",
      "Clack-clack!"
    ],
    [
      "Crack!",
      "A brittle snap."
    ],
    [
      "Clatter…",
      "Bones tumble."
    ]
  ],
  "candle": [
    [
      "Snff… warm!",
      "A hungry hiss."
    ],
    [
      "GNAASH!",
      "Fsssh!"
    ],
    [
      "My wick!",
      "Sss! Hot!"
    ],
    [
      "Pffft…",
      "The flame gutters."
    ]
  ],
  "fighter": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Behind me!",
      "Hold the line!",
      "Shields up!",
      "Stand your ground!",
      "I have this!"
    ],
    [
      "Still standing.",
      "Just a scratch.",
      "That got through!",
      "Armour held. Mostly."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "rogue": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Too slow.",
      "You never saw me.",
      "Quick and quiet.",
      "Found an opening.",
      "Right behind you."
    ],
    [
      "They saw that one.",
      "That stings.",
      "Careless of me.",
      "Caught my sleeve!"
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "mage": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Stand clear!",
      "One more spell!",
      "This should do it.",
      "Keep them busy!",
      "I have a clear shot."
    ],
    [
      "Lost my focus!",
      "Keep them off me!",
      "That burned!",
      "I felt that."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "ranger": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Hold. Loose!",
      "A clear shot.",
      "Right on target.",
      "There is my opening!",
      "Take the shot!"
    ],
    [
      "Keep steady.",
      "Too close for comfort.",
      "My shooting arm!",
      "I need some room."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "berserker": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Come closer!",
      "Hit harder!",
      "My turn!",
      "You will feel this!",
      "Again!"
    ],
    [
      "Now I am angry.",
      "That all you have?",
      "You will pay for that.",
      "I felt that one!"
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "jester": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Watch closely!",
      "Surprise!",
      "Pick a card!",
      "Here comes trouble!",
      "My best trick yet!"
    ],
    [
      "Ouch! Tough crowd.",
      "That was not rehearsed!",
      "Mind the hat!",
      "I meant to dodge that."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "bloodbinder": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Their strength is ours.",
      "Hold still.",
      "A drop is enough.",
      "This will mend us.",
      "Let the Seeds take hold."
    ],
    [
      "I can stop the bleeding.",
      "Keep the wound covered.",
      "Hold the binding!",
      "Not too deep."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ],
  "necromancer": [
    [
      "Stay back!",
      "You will not take me!"
    ],
    [
      "Rise, my servants!",
      "Your soul is mine.",
      "Guard your master!",
      "Return to me.",
      "Let the dead through."
    ],
    [
      "Not my time yet.",
      "Protect me!",
      "That was too close.",
      "Hold them back."
    ],
    [
      "I cannot…",
      "My last fight…"
    ]
  ]
});
function creatureSpeech(e,mood) {
  const phase={entrance:0,attack:1,hurt:2,defeat:3}[mood]??0;
  const key=e.baseArt||e.species||e.art||e.job;
  const bank=CREATURE_VOICES[key]?.[phase] || ["A low growl.","A harsh cry."];
  return visualPick(Array.isArray(bank)?bank:[bank]);
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
