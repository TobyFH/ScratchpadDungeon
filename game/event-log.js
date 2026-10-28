// One journal, separate presentation metadata. Keep legacy state.logs strings for
// old saves/tools; snapshot explanations alongside them, never HTML or live hero
// references. Categories are recorded now so future split views need no new hooks.
const EVENT_LOG_LIMIT = 60;
const CHARACTER_EVENT_HELP = Object.freeze({
  heroic: "A would-be lethal hit leaves this hero at 1 HP instead.",
  ironWill: "This incoming stun is shrugged off before it takes hold.",
  parry: "The incoming hit is halved, rounded up, with at least 1 damage remaining.",
  rally: "A wounded companion receives 3 HP plus 1 per three hero levels.",
  inspired: "The strongest useful effect in this roll gains 20%, rounded up (at least +1).",
  scavenger: "Finds 3 gold plus 2 per floor, added to carried gold.",
  breath: "Recovers 5% of maximum HP, rounded up, with a minimum of 2 HP.",
  footing: "This trap's damage is halved, rounded up, with at least 1 damage remaining.",
  insight: "Gains one personal point to spend on reel edits.",
  scout: "Reveals one hidden neighbouring discovery without activating it.",
});
const WILDCARD_LOG_EVENTS = Object.freeze([
  { name: "INK IN THE GEARS", description: "The Jester covers an enemy reel in ink. It counts as empty for one roll, then clears." },
  { name: "GILDED REEL", description: "One ally reel gains a rank on its ordinary marks for two rolls. The gift clears after battle." },
  { name: "TURNED TABLES!", description: "Rolls an enemy machine against its own side. Damage hits that enemy; any rolled healing helps your wounded party instead." },
  { name: "PIE FIGHT!", description: "Strikes every enemy. Stray pies also deal at most 1 HP to each ally, but cannot kill them." },
  { name: "MERCY IN CONFETTI", description: "Heals the whole party. Each surviving enemy may also recover 1 HP." },
  { name: "PICK A CARD!", description: "Deals spell damage to one enemy and heals a random living ally." },
]);
const EVENT_LOG_TERMS = Object.freeze({
  "Cave room": "Revealing one room tile uncovers the connected room and its discoveries. Revealed discoveries are not activated until visited.",
  "Gold": "Carried gold buys shop supplies. Bank it after clearing a floor to keep it between expeditions.",
  "Treasure": "A chest rolls gold and possible supplies or artefacts. Three matching symbols trigger a critical reward.",
  "Battle spoils": "Loot rolled after a won battle. Gold is added to your purse; supplies may need space in the satchel.",
  "Beacon": "Reveals neighbouring tiles, including diagonals and sometimes a few beyond. Stone blocks its sight; discoveries remain unactivated.",
  "Mushroom light": "Lights connected nearby mushroom tiles, revealing up to eight more without triggering discoveries.",
  "Lava": "Impassable terrain whose glow reveals nearby stone. Walls block the light.",
  "Stairs": "Select the staircase to face its guardian or descend after victory. You can keep exploring first.",
  "Stalactite": "Loose ceiling stone falls when its footstep countdown runs out, then resets. It can damage the party or crush the Unwritten.",
  "Forgotten traveller": "An abandoned satchel can hold loot. Searching it does not harm the party; you can also leave it undisturbed.",
  "Rage": "Adds physical damage and a little damage resistance until battle ends.",
  "Stored Execute": "Other party actions and enemy turns build Ranger patience. The next damaging roll consumes it for a separate, capped hit, stronger against wounded enemies. The Execute class seal amplifies that stored bonus.",
  "Fury lifesteal": "Stored Berserker Fury converts part of actual damage dealt into healing. Every HP actually restored spends Fury.",
  "Self-destruct": "The creature explodes after its fuse burns down, damaging each surviving hero and destroying itself. Shared block and Unbroken page can protect the team.",
  "Blood Price": "Berserker-only mark. Pay a little health without dying; higher ranks pay more and build more Fury per HP spent. All healing spends Fury.",
  "Fury": "Berserker wounds build charge. Blood Price builds it faster; all healing spends charge. Stored Fury adds physical damage and lifesteal.",
  "Self stimulant": "Buffs the caster’s damage and resistance for at most three own actions. Further doses increase potency instead of extending a long duration.",
  "Trick": "Builds Jester anticipation. At six, Punchline fires six ordinary marks from the hero’s own reels.",
  "Elite": "An empowered enemy with an added affix and sometimes a passive ability. Core stats and rewards are stronger than the ordinary version.",
  "Boss": "A powerful staircase guardian with an elite affix. Defeat it before descending; the tenth guardian ends the run.",
  "Rockfall": "Falling stone can hurt the party and block a passage. A safe route to the stairs is preserved.",
  "Ambush": "A wandering foe can surprise you in an old explored passage. Tiles age by move commands, not time spent reading or fighting.",
  "Surprised": "Cannot make the first party roll. If the whole party is surprised, enemies act first.",
  "Initiative": "The first roll gains 25% to its effects if this hero acts first. Choosing another hero loses the bonus.",
  "Vulnerable": "The next damaging hit after the exposing action deals 25% more HP damage. Healing does not consume this effect.",
  "Poison": "Deals damage over several actions. Further doses increase potency once three turns are loaded. Clears at battle end.",
  "Stunned": "Cannot act until recovery. Other rolls help recovery: 60%, then guaranteed. If nobody can act, one missed turn advances enemy clocks.",
  "Stun": "Stops an action until recovery; shields can resist it. Recovery grants two own actions of stun protection.",
  "Steady": "Protected from stun for two own completed actions after recovering. Further stuns cannot immediately lock this character again.",
  "Stimulant": "A short damage and resistance buff. Lasts at most three actions; extra doses strengthen it instead. Clears after battle.",
  "Ally stimulant": "Applies stimulant to the selected living ally, even at full health; falls back to the caster if needed.",
  "Team block": "Shared protection absorbs incoming damage and is consumed as it protects. It has a party-size cap and clears after battle.",
  "Critical": "Three matching marks trigger a multiplier roll. The increased effects are applied to the original roll.",
  "Punchline": "A full Jester anticipation bar fires six ordinary marks from that hero's reels. The burst cannot crit, reroll or refill itself.",
  "Healing fountain": "Rolls a healing amount for each surviving hero, with a base maximum-health contribution that grows with depth. Matching marks can crit. Unused wells can be saved for later.",
  "Fountain": "An optional, single-use team heal. Declining leaves it available; it cannot revive the dead.",
  "Crystal seals": "Nearby crystals seal two random party reels every three party rolls. Sealed reels count as empty; rolling the affected hero cracks the gems.",
  "Nearby crystals": "Nearby crystals seal two random party reels every three party rolls. Rolling an affected hero cracks the gems.",
  "Ruins": "An optional roll that trades the risk of trap damage for loot.",
  "Tunnel": "An optional passage to its paired tile. Both ends stay open after use.",
});
function eventLogDictionary() {
  const terms = Object.entries(EVENT_LOG_TERMS).map(([name, description]) => ({ name, description }));
  terms.push(...WILDCARD_LOG_EVENTS);
  for (const def of Object.values(BIOME_DISCOVERIES)) terms.push({name:def.name,description:def.description});
  for (const [name,description] of Object.entries({"Poison mushrooms":"Crossing these caps releases damaging spores every time.","Burstcap":"Explodes within one tile, then becomes an ordinary mushroom. A reel roll decides the damage.","Brittle ice":"Slides, then collapses into an impassable hole after you leave.","Self heal":"Heals the caster only. It never retargets or spills into another hero."})) terms.push({name,description});
  for (const def of Object.values(TRAVEL_EVENTS))
    terms.push({ name: def.title, description: def.subtitle + (def.reward === "item" ? " Trade gold for the offered supply, or leave without spending." : " Roll for gold and possible finds, with a risk of injury; leaving is free.") });
  for (const [id, def] of Object.entries(CHARACTER_EVENTS))
    terms.push({ name: def.name, description: CHARACTER_EVENT_HELP[id] });
  for (const def of Object.values(HERO_TRAITS))
    terms.push({ name: def.name, description: def.description });
  for (const def of Object.values(ENEMY_TRAITS))
    terms.push({ name: def.name, description: def.description });
  for (const def of Object.values(CLASS_COMBOS))
    terms.push({ name: def.name, description: def.hint });
  for (const h of state.party)
    terms.push({ name: classAbilityName(h), description: classAbilityDescription(h) });
  for (const def of Object.values(ITEM_DEFS))
    terms.push({ name: def.name, description: def.description });
  return terms;
}
function eventLogAnnotations(text, explicit = [], dictionary = eventLogDictionary()) {
  const candidates = [], used = new Set();
  // Explicit explanations win, including an earned trait's reason at that moment.
  for (const term of [...explicit, ...dictionary]) {
    if (!term || typeof term.name !== "string" || !term.name || typeof term.description !== "string" || !term.description) continue;
    const key = term.name.toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    const pattern = term.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(pattern, "giu");
    for (const match of text.matchAll(regex)) {
      const start = match.index, end = start + match[0].length;
      // Whole words only: do not underline 'stun' inside 'stunned'.
      if ((start && /[\p{L}\p{N}_]/u.test(text[start - 1])) || /[\p{L}\p{N}_]/u.test(text[end] || "")) continue;
      candidates.push({ start, end, description: term.description, kind: term.kind === "gold" || key === "gold" ? "gold" : "event" });
    }
  }
  candidates.sort((a, b) => a.start - b.start || b.end - a.end);
  const result = [];
  let end = 0;
  for (const term of candidates) {
    if (term.start < end) continue;
    result.push(term);
    end = term.end;
  }
  return result;
}
function log(msg, options = {}) {
  const text = String(msg), record = {
    text,
    category: options.category || (state.enemy ? "combat" : "exploration"),
    context: options.context || (state.enemy ? "combat" : "exploration"),
    label: typeof options.label === "string" ? options.label : null,
    terms: eventLogAnnotations(text, options.terms || []),
    important: !!options.important,
  };
  if (groupedCombatLog && groupedCombatLog.run === state) {
    groupedCombatLog.entries.push(text);
    if (options.inline) (groupedCombatLog.inlineEvents ??= []).push(record);
    else if (record.important) (groupedCombatLog.eventEntries ??= []).push(record);
    return;
  }
  // Discard mismatched metadata if a legacy save/tool replaced the string log.
  state.logDetails = (state.logs || []).map((text, i) => state.logDetails?.[i]?.text === text ? state.logDetails[i] : null);
  record.id = state.logSerial = (Number.isSafeInteger(state.logSerial) ? state.logSerial : 0) + 1;
  state.logs.unshift(text);
  state.logs = state.logs.slice(0, EVENT_LOG_LIMIT);
  state.logDetails.unshift(record);
  state.logDetails = state.logDetails.slice(0, EVENT_LOG_LIMIT);
  renderLog();
}
function logCombatSummary(group, message) {
  const inline = group.inlineEvents || [];
  const names = [...new Set(inline.map((r) => r.label || r.text))];
  const h = state.party.find((h) => h.id === group.heroId) || state.party.find((h) => h.name === group.hero);
  log(message + (names.length ? " " + names.join(" · ") + "." : ""), {
    category: "combat", context: "combat",
    terms: h ? [{ name: classAbilityName(h), description: classAbilityDescription(h) }] : [],
  });
  if (group.previous) (group.previous.inlineEvents ??= []).push(...inline);
}
function flushCombatLogEvents(group) {
  const records = group.eventEntries || [], texts = new Set(records.map((r) => r.text));
  // Named personal/trait/status events must survive every level of nested bursts.
  for (const record of records) log(record.text, {
    category: record.category, context: record.context, important: true,
    terms: record.terms.map((t) => ({ name: record.text.slice(t.start, t.end), description: t.description, kind: t.kind })),
  });
  group.entries.filter((s) => !texts.has(s) && /second wind|summon|splits|falls|dies|becomes|refuses to fall|shrugs off|turns aside/i.test(s)).slice(0, 3).forEach((s) => log(s));
}
let lastEventLogRender = null;
function renderLog() {
  const textSignature = JSON.stringify(state.logs);
  if (lastEventLogRender?.textSignature === textSignature && lastEventLogRender?.logs === state.logs && lastEventLogRender?.details === state.logDetails && lastEventLogRender?.count === state.logs.length) return;
  const root = $("#log"), dictionary = eventLogDictionary(), scroll = root.scrollTop;
  const focused = root.contains(document.activeElement) ? document.activeElement : null;
  const focusId = focused?.closest("li")?.dataset.logId, focusTerm = focused?.dataset.logTerm;
  // A rerender must not leave a detached entry's tooltip floating over the book.
  if (focused || root.matches(":hover")) document.getElementById("status-tooltip")?.setAttribute("hidden", "");
  root.innerHTML = (state.logs || []).map((text, i) => {
    text = String(text);
    const detail = state.logDetails?.[i]?.text === text ? state.logDetails[i] : null;
    const terms = Array.isArray(detail?.terms) ? detail.terms : eventLogAnnotations(text, [], dictionary);
    let cursor = 0, html = "";
    for (const t of terms) {
      // Treat saved records as untrusted input; never render stored HTML/offsets.
      if (!t || typeof t !== "object" || !Number.isInteger(t.start) || !Number.isInteger(t.end) || t.start < cursor || t.end <= t.start || t.end > text.length || typeof t.description !== "string") continue;
      html += escapeHTML(text.slice(cursor, t.start));
      html += `<span class="log-term log-term-${feedbackKind(text.slice(t.start,t.end),"event")}${t.kind === "gold" ? " log-term-gold" : ""}" tabindex="0" data-log-term="${t.start}" aria-describedby="status-tooltip" data-tooltip="${escapeHTML(t.description)}" title="${escapeHTML(t.description)}">${escapeHTML(text.slice(t.start, t.end))}</span>`;
      cursor = t.end;
    }
    return `<li data-log-id="${Number.isSafeInteger(detail?.id) ? detail.id : "legacy-" + i}" data-log-category="${["combat", "exploration", "personal", "trait", "loot"].includes(detail?.category) ? detail.category : "exploration"}">${html + escapeHTML(text.slice(cursor))}</li>`;
  }).join("");
  lastEventLogRender = { logs: state.logs, details: state.logDetails, count: state.logs.length, textSignature };
  root.scrollTop = scroll;
  if (focusId && focusTerm) {
    const match = [...root.querySelectorAll(".log-term")].find((el) => el.closest("li").dataset.logId === focusId && el.dataset.logTerm === focusTerm);
    (match || root).focus({ preventScroll: true });
  }
}
// Ignore distant environmental churn and hidden tiles, without exposing the map.
// Chebyshev range matches the immediate visual neighbourhood; walls occlude it.
function relevantLogTile(i) {
  return !!state.map[i]?.seen && tileDistance(i) <= 2 && lineOfSight(state.position, i);
}
