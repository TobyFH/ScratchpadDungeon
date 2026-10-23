// Persistent hero builds. Shared by the editor, actual rolls and autoplay.
const SPECIALISMS = Object.freeze({
  offence: {
    name: "Offence",
    description: "+1 damage, poison and stun power on relevant rolls.",
  },
  defence: {
    name: "Defence",
    description:
      "+1 healing, shared block and stimulant power on relevant rolls.",
  },
});
const MAGE_ROLES = Object.freeze({
  magic: {
    name: "Spell damage",
    icon: "magic",
    description: "Resonance strikes every enemy with magic.",
  },
  heal: {
    name: "Healing",
    icon: "heal",
    description: "Resonance heals every living ally.",
  },
  block: {
    name: "Shields",
    icon: "block",
    description: "Resonance raises shared protection for every ally.",
  },
  poison: {
    name: "Poison",
    icon: "poison",
    description: "Resonance poisons every enemy.",
  },
});
const RANGER_AIM_CAP = 6;
const rangerAimGain = () => 1;
function mageRole(h) {
  return Object.hasOwn(MAGE_ROLES, h?.mageRole) ? h.mageRole : "magic";
}
function normaliseHeroBuild(h) {
  if (!h) return;
  if (h.job === "healer") {
    h.job = "mage";
    h.mageRole = "heal";
  }
  if (!Object.hasOwn(SPECIALISMS, h.specialism))
    h.specialism =
      Math.floor(Number(h.id) || h.name?.length || 0) % 2
        ? "offence"
        : "defence";
  if (h.job === "mage") h.mageRole = mageRole(h);
  h.charge = Math.min(RANGER_AIM_CAP, Math.max(0, h.charge || 0));
  if (!h.reels) return;
  for (const face of h.last || [])
    if (face.type === "class") {
      face.job = h.job;
      if (h.job === "mage") face.mageRole = mageRole(h);
    }
  h.reels.forEach((reel, k) => {
    let seal = false;
    for (const face of reel) {
      if (face.type !== "class") continue;
      if (k === 1 && !seal) {
        seal = true;
        face.job = h.job;
        if (h.job === "mage") face.mageRole = mageRole(h);
        face.tier = 1;
      } else {
        face.type = "blank";
        face.tier = 1;
        delete face.job;
      }
    }
    if (k === 1 && !seal)
      reel.push({
        type: "class",
        tier: 1,
        weight: 3,
        job: h.job,
        ...(h.job === "mage" ? { mageRole: mageRole(h) } : {}),
      });
  });
}
function classAbilityName(hero) {
  const job = typeof hero === "string" ? hero : hero?.job;
  return (
    {
      fighter: "RAGE",
      rogue: "FLURRY",
      mage: "RESONANCE",
      healer: "RESONANCE",
      ranger: "EXECUTE",
    }[job] || "CLASS"
  );
}
function classAbilityDescription(hero) {
  const job = typeof hero === "string" ? hero : hero?.job;
  if (job === "mage" || job === "healer")
    return typeof hero === "object"
      ? MAGE_ROLES[mageRole(hero)].description
      : "Resonance: apply your chosen healing, shield, poison or magic role to the whole appropriate side.";
  return (
    {
      fighter:
        "Rage: gain damage for the rest of this battle, with a little protection as rage builds.",
      rogue: "Flurry: roll three extra attack reels; matching blades can crit.",
      ranger:
        "Execute: wait between attacks to fill the bar. Your next damaging roll gains more damage against a wounded target; the seal strengthens that shot. Charge clears after battle.",
    }[job] || "A signature ability alongside the other two reel results."
  );
}
function temperamentEffects(h, base) {
  if (h.specialism === "offence") {
    if (base.attack) base.attack++;
    else if (base.magic) base.magic++;
    if (base.poison) base.poison++;
    if (base.stun) base.stun++;
  } else if (h.specialism === "defence") {
    if (base.heal) base.heal++;
    else if (base.teamHeal) base.teamHeal++;
    if (base.block) base.block++;
    if (base.stimulant) base.stimulant++;
  }
  return base;
}
function executionBonus(
  h,
  enemy = state.enemy,
  charge = h.charge || 0,
  seal = false,
) {
  if (!enemy || !charge) return 0;
  const missing = 1 - Math.max(0, enemy.hp) / Math.max(1, enemy.maxHp);
  return Math.ceil(
    (((2 + h.level / 2) * Math.min(RANGER_AIM_CAP, charge)) / RANGER_AIM_CAP) *
      (0.25 + 2 * missing) *
      (seal ? 1.35 : 1),
  );
}
function advanceRangerPatience(actor, attacked, seal = false) {
  for (const h of state.party.filter(alive)) {
    if (h.job !== "ranger" || (h === actor && attacked)) continue;
    h.charge = Math.min(
      RANGER_AIM_CAP,
      (h.charge || 0) + (h === actor && seal ? 2 : 1),
    );
    syncRangerAim(h);
  }
}
function pointsNeedAttention(h) {
  return (
    !state.over &&
    !state.awaitingStarter &&
    alive(h) &&
    h.points >= Math.max(6, h.level * 3)
  );
}
function heroBuildMarkup(h) {
  return `<span class="hero-specialism" data-tooltip="${escapeHTML(SPECIALISMS[h.specialism]?.description || "")}">${SPECIALISMS[h.specialism]?.name || "Offence"}${h.job === "mage" ? " · " + MAGE_ROLES[mageRole(h)].name : ""}</span>`;
}
function enemyBlock() {
  return Math.max(0, state.enemyBlock || 0);
}
function setEnemyBlock(amount) {
  state.enemyBlock = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  // Non-enumerable aliases keep old saves/callers compatible without storing
  // or maintaining competing pools. New game code uses these shared helpers.
  for (const e of battleEnemies()) {
    if (Object.getOwnPropertyDescriptor(e, "block")?.get) continue;
    Object.defineProperty(e, "block", {
      configurable: true,
      enumerable: false,
      get: () => enemyBlock(),
      set: (value) => setEnemyBlock(value),
    });
  }
  const readout = $("#enemy-team-block strong");
  if (readout) readout.textContent = state.enemyBlock;
}
function gainEnemyBlock(amount) {
  setEnemyBlock(enemyBlock() + amount);
}
function enemyBlockMarkup() {
  return `<div id="enemy-team-block" class="enemy-team-block" aria-label="Enemy team block: ${enemyBlock()}">${icon("block")}<strong>${enemyBlock()}</strong><span>ENEMY TEAM BLOCK<small>Shared by all enemies</small></span></div>`;
}
function wardActive(e = actingEnemy) {
  return !!(
    state.invulnerable &&
    (!state.invulnerable.enemyId || state.invulnerable.enemyId === e?.id)
  );
}
