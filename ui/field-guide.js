// Six illustrated quick-reference pages. Detailed live rules belong in the
// existing hover tooltips and reel workshop, not an encyclopaedia here.
function guideRows(rows, classPage = false) {
  return `<ul class="guide-takeaways illustrated-guide ${classPage ? 'guide-classes' : ''}">${rows.map(([art,title,copy]) => `<li><span class="guide-picture" aria-hidden="true">${classPage ? portraitArt(art,{hp:1,maxHp:1}) : art === 'wall' ? wallArt() : icon(art)}</span><span><b>${title}</b> ${copy}</span></li>`).join('')}</ul>`;
}
const FIELD_GUIDE = Object.freeze([
  {id:'explore',title:'Explore & descend',body:guideRows([
    ['hero','Walk into the pencil.','Click covered neighbours. Click known passages for a route.'],
    ['treasure','Take your chances.','Chests roll loot. Traps roll danger. Confirm each discovery.'],
    ['well','Save a fountain.','Return when wounded. Dead companions cannot be healed.'],
    ['stairs','Find the guardian.','Defeat each stair boss. The tenth boss wins the run.'],
    ['tunnel','Read the route.','Walls and water block walking. Bridges cross; tunnels teleport.'],
    ['pursuer','Watch your back.','Old paths hide ambushes. The Unwritten and bees pursue.'],
  ])},
  {id:'combat',title:'Roll & fight',body:guideRows([
    ['sword','Choose any ready hero.','Click a card or handle repeatedly. Watch enemy countdowns.'],
    ['heal','Choose your targets.','Click enemies to attack; select allies to heal. Self-heal stays personal.'],
    ['class','Match three marks.','Match kind AND rank. The class mark completes matching outer marks.'],
    ['block','Protect the party.','Shared and spent when hit. Cap 20; 30 with a Tank.'],
    ['stun','Read the condition icons.','Stun stops actions; poison hurts; stimulant strengthens. Hover for details.'],
    ['magic','Make big hits count.','Criticals and rank III–IV attacks hit every enemy.'],
  ])},
  {id:'heroes',title:'Build your reels',body:guideRows([
    ['sword','Regular physical: 1 / 2 / 3 / 4.','Cheaper to improve. Spells have the same base damage.'],
    ['heavy','Heavy physical: 2 / 4 / 6 / 8.','Tank/Berserker only. More expensive; matches separately from regular attacks.'],
    ['heal','Healing & block: 2 / 4 / 6 / 8.','Support keeps the party alive. Mixed powers earn class bonuses.'],
    ['class','Keep the class mark.','One permanent middle-reel ability. Cannot be removed or copied.'],
    ['point','Spend personal points.','Portrait → reel → mark → type or rank. Prices/refunds are shown.'],
    ['blank','Build a matching set.','Equal face odds. Duplicates improve matches. Victories earn EXP/points.'],
  ])},
  {id:'classes',title:'Know your party',body:guideRows([
    ['fighter','Tank.','Shields and heavy weapons. Shield Bash spends protection on damage.'],
    ['rogue','Rogue.','Fragile physical combos and poison. Flurry adds three attacks.'],
    ['mage','Mage.','Spells or support. Resonance echoes rolled powers across a team.'],
    ['ranger','Ranger.','Let allies charge patience, then spend it on Execute.'],
    ['berserker','Berserker.','Wounds build Fury for damage and lifesteal. Healing spends it.'],
    ['jester','Jester.','Wildcard surprises. Trick charges Punchline: six marks from their reels.'],
  ],true)},
  {id:'biomes',title:'Recognise the terrain',body:guideRows([
    ['overgrown','Overgrowth.','Roots, fruit, clearings; bee swarms follow nearby travellers.'],
    ['explodingMushroom','Mushrooms.','Purple caps poison. Red caps explode. Ordinary caps reveal neighbours.'],
    ['ice','Frozen caves.','Ice slides forward. Brittle ice leaves an impassable hole.'],
    ['lava','Lava caves.','Molten rivers block. Bridges and cooling crust offer crossings.'],
    ['crystal','Crystal caves.','Blue auras seal reels. Roll affected heroes to crack gems.'],
    ['stalactite','Shaky caves.','Ceilings count footsteps. Cracks collapse; tremors move discoveries.'],
    ['shadow','Shadow galleries.','Old rooms darken. Lantern islands keep visited passages clear.'],
    ['wall','Labyrinth.','Walls shift often. Watch warnings; an escape route remains.'],
  ])},
  {id:'camp',title:'Supplies, camp & controls',body:guideRows([
    ['bag','Use your satchel.','Three item types. Drag equipment to heroes; artefacts grant passives.'],
    ['recruit','Build a party.','Up to three companions. Temperament favours aggressive or defensive powers.'],
    ['coin','Bank your gold.','Bank after cleared floors. Banked gold survives failed runs.'],
    ['camp','Prepare the next run.','Lessons improve heroes. Invitations unlock classes. Other rules change runs.'],
    ['safe','Use your own pace.','Options control effects. Autofight rolls; Autoplay explores and builds.'],
    ['sound','Event log.','Hover underlined names. Reopen old battles. Shortcuts line the bottom.'],
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
