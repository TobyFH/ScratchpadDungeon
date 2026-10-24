// Battle-only state and decisions. Presentation never determines an outcome.
const TACTICS = Object.freeze({
  initiativeSolo: 0.18,
  initiativePerAlly: 0.08,
  initiativeMultiplier: 1.25,
  surpriseChance: 0.18,
  surprisePerHero: 0.48,
  poisonTurns: 3,
  poisonMaxDamage: 8,
  vulnerabilityBonus: 0.25,
});
function entityArt(entity) {
  const i = state.party.indexOf(entity);
  return i >= 0 ? $("#portrait-" + i) : enemyArtEl(entity);
}
function gainFury(h, damage = 0, extra = 0) {
  if (h?.job !== "berserker" || !state.enemy || !alive(h)) return;
  const before = h.fury || 0;
  h.fury = Math.min(
    BERSERKER_FURY_CAP,
    before + Math.ceil(damage * 1.5) + extra,
  );
  if (h.fury > before) {
    burst(entityArt(h), "damage", 14);
    actionLabel(entityArt(h), `FURY +${h.fury - before}`);
    syncRangerAim(h);
  }
}
const furyBonus = (h) =>
  h?.job === "berserker" ? Math.floor((h.fury || 0) / 4) : 0;
function furyMarkup(h) {
  return `<span class="fury-meter" role="meter" aria-label="Berserker Fury" aria-valuemin="0" aria-valuemax="20" aria-valuenow="${h.fury || 0}" data-tooltip="Wounds feed Fury: 1.5 per HP lost. Every 4 Fury adds 1 damage, up to +5. Blood Price grants extra Fury. Clears after battle."><b>FURY ${h.fury || 0}/20</b><span><i style="width:${(h.fury || 0) * 5}%"></i></span><small>+${furyBonus(h)} damage</small></span>`;
}
function setupBattleOpening({ fresh = false } = {}) {
  const living = state.party.filter(alive);
  state.opening = { pending: true, firstRoll: true, resolved: false };
  living.forEach((h) => {
    h.surprised = false;
    h.initiative = null;
  });
  if (fresh && Math.random() < TACTICS.surpriseChance) {
    living.forEach(
      (h) => (h.surprised = Math.random() < TACTICS.surprisePerHero),
    );
    if (!living.some((h) => h.surprised)) pick(living).surprised = true;
    state.opening.surprise = true;
  }
  const ready = living.filter((h) => !h.surprised);
  if (
    ready.length &&
    Math.random() <
      TACTICS.initiativeSolo + (living.length - 1) * TACTICS.initiativePerAlly
  ) {
    pick(ready).initiative = { multiplier: TACTICS.initiativeMultiplier };
  }
  for (const e of livingEnemies()) planEnemyIntent(e);
}
function openingEligible(h) {
  return !state.opening?.firstRoll || !h.surprised;
}
function finishOpeningRoll() {
  if (!state.opening) return;
  state.opening.firstRoll = false;
  state.opening.pending = false;
  state.party.forEach((h) => {
    h.surprised = false;
    h.initiative = null;
  });
}
async function resolveBattleOpening() {
  if (!state.opening || state.opening.resolved) return;
  state.opening.resolved = true;
  const living = state.party.filter(alive);
  if (living.length && living.every((h) => h.surprised)) {
    result(icon("stun") + "Caught off guard · enemies take the opening turn!");
    combatCallout($("#encounter"), "ENEMIES GO FIRST", "danger");
    for (const e of livingEnemies()) {
      await enemyTurn(e);
      await processDeaths();
      if (checkDefeat()) break;
      e.countdown = e.frequency;
    }
    finishOpeningRoll();
  } else {
    const quick = living.find((h) => h.initiative);
    if (quick)
      combatCallout(entityArt(quick), `${quick.name}: INITIATIVE +25%`, "gold");
    living
      .filter((h) => h.surprised)
      .forEach((h) => actionLabel(entityArt(h), "SURPRISED · wait one roll"));
  }
  syncStatusFX();
}
function planEnemyIntent(e) {
  const living = state.party.filter(alive);
  if (!living.length || !e || e.hp <= 0) return;
  const faces = e.reels.flat(),
    has = (t) => faces.some((f) => f.type === t);
  const weakest = [...living].sort((a, b) => a.hp - b.hp)[0];
  let goal = "attack",
    target = pick(living);
  if (e.hp < e.maxHp * 0.45 && has("heal")) goal = "heal";
  else if (weakest.hp <= e.damage * e.strikes * 1.5) {
    goal = "finish";
    target = weakest;
  } else if (
    has("stun") &&
    state.block < 5 &&
    !target.stun &&
    e.turnsTaken % 3 === 1
  )
    goal = "stun";
  else if (has("poison") && !target.poison && !has("attack") && !has("magic"))
    goal = "poison";
  else if (has("block") && !has("attack") && !has("magic")) goal = "block";
  e.intent = { goal, targetId: target.id };
}
function enemyIntent(e) {
  if (e.hp <= 0) return "Defeated";
  if (e.stun) return "Stunned · will miss its turn";
  if (!e.intent) return "Watching the party · roll decides";
  const target =
    state.party.find((h) => h.id === e.intent.targetId && alive(h)) ||
    state.party.find(alive);
  return (
    {
      heal: "Seeking a healing roll",
      block: "Seeking shared protection",
      attack: `Hunting ${target?.name || "the party"}`,
      finish: `Trying to finish ${target?.name || "a wounded hero"}`,
      stun: `Trying to stun ${target?.name || "a hero"}`,
      poison: `Poison aimed at ${target?.name || "the party"}`,
    }[e.intent.goal] || "Watching the party"
  );
}
function vulnerableDamage(entity, amount) {
  if (
    !entity.vulnerable ||
    amount <= 0 ||
    entity.vulnerable.createdAction >= state.actionSerial
  )
    return amount;
  const total = Math.ceil(amount * (1 + TACTICS.vulnerabilityBonus));
  entity.vulnerable = null;
  combatCallout(entityArt(entity), "VULNERABLE HIT!", "danger");
  return total;
}
function maybeVulnerable(entity, power = 1, cause = "Stun") {
  if (!entity || entity.hp <= 0 || entity.vulnerable) return false;
  const chance =
    cause === "Magic"
      ? Math.min(0.45, 0.18 + power * 0.035)
      : Math.min(0.65, 0.25 + power * 0.055);
  if (Math.random() >= chance) return false;
  entity.vulnerable = {
    createdAction: state.actionSerial,
    bonus: TACTICS.vulnerabilityBonus,
  };
  combatCallout(entityArt(entity), "VULNERABLE · +25% next hit", "danger");
  syncStatusFX();
  return true;
}
function clearStuns(entity, amount, { all = false } = {}) {
  if (!entity?.stun) return false;
  const guard = state.party.includes(entity) ? state.block : enemyBlock();
  if (!all && Math.random() >= amount / (amount + guard + 4)) return false;
  entity.stun = 0;
  entity.stunGrace = 1;
  combatCallout(entityArt(entity), "STUN CLEARED", "heal");
  return true;
}
function clearBattleStatuses() {
  for (const entity of [...state.party, ...battleEnemies()]) {
    entity.rage = 0;
    entity.charge = 0;
    entity.fury = 0;
    entity.stimulant = null;
    entity.poison = null;
    entity.stun = 0;
    entity.stunGrace = 0;
    entity.vulnerable = null;
    entity.initiative = null;
    entity.surprised = false;
  }
  state.opening = null;
  state.invulnerable = null;
  state.party.forEach((h, i) => syncHero(i));
  syncEnemy();
  syncStatusFX();
}
function applyPoison(entity, amount, source = null, { damage = 1 } = {}) {
  if (entity.hp <= 0 || !amount) return;
  const old = entity.poison,
    added = Math.max(
      1,
      1 + Math.ceil(amount) + traitBonus(source, "poisonDuration"),
    );
  const duration = Math.min(TACTICS.poisonTurns, (old?.turns || 0) + added);
  const overflow =
    (old?.overflow || 0) +
    Math.max(0, (old?.turns || 0) + added - TACTICS.poisonTurns);
  entity.poison = {
    turns: duration,
    damage: Math.min(
      TACTICS.poisonMaxDamage,
      Math.max(old?.damage || 1, damage) + Math.floor(overflow / 3),
    ),
    overflow: overflow % 3,
    ticks: old?.ticks || 0,
    sourceId: source?.id || old?.sourceId || null,
    sourceName: source?.name || old?.sourceName || "Poison",
    appliedAt: old ? old.appliedAt : state.actionSerial,
  };
  const i = state.party.indexOf(entity);
  if (i >= 0) partyCardFeedback(i, "poison");
  burst(entityArt(entity), "poison", 22);
  actionLabel(
    entityArt(entity),
    `POISON ${entity.poison.damage}/tick · ${duration} turns`,
  );
  syncStatusFX();
}
async function tickPoison() {
  for (const entity of [...state.party.filter(alive), ...livingEnemies()]) {
    const poison = entity.poison;
    if (!poison || poison.appliedAt >= state.actionSerial) continue;
    poison.turns--;
    poison.ticks = (poison.ticks || 0) + 1;
    const hero = state.party.indexOf(entity),
      source =
        state.party.find((h) => h.id === poison.sourceId) ||
        state.graveyard.find((h) => h.id === poison.sourceId);
    if (hero >= 0)
      damageHero(hero, poison.damage, "Poison from " + poison.sourceName, {
        piercing: true,
      });
    else {
      const n = damageEnemy(
        poison.damage,
        "Poison from " + poison.sourceName,
        entity,
        { piercing: true },
      );
      if (source) {
        source.stats.damageDealt += n;
        if (entity.hp === 0) {
          source.stats.kills++;
          if (source.battleMemo) source.battleMemo.poisonKills++;
        }
        if (source.death) {
          source.death.stats.damageDealt += n;
          if (entity.hp === 0) source.death.stats.kills++;
        }
      }
    }
    if (!poison.turns || entity.hp <= 0) entity.poison = null;
    await pause(100);
  }
  await processDeaths();
  syncStatusFX();
}
function stunResolution(power, block) {
  const spent = Math.min(block, 6 * Math.max(1, power));
  if (!block) return { spent, applied: true };
  const chance =
    power < 2
      ? 0
      : Math.min(
          0.9,
          0.08 * (power - 1) +
            (power >= 3 ? 0.45 * Math.max(0, 1 - block / (6 * power)) : 0),
        );
  return { spent, applied: chance > 0 && Math.random() < chance };
}
function stunHero(i, power) {
  const h = state.party[i];
  if (!alive(h)) return "no living target";
  if (h.stunGrace) return h.name + " resists a repeated stun";
  const hit = stunResolution(power, state.block);
  if (hit.spent) {
    state.block -= hit.spent;
    h.stats ??= emptyStats();
    h.stats.damageBlocked += hit.spent;
    renderBlock();
    armourFX(hit.spent, hit.applied ? "STUN BREAKS THROUGH" : "STUN BLOCKED");
  }
  if (!hit.applied) {
    shieldedFX(entityArt(h));
    return `${h.name} protected from stun (−${hit.spent} armour)`;
  }
  h.stun = 1;
  maybeVulnerable(h, power, "Stun");
  syncHero(i);
  combatCallout(entityArt(h), "STUNNED · miss one roll", "danger");
  log(`${h.name} is stunned. The missed roll leaves enemy clocks unchanged.`);
  return h.name + " stunned";
}
function stunEnemy(power, e = state.enemy) {
  const hit = stunResolution(power, enemyBlock());
  setEnemyBlock(enemyBlock() - hit.spent);
  if (!hit.applied) {
    shieldedFX(enemyArtEl(e));
    return `stun blocked · −${hit.spent} enemy armour`;
  }
  const newly = !e.stun;
  e.stun = 1;
  if (
    newly &&
    state.currentHero != null &&
    state.party[state.currentHero]?.battleMemo
  )
    state.party[state.currentHero].battleMemo.stuns++;
  maybeVulnerable(e, power, "Stun");
  combatCallout(
    enemyArtEl(e),
    hit.spent ? "STUN BREAKS THROUGH!" : "STUNNED",
    "gold",
  );
  log(`${e.name} is stunned and will miss one attack turn.`);
  return "one enemy turn stunned";
}

function resonanceEffects(h, role) {
  return {
    magic: { magic: 4 + Math.floor(h.level / 2) },
    heal: { teamHeal: 3 + Math.ceil(h.level / 2) },
    block: { block: 4 + Math.floor(h.level / 3) },
    poison: { poison: 2 + Math.floor(h.level / 3) },
  }[role];
}
function enemyShieldEl(e = state.enemy) {
  return $(
    battleEnemies().indexOf(e) > 0
      ? "#enemy-team-block-2"
      : "#enemy-team-block",
  );
}
function canEquipGear(h, gear) {
  return !!h && !!gear && (!gear.job || gear.job === h.job);
}
function equipmentScope(item) {
  return item?.equipment
    ? item.job
      ? className(item.job) + " ONLY"
      : "ALL CLASSES"
    : "";
}
async function confirmShopOverflow(type, price) {
  const overlay = $("#overlay");
  overlay.hidden = true;
  showSpotlight(
    "Your bag is full",
    `${ITEM_DEFS[type].name} · ${price} gold`,
    `<div class="incoming-item">${icon(ITEM_DEFS[type].icon)}<b>${ITEM_DEFS[type].name}</b><p>${ITEM_DEFS[type].description}</p></div><div class="stage-result">All three pockets hold different item types.<br>If you buy this, choose a stack to discard or use an item.<br><b>No gold has been spent.</b></div>`,
    "shop-bag-warning",
  );
  const choice = await eventChoice([
    {
      id: "stage-confirm",
      label: `Buy for ${price} gold · make room next`,
      value: true,
    },
    { id: "shop-cancel", label: "Cancel · keep my gold", value: false },
  ]);
  closeSpotlight();
  overlay.hidden = false;
  return choice === "true";
}

async function resumeOpeningEncounter() {
  if (!state.enemy || !state.opening || state.opening.resolved || state.over)
    return;
  busy = true;
  render();
  try {
    await encounterEntrance();
  } finally {
    busy = false;
    render();
    save();
  }
}

function normaliseTacticalStatuses(entity) {
  entity.vulnerable ??= null;
  entity.surprised ??= false;
  entity.initiative ??= null;
  entity.fury = Math.min(BERSERKER_FURY_CAP, Math.max(0, entity.fury || 0));
  if (entity.poison) {
    const excess = Math.max(0, entity.poison.turns - TACTICS.poisonTurns);
    entity.poison.damage = Math.min(
      TACTICS.poisonMaxDamage,
      (entity.poison.damage || 1) + Math.floor(excess / 3),
    );
    entity.poison.turns = Math.min(TACTICS.poisonTurns, entity.poison.turns);
    entity.poison.overflow = ((entity.poison.overflow || 0) + excess) % 3;
  }
}
