// Six illustrated quick-reference pages. Detailed live rules belong in the
// existing hover tooltips and reel workshop, not an encyclopaedia here.
function guideRows(rows, classPage = false) {
  return `<ul class="guide-takeaways illustrated-guide ${classPage ? 'guide-classes' : ''}">${rows.map(([art,title,copy]) => `<li><span class="guide-picture" aria-hidden="true">${classPage ? portraitArt(art,{hp:1,maxHp:1}) : art === 'wall' ? wallArt() : icon(art)}</span><span><b>${title}</b> ${copy}</span></li>`).join('')}</ul>`;
}
const FIELD_GUIDE = Object.freeze([
  {id:'explore',title:'Explore & descend',body:guideRows([
    ['hero','Reveal nearby tiles.','Click a covered tile beside your party to explore it. Click a revealed tile to walk there automatically.'],
    ['treasure','Treasure and traps.','Chests can contain gold and items. Traps can injure your party; a slot roll decides the outcome.'],
    ['well','Healing fountains.','A fountain restores some health. You can decline it and return later when your party needs healing.'],
    ['stairs','Reach the next floor.','Find the stairs and defeat their guardian to descend. Defeat the guardian on floor ten to win.'],
    ['tunnel','Find a way through.','Walls, rivers and lava block movement. Bridges cross water or lava; paired tunnels teleport you between entrances.'],
    ['pursuer','Some enemies pursue you.','Watch for creatures moving towards your party: contact starts a fight. Returning through old passages can also trigger an ambush.'],
  ])},
  {id:'combat',title:'Roll & fight',body:guideRows([
    ['sword','Choose who acts.','Click a hero’s card or handle to roll. You can use the same hero again; enemy countdowns show when they retaliate.'],
    ['heal','Choose your targets.','Click an enemy to target attacks, or choose an ally for healing. Self-healing only affects the hero who rolls it.'],
    ['class','Three matches make a critical.','Match the symbol and its tier across all three reels. A middle class symbol can complete two matching outer symbols.'],
    ['block','Block protects everyone.','The party shares one shield pool, spent as it absorbs damage. It holds up to 20 block, or 30 with a Tank.'],
    ['stun','Check status icons.','Stun prevents actions, poison deals damage over time, and stimulants strengthen heroes. Hover an icon for its effects and duration.'],
    ['magic','Hit groups with strong rolls.','Critical attacks and tier III–IV attacks can hit every enemy. Healing and other effects follow their own targets.'],
  ])},
  {id:'heroes',title:'Build your reels',body:guideRows([
    ['sword','Physical and spell damage.','Tiers I–IV deal 1, 2, 3 or 4 base damage per symbol. Class bonuses and criticals can increase the result.'],
    ['heavy','Heavy physical damage.','Tank and Berserker can buy stronger attacks: 2, 4, 6 or 8 base damage. They cost more and only match other heavy symbols.'],
    ['heal','Healing and shields.','Tiers I–IV restore 2, 4, 6 or 8 base health or block. A mix of attacks and support helps a party survive.'],
    ['class','Every class has a special ability.','Its symbol stays on the middle reel. You can improve it, but cannot remove it or add extra copies.'],
    ['point','Edit a hero’s reels.','Open their portrait outside combat, choose a reel and symbol, then choose a type or tier. Costs and refunds are shown.'],
    ['blank','Improve your odds.','Every entry on a reel has an equal chance. Repeated symbols make matching easier. Battle victories earn experience and upgrade points.'],
  ])},
  {id:'classes',title:'Know your party',body:guideRows([
    ['fighter','Tank — protection.','A tough protector with strong shields and heavy weapons. Keeps allies safe while dealing steady damage.'],
    ['rogue','Rogue — fast damage.','A fragile damage specialist. Uses physical attacks, poison and repeated hits to bring enemies down quickly.'],
    ['mage','Mage — flexible support.','A flexible spellcaster. Can focus on healing and shields, spell damage, or a mix of support and attacks.'],
    ['ranger','Ranger — finishing attacks.','Builds power between attacks, then fires stronger shots. Especially effective against already wounded enemies.'],
    ['berserker','Berserker — risk and recovery.','Grows stronger when hurt and recovers health by attacking. A risky fighter who still needs careful healing.'],
    ['jester','Jester — unpredictable bursts.','Can learn many powers and build towards sudden bursts of extra effects. Versatile, but less predictable.'],
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
    ['bag','Use items and equipment.','The bag holds three item types. Use supplies when needed, drag equipment onto heroes, and equip an artefact for a lasting bonus.'],
    ['recruit','Recruit companions.','Your party holds up to three heroes. Each has an aggressive or defensive temperament that boosts suitable powers.'],
    ['coin','Keep gold between runs.','After clearing a floor, choose how much gold to bank. Banked gold is safe even if the party later dies.'],
    ['camp','Buy permanent upgrades.','On the starting menu, open Upgrades to spend banked gold on stronger heroes, new classes and optional rules for future runs.'],
    ['safe','Adjust the game to suit you.','Options control sound and effects. Autofight chooses battle actions; Autoplay also explores, uses supplies and improves reels.'],
    ['sound','Read the Event log.','Hover underlined names to learn what happened. Open older battle summaries to reread them. Keyboard shortcuts appear along the bottom.'],
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
