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
    body: '<ul class="guide-takeaways"><li><b>Win.</b> Defeat each staircase guardian. Beating the tenth guardian completes the dungeon.</li><li><b>Descend.</b> Select stairs to open their menu. After victory, descend from anywhere or keep exploring.</li><li><b>Wells.</b> Save an unused fountain for later. It offers 15% maximum HP plus half its healing roll; triples can crit.</li><li><b>Light.</b> Beacons, cave rooms and lava reveal nearby tiles without activating events. Stone blocks beacon and lava light.</li><li><b>Other finds.</b> Ruins trade risk for loot. Strongholds shelter powerful enemies. Paired tunnels stay open after use.</li></ul>',
  },
  {
    id: "combat",
    title: "Combat & criticals",
    body: '<ul class="guide-takeaways"><li><b>Act freely.</b> Use any living hero repeatedly. Click their card or handle to roll; their portrait opens reel editing.</li><li><b>Choose targets.</b> Click an enemy portrait to aim damage. Use the healing target control for healing and buffs.</li><li><b>Critical.</b> Three matching kinds AND ranks roll a multiplier. The middle class mark completes two matching outer marks. Blanks do nothing.</li><li><b>Big hits.</b> Criticals and tier III–IV attacks hit all enemies. Each foe has its own attack countdown.</li><li><b>Keep moving.</b> Click rolling reels or press Space to land them. Event results still need confirmation. Hero criticals grant 1 EXP.</li></ul>',
  },
  {
    id: "statuses",
    title: "Block, stun & Vulnerable",
    body: '<ul class="guide-takeaways"><li><b>Team block.</b> Each side has one shared pool. It absorbs damage, is consumed as it protects and expires after battle.</li><li><b>Stun.</b> Miss an attempt without advancing enemy clocks. Recovery becomes likelier each roll; most stuns end after 1–3 checks.</li><li><b>Break through.</b> Stronger stuns strip more block and can penetrate shields. Healing can clear stun; Mage healing Resonance clears all allies.</li><li><b>Vulnerable.</b> The next direct hit deals 25% extra damage. Healing and poison ticks do not consume it.</li><li><b>Details.</b> Hover any condition icon for its actual effect and remaining strength or duration.</li></ul>',
  },
  {
    id: "openings",
    title: "Openings & poison",
    body: '<ul class="guide-takeaways"><li><b>Initiative.</b> A marked hero gains 25% stronger effects if chosen for the first roll.</li><li><b>Surprise.</b> Surprised heroes cannot open. If everyone is surprised, the enemies attack first.</li><li><b>Enemy intent.</b> The short line names a goal and target. Reels still decide what actually happens.</li><li><b>Poison.</b> Ticks bypass block. Doses load up to three turns; repeated doses then increase tick damage.</li><li><b>Temporary effects.</b> Poison, stun, Rage, Fury, Execute and buffs all clear after combat.</li></ul>',
  },
  {
    id: "heroes",
    title: "Reel editing",
    body: '<ul class="guide-takeaways"><li><b>Earn points.</b> Victories grant EXP and personal points. A level adds 6 maximum HP and 4 points.</li><li><b>Edit.</b> Choose a reel, then a mark. Upgrade raises power; Replace lets you choose its type.</li><li><b>Refund.</b> Downgrade returns half the rank cost. Rebuild support heroes if they must fight alone.</li><li><b>Odds.</b> Faces start equally likely. Paid Weight increases a face’s chance. The Critical odds page shows your combinations.</li><li><b>Permanent mark.</b> Only the middle reel has the class mark. It cannot be removed, copied or upgraded.</li></ul>',
  },
  {
    id: "classes",
    title: "Classes & temperament",
    body: '<ul class="guide-takeaways"><li><b>Temperament.</b> Aggressive and Defensive choose different starting marks. They do not change a mark’s stated power. Rebuild either way.</li><li><b>Tank & Rogue.</b> Tanks favour blades, block and stun. Rogues favour blades, poison and tricks; Flurry throws three extra attacks.</li><li><b>Mage.</b> Use magic, healing, poison, shields or buffs. Resonance echoes rolled marks across the appropriate team.</li><li><b>Ranger.</b> Wait between attacks to fill Execute. Spend that patience on a stronger finishing shot.</li><li><b>Berserker.</b> Wounds and Blood Price build Fury. Bloodrush heals; charged attacks return a little stolen health.</li></ul>',
  },
  {
    id: "jester",
    title: "Jester & Jackpots",
    body: '<ul class="guide-takeaways"><li><b>Unlock.</b> Buy the Jester’s invitation at camp. Jesters can inscribe every ordinary mark type.</li><li><b>Jackpot.</b> Roll three different non-empty KINDS. Ranks do not matter. Gain double a usual critical multiplier.</li><li><b>Encore.</b> A Jackpot adds one free roll before enemy clocks advance. An encore can Jackpot, but cannot chain another encore.</li><li><b>Backfire.</b> A normal matching triple stuns the Jester instead. Matching outer marks plus the middle class mark also backfire.</li><li><b>Wildcard.</b> Six tricks can black out an enemy reel, strengthen an allied reel, reverse enemy rolls, throw pies, scatter healing or deal a sharp card.</li></ul>',
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
    body: '<ul class="guide-takeaways"><li><b>Bank gold.</b> After floors 1–9, bank 25%, 50%, 75% or all carried gold. Victory banks everything. Banked gold survives failed runs.</li><li><b>Adventurers.</b> Unlock Ranger, Berserker and Jester starts and wandering companions.</li><li><b>Campfire Lessons.</b> Eight improvements have five tiers each. Buy tiers permanently; use − and + to choose an active rank, including zero.</li><li><b>Other rules.</b> Challenges add danger, sometimes with rewards. Oddities change discoveries and routes. Purchases start disabled.</li><li><b>Next run.</b> Lesson ranks and toggles are chosen before an expedition. Purchases never rewrite a run already in progress.</li></ul>',
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
