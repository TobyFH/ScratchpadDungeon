// A persistent preference gives each automated hero a recognisable build.
// Utility saturates, and every build keeps useful solo damage. Edits still pass
// through the same prices, refunds and validators as the workshop.
const AUTO_ARCHETYPES = Object.freeze({
  assault: {
    name: "Assault",
    weights: {
      damage: 1.9,
      block: 0.35,
      heal: 0.35,
      stun: 0.7,
      poison: 0.65,
      stimulant: 0.65,
      rage: 1,
    },
  },
  bulwark: {
    name: "Bulwark",
    weights: {
      damage: 0.85,
      block: 2.7,
      heal: 0.7,
      stun: 1.7,
      stimulant: 1.1,
      rage: 0.5,
    },
  },
  balanced: {
    name: "Balanced",
    weights: {
      damage: 1.35,
      block: 1.2,
      heal: 1.1,
      stun: 1.25,
      poison: 1,
      stimulant: 1.15,
      rage: 0.6,
    },
  },
  venom: {
    name: "Venom",
    weights: {
      damage: 1.1,
      poison: 2.8,
      stun: 1.5,
      heal: 0.4,
      stimulant: 0.9,
      block: 0.2,
    },
  },
  mender: {
    name: "Mender",
    weights: {
      damage: 0.85,
      heal: 2.3,
      teamHeal: 2.3,
      block: 1.8,
      stun: 0.8,
      stimulant: 1.3,
    },
  },
  enchanter: {
    name: "Enchanter",
    weights: {
      damage: 1.2,
      stimulant: 2.8,
      stun: 2,
      heal: 0.8,
      block: 1.1,
      poison: 0.7,
    },
  },
  trickster: {
    name: "Trickster",
    weights: {
      damage: 1.3,
      stun: 1.15,
      trick: 3.2,
      poison: 1.3,
      stimulant: 1.7,
      heal: 1,
      block: 0.9,
    },
  },
});
function autoBuildFor(h) {
  const choices = {
    fighter:
      h.specialism === "defence"
        ? ["bulwark", "balanced", "assault"]
        : ["assault", "balanced", "bulwark"],
    rogue: ["assault", "venom", "balanced"],
    mage:
      h.specialism === "defence"
        ? ["mender", "enchanter", "balanced"]
        : ["venom", "assault", "enchanter"],
    ranger: ["assault", "balanced", "enchanter"],
    berserker: ["assault", "balanced"],
    jester: ["trickster", "balanced", "enchanter"],
  }[h.job] || ["balanced"];
  if (h.job === "mage" && partyDamagePartners(h) >= 2) {
    h.autoArchetype = "mender";
    return AUTO_ARCHETYPES.mender;
  }
  if (h.job === "jester") h.autoArchetype = "trickster";
  if (!choices.includes(h.autoArchetype)) {
    let hash = 0;
    for (const c of String(h.id))
      hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
    h.autoArchetype = choices[hash % choices.length];
  }
  return AUTO_ARCHETYPES[h.autoArchetype];
}
function autoBuildUtility(h) {
  const fx = expectedHeroEffects(h),
    build = autoBuildFor(h),
    solo = state.party.filter(alive).length === 1;
  const weights = {
    ...build.weights,
    selfHeal: 1.25,
    rally: h.autoArchetype === "enchanter" ? 1.6 : 0.75,
    trick: h.job === "jester" ? 3.2 : 0,
    selfharm: -0.3,
    fury: 0.2,
  };
  weights.stimulant = Math.min(0.65, weights.stimulant || 0);
  const otherDamage = partyDamagePartners(h);
  if (h.job === "mage" && otherDamage >= 2) {
    Object.assign(weights, {
      heal: 2.8,
      teamHeal: 2.8,
      block: 2.4,
      stun: 1.8,
      damage: 0.8,
      poison: 0.6,
      rally: 1,
    });
  }
  const limits = {
    damage: Math.max(4, 2 + state.depth * 0.65),
    block: 4 + state.depth * 0.6,
    heal: 5 + state.depth * 0.65,
    teamHeal: 4 + state.depth * 0.6,
    poison: 3 + state.depth * 0.35,
    stun: 3 + state.depth * 0.3,
    stimulant: 1.5,
    rally: 2,
    trick: 2.5,
    selfHeal: 5 + state.depth * 0.5,
  };
  let utility = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const value = fx[key] || 0,
      limit = limits[key] || 4;
    utility +=
      weight *
      (value <= limit ? value : limit + Math.sqrt(value - limit) * 0.3);
  }
  const coverage =
    {
      assault: { stun: [0.5, 1] },
      bulwark: { block: [3, 2.5], stun: [1.5, 4] },
      balanced: {
        block: [2, 2],
        stun: [1, 3],
        heal: [2, 1],
      },
      venom: { poison: [3, 2], stun: [1.2, 3] },
      mender: {
        heal: [3, 2],
        block: [2.5, 2],
        stun: [0.6, 2],
        rally: [0.7, 1],
      },
      enchanter: { rally: [1, 1], stun: [1.5, 3], block: [1.5, 2] },
      trickster: { stun: [1.5, 2], trick: [0.7, 1], poison: [1.5, 2] },
    }[h.autoArchetype] || {};
  for (const [key, [target, weight]] of Object.entries(coverage))
    utility += Math.min(target, fx[key] || 0) * weight;
  if (h.job === "mage" && otherDamage >= 2) {
    utility +=
      Math.min(2.5, fx.block) * 4 +
      Math.min(3, fx.heal + fx.teamHeal) * 3 +
      Math.min(1, fx.stun) * 3;
    const recovery = fx.heal + fx.teamHeal * state.party.filter(alive).length;
    utility -= Math.max(0, recovery - (6 + state.depth)) * 1.6;
    utility -=
      Math.max(0, 0.22 - faceShare(h.reels.flat(), ["heal", "block"])) * 70;
  }
  if (h.job === "jester") {
    utility += Math.min(1.25, fx.trick) * 5;
    utility -= Math.max(0, 0.15 - faceShare(h.reels.flat(), ["trick"])) * 100;
    utility -= Math.max(0, faceShare(h.reels.flat(), ["stun"]) - 0.23) * 65;
  }
  const offence = fx.damage + fx.poison * 1.2,
    minDamage = solo
      ? Math.max(1.8, 1.2 + state.depth * 0.22)
      : Math.max(1.2, 0.8 + state.depth * 0.12);
  utility -= Math.max(0, minDamage - offence) * (solo ? 12 : 7);
  // Avoid support-only survivors and favour some self-recovery when alone.
  if (solo) utility += Math.min(2, fx.heal + fx.selfHeal) * 1.1;
  // Chance to actually hit matters independently of mean damage: one huge
  // attack among many buffs is not a reliable damage dealer.
  const minShare = solo
    ? 0.4
    : ["rogue", "ranger", "berserker"].includes(h.job)
      ? 0.38
      : h.job === "mage" && otherDamage >= 2
        ? 0.2
        : 0.3;
  utility -= Math.max(0, minShare - directDamageShare(h)) * 75;
  for (const reel of h.reels) {
    const p = faceShare(reel, ["attack", "magic", "poison"]);
    utility -= Math.max(0, (solo ? 0.2 : 0.12) - p) * 16;
  }
  for (const [types, cap] of [
    [["stimulant", "rally"], buffFaceLimit(h)],
    [["trick"], 0.22],
  ]) {
    const over = Math.max(0, faceShare(h.reels.flat(), types) - cap);
    utility -= over * 60 + over * over * 80;
  }
  // Recovery is valuable, especially with camp lessons, but physical classes
  // must not turn into mostly-heal wheels. Keep a few emergency marks; let
  // the Mage and genuine damage dealers complement each other.
  const healCap =
    {
      rogue: 0.18,
      ranger: 0.22,
      fighter: 0.24,
      berserker: 0.36,
      mage: 0.42,
      jester: 0.25,
    }[h.job] || 0.25;
  utility -= Math.max(0, faceShare(h.reels.flat(), ["heal", "selfheal"]) - healCap) * 80;
  // Poison and stun are valuable tools, but their ticks/recovery saturate.
  // Avoid a cheap utility mark crowding every physical or spell combo off a build.
  for (const [types, cap] of [
    [["poison"], h.autoArchetype === "venom" ? 0.5 : 0.25],
    [["stun"], h.autoArchetype === "bulwark" ? 0.3 : 0.22],
  ])
    utility -= Math.max(0, faceShare(h.reels.flat(), types) - cap) * 70;
  if (h.job === "mage" && otherDamage >= 2)
    utility -= Math.max(0, faceShare(h.reels.flat(), ["magic"]) - 0.35) * 65;
  return utility + fx.crit * (meanCritical(h) - 1) * 2;
}
function faceShare(reel, types) {
  const weight = reel.reduce((n, f) => n + (f.weight || 1), 0);
  return weight
    ? reel.reduce(
        (n, f) =>
          n +
          (types.includes(f.type)
            ? f.weight || 1
            : f.type === "mystery"
              ? ((f.weight || 1) *
                  MYSTERY_TYPES.filter((t) => types.includes(t)).length) /
                MYSTERY_TYPES.length
              : 0),
        0,
      ) / weight
    : 0;
}
function directDamageShare(h) {
  return (
    h.reels.reduce(
      (n, reel) => n + faceShare(reel, ["attack", "magic", "poison"]),
      0,
    ) / 3
  );
}
function buffFaceLimit(h) {
  return ["mage", "jester"].includes(h.job) && h.autoArchetype === "enchanter"
    ? 0.22
    : 0.17;
}
// Repair last release's over-stimulated AI builds using real refunds/prices.
// New candidates then pass through the same density penalties above.
function repairOverbuffBuild(h) {
  let edits = 0;
  for (let attempts = 0; attempts < 24; attempts++) {
    if (faceShare(h.reels.flat(), ["stimulant", "rally"]) <= buffFaceLimit(h))
      break;
    const row = h.reels
      .flatMap((reel, r) => reel.map((face, j) => ({ face, r, j })))
      .find(({ face }) => ["stimulant", "rally"].includes(face.type));
    if (!row) break;
    const { r, j } = row,
      reel = h.reels[r];
    const damageAllies = partyDamagePartners(h),
      fx = expectedHeroEffects(h),
      type =
        h.job === "mage" && damageAllies >= 2
          ? fx.heal + fx.teamHeal < fx.block + 2
            ? "heal"
            : "block"
          : h.job === "mage"
            ? "magic"
            : "attack";
    let cost = faceEditCost(h, r, j, "swap", type);
    while (
      cost > h.points &&
      reel[j].tier > 1 &&
      applyFaceEdit(h, r, j, "weaken")
    ) {
      edits++;
      cost = faceEditCost(h, r, j, "swap", type);
    }
    if (cost && cost <= h.points && applyFaceEdit(h, r, j, "swap", type))
      edits++;
    else break;
  }
  return edits;
}
const soloOffence = (h) => {
  const f = expectedHeroEffects(h);
  return f.damage + f.poison * 1.2;
};
function repairSoloBuild(h) {
  if (state.party.filter(alive).length !== 1 || soloOffence(h) >= 2) return 0;
  let edits = 0;
  for (let r = 0; r < 3 && soloOffence(h) < 2; r++) {
    let j = h.reels[r].findIndex(
      (f) =>
        !["class", "mystery"].includes(f.type) &&
        !["attack", "magic", "poison"].includes(f.type),
    );
    if (j < 0) continue;
    const type = h.job === "mage" ? "magic" : "attack";
    let cost = faceEditCost(h, r, j, "swap", type);
    while (cost > h.points) {
      const candidate = h.reels
        .flatMap((reel, k) => reel.map((face, n) => ({ face, k, n })))
        .filter(
          ({ face }) =>
            !["class", "mystery"].includes(face.type) &&
            face.tier > 1 &&
            !["attack", "magic", "poison"].includes(face.type),
        )
        .sort((a, b) => faceRefund(h, b.face) - faceRefund(h, a.face))[0];
      if (!candidate || !applyFaceEdit(h, candidate.k, candidate.n, "weaken"))
        break;
      edits++;
      cost = faceEditCost(h, r, j, "swap", type);
    }
    if (cost && cost <= h.points && applyFaceEdit(h, r, j, "swap", type))
      edits++;
  }
  return edits;
}

function partyDamagePartners(h) {
  return state.party.filter(
    (a) =>
      a.id !== h.id &&
      alive(a) &&
      ((["rogue", "ranger", "berserker"].includes(a.job) &&
        a.reels
          .flat()
          .some((f) => ["attack", "magic", "poison"].includes(f.type))) ||
        directDamageShare(a) >= 0.3),
  ).length;
}
function paidIdentitySwap(h, type) {
  const candidates = h.reels
    .flatMap((reel, r) => reel.map((face, j) => ({ face, r, j })))
    .filter(
      ({ face }) =>
        !["class", "mystery"].includes(face.type) && face.type !== type,
    )
    .sort(
      (a, b) =>
        (a.face.type === "blank"
          ? -20
          : faceShare(h.reels.flat(), [a.face.type]) * -10) -
        (b.face.type === "blank"
          ? -20
          : faceShare(h.reels.flat(), [b.face.type]) * -10),
    );
  for (const { face, r, j } of candidates) {
    let cost = faceEditCost(h, r, j, "swap", type);
    while (cost > h.points && face.tier > 1 && applyFaceEdit(h, r, j, "weaken"))
      cost = faceEditCost(h, r, j, "swap", type);
    if (cost && cost <= h.points && applyFaceEdit(h, r, j, "swap", type))
      return 1;
  }
  return 0;
}
function repairClassIdentity(h) {
  let changed = 0;
  if (h.job === "jester") {
    for (let n = 0; n < 3 && faceShare(h.reels.flat(), ["trick"]) < 0.15; n++) {
      if (!paidIdentitySwap(h, "trick")) break;
      changed++;
    }
  }
  if (h.job === "mage" && partyDamagePartners(h) >= 2) {
    for (const type of ["heal", "block"]) {
      if (
        !h.reels.flat().some((f) => f.type === type) &&
        paidIdentitySwap(h, type)
      )
        changed++;
    }
  }
  return changed;
}
// Utility gains from temperament must not trade away the class marks repaired
// above. Preserve an existing Trick floor while allowing paid recovery toward it.
function preservesAutoClassIdentity(before, after) {
  return before.job !== "jester" ||
    faceShare(after.reels.flat(), ["trick"]) + 1e-9 >=
      Math.min(0.15, faceShare(before.reels.flat(), ["trick"]));
}
function chargedActorScore(h) {
  let score = autoCombatScore(h);
  if (h.job === "berserker")
    score += furyBonus(h) * 0.55 + ((h.fury || 0) / furyCapacity(h)) * 2;
  if (h.job === "jester")
    score +=
      ((h.anticipation || 0) / JESTER_ANTICIPATION_CAP) *
      (1 + expectedHeroEffects(h).trick * 3);
  if (h.job === "ranger") score += ((h.charge || 0) / RANGER_AIM_CAP) * 3;
  return score;
}
