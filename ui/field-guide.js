// Six illustrated quick-reference pages. Detailed live rules belong in the
// existing hover tooltips and reel workshop, not an encyclopaedia here.
function guideRows(rows, classPage = false) {
  return `<ul class="guide-takeaways illustrated-guide ${classPage ? 'guide-classes' : ''}">${rows.map(([art,title,copy]) => `<li><span class="guide-picture" aria-hidden="true">${classPage ? portraitArt(art,{hp:1,maxHp:1}) : art === 'wall' ? wallArt() : icon(art)}</span><span><b>${title}</b> ${copy}</span></li>`).join('')}</ul>`;
}
const FIELD_GUIDE = Object.freeze([
  {id:'explore',title:'Explore & descend',body:guideRows([
    ['hero','Reveal nearby tiles.','Click a covered neighbour to explore. Click a revealed tile to walk there automatically.'],
    ['treasure','Treasure, traps and temples.','Chests offer gold and items; traps can hurt your party. Rare temples hold an optional guardian and valuable loot.'],
    ['well','Healing fountains.','Fountains restore health. Decline one to save it, then return when your party is wounded.'],
    ['stairs','Reach the next floor.','Find the stairs and defeat their guardian to descend. Beat floor ten’s guardian to win.'],
    ['tunnel','Find a way through.','Walls, rivers and lava block movement. Bridges cross rivers; paired tunnels teleport between entrances.'],
    ['pursuer','Some enemies pursue you.','Some creatures pursue you; contact starts a fight. Old passages can also hide ambushes.'],
  ])},
  {id:'combat',title:'Roll & fight',body:guideRows([
    ['sword','Choose who acts.','Click a hero’s card or handle to roll. Repeat freely; enemy countdowns show when they attack.'],
    ['heal','Choose your targets.','Click an enemy to target attacks; choose an ally for healing. Self-healing stays with its caster.'],
    ['class','Three matches make a critical.','Match symbol and tier across three reels. A middle class symbol completes matching outer symbols.'],
    ['block','Block protects everyone.','Everyone shares block, spent when it absorbs damage. The cap is 20, or 30 with a Tank.'],
    ['stun','Check status icons.','Stun stops actions; poison hurts over time; stimulants strengthen heroes. Hover icons for details.'],
    ['magic','Hit groups with strong rolls.','Critical attacks and tier III–IV attacks hit every enemy. Other powers follow their own targets.'],
  ])},
  {id:'heroes',title:'Build your reels',body:guideRows([
    ['sword','Physical and spell damage.','Tiers I–IV deal 1, 2, 3 or 4 base damage. Bonuses and criticals can increase it.'],
    ['heavy','Heavy physical damage.','Tank and Berserker can buy 2/4/6/8-damage heavy attacks. They cost more and match separately.'],
    ['heal','Healing and shields.','Tiers I–IV give 2, 4, 6 or 8 base health or block. Support helps everyone survive.'],
    ['class','Every class has a special ability.','Its symbol stays on the middle reel. You cannot remove it or add extra copies.'],
    ['point','Edit a hero’s reels.','Open a portrait, choose a reel and symbol, then its type or tier. Costs and refunds are shown.'],
    ['blank','Improve your odds.','Every reel entry has equal odds. Duplicates help matching. Battle victories earn experience and points.'],
  ])},
  {id:'classes',title:'Know your party',body:guideRows([
    ['fighter','Tank — protection.','A tough protector. Shields keep allies safe; heavy weapons hit hard.'],
    ['rogue','Rogue — fast damage.','Fragile, with strong blade bursts and poison. Cannot use healing marks.'],
    ['mage','Mage — flexible support.','A flexible spellcaster. Build for damage, healing, shields, or a mix.'],
    ['ranger','Ranger — finishing attacks.','Builds power between attacks, then fires strong shots at wounded foes.'],
    ['berserker','Berserker — risk and recovery.','Grows stronger when hurt. Can drain health by attacking, but needs careful healing.'],
    ['bloodbinder','Bloodbinder — shared healing.','Spends HP to plant Seeds. Hits or Blood Bloom burst them to heal allies.'],
    ['necromancer','Necromancer — undead companions.','Win floor ten to unlock. Raise allies, choose their rolls, and consume them to heal yourself.'],
    ['jester','Jester — unpredictable bursts.','Versatile and unpredictable, with sudden bursts of extra effects.'],
  ],true)},
  {id:'biomes',title:'Recognise the terrain',body:guideRows([
    ['overgrown','Overgrowth.','Fruit and clearings offer help among the roots. Nearby bee swarms may follow you.'],
    ['explodingMushroom','Mushroom caves.','Purple caps poison; red ones explode. Step on ordinary mushrooms to reveal nearby caps.'],
    ['ice','Frozen caves.','Ice slides you forward. Brittle ice breaks after crossing, leaving an impassable hole.'],
    ['lava','Lava caves.','Lava blocks movement. Cross using bridges, tunnels or temporary cooling crust.'],
    ['crystal','Crystal caves.','Fights inside blue zones can seal your reels. Roll an affected hero to break the seals.'],
    ['stalactite','Shaky caves.','Watch for falling rocks and collapsing ground. Tremors can move discoveries.'],
    ['shadow','Shadow galleries.','Darkness returns to old passages and can hide danger. Lanterns keep nearby paths clear.'],
    ['wall','Labyrinth.','Walls shift as you explore. Warnings show which passages will close or open.'],
  ])},
  {id:'camp',title:'Supplies, camp & controls',body:guideRows([
    ['bag','Use items and equipment.','Carry three item types. Use supplies, drag equipment onto heroes, and equip an artefact for lasting bonuses.'],
    ['recruit','Recruit companions.','Take up to three heroes. Temperament stays fixed; you can rebuild their reels freely.'],
    ['coin','Keep gold between runs.','After clearing a floor, choose how much to bank. Banked gold survives failed runs.'],
    ['camp','Buy permanent upgrades.','Open Upgrades on the starting menu. Spend banked gold on stronger heroes, new classes and optional rules.'],
    ['safe','Adjust the game to suit you.','Options control sound and effects. Autofight fights; Autoplay also explores, uses supplies and improves reels.'],
    ['sound','Read the Event log.','Hover underlined names for explanations. Reopen older battles. Keyboard shortcuts appear along the bottom.'],
  ])},
]);
const GUIDE_ALIASES = Object.freeze({floors:'explore',statuses:'combat',buffs:'combat',openings:'combat',combos:'heroes',jester:'classes',mystery:'classes',companions:'classes',controls:'camp','event-log':'camp',roots:'biomes',crust:'biomes',faults:'biomes',landmarks:'biomes',ice:'biomes',crystal:'biomes',living:'biomes',shadow:'biomes',maze:'biomes','wild-finds':'explore'});
function help(topic = "explore") {
  topic = GUIDE_ALIASES[topic] || topic;
  let page = Math.max(
    0,
    FIELD_GUIDE.findIndex((p) => p.id === topic),
  );
  openModal(
    "Field guide",
    `<section class="field-guide"><nav class="guide-navigation" aria-label="Field guide topics"><label for="guide-topic">Topic<select id="guide-topic">${FIELD_GUIDE.map((p, i) => `<option value="${i}" ${i === page ? "selected" : ""}>${p.title}</option>`).join("")}</select></label><button id="guide-previous" aria-label="Previous topic">← Previous</button><button id="guide-next" aria-label="Next topic">Next →</button></nav><div class="guide-grid" id="guide-content" aria-live="polite">${FIELD_GUIDE.map((topic, i) => `<div class="guide-topic-body" data-guide-page="${i}" aria-hidden="true" inert>${topic.body}</div>`).join("")}</div><div class="guide-page-count" aria-live="polite"></div></section><div class="modal-actions"><button class="primary" data-close>Back to the dungeon ↗</button></div>`,
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
