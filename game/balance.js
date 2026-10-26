// Shared numeric tuning. Keep RNG, match rules, reel counts and art outside this module.
// All multipliers are visible in the workshop/guide; a mark has the same base power for every class.
const POWER = Object.freeze({
  selfharm: 2,
  attack: 1,
  magic: 1,
  poison: 1,
  stimulant: 1,
  rally: 1,
  trick: 1,
  heal: 2,
  block: 2,
  stun: 1,
  class: 0,
  blank: 0,
});
const ATTACK_POWER = Object.freeze([0, 1, 2, 3, 4]);
const FACE_COST = Object.freeze({ 1: 1, 2: 3, 3: 6, 4: 10 });
const CLASS_BALANCE = Object.freeze({
  fighter: {
    hp: 50,
    critical: [1.5, 1.75, 2, 2.25],
    path: "Shields fuel Shield Bash. Stun controls; lower damage crits.",
  },
  rogue: {
    hp: 26,
    critical: [2, 3, 4, 5],
    path: "Physical combos or poison. Strong crits; fragile, little healing.",
  },
  mage: {
    hp: 28,
    critical: [1.75, 2, 2.5, 3],
    path: "Solo spell combos; healing, shields or poison for a party.",
  },
  ranger: {
    hp: 30,
    critical: [2, 2.5, 3, 4],
    path: "Wait for Execute, then finish wounded foes. Keep support marks.",
  },
  berserker: {
    hp: 38,
    critical: [1.75, 2.5, 3, 4],
    path: "Blood Price builds Fury. Balance damage with healing and lifesteal.",
  },
  jester: {
    hp: 30,
    critical: [1.5, 2, 3, 4],
    path: "Trick builds Punchline. Mix damage with useful support.",
  },
});
const CRITICAL_BALANCE = Object.freeze({
  enemy: [1.25, 1.25, 1.5, 1.5],
  well: [1.25, 1.25, 1.5, 1.75],
  loot: [2, 2.5, 3, 4],
});
function criticalPool(hero, { enemy = false, context = null } = {}) {
  if (context === "well") return CRITICAL_BALANCE.well;
  if (enemy) return CRITICAL_BALANCE.enemy;
  return hero
    ? CLASS_BALANCE[hero.job]?.critical || CLASS_BALANCE.mage.critical
    : CRITICAL_BALANCE.loot;
}
const meanCritical = (h) =>
  criticalPool(h).reduce((a, b) => a + b, 0) / criticalPool(h).length;
const criticalRange = (h) =>
  `×${Math.min(...criticalPool(h))}–×${Math.max(...criticalPool(h))}`;
const FLURRY_FACES = Object.freeze([
  { type: "attack", tier: 1, weight: 8 },
  { type: "attack", tier: 2, weight: 3 },
  { type: "attack", tier: 3, weight: 1 },
]);
const flurryMeanDamage = () =>
  (3 * FLURRY_FACES.reduce((n, f) => n + ATTACK_POWER[f.tier] * f.weight, 0)) /
  FLURRY_FACES.reduce((n, f) => n + f.weight, 0);
// Explicit rows avoid abrupt formula/clocks/tier jumps stacking accidentally.
// hp/damage are the ordinary reference; bosses have independent budgets.
const FLOOR_BALANCE = Object.freeze([
  {
    hp: 13,
    damage: 3,
    bossHp: 28,
    bossDamage: 4,
    frequency: 3,
    bossFrequency: 2,
    strikes: 1,
    promotion: 0,
  },
  {
    hp: 17,
    damage: 4,
    bossHp: 36,
    bossDamage: 5,
    frequency: 3,
    bossFrequency: 2,
    strikes: 1,
    promotion: 0,
  },
  {
    hp: 22,
    damage: 5,
    bossHp: 47,
    bossDamage: 6,
    frequency: 2,
    bossFrequency: 2,
    strikes: 1,
    promotion: 0,
  },
  {
    hp: 28,
    damage: 6,
    bossHp: 60,
    bossDamage: 7,
    frequency: 2,
    bossFrequency: 2,
    strikes: 1,
    promotion: 1,
  },
  {
    hp: 35,
    damage: 7,
    bossHp: 76,
    bossDamage: 8,
    frequency: 2,
    bossFrequency: 2,
    strikes: 1,
    promotion: 1,
  },
  {
    hp: 43,
    damage: 8,
    bossHp: 94,
    bossDamage: 9,
    frequency: 2,
    bossFrequency: 2,
    strikes: 2,
    promotion: 1,
  },
  {
    hp: 52,
    damage: 9,
    bossHp: 116,
    bossDamage: 10,
    frequency: 2,
    bossFrequency: 2,
    strikes: 2,
    promotion: 1,
  },
  {
    hp: 63,
    damage: 10,
    bossHp: 140,
    bossDamage: 11,
    frequency: 2,
    bossFrequency: 2,
    strikes: 2,
    promotion: 2,
  },
  {
    hp: 75,
    damage: 11,
    bossHp: 168,
    bossDamage: 12,
    frequency: 2,
    bossFrequency: 2,
    strikes: 2,
    promotion: 2,
  },
  {
    hp: 88,
    damage: 12,
    bossHp: 205,
    bossDamage: 14,
    frequency: 2,
    bossFrequency: 2,
    strikes: 3,
    promotion: 2,
  },
]);
const floorBalance = (depth) =>
  FLOOR_BALANCE[Math.max(0, Math.min(9, Math.floor(depth) - 1))];
function enemyBalance(
  depth,
  {
    boss = false,
    elite = false,
    pair = false,
    mimic = false,
    stronghold = false,
    species = null,
  } = {},
) {
  const row = floorBalance(depth),
    identity = ENEMY_PROFILES[species] || {};
  const stats = {
    maxHp: Math.ceil(
      (boss ? row.bossHp : row.hp * (identity.hp || 1)) *
        (boss
          ? 1
          : (elite ? 1.25 : 1) *
            (stronghold ? 1.4 : 1) *
            (mimic ? 1.15 : 1) *
            (pair ? 0.76 : 1)),
    ),
    damage: Math.ceil(
      (boss ? row.bossDamage : row.damage) *
        (identity.damage || 1) *
        (boss
          ? 1
          : (elite ? 1.1 : 1) * (stronghold ? 1.15 : 1) * (pair ? 0.78 : 1)),
    ),
    frequency: boss
      ? row.bossFrequency
      : stronghold
        ? 2
        : Math.max(1, row.frequency + (identity.cadence || 0)),
    strikes: boss ? row.strikes : stronghold && depth >= 7 ? 2 : 1,
  };
  if (species === "pursuer") {
    stats.maxHp = Math.ceil(stats.maxHp * (depth >= 4 ? 1.35 : 1.15));
    stats.damage = Math.ceil(stats.damage * (depth >= 4 ? 1.2 : 1.1));
    if (depth >= 8) stats.strikes = Math.max(2, stats.strikes);
  }
  stats.maxHp = Math.ceil(
    stats.maxHp *
      (ruleEnabled("iron") ? 1.2 : 1) *
      (ruleEnabled("richFoes") ? 1.15 : 1),
  );
  stats.damage =
    Math.ceil(stats.damage * (ruleEnabled("iron") ? 1.1 : 1)) +
    (ruleEnabled("sharp") ? 1 : 0);
  if (ruleEnabled("restless"))
    stats.frequency = Math.max(1, stats.frequency - 1);
  return stats;
}

// Species identity is data, shared by encounters, summons and previews.
const ENEMY_PROFILES = {
  rat: {
    damage: 0.85,
    cadence: -1,
    hp: 0.8,
    faces: [
      ["attack", 1],
      ["attack", 1],
      ["attack", 2],
      ["poison", 1],
      ["stun", 1],
      ["miss", 1],
    ],
    trait: "secondWind",
  },
  gnawer: {
    damage: 0.9,
    hp: 0.9,
    faces: [
      ["attack", 1],
      ["attack", 1],
      ["attack", 2],
      ["heal", 1],
      ["stimulant", 1],
      ["miss", 1],
    ],
    trait: "secondWind",
  },
  ghost: {
    damage: 0.9,
    hp: 0.8,
    faces: [
      ["magic", 1],
      ["magic", 1],
      ["magic", 2],
      ["stun", 1],
      ["stun", 1],
      ["miss", 1],
    ],
    trait: "summoner",
  },
  slime: {
    damage: 0.75,
    cadence: 1,
    hp: 1.4,
    faces: [
      ["attack", 1],
      ["heal", 1],
      ["heal", 2],
      ["block", 1],
      ["block", 1],
      ["miss", 1],
    ],
    trait: "split",
  },
  skull: {
    hp: 1.05,
    faces: [
      ["attack", 1],
      ["attack", 2],
      ["attack", 2],
      ["block", 1],
      ["block", 1],
      ["stun", 1],
    ],
    trait: "carapace",
  },
  bellkeeper: {
    damage: 1.05,
    cadence: 1,
    hp: 1.35,
    faces: [
      ["attack", 1],
      ["attack", 2],
      ["stun", 1],
      ["stun", 1],
      ["block", 2],
      ["block", 1],
    ],
    trait: "carapace",
  },
  widow: {
    damage: 0.8,
    hp: 0.85,
    faces: [
      ["attack", 1],
      ["poison", 1],
      ["poison", 1],
      ["poison", 2],
      ["stun", 1],
      ["miss", 1],
    ],
    trait: "summoner",
  },
  oracle: {
    damage: 1.1,
    hp: 0.95,
    faces: [
      ["magic", 1],
      ["magic", 2],
      ["magic", 2],
      ["heal", 2],
      ["stimulant", 1],
      ["stun", 1],
    ],
    trait: "secondWind",
  },
  revenant: {
    damage: 1.05,
    hp: 1.25,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["attack", 1],
      ["block", 2],
      ["block", 1],
      ["stun", 1],
    ],
    trait: "secondWind",
  },
  demon: {
    damage: 1.2,
    hp: 1.05,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["magic", 2],
      ["stimulant", 1],
      ["stimulant", 1],
      ["stun", 1],
    ],
    trait: "secondWind",
  },
  lich: {
    damage: 0.95,
    hp: 0.95,
    faces: [
      ["magic", 1],
      ["magic", 2],
      ["magic", 2],
      ["poison", 1],
      ["heal", 1],
      ["stun", 1],
    ],
    trait: "summoner",
  },
  abomination: {
    damage: 0.9,
    hp: 1.5,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["block", 2],
      ["block", 1],
      ["heal", 1],
      ["poison", 1],
    ],
    trait: "split",
  },
  pageeater: {
    damage: 1.15,
    cadence: 1,
    hp: 1.6,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["attack", 2],
      ["block", 2],
      ["stun", 2],
      ["heal", 1],
    ],
    trait: "carapace",
  },
  moth: {
    name: "Tallow moth",
    minDepth: 1,
    maxDepth: 3,
    hp: 0.72,
    damage: 0.9,
    faces: [
      ["attack", 1],
      ["attack", 1],
      ["stun", 1],
      ["miss", 1],
      ["miss", 1],
    ],
  },
  rustmite: {
    name: "Rust mite",
    minDepth: 2,
    maxDepth: 5,
    hp: 1.28,
    damage: 0.9,
    faces: [
      ["attack", 1],
      ["attack", 2],
      ["block", 1],
      ["block", 1],
      ["stun", 1],
      ["miss", 1],
    ],
    trait: "carapace",
  },
  sporepilgrim: {
    name: "Spore pilgrim",
    minDepth: 3,
    maxDepth: 6,
    hp: 1.1,
    damage: 0.9,
    faces: [
      ["poison", 1],
      ["poison", 2],
      ["magic", 1],
      ["heal", 1],
      ["block", 1],
      ["miss", 1],
    ],
    trait: "secondWind",
  },
  mirrorhound: {
    name: "Mirror hound",
    minDepth: 5,
    maxDepth: 8,
    hp: 0.9,
    damage: 1.1,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["attack", 1],
      ["stun", 1],
      ["stimulant", 1],
      ["miss", 1],
    ],
    trait: "split",
  },
  ashcolossus: {
    name: "Ash colossus",
    minDepth: 8,
    maxDepth: 10,
    hp: 1.7,
    damage: 1.15,
    faces: [
      ["attack", 2],
      ["attack", 2],
      ["block", 2],
      ["block", 2],
      ["stun", 2],
      ["miss", 1],
    ],
    trait: "carapace",
  },
  pursuer: {
    hp: 1.28,
    damage: 1.12,
    faces: [
      ["attack", 1],
      ["attack", 2],
      ["attack", 2],
      ["poison", 1],
      ["stun", 1],
      ["stimulant", 1],
    ],
    trait: "secondWind",
  },
  mimic: {
    damage: 1.05,
    hp: 1.3,
    faces: [
      ["attack", 1],
      ["attack", 2],
      ["attack", 2],
      ["block", 1],
      ["stun", 1],
      ["miss", 1],
    ],
    trait: "carapace",
  },
};

function encounterXP(depth, enemy, count = 1) {
  return Math.round(
    (8 + depth * 2) *
      0.85 *
      count *
      (enemy.stronghold ? 2 : enemy.boss ? 1.35 : enemy.elite ? 1.2 : 1),
  );
}

// Bounded resources and complementary marks, shared by manual play and AI.
const COMBAT_LIMITS = Object.freeze({
  block: 20,
  tankBlock: 30,
  enemyBlock: 20,
  bossBlock: 30,
  stunWard: 2,
  stimulantPower: 6,
  punchlineShots: 6,
});
const partyBlockCap = () =>
  state.party.some((h) => alive(h) && h.job === "fighter")
    ? COMBAT_LIMITS.tankBlock
    : COMBAT_LIMITS.block;
const enemyBlockCap = () =>
  livingEnemies().some((e) => e.boss)
    ? COMBAT_LIMITS.bossBlock
    : COMBAT_LIMITS.enemyBlock;
function normalisePartyBlock() {
  state.block = Math.max(0, Math.floor(Number(state.block) || 0));
  if (state.enemy) state.block = Math.min(partyBlockCap(), state.block);
  return state.block;
}
function gainPartyBlock(amount) {
  normalisePartyBlock();
  const before = state.block;
  state.block = Math.min(
    partyBlockCap(),
    before + Math.max(0, Math.floor(amount || 0)),
  );
  return state.block - before;
}
const bashLimit = (h) => 6 + Math.max(0, (h?.level || 1) - 1);
const CLASS_COMBOS = Object.freeze({
  fighter: { name: "Counterstroke", hint: "Physical + block: +2 team block." },
  rogue: {
    name: "Venom edge",
    hint: "Physical + poison or stun: +1 physical damage.",
  },
  mage: {
    name: "Spellweave",
    hint: "Spell/poison + healing/block/ally stimulant: +1 spell and +1 rolled healing or block.",
  },
  ranger: {
    name: "Prepared shot",
    hint: "Physical + healing/stun/ally stimulant: +2 physical damage.",
  },
  berserker: {
    name: "Blood & steel",
    hint: "Physical + healing/Blood Price: +1 physical damage.",
  },
  jester: {
    name: "Variety act",
    hint: "Trick + another useful kind: +1 anticipation.",
  },
});
function complementaryEffects(h, symbols) {
  const has = (t) => symbols.some((f) => f.type === t),
    fx = {};
  if (h.job === "fighter" && has("attack") && has("block")) fx.block = 2;
  if (h.job === "rogue" && has("attack") && (has("poison") || has("stun")))
    fx.attack = 1;
  if (
    h.job === "mage" &&
    (has("magic") || has("poison")) &&
    ["heal", "block", "rally"].some(has)
  ) {
    fx.magic = 1;
    if (has("heal")) fx.heal = 1;
    else if (has("block")) fx.block = 1;
  }
  if (
    h.job === "ranger" &&
    has("attack") &&
    ["heal", "stun", "rally"].some(has)
  )
    fx.attack = 2;
  if (
    h.job === "berserker" &&
    has("attack") &&
    (has("heal") || has("selfharm"))
  )
    fx.attack = 1;
  if (
    h.job === "jester" &&
    has("trick") &&
    symbols.some((f) => !["trick", "blank", "class", "miss"].includes(f.type))
  )
    fx.trick = 1;
  return fx;
}
function applyComplementaryEffects(h, symbols, base) {
  const fx = complementaryEffects(h, symbols);
  for (const [key, n] of Object.entries(fx)) base[key] = (base[key] || 0) + n;
  if (Object.keys(fx).length) {
    Object.defineProperty(base, "combo", {
      value: CLASS_COMBOS[h.job].name,
      enumerable: false,
    });
    combatCallout(
      entityArt(h),
      CLASS_COMBOS[h.job].name.toUpperCase(),
      "ability",
    );
  }
  return base;
}
// Paid weighting is retired. Equalise old faces and refund actual historic
// 4/8/12-point purchases (6/12/18 for the middle seal) exactly once.
function retireReelWeights(h) {
  let refund = 0;
  for (const reel of h.reels || [])
    for (const f of reel) {
      const weight = Number(f.weight) || 1;
      if (Number.isInteger(weight) && weight >= 2 && weight <= 4)
        refund += 2 * (weight - 1) * weight * (f.type === "class" ? 1.5 : 1);
      f.weight = 1;
    }
  if (refund) {
    h.points = (h.points || 0) + refund;
    h.retiredWeightRefund = (h.retiredWeightRefund || 0) + refund;
  }
  return refund;
}
// Exact chance of complementary kinds on the three independent equal-face reels.
function expectedComplementaryEffects(h) {
  const probabilities = (types) =>
    h.reels.map((reel) => faceShare(reel, types));
  const both = (left, right) => {
    const a = probabilities(left),
      b = probabilities(right);
    return Math.max(
      0,
      1 -
        a.reduce((p, x) => p * (1 - x), 1) -
        b.reduce((p, x) => p * (1 - x), 1) +
        a.reduce((p, x, k) => p * (1 - x - b[k]), 1),
    );
  };
  if (h.job === "fighter") return { block: 2 * both(["attack"], ["block"]) };
  if (h.job === "rogue")
    return { damage: both(["attack"], ["poison", "stun"]) };
  if (h.job === "ranger")
    return { damage: 2 * both(["attack"], ["heal", "stun", "rally"]) };
  if (h.job === "berserker")
    return { damage: both(["attack"], ["heal", "selfharm"]) };
  if (h.job === "jester")
    return {
      trick: both(
        ["trick"],
        TYPES.filter(
          (t) => !["class", "blank", "trick", "selfharm"].includes(t),
        ),
      ),
    };
  if (h.job === "mage") {
    const l = probabilities(["magic", "poison"]),
      a = probabilities(["heal"]),
      b = probabilities(["block"]);
    const triple = l.reduce(
      (n, p, i) =>
        n +
        p * a[(i + 1) % 3] * b[(i + 2) % 3] +
        p * b[(i + 1) % 3] * a[(i + 2) % 3],
      0,
    );
    return {
      damage: both(["magic", "poison"], ["heal", "block", "rally"]),
      heal: both(["magic", "poison"], ["heal"]),
      block: Math.max(0, both(["magic", "poison"], ["block"]) - triple),
    };
  }
  return {};
}
