// Hero identity and build rules; shared by play, recruitment, saves and automation.
const SPECIALISMS = Object.freeze({
  offence: {
    name: "Aggressive",
    description:
      "Starts with more offensive marks. Rebuild freely; marks keep their usual power.",
  },
  defence: {
    name: "Defensive",
    description:
      "Starts with more support marks. Rebuild freely; marks keep their usual power.",
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
const HERO_TUNING = Object.freeze({
  rangerExecute: 1.12,
  healing: 1,
});
const tankSealBlock = (h) =>
  2 + Math.floor(Math.max(0, (h?.level || 1) - 1) / 3);
const furyCapacity = (h) =>
  24 + Math.max(0, Math.floor((h?.level || 1) - 1)) * 3;
const fountainBaseRate = (depth = state.depth) =>
  0.15 + Math.min(9, Math.max(0, depth - 1)) * 0.005;
const fountainRollRate = (depth = state.depth) =>
  0.5 + Math.min(9, Math.max(0, depth - 1)) * 0.018;
function heroDamagePower(h, n) {
  return n;
}
function heroHealingPower(n) {
  return n;
}
const RANGER_AIM_CAP = 6;
// Fury scales with level; every real HP restored spends one charge.
const BERSERKER_SUSTAIN = Object.freeze({
  bloodrushHeal: 4,
  healLevelInterval: 3,
  leechPerPower: 0.045,
  maxLeech: 0.24,
});
const bloodrushHealing = (h) =>
  BERSERKER_SUSTAIN.bloodrushHeal +
  Math.floor(
    Math.max(0, (h?.level || 1) - 1) / BERSERKER_SUSTAIN.healLevelInterval,
  );
const furyLeechRate = (h) =>
  h?.job === "berserker"
    ? Math.min(
        BERSERKER_SUSTAIN.maxLeech +
          Math.min(0.08, Math.max(0, (h.level || 1) - 1) * 0.005),
        furyBonus(h) * BERSERKER_SUSTAIN.leechPerPower,
      )
    : 0;
const rangerAimGain = () => 2;
const BASE_JOBS = Object.freeze(["fighter", "rogue", "mage"]);
const heroJobs = (rules = state?.runRules || []) => [
  ...BASE_JOBS,
  ...(rules.includes("ranger") ? ["ranger"] : []),
  ...(rules.includes("berserker") ? ["berserker"] : []),
  ...(rules.includes("jester") ? ["jester"] : []),
];
function mageResonance(h, symbols = null) {
  // A property of the marks actually rolled, falling back to reel probabilities.
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
  h.momentReceipts =
    h.momentReceipts &&
    typeof h.momentReceipts === "object" &&
    !Array.isArray(h.momentReceipts)
      ? h.momentReceipts
      : {};
  h.reelGifts = Array.isArray(h.reelGifts)
    ? h.reelGifts.filter(
        (g) =>
          Number.isInteger(g.reel) &&
          g.reel >= 0 &&
          g.reel < 3 &&
          Number.isInteger(g.uses) &&
          g.uses > 0 &&
          g.uses <= 2,
      )
    : [];
  if (!Object.hasOwn(SPECIALISMS, h.specialism))
    h.specialism =
      Math.floor(Number(h.id) || h.name?.length || 0) % 2
        ? "offence"
        : "defence";
  h.anticipation = Math.min(
    JESTER_ANTICIPATION_CAP - 1,
    Math.max(0, Math.floor(h.anticipation || 0)),
  );
  normaliseStimulant(h);
  normaliseTraitRecord(h);
  h.charge = Math.min(RANGER_AIM_CAP, Math.max(0, h.charge || 0));
  h.fury = Math.min(furyCapacity(h), Math.max(0, h.fury || 0));
  if (!h.reels) return;
  retireReelWeights(h);
  for (const face of h.last || []) {
    if (
      face.type === "selfharm" &&
      h.job !== "berserker" &&
      !face.fromMystery
    ) {
      face.type = h.job === "jester" ? "trick" : "blank";
      if (face.type === "blank") face.tier = 1;
    }
    if (face.type === "trick" && h.job !== "jester") {
      face.type = "blank";
      face.tier = 1;
    }
    if (
      face.type === "stimulant" &&
      !face.fromMystery &&
      ["mage", "ranger", "jester"].includes(h.job)
    )
      face.type = "rally";
    if (face.type === "class") {
      face.job = h.job;
      delete face.mageRole;
    }
  }
  h.reels.forEach((reel, k) => {
    let seal = false;
    for (const face of reel) {
      face.weight = Math.max(1, Math.min(4, Math.floor(face.weight || 1)));
      delete face.mageRole;
      if (
        face.type === "selfharm" &&
        h.job !== "berserker" &&
        !face.fromMystery
      ) {
        face.type = h.job === "jester" ? "trick" : "blank";
        if (face.type === "blank") face.tier = 1;
      }
      if (face.type === "trick" && h.job !== "jester") {
        face.type = "blank";
        face.tier = 1;
      }
      if (
        face.type === "stimulant" &&
        ["mage", "ranger", "jester"].includes(h.job)
      )
        face.type = "rally";
      if (
        h.job === "berserker" &&
        !["attack", "heal", "selfharm", "stimulant", "blank", "class"].includes(
          face.type,
        )
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
      reel.push({ type: "class", tier: 1, weight: 1, job: h.job });
  });
  normaliseMysteryReels(h);
}
function classAbilityName(hero) {
  const job = typeof hero === "string" ? hero : hero?.job;
  return (
    {
      fighter: "SHIELD BASH",
      rogue: "FLURRY",
      mage: "RESONANCE",
      healer: "RESONANCE",
      ranger: "EXECUTE",
      berserker: "BLOODRUSH",
      jester: "WILDCARD",
    }[job] || "CLASS"
  );
}
function classAbilityDescription(hero) {
  const job = typeof hero === "string" ? hero : hero?.job;
  return (
    {
      jester:
        "Wildcard: tricks ink enemy reels, gild allied reels, reverse a foe’s roll, or scatter damage and healing. They usually favour your party.",
      fighter: `Shield Bash: gain ${tankSealBlock(typeof hero === "object" ? hero : null)} team block, then spend up to ${bashLimit(typeof hero === "object" ? hero : null)} block on a bash. Block gained increases every three levels. The bash deals double damage to enemy shields.`,
      rogue: "Flurry: roll three extra attacks; each blade lands separately.",
      mage: "Resonance echoes the strongest healing, shield, poison or magic marks in this roll across the appropriate whole team. Healing also clears every ally’s stun.",
      healer: "Resonance echoes your rolled marks across the appropriate team.",
      ranger:
        "Execute: wait between attacks to fill patience. The next damaging roll gains a bonus against wounded enemies; the seal strengthens that shot.",
      berserker: `Bloodrush: restore ${bloodrushHealing(hero && typeof hero === "object" ? hero : { level: 1 })} HP to yourself, gain +2 physical damage. Wounds build Fury; every HP healed spends Fury. Charged Fury adds damage and lifesteal.`,
    }[job] || "Your permanent signature mark, alongside the other two results."
  );
}
function temperamentEffects(h, base) {
  // Temperament selects a starting palette, never changes a mark's stated power.
  return base;
}
const CLASS_FACE_TYPES = Object.freeze({
  fighter: ["attack", "block", "heal", "stun", "stimulant", "blank"],
  rogue: ["attack", "poison", "stun", "stimulant", "heal", "blank"],
  mage: ["magic", "heal", "block", "poison", "stun", "rally", "blank"],
  ranger: ["attack", "stun", "heal", "rally", "poison", "blank"],
  berserker: ["attack", "heal", "selfharm", "stimulant", "blank"],
});
function startingFaces(job, temperament) {
  const defensive = temperament === "defence";
  return {
    fighter: defensive
      ? [
          ["attack", 1],
          ["block", 1],
          ["block", 2],
          ["heal", 1],
          ["stun", 1],
          ["blank", 1],
        ]
      : [
          ["attack", 1],
          ["attack", 2],
          ["block", 1],
          ["heal", 1],
          ["stun", 1],
          ["blank", 1],
        ],
    rogue: defensive
      ? [
          ["attack", 1],
          ["poison", 1],
          ["poison", 1],
          ["stun", 1],
          ["stimulant", 1],
          ["blank", 1],
        ]
      : [
          ["attack", 1],
          ["attack", 2],
          ["poison", 1],
          ["stun", 1],
          ["stimulant", 1],
          ["blank", 1],
        ],
    mage: defensive
      ? [
          ["heal", 1],
          ["heal", 2],
          ["magic", 2],
          ["block", 1],
          ["rally", 1],
          ["blank", 1],
        ]
      : [
          ["magic", 1],
          ["magic", 2],
          ["poison", 1],
          ["heal", 1],
          ["rally", 1],
          ["blank", 1],
        ],
    ranger: defensive
      ? [
          ["attack", 1],
          ["stun", 1],
          ["stun", 2],
          ["heal", 1],
          ["rally", 1],
          ["blank", 1],
        ]
      : [
          ["attack", 1],
          ["attack", 2],
          ["stun", 1],
          ["heal", 1],
          ["rally", 1],
          ["blank", 1],
        ],
    berserker: defensive
      ? [
          ["attack", 1],
          ["heal", 1],
          ["heal", 2],
          ["selfharm", 1],
          ["stimulant", 1],
          ["blank", 1],
        ]
      : [
          ["attack", 1],
          ["attack", 2],
          ["heal", 1],
          ["selfharm", 1],
          ["heal", 2],
          ["blank", 1],
        ],
    jester: defensive
      ? [
          ["attack", 1],
          ["heal", 1],
          ["block", 1],
          ["rally", 1],
          ["trick", 1],
          ["blank", 1],
        ]
      : [
          ["attack", 1],
          ["magic", 1],
          ["poison", 1],
          ["heal", 1],
          ["trick", 1],
          ["blank", 1],
        ],
  }[job];
}
// Recruits draw this independently of class and the starter selection.
const randomTemperament = () => (Math.random() < 0.5 ? "offence" : "defence");
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
    : randomTemperament();
  const faces = startingFaces(job, specialism);
  const maxHp = Math.round(
    ((CLASS_BALANCE[job]?.hp || 30) + (rules.includes("hearty") ? 4 : 0)) *
      (1 + lessonBonus("vitality", rules) / 100) *
      (rules.includes("glass") ? 0.85 : 1),
  );
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
    anticipation: 0,
    fury: 0,
    points: 3,
    equipment: null,
    trait: null,
    traitProgress: {},
    stun: 0,
    stunAge: 0,
    stunWard: 0,
    blackout: [],
    reelGifts: [],
    momentReceipts: {},
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
      ...faces.map(([type, tier]) => ({ type, tier, weight: 1 })),
      ...(reel === 1 ? [{ type: "class", tier: 1, weight: 1, job }] : []),
    ]),
    last: [],
  };
  normaliseMysteryReels(h);
  h.last = [h.reels[0][0], h.reels[1][1], { type: "blank", tier: 1 }].map(
    (f) => ({ ...f }),
  );
  return h;
}
// Shared by actual recovery and the fountain's uncapped offered totals.
function offeredHealing(h, amount) {
  return amount > 0
    ? Math.max(
        1,
        amount + traitBonus(h, "healingReceived") + lessonBonus("recovery"),
      )
    : 0;
}
function specialismBadge(h) {
  const s = SPECIALISMS[h.specialism] || SPECIALISMS.offence;
  return `<span class="specialism-badge ${h.specialism}" data-tooltip="${escapeHTML(s.name + ": " + s.description)}" aria-label="${s.name} temperament">${icon(h.specialism === "defence" ? "block" : "sword")}</span>`;
}
function heroBuildMarkup(h) {
  const s = SPECIALISMS[h.specialism] || SPECIALISMS.offence;
  return `<span class="hero-specialism ${h.specialism}" data-tooltip="${escapeHTML(s.description)}">${icon(h.specialism === "defence" ? "block" : "sword")}<b>${s.name}</b> · ${h.specialism === "defence" ? "supporting start" : "attacking start"}<small>Fixed temperament</small></span>`;
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
    (((3 + h.level * 0.75) * Math.min(RANGER_AIM_CAP, charge)) /
      RANGER_AIM_CAP) *
      (0.5 + 2.5 * missing) *
      (seal ? 1.35 : 1) *
      HERO_TUNING.rangerExecute,
  );
}
function advanceRangerPatience(actor, attacked, seal = false) {
  for (const h of state.party.filter(alive)) {
    if (h.job !== "ranger" || (h === actor && attacked)) continue;
    h.charge = Math.min(
      RANGER_AIM_CAP,
      (h.charge || 0) + (h === actor && seal ? 3 : rangerAimGain()),
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
  state.enemyBlock = Number.isFinite(amount)
    ? Math.min(enemyBlockCap(), Math.max(0, amount))
    : 0;
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
    el.querySelector("small").textContent = "Shared · cap " + enemyBlockCap();
    el.style.setProperty(
      "--block-strength",
      Math.min(20, state.enemyBlock) / 20,
    );
    el.setAttribute("aria-label", "Shared enemy block: " + state.enemyBlock);
  });
}
function gainEnemyBlock(amount) {
  setEnemyBlock(enemyBlock() + amount);
}
function enemyBlockMarkup(index = 0) {
  return `<div id="enemy-team-block${index ? "-2" : ""}" class="enemy-team-block" style="--block-strength:${Math.min(20, enemyBlock()) / 20}" aria-label="Enemy team block: ${enemyBlock()}">${icon("block")}<strong>${enemyBlock()}</strong><span>TEAM BLOCK<small>Shared · cap ${enemyBlockCap()}</small></span></div>`;
}
function wardActive(e = actingEnemy) {
  return !!(
    state.invulnerable &&
    (!state.invulnerable.enemyId || state.invulnerable.enemyId === e?.id)
  );
}
