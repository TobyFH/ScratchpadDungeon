// Short, scannable topics share one fixed notebook frame. No filler text.
const FIELD_GUIDE = Object.freeze([
  {
    id: "explore",
    title: "Exploration",
    body: '<ul class="guide-takeaways"><li><b>Move.</b> Click an adjacent unknown tile to reveal it. Click a known tile for a shortest route.</li><li><b>Change course.</b> Click a new valid destination while walking. Routes prefer to avoid active fights and traps.</li><li><b>Terrain.</b> Stone, rivers and lava block walking. Bridges are clear crossings; tunnels offer optional travel.</li><li><b>Old passages.</b> After 12 move commands away, explored tiles can hide an ambush. Long routes count once; waiting does not age tiles.</li><li><b>The Unwritten.</b> From floor three, watch for a hunter that moves one tile for each of your footsteps.</li></ul>',
  },
  {
    id: "floors",
    title: "Floors & discoveries",
    body: '<ul class="guide-takeaways"><li><b>Win.</b> Defeat each staircase guardian. Beating the tenth guardian completes the dungeon.</li><li><b>Descend.</b> Select stairs to open their menu. After victory, descend from anywhere or keep exploring.</li><li><b>Wells.</b> Save an unused fountain for later. It starts at 15% maximum HP plus half its roll. Both grow gently with depth; triples can crit.</li><li><b>Light.</b> Beacons, cave rooms and lava reveal nearby tiles without activating events. Stone blocks beacon and lava light.</li><li><b>Other finds.</b> Ruins trade risk for loot. Strongholds shelter powerful enemies. Paired tunnels stay open after use.</li></ul>',
  },
  {
    id: "biomes", title: "Caves & living floors",
    body: '<ul class="guide-takeaways"><li><b>Floor themes.</b> Each floor has a name and a softly tinted map edge. Most are stone caves; themed floors grow more common deeper down.</li><li><b>Overgrowth.</b> Roots hide approaches. Fresh fights are more likely to surprise the party, or catch foes unaware for one extra spin.</li><li><b>Mushrooms.</b> Step on a cap to light nearby connected caps, revealing up to eight more without triggering their discoveries.</li><li><b>Fire & frost.</b> Lava blocks walking and lights neighbouring stone. Ice forces a slide; see the next guide topic.</li><li><b>Local creatures.</b> Overgrown, fungal, frozen and lava caves have their own creatures. Deeper floors bring stronger local species.</li></ul>',
  },
  {
    id: "ice", title: "Ice & dangerous fuses",
    body: '<ul class="guide-takeaways"><li><b>Ice.</b> Entering ice carries you forward. Consecutive ice tiles continue the slide; a wall stops it.</li><li><b>Plan ahead.</b> Known ice is included in routes. You cannot choose to turn halfway through a slide.</li><li><b>No safe route.</b> If sliding makes your destination unreachable, a long move stops before the blocking ice.</li><li><b>Powder imp.</b> Watch its burning fuse. After two enemy turns it explodes, damaging the party and destroying itself.</li><li><b>Answer the fuse.</b> Kill or stun it before detonation, build team block, or use an Unbroken page. Its warning shows blast power.</li></ul>',
  },
  {id:"crystal",title:"Crystal caves",body:'<ul class="guide-takeaways"><li><b>Deposits.</b> Crystal clusters block walking. Their blue aura reaches fights within two tiles, with stone blocking its reach.</li><li><b>Resonance.</b> Every three party rolls, two random reels become sealed with gems.</li><li><b>Crack them.</b> Roll an affected hero. Their sealed reels are empty for that roll, then the gems shatter. Other heroes keep their own seals.</li><li><b>After battle.</b> Every seal clears when the fight ends. The deposit stays on the map.</li></ul>'},
  {
    id: "combat",
    title: "Combat & criticals",
    body: '<ul class="guide-takeaways"><li><b>Hero powers.</b> Physical/spell ranks I–IV deal 1/2/3/4 damage. Healing/block give 2/4/6/8. Bonuses and criticals add to these.</li><li><b>Targets.</b> Click an enemy to aim damage. Choose an ally for healing. Stimulants boost self or an ally.</li><li><b>Critical.</b> Match three kinds AND ranks. The middle class mark completes matching outer marks. Blanks do nothing.</li><li><b>Big hits.</b> Criticals and tier III–IV attacks hit all foes. Each enemy has its own countdown.</li><li><b>Roll freely.</b> Click any hero card or handle; portraits edit reels. Click rolling reels to land them. Events need confirmation; hero crits grant 1 EXP.</li></ul>',
  },
  {
    id: "statuses",
    title: "Block, stun & Vulnerable",
    body: '<ul class="guide-takeaways"><li><b>Team block.</b> Each side has one shared pool. It absorbs damage, is consumed as it protects and expires after battle.</li><li><b>Stun.</b> Miss an attempt without advancing enemy clocks. Recovery becomes likelier each roll; most stuns end after 1–3 checks.</li><li><b>Break through.</b> Stronger stuns strip more block and can penetrate shields. Healing can clear stun; Mage healing Resonance clears all allies.</li><li><b>Vulnerable.</b> The next direct hit deals 25% extra damage. Healing and poison ticks do not consume it.</li><li><b>Details.</b> Hover any condition icon for its actual effect and remaining strength or duration.</li></ul>',
  },
  {
    id: "buffs",
    title: "Stimulants & shield bash",
    body: '<ul class="guide-takeaways"><li><b>Self stimulant.</b> Tanks, Rogues and Berserkers can boost themselves with this mark.</li><li><b>Ally stimulant.</b> Mages, Rangers and Jesters boost the ally who has rolled most this fight. Alone, they boost themselves.</li><li><b>Three actions.</b> Each power adds one action of duration, up to three of the recipient’s own actions. Extra duration increases potency.</li><li><b>Potency.</b> Gain +1 damage plus one per three power, and +1 resistance plus one per five power. Hover the status for exact values.</li><li><b>Tank class mark.</b> Shield Bash adds two team block, plus one every three levels, then hits with your current shield count. Each point of bash power removes two enemy block.</li></ul>',
  },
  {
    id: "openings",
    title: "Openings & poison",
    body: '<ul class="guide-takeaways"><li><b>Initiative.</b> A marked hero gains 25% stronger effects if chosen for the first roll.</li><li><b>Surprise.</b> Surprised heroes cannot open. If everyone is surprised, the enemies attack first.</li><li><b>Enemy intent.</b> The short line names a goal and target. Reels still decide what actually happens.</li><li><b>Poison.</b> Ticks bypass block. Doses load up to three turns; repeated doses then increase tick damage.</li><li><b>Temporary effects.</b> Poison, stun, Fury, Execute, anticipation and buffs all clear after combat.</li></ul>',
  },
  {
    id: "heroes",
    title: "Reel editing",
    body: '<ul class="guide-takeaways"><li><b>Earn points.</b> Victories grant EXP and personal points. A level adds 6 maximum HP and 4 points.</li><li><b>Edit.</b> Choose a reel, then a mark. Upgrade raises power; Replace lets you choose its type.</li><li><b>Refund.</b> Downgrade returns half the rank cost. Rebuild support heroes if they must fight alone.</li><li><b>Odds.</b> Faces start equally likely. Paid Weight increases a face’s chance. The Critical odds page shows your combinations.</li><li><b>Permanent mark.</b> Only the middle reel has the class mark. It cannot be removed, copied or upgraded.</li></ul>',
  },
  {
    id: "classes",
    title: "Classes & temperament",
    body: '<ul class="guide-takeaways"><li><b>Temperament.</b> Aggressive and Defensive choose different starting marks. They do not change a mark’s stated power. Rebuild either way.</li><li><b>Tank & Rogue.</b> Tank crits ×1.5–×2.25; cheap shields fuel Shield Bash. Rogue crits ×2–×5; build physical combos or poison, with little recovery.</li><li><b>Mage.</b> Crits ×1.75–×3. Spell damage works alone; healing, shields or poison Resonance support a party. No chosen speciality.</li><li><b>Ranger.</b> Crits ×2–×4. Let allies act to charge Execute, then strike a wounded enemy.</li><li><b>Berserker.</b> Crits ×1.75–×4. Wounds charge Fury; balance Blood Price with healing and lifesteal.</li></ul>',
  },
  {
    id: "jester",
    title: "Jester & Punchline",
    body: '<ul class="guide-takeaways"><li><b>Unlock.</b> Buy the Jester’s invitation at camp. It can inscribe any ordinary kind except Self stimulant and the Berserker’s Blood Price.</li><li><b>Trick.</b> These marks fill anticipation by their rank. At 6, earn one free Punchline before enemy clocks advance.</li><li><b>Punchline.</b> Roll your own machine with ordinary non-empty marks one rank stronger, up to IV. These bonus rolls do not refill anticipation.</li><li><b>Criticals.</b> Matching triples roll ×1.5–×4. Different kinds have no special critical; matching triples do not self-stun.</li><li><b>Wildcard.</b> The permanent class mark can ink enemy reels, gild allied reels, reverse a foe’s roll or scatter damage and healing.</li></ul>',
  },
  {
    id: "companions",
    title: "Traits & fallen companions",
    body: '<ul class="guide-takeaways"><li><b>Traits.</b> Relevant experiences sometimes grant one hero a trait. Only one trait is active; a later trait can replace it.</li><li><b>Rare moments.</b> A hero might hold at 1 HP, shrug off stun, parry, rally or roll with inspiration. Each fight permits at most two such moments.</li><li><b>On the road.</b> Coins, insight, a warning, a second breath or sure footing may reward one adventurer. Moments can occasionally leave a related trait.</li><li><b>Death.</b> A carried Revive Stone can restore a fallen hero at 75% HP. Otherwise death is permanent.</li><li><b>Records.</b> Names remembered and the final roster keep the stories and statistics of fallen and retired companions.</li></ul>',
  },
  {
    id: "supplies",
    title: "Supplies & equipment",
    body: '<ul class="guide-takeaways"><li><b>Satchel.</b> Carry three item types; matching supplies stack. Inspect to use or discard. A full bag offers swap, use or leave.</li><li><b>Spend supplies.</b> Later floors offer stronger variants. Ink bombs roll damage and poison; Unbroken page blocks one full enemy turn.</li><li><b>Equipment.</b> Drag compatible gear onto a hero. Class-bound items say who can wear them; generic gear fits anyone.</li><li><b>Artefacts.</b> One equipped artefact provides a passive bonus. Revive Stones work from the pack without equipping.</li><li><b>Companions.</b> Invite up to three, or replace one. Declining at either invitation step can bring a farewell, gift or fight.</li></ul>',
  },
  {
    id: "camp",
    title: "By the campfire",
    body: '<ul class="guide-takeaways"><li><b>Bank gold.</b> After floors 1–9, bank 25%, 50%, 75% or all carried gold. Victory banks everything. Banked gold survives failed runs.</li><li><b>Adventurers.</b> Unlock Ranger, Berserker and Jester starts and wandering companions.</li><li><b>Campfire Lessons.</b> Eight improvements have five tiers each. Buy tiers permanently; use − and + to choose an active rank, including zero.</li><li><b>Other rules.</b> Challenges add danger, sometimes with rewards. Oddities change discoveries and routes. Purchases start disabled.</li><li><b>Grow stronger.</b> Bank gold for lessons. Fresh runs are dangerous; a trained party is stronger. Select lessons before the next run.</li></ul>',
  },
  {
    id: "controls",
    title: "Controls & automation",
    body: '<ul class="guide-takeaways"><li><b>Navigate.</b> Use Tab and Enter, or the shortcuts in the bottom bar. Side tabs stay available during events.</li><li><b>Autofight.</b> Chooses heroes, targets and occasional supplies. Autoplay explores, edits reels and seeks useful discoveries.</li><li><b>Builds.</b> Autoplay keeps a preferred build for each hero, while retaining damage and rebuilding a support-only survivor.</li><li><b>Options.</b> Adjust sound, motion, lighting, palette and icon/beam feedback. Reset progress keeps these settings.</li><li><b>Backup.</b> Save HTML in Options downloads the offline game, not browser-local progress.</li></ul>',
  },
]);
function help(topic = "explore") {
  let page = Math.max(
    0,
    FIELD_GUIDE.findIndex((p) => p.id === topic),
  );
  openModal(
    "A field guide for the brave",
    `<section class="field-guide"><nav class="guide-navigation" aria-label="Field guide topics"><label for="guide-topic">Topic<select id="guide-topic">${FIELD_GUIDE.map((p, i) => `<option value="${i}" ${i === page ? "selected" : ""}>${p.title}</option>`).join("")}</select></label><button id="guide-previous" aria-label="Previous topic">← Previous</button><button id="guide-next" aria-label="Next topic">Next →</button></nav><div class="guide-grid" id="guide-content" aria-live="polite">${FIELD_GUIDE.map((topic, i) => `<div class="guide-topic-body" data-guide-page="${i}" aria-hidden="true" inert>${topic.body}</div>`).join("")}</div><div class="guide-page-count" aria-live="polite"></div></section><div class="modal-actions"><button class="primary" data-close>Into the margins ↗</button></div>`,
    "help",
  );
  const showPage = (next) => {
    page = Math.max(0, Math.min(FIELD_GUIDE.length - 1, next));
    $("#guide-topic").value = String(page);
    document.querySelectorAll("[data-guide-page]").forEach((node) => {
      const active = Number(node.dataset.guidePage) === page;
      node.classList.toggle("current-topic", active);
      node.setAttribute("aria-hidden", String(!active));
      node.inert = !active;
    });
    $(".guide-page-count").textContent =
      `${page + 1} / ${FIELD_GUIDE.length} · ${FIELD_GUIDE[page].title}`;
    $("#guide-previous").disabled = page === 0;
    $("#guide-next").disabled = page === FIELD_GUIDE.length - 1;
    fitDialogs();
  };
  $("#guide-topic").onchange = (e) => showPage(Number(e.target.value));
  $("#guide-previous").onclick = () => showPage(page - 1);
  $("#guide-next").onclick = () => showPage(page + 1);
  showPage(page);
}
