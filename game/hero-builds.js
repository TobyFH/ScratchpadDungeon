// Hero identity and build rules; shared by play, recruitment, saves and automation.
const SPECIALISMS = Object.freeze({
  offence: {
    name: "Aggressive",
    description: "+1 damage, poison and stun power on relevant rolls.",
  },
  defence: {
    name: "Defensive",
    description:
      "+1 healing, shared block and stimulant power on relevant rolls.",
  },
});
const MAGE_POWERS = Object.freeze({
  magic: {
    name: "Spell damage",
    icon: "magic",
    description: "Resonance strikes every enemy with magic.",
  },
  heal: {
    name: "Healing",
    icon: "heal",
    description:
      "Resonance heals every living ally and clears all allied stuns.",
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
const RANGER_AIM_CAP = 6,
  BERSERKER_FURY_CAP = 20;
const rangerAimGain = () => 1;
const BASE_JOBS = Object.freeze(["fighter", "rogue", "mage", "berserker"]);
const heroJobs = (rules = state?.runRules || []) => [
  ...BASE_JOBS,
  ...(rules.includes("ranger") ? ["ranger"] : []),
];
function mageResonance(h, symbols = null) {
  // A property of the marks actually rolled, falling back to weighted wheels.
  // It is never a selectable or saved Mage role.
  const scores = Object.fromEntries(
    Object.keys(MAGE_POWERS).map((t) => [t, 0]),
  );
  const add = (f, weight) => {
    if (f && Object.hasOwn(scores, f.type))
      scores[f.type] +=
        (f.type === "magic" ? ATTACK_POWER[f.tier] : POWER[f.type] * f.tier) *
        weight;
  };
  if (symbols) symbols.forEach((f) => add(f, 1));
  if (!Object.values(scores).some(Boolean))
    for (const reel of h?.reels || []) {
      const total = reel.reduce((n, f) => n + (f.weight || 1), 0);
      reel.forEach((f) => add(f, (f.weight || 1) / total));
    }
  if (h?.specialism === "defence") {
    scores.heal *= 1.12;
    scores.block *= 1.12;
  } else {
    scores.magic *= 1.12;
    scores.poison *= 1.12;
  }
  return Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
}
// Compatibility name for old integrations; always derived, with no role field.
const mageRole = (h) => mageResonance(h);
function normaliseHeroBuild(h) {
  if (!h) return;
  if (h.job === "healer") h.job = "mage";
  delete h.mageRole;
  normaliseTacticalStatuses(h);
  if (!Object.hasOwn(SPECIALISMS, h.specialism))
    h.specialism =
      Math.floor(Number(h.id) || h.name?.length || 0) % 2
        ? "offence"
        : "defence";
  h.charge = Math.min(RANGER_AIM_CAP, Math.max(0, h.charge || 0));
  h.fury = Math.min(BERSERKER_FURY_CAP, Math.max(0, h.fury || 0));
  if (!h.reels) return;
  for (const face of h.last || [])
    if (face.type === "class") {
      face.job = h.job;
      delete face.mageRole;
    }
  h.reels.forEach((reel, k) => {
    let seal = false;
    for (const face of reel) {
      delete face.mageRole;
      if (
        h.job === "berserker" &&
        !["attack", "heal", "selfharm", "blank", "class"].includes(face.type)
      ) {
        face.type = "blank";
        face.tier = 1;
      }
      if (face.type !== "class") continue;
      if (k === 1 && !seal) {
        seal = true;
        face.job = h.job;
        face.tier = 1;
      } else {
        face.type = "blank";
        face.tier = 1;
        delete face.job;
      }
    }
    if (k === 1 && !seal)
      reel.push({ type: "class", tier: 1, weight: 3, job: h.job });
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
      berserker: "BLOODRUSH",
    }[job] || "CLASS"
  );
}
function classAbilityDescription(hero) {
  const job = typeof hero === "string" ? hero : hero?.job;
  return (
    {
      fighter:
        "Rage: build damage and a little resistance until this fight ends.",
      rogue: "Flurry: roll three extra attacks; each blade lands separately.",
      mage: "Resonance echoes the strongest healing, shield, poison or magic marks in this roll across the appropriate whole team. Healing also clears every ally’s stun.",
      healer: "Resonance echoes your rolled marks across the appropriate team.",
      ranger:
        "Execute: wait between attacks to fill patience. The next damaging roll gains a bonus against wounded enemies; the seal strengthens that shot.",
      berserker:
        "Bloodrush: gain 4 Fury and strike for extra blade damage. Wounds and Blood Price faces feed Fury; every 4 Fury adds 1 damage until battle ends.",
    }[job] || "Your permanent signature mark, alongside the other two results."
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
function makeHero(
  name,
  job,
  origin = null,
  rules = state?.runRules || [],
  build = {},
) {
  const legacyHealer = job === "healer";
  if (legacyHealer) job = "mage";
  const specialism = Object.hasOwn(SPECIALISMS, build.specialism)
    ? build.specialism
    : pick(["offence", "defence"]);
  const faces = {
    fighter: [
      ["attack", 1, 9],
      ["attack", 2, 5],
      ["block", 1, 7],
      ["block", 2, 3],
      ["heal", 1, 1],
      ["blank", 1, 5],
    ],
    rogue: [
      ["attack", 1, 11],
      ["attack", 2, 10],
      ["attack", 3, 3],
      ["poison", 1, 2],
      ["block", 1, 1],
      ["blank", 1, 4],
    ],
    ranger: [
      ["attack", 1, 12],
      ["attack", 2, 5],
      ["poison", 1, 3],
      ["block", 1, 2],
      ["stun", 1, 2],
      ["blank", 1, 6],
    ],
    berserker: [
      ["attack", 1, 10],
      ["attack", 2, 6],
      ["heal", 1, 4],
      ["selfharm", 1, 5],
      ["selfharm", 2, 2],
      ["blank", 1, 5],
    ],
    mage: legacyHealer
      ? [
          ["heal", 1, 14],
          ["heal", 2, 12],
          ["block", 1, 2],
          ["stun", 1, 1],
          ["magic", 1, 1],
          ["blank", 1, 4],
        ]
      : specialism === "defence"
        ? [
            ["heal", 1, 10],
            ["heal", 2, 5],
            ["block", 1, 5],
            ["magic", 1, 6],
            ["poison", 1, 2],
            ["blank", 1, 5],
          ]
        : [
            ["magic", 1, 11],
            ["magic", 2, 7],
            ["poison", 1, 4],
            ["heal", 1, 4],
            ["block", 1, 2],
            ["blank", 1, 5],
          ],
  };
  const maxHp =
    { fighter: 44, rogue: 26, mage: 28, ranger: 30, berserker: 38 }[job] +
    (rules.includes("hearty") ? 4 : 0);
  const h = {
    id: Date.now() + Math.random(),
    name,
    job,
    specialism,
    level: 1,
    xp: 0,
    hp: maxHp,
    maxHp,
    charge: 0,
    fury: 0,
    points: 3,
    equipment: null,
    trait: null,
    traitProgress: {},
    stun: 0,
    stunGrace: 0,
    poison: null,
    stimulant: null,
    rage: 0,
    vulnerable: null,
    initiative: null,
    surprised: false,
    dead: false,
    joinedAt: Date.now(),
    joinedSteps: state?.steps || 0,
    origin: origin || {
      depth: state?.depth || 1,
      tile: state?.position ?? pos(1, 7),
      description: "A wandering adventurer in the dungeon",
    },
    stats: emptyStats(),
    reels: [0, 1, 2].map((reel) => [
      ...faces[job].map(([type, tier, weight]) => ({ type, tier, weight })),
      ...(reel === 1 ? [{ type: "class", tier: 1, weight: 3, job }] : []),
    ]),
    last: [],
  };
  h.last = [h.reels[0][0], h.reels[1][1], { type: "blank", tier: 1 }].map(
    (f) => ({ ...f }),
  );
  return h;
}
function specialismBadge(h) {
  const s = SPECIALISMS[h.specialism] || SPECIALISMS.offence;
  return `<span class="specialism-badge ${h.specialism}" data-tooltip="${escapeHTML(s.name + ": " + s.description)}" aria-label="${s.name} temperament">${icon(h.specialism === "defence" ? "block" : "sword")}<small>${s.name}</small></span>`;
}
function heroBuildMarkup(h) {
  const s = SPECIALISMS[h.specialism] || SPECIALISMS.offence;
  return `<span class="hero-specialism ${h.specialism}" data-tooltip="${escapeHTML(s.description)}">${icon(h.specialism === "defence" ? "block" : "sword")}<b>${s.name}</b> · ${h.specialism === "defence" ? "+1 healing · block · buffs" : "+1 damage · poison · stun"}<small>Fixed temperament</small></span>`;
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
  document.querySelectorAll(".enemy-team-block").forEach((el) => {
    el.querySelector("strong").textContent = state.enemyBlock;
    el.setAttribute("aria-label", "Shared enemy block: " + state.enemyBlock);
  });
}
function gainEnemyBlock(amount) {
  setEnemyBlock(enemyBlock() + amount);
}
function enemyBlockMarkup(index = 0) {
  return `<div id="enemy-team-block${index ? "-2" : ""}" class="enemy-team-block" aria-label="Enemy team block: ${enemyBlock()}">${icon("block")}<strong>${enemyBlock()}</strong><span>TEAM BLOCK<small>Shared pool</small></span></div>`;
}
function wardActive(e = actingEnemy) {
  return !!(
    state.invulnerable &&
    (!state.invulnerable.enemyId || state.invulnerable.enemyId === e?.id)
  );
}
