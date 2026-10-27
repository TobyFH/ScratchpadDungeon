// Rare personal moments have their own saved PRNG stream. Cosmetic randomness,
// world-generation rolls and repeated renders cannot reroll a character's luck.
const CHARACTER_EVENTS = Object.freeze({
  heroic: {
    name: "HEROIC!",
    context: "combat",
    chance: 0.035,
    trait: "heroic",
    icon: "safe",
    kind: "recovery",
    text: "refuses to fall and holds on at 1 HP",
  },
  ironWill: {
    name: "UNSHAKEN!",
    context: "combat",
    chance: 0.055,
    trait: "focused",
    icon: "stun",
    kind: "recovery",
    text: "shrugs off the incoming stun",
  },
  parry: {
    name: "LAST-SECOND PARRY!",
    context: "combat",
    chance: 0.035,
    trait: "stoic",
    icon: "block",
    kind: "block",
    text: "turns aside half the incoming damage",
  },
  rally: {
    name: "RALLY!",
    context: "combat",
    chance: 0.03,
    trait: "merciful",
    icon: "heal",
    kind: "heal",
    text: "finds a moment to mend a wounded companion",
  },
  inspired: {
    name: "INSPIRED!",
    context: "combat",
    chance: 0.025,
    trait: "focused",
    icon: "beacon",
    kind: "gold",
    text: "puts extra strength into this roll",
  },
  scavenger: {
    name: "A KEEN EYE",
    context: "travel",
    chance: 0.012,
    trait: "bookish",
    icon: "coin",
    kind: "gold",
    text: "spots a few overlooked coins",
  },
  breath: {
    name: "SECOND BREATH",
    context: "travel",
    chance: 0.012,
    trait: "hardy",
    icon: "heal",
    kind: "heal",
    text: "catches their breath and recovers a little health",
  },
  footing: {
    name: "SURE FOOTING",
    context: "travel",
    chance: 0.055,
    trait: "wary",
    icon: "safe",
    kind: "recovery",
    text: "slips clear of half the trap's damage",
  },
  insight: {
    name: "A LESSON LEARNED",
    context: "travel",
    chance: 0.008,
    trait: "bookish",
    icon: "point",
    kind: "gold",
    text: "finds a better way to carve their marks",
  },
  scout: {
    name: "LISTEN CLOSELY",
    context: "travel",
    chance: 0.012,
    trait: "wary",
    icon: "eye",
    kind: "recovery",
    text: "spots a hidden discovery nearby",
  },
});
function characterLuck() {
  if (!Number.isInteger(state.characterLuckSeed)) {
    let seed = 2166136261;
    for (const c of String(state.runId))
      seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    state.characterLuckSeed = seed >>> 0 || 1;
  }
  let x = state.characterLuckSeed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.characterLuckSeed = x >>> 0 || 1;
  return (state.characterLuckSeed >>> 0) / 4294967296;
}
function characterMoment(id, h) {
  const def = CHARACTER_EVENTS[id];
  if (!def || !alive(h) || state.over) return false;
  state.characterEventMemo ??= { combat: 0, lastTravel: -20 };
  const memo = state.characterEventMemo,
    combat = def.context === "combat";
  if (combat && (!state.enemy || memo.combat >= 2)) return false;
  if (!combat && (state.enemy || state.moveCommands - memo.lastTravel < 8))
    return false;
  h.momentReceipts ??= {};
  const receipt = combat
    ? String(state.encounterSerial || 0)
    : String(state.moveCommands || 0);
  if (h.momentReceipts[id] === receipt || characterLuck() >= def.chance)
    return false;
  h.momentReceipts[id] = receipt;
  if (combat) memo.combat++;
  else memo.lastTravel = state.moveCommands || 0;
  h.stats ??= emptyStats();
  h.stats.luckyMoments = (h.stats.luckyMoments || 0) + 1;
  state.characterEvents ??= [];
  state.characterEvents.push({
    id,
    heroId: h.id,
    hero: h.name,
    depth: state.depth,
    step: state.steps,
    command: state.moveCommands || 0,
    at: Date.now(),
  });
  state.characterEvents = state.characterEvents.slice(-100);
  log(`${h.name} · ${def.name}: ${def.text}${id === "scavenger" ? ` (+${3 + state.depth * 2} gold)` : ""}.`, {
    category: "personal", context: combat ? "combat" : "exploration", important: true,
    terms: [{ name: def.name, description: `${h.name} ${def.text}. ${CHARACTER_EVENT_HELP[id]}` }],
  });
  combatCallout(entityArt(h), def.name, def.kind);
  showHeroNotice(h, def.name, def.text, def.kind);
  if (id === "heroic") {
    state.pendingCharacterMoments ??= [];
    state.pendingCharacterMoments.push({heroId:h.id,title:def.name,text:def.text});
  }
  burst(
    entityArt(h),
    def.kind === "heal" ? "heal" : def.kind === "block" ? "shield" : "gold",
    22,
  );
  portraitMotion(entityArt(h), "talk");
  GameSound.play(def.kind === "heal" ? "heal" : "trait");
  if (characterLuck() < 0.12)
    grantTrait(
      h,
      def.trait,
      def.text[0].toUpperCase() + def.text.slice(1) + ".",
    );
  return true;
}
function luckyDamage(
  h,
  damage,
  { selfInflicted = false, piercing = false, source = "" } = {},
) {
  if (damage <= 0 || selfInflicted) return damage;
  if (state.enemy && !piercing && damage > 1 && characterMoment("parry", h))
    damage = Math.max(1, Math.ceil(damage / 2));
  if (
    !state.enemy &&
    /trap|rockfall|ruin|discovery/i.test(source) &&
    damage > 1 &&
    characterMoment("footing", h)
  )
    damage = Math.max(1, Math.ceil(damage / 2));
  if (state.enemy && damage >= h.hp && h.hp > 1 && characterMoment("heroic", h))
    damage = h.hp - 1;
  return damage;
}
function inspiredRoll(h, base) {
  const keys = [
    "attack",
    "magic",
    "heal",
    "teamHeal",
    "selfHeal",
    "block",
    "poison",
    "stun",
    "stimulant",
    "rally",
    "trick",
    "bash",
  ].filter((k) => base[k] > 0);
  if (keys.length && characterMoment("inspired", h)) {
    const key = keys.reduce((a, b) => (base[a] >= base[b] ? a : b));
    base[key] += Math.max(1, Math.ceil(base[key] * 0.2));
  }
  return base;
}
function rallyAfterRoll(h) {
  const ally = state.party
    .filter((a) => alive(a) && a !== h && a.hp < a.maxHp)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
  if (!ally || h.hp / h.maxHp > 0.4 || !livingEnemies().length) return;
  if (characterMoment("rally", h)) {
    const n = healHero(state.party.indexOf(ally), 3 + Math.floor(h.level / 3));
    h.stats.healingDone += n;
    beam(entityArt(h), entityArt(ally), "heal");
  }
}
function travelCharacterMoment(c, { fresh = false } = {}) {
  if (state.enemy || state.over || c.event || c.wall) return false;
  const heroes = state.party.filter(alive);
  if (!heroes.length) return false;
  const h = heroes[Math.floor(characterLuck() * heroes.length)];
  if (h.hp < h.maxHp && characterMoment("breath", h)) {
    healHero(state.party.indexOf(h), Math.max(2, Math.ceil(h.maxHp * 0.05)));
    return true;
  }
  if (!fresh) return false;
  if (characterMoment("scavenger", h)) {
    const gold = 3 + state.depth * 2;
    state.gold += gold;
    h.stats.goldFound = (h.stats.goldFound || 0) + gold;
    burst($(`[data-tile="${state.position}"]`), "coin", 14);
    GameSound.play("coin");
    return true;
  }
  if (characterMoment("insight", h)) {
    h.points++;
    return true;
  }
  const hidden = neighbors(state.position, true).filter(
    (i) => !state.map[i].seen && !state.map[i].wall && state.map[i].event,
  );
  if (hidden.length && characterMoment("scout", h)) {
    const i = hidden[Math.floor(characterLuck() * hidden.length)];
    markSeen(i);
    renderMap();
    burst($(`[data-tile="${i}"]`), "paper", 14);
    return true;
  }
  return false;
}
