// Short topics share one fixed page frame; invisible pages reserve the longest text.
const FIELD_GUIDE = Object.freeze([
  {
    id: "explore",
    title: "Exploration",
    body: "<p><b>Explore.</b> Click a frontier tile to uncover it, or a known tile to follow a shortest route. Routes avoid active fights and traps. Redirect while walking or erasing. Known wells, shops and ruins are ignored when passing through. Walls, rivers and deep-floor lava block movement; bridges cross water. Lava lights its own tile and its four direct neighbours when any one is discovered.</p>\n<p><b>Old passages.</b> Explored rooms can hide an ambush after a minute away. Battles and menus pause that timer. Winning clears nearby ambush age. From floor three, The Unwritten can awaken and follow one tile per footstep. Watch its moving mark.</p>",
  },
  {
    id: "floors",
    title: "Floors & discoveries",
    body: "<p><b>Descend.</b> Select marked stairs to open their menu; passing through does not stop you. Each staircase has a guardian. Defeat it, then descend from anywhere or keep exploring. Stairs are reachable and at least eight steps from camp. Defeating the tenth guardian wins.</p>\n<p><b>Discoveries.</b> Leave wells active until needed: they roll 15% maximum HP plus half a healing bonus. Beacons and cave rooms reveal nearby discoveries without triggering them; beacon light cannot cross stone. Ruins risk trap damage for loot. Rare strongholds hold dangerous champions. Paired tunnels offer optional travel between two distant entrances.</p>",
  },
  {
    id: "combat",
    title: "Combat & criticals",
    body: "<p><b>Act freely.</b> Any living hero can spin repeatedly. Click a hero card to spin, its portrait to edit, target buttons to heal and an enemy portrait to target damage. Double battles become more common, especially through floors one to four; each enemy has its own clock. Tier III/IV attacks and criticals hit all enemies.</p>\n<p><b>Three of a kind.</b> Three matching type-and-tier symbols roll a critical: ×2–×4 for heroes and loot, ×1.25–×1.75 for enemies and fountains. A middle class seal completes two matching symbols and casts its ability. Blanks never crit. Click rolling reels or press Space to land them. Confirm event outcomes; “Strike now” skips a critical hold.</p>",
  },
  {
    id: "statuses",
    title: "Block, stun & Vulnerable",
    body: "<p><b>Block and stun.</b> Each side shares its own block pool. It absorbs damage, wears away and expires after battle. Unbroken page blocks the next enemy’s entire turn. Weak stuns are stopped by block; stronger ones consume more and can break through. Stun or magic may expose Vulnerable: the next damaging hit gains 25%. Healing can clear stun; stronger heals help and heavy block reduces the chance. A stunned hero misses an attempt without advancing enemy clocks. Recovery chance rises with each roll; most stuns break within one to three checks. Hover status badges for exact effects.</p>",
  },
  {
    id: "openings",
    title: "Openings & poison",
    body: "<p><b>Openings and poison.</b> Initiative sometimes offers one hero a 25% bonus if they take the first roll. A fresh hidden encounter may surprise some heroes: a ready companion must open. If everyone is surprised, enemies go first. Intent names the enemy’s focus; reels still decide the result. Poison holds at most three turns; repeated doses increase tick damage.</p>",
  },
  {
    id: "heroes",
    title: "Reel editing",
    body: "<p><b>Reels and levels.</b> Victories give EXP and personal editing points. Levels add 6 maximum HP and 4 points. Click a portrait to edit a symbol. Starting faces are equally likely; spend points to weight one more heavily. The Critical odds page lists every possible matching combination. Downgrades refund points. Your middle class mark is permanent.</p>",
  },
  {
    id: "classes",
    title: "Classes & temperament",
    body: "<p><b>Your build.</b> Aggressive or Defensive temperament is fixed, chosen only for your first hero. Mage Resonance echoes the rolled power across its appropriate team; healing Resonance also clears all allied stuns. Ranger Execute fills between attacks for a stronger finishing shot. Berserkers turn wounds and Blood Price into Fury: every four Fury adds one damage. Their wheels allow blades, healing, Blood Price and blanks. Temporary statuses clear after battle.</p>",
  },
  {
    id: "companions",
    title: "Traits & fallen companions",
    body: "<p><b>Traits.</b> Related experiences sometimes leave a lasting trait. At most one adventurer gains a trait from each experience. One trait per hero; new traits replace old ones automatically. Hover its portrait badge for effects and origin. Traits persist between battles.</p>\n<p><b>The fallen.</b> A carried Revive Stone can restore a fallen hero once, at 75% health. Otherwise death is permanent. Survivors acknowledge a burial; Names remembered keeps their statistics. Final records include every survivor, retired companion and fallen adventurer.</p>",
  },
  {
    id: "supplies",
    title: "Supplies & equipment",
    body: "<p><b>Supplies and company.</b> Carry three item types; matching items stack. Inspect to use/discard; a full bag offers use, swap or leave. Ink bombs roll damage and poison. Stronger supplies appear from floors 4, 7 and 10 and keep their acquired strength. Generic equipment fits every class; class-bound gear is clearly labelled. Drag compatible equipment onto heroes; equip one passive artefact. Invite up to three companions, or replace one. Refusals can lead to farewells, gifts or fights.</p>",
  },
  {
    id: "camp",
    title: "Camp progression",
    body: "<p><b>Camp.</b> After a guardian, bank 25/50/75/100% of carried gold or keep it for shops. Banked gold survives new runs. Upgrades in the starting menu unlocks Ranger, Berserker, tiered permanent training and optional next-run modifiers. Purchased modifiers start disabled; choose which to enable.</p>",
  },
  {
    id: "controls",
    title: "Controls & automation",
    body: "<p><b>Controls.</b> Tab/Enter and the bottom bar cover navigation. Options includes audio, pace, palette, lighting, shake and cosmetic Pun-nishing Mode. Effects selects icons, beams or both. Autofight chooses combat actions; Autoplay explores, upgrades and seeks supplies/experience when behind. Enable both for a hands-free attempt. Autoplay banks 25% after ordinary floors; final records stay open. Menus pause exploration. Save HTML downloads the offline game, not browser-local progress.</p>",
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
