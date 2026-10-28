// Species records are independent of expedition/camp saves. Unknown entries never
// expose names, stats or silhouettes. A record stores real observed encounter stats.
const BESTIARY_KEY = "scratchpad-dungeon-bestiary-v1";
const SPECIES_LORE = {
  jester: [
    "Hostile jester",
    "A joke takes a sharp turn. Its mystery marks can become almost any power.",
  ],
  rat: [
    "Ink rat",
    "Cellar scavengers lick spilled ink from discarded pages. Their teeth carry more than a stain.",
  ],
  ghost: [
    "Margin wraith",
    "A reader who never found the ending. Its pale hands reach for the spaces between thoughts.",
  ],
  slime: [
    "Blotling",
    "A blot left too long in a damp book. It can pull itself together, even after being torn apart.",
  ],
  skull: [
    "Skeletal warrior",
    "Old guards still follow orders written before their bones were bare. Expect blades and shields.",
  ],
  gnawer: [
    "Candle gnawer",
    "It steals lantern wax and shelters a stolen flame in its matted head. It bites when the light runs low.",
  ],
  bellkeeper: [
    "Blind bellkeeper",
    "The bell is its only map. Each toll finds a footstep and sends a shock through the stone.",
  ],
  widow: [
    "Thorn widow",
    "Roots and spider silk have made a patient hunter. Antidotes are worth keeping nearby.",
  ],
  oracle: [
    "Gutter oracle",
    "It reads the future in puddles of ink, though the future seldom says anything kind.",
  ],
  revenant: [
    "Chainbound revenant",
    "A warder dragged back by the weight of its own keys. Its chains make a warning before its blade does.",
  ],
  demon: [
    "Furnace devil",
    "Heat still glows beneath the ash. Give it time and its temper burns brighter.",
  ],
  lich: [
    "Marrow lich",
    "It hoards the names of the dead and calls them softly into the room. Do not fight its summons forever.",
  ],
  abomination: [
    "Stitched horror",
    "Several unfinished creatures share one binding. Cutting the stitches may free something smaller.",
  ],
  pageeater: [
    "Page eater",
    "A heavy jaw made for chewing through whole histories. Its thick hide turns glancing blows.",
  ],
  moth: [
    "Tallow moth",
    "A little cellar moth with a terrible appetite for candlelight. More startling than sturdy.",
  ],
  rustmite: [
    "Rust mite",
    "It wears a shell of stolen iron flakes. Repeated small attacks scrape against that armour.",
  ],
  sporepilgrim: [
    "Spore pilgrim",
    "A walking mushroom that leaves violet dust in its wake. The smell is sweet; the poison is not.",
  ],
  mirrorhound: [
    "Mirror hound",
    "An echo that learned to bite. A broken reflection can still have teeth.",
  ],
  ashcolossus: [
    "Ash colossus",
    "The old furnace walked away from its foundations. A slow wall of ash and heat.",
  ],
  pursuer: [
    "The Unwritten",
    "An unfinished shape follows the turning pages. A live floor trap can finish what its author did not.",
  ],
  mimic: [
    "Hungry chest",
    "The hinges are jaws. The lock is an eye. It practised sitting very still.",
  ],
  smudger: [
    "Graphite gaoler",
    "A jailer drawn with too much pencil. It smothers marks on your reels: roll an affected hero to erase them.",
  ],
  zombie: [
    "Returned adventurer",
    "Sometimes a buried name crawls back between the pages. This is a memory wearing a body, not a companion restored.",
  ],
  fighter: [
    "Hostile tank",
    "An adventurer who has chosen steel over company. Its shield is as stubborn as its pride.",
  ],
  rogue: [
    "Hostile rogue",
    "Quick hands, a quiet blade, and an invitation refused. Watch the little bottle at its belt.",
  ],
  mage: [
    "Hostile mage",
    "Another student of the margins. Its spellbook has room for only one side of this argument.",
  ],
  ranger: [
    "Hostile ranger",
    "A lone archer keeps the passage. Patience is part of the weapon.",
  ],
  berserker: [
    "Hostile berserker",
    "Pain sharpens its purpose. A wounded berserker is never a harmless one.",
  ],
};
ENEMY_PROFILES.smudger = {
  name: "Graphite gaoler",
  minDepth: 6,
  maxDepth: 10,
  hp: 1.15,
  trait: "blackout",
  faces: [
    ["attack", 1],
    ["attack", 2],
    ["magic", 1],
    ["block", 1],
    ["stun", 1],
    ["miss", 1],
  ],
};
for (const [id, def] of Object.entries(BIOME_ENEMIES))
  SPECIES_LORE[id] = [def.name, def.lore];
const BESTIARY_ENTRIES = Object.entries(SPECIES_LORE).map(
  ([art, [name, lore]]) => ({ id: art, art, name, lore }),
);
for (let depth = 1; depth <= 10; depth++) {
  const boss = stairBossType(depth);
  BESTIARY_ENTRIES.push({
    id: "boss-" + depth,
    art: boss.art,
    name: boss.name,
    depth,
    lore: `Guardian of floor ${depth}. ${SPECIES_LORE[boss.art]?.[1] || "It keeps the next page shut."} ${depth === 10 ? "The final guardian rolls three top-tier strikes. Bring a well-built party." : "Defeat it to open the way down."}`,
  });
}
function readBestiary() {
  try {
    const data = JSON.parse(localStorage.getItem(BESTIARY_KEY) || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}
function bestiaryId(e) {
  return e.boss && e.stairBossDepth ? "boss-" + e.stairBossDepth : e.art;
}
function rememberEnemy(e, { defeated = false } = {}) {
  if (e.boss && !e.stairBossDepth && state.encounterReward?.stairBoss)
    e.stairBossDepth = state.depth;
  if (!defeated && e.journalSeen) return;
  const id = bestiaryId(e);
  if (!BESTIARY_ENTRIES.some((entry) => entry.id === id)) return;
  const book = readBestiary(),
    old = book[id] || {},
    encounters = Array.isArray(old.encounters) ? old.encounters : [],
    defeats = Array.isArray(old.defeats) ? old.defeats : [],
    alreadySeen = encounters.includes(e.id),
    alreadyDefeated = defeats.includes(e.id);
  book[id] = {
    seen: Math.max(1, (old.seen || 0) + (defeated || alreadySeen ? 0 : 1)),
    defeated: (old.defeated || 0) + (defeated && !alreadyDefeated ? 1 : 0),
    encounters: [...new Set([...encounters, e.id])].slice(-256),
    defeats: defeated ? [...new Set([...defeats, e.id])].slice(-256) : defeats,
    depth: state.depth,
    hp: e.maxHp,
    damage: e.damage,
    frequency: e.frequency,
    strikes: e.strikes,
    passive: e.passive?.key || null,
  };
  try {
    localStorage.setItem(BESTIARY_KEY, JSON.stringify(book));
    e.journalSeen = true;
  } catch (error) {
    console.warn("Bestiary could not be saved:", error.message);
  }
}
function recordBestiaryDefeat(e) {
  if (e.bestiaryDeathRecorded) return;
  e.bestiaryDeathRecorded = true;
  rememberEnemy(e, { defeated: true });
}
function chooseReturnedHero(depth) {
  if (depth < 2) return null;
  const lost = (state.graveyard || []).filter(
    (h) => h.depth < depth && !h.returnedAsZombie,
  );
  if (!lost.length || Math.random() >= ENCOUNTER_TUNING.returnedHeroChance)
    return null;
  const hero = pick(lost);
  hero.returnedAsZombie = true;
  return hero;
}
let bestiaryPageIndex = 0;
function bestiaryPage(index = bestiaryPageIndex) {
  bestiaryPageIndex = Math.max(
    0,
    Math.min(BESTIARY_ENTRIES.length - 1, Number(index) || 0),
  );
  const book = readBestiary(),
    entry = BESTIARY_ENTRIES[bestiaryPageIndex],
    record = book[entry.id],
    known = !!record;
  const specimen = {
    id: "enemy-bestiary-" + entry.id,
    art: entry.art,
    name: entry.name,
    baseName: entry.name,
    hp: 1,
    maxHp: 1,
    boss: !!entry.depth,
    stairBossDepth: entry.depth,
  };
  applyEnemyPresentation(specimen);
  openModal(
    "The dungeon bestiary",
    `<section class="bestiary-page"><nav class="guide-navigation" aria-label="Bestiary entries"><label>Entry<select id="bestiary-select">${BESTIARY_ENTRIES.map((e, i) => `<option value="${i}" ${i === bestiaryPageIndex ? "selected" : ""}>${String(i + 1).padStart(2, "0")} · ${book[e.id] ? applyEnemyPresentation({ art: e.art, name: e.name, boss: !!e.depth, stairBossDepth: e.depth }).name : "Unknown"}</option>`).join("")}</select></label><button id="bestiary-previous" ${bestiaryPageIndex ? "" : "disabled"}>← Previous</button><button id="bestiary-next" ${bestiaryPageIndex < BESTIARY_ENTRIES.length - 1 ? "" : "disabled"}>Next →</button></nav><article class="bestiary-record ${known ? "known" : "unknown"}"><button id="bestiary-cry" ${known ? "" : "disabled"} aria-label="${known ? "Hear " + escapeHTML(specimen.name) : "Unknown creature"}">${known ? portraitArt(entry.art, specimen) : icon("question")}</button><div><h3>${known ? specimen.name : "An unwritten creature"}</h3><p>${known ? entry.lore : "Meet this creature in the dungeon to fill this page."}</p>${known ? `<dl class="bestiary-stats"><dt>Floor</dt><dd>Floor ${record.depth}</dd><dt>Health</dt><dd>${record.hp} HP</dd><dt>Strength</dt><dd>${record.damage}</dd><dt>Attacks</dt><dd>${record.strikes} strike${record.strikes === 1 ? "" : "s"} every ${record.frequency} spins</dd><dt>Passive</dt><dd>${ENEMY_TRAITS[record.passive]?.name || "None observed"}</dd><dt>Met / slain</dt><dd>${record.seen} / ${record.defeated}</dd></dl><small>Stats vary by floor and elite status. Click the sketch to hear its cry.</small>` : ""}</div></article><div class="guide-page-count">${bestiaryPageIndex + 1} / ${BESTIARY_ENTRIES.length} · ${Object.keys(book).filter((id) => BESTIARY_ENTRIES.some((e) => e.id === id)).length} discovered</div></section><div class="modal-actions"><button data-close class="primary">Close the bestiary</button></div>`,
    "bestiary",
  );
  $("#bestiary-select").onchange = (e) => bestiaryPage(e.target.value);
  $("#bestiary-previous").onclick = () => {
    bestiaryPage(bestiaryPageIndex - 1);
    $("#bestiary-previous").focus();
  };
  $("#bestiary-next").onclick = () => {
    bestiaryPage(bestiaryPageIndex + 1);
    $("#bestiary-next").focus();
  };
  $("#bestiary-cry").onclick = async () => {
    await GameSound.unlock();
    enemyCry(specimen, "appear");
    portraitMotion($("#bestiary-cry"), "talk");
  };
}
