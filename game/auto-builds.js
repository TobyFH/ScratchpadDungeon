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
      stun: 1.7,
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
    rogue: ["assault", "venom", "enchanter"],
    mage:
      h.specialism === "defence"
        ? ["mender", "enchanter", "balanced"]
        : ["venom", "assault", "enchanter"],
    ranger: ["assault", "balanced", "enchanter"],
    berserker: ["assault", "balanced", "enchanter"],
    jester: ["trickster", "balanced", "enchanter"],
  }[h.job] || ["balanced"];
  if (!AUTO_ARCHETYPES[h.autoArchetype]) {
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
    selfharm: -0.3,
    fury: 0.2,
  };
  const limits = {
    damage: Math.max(7, 3 + state.depth * 2.1),
    block: 4 + state.depth * 0.6,
    heal: 5 + state.depth * 0.65,
    teamHeal: 4 + state.depth * 0.6,
    poison: 3 + state.depth * 0.35,
    stun: 3 + state.depth * 0.3,
    stimulant: 3 + state.depth * 0.3,
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
      assault: { stimulant: [1.2, 3], stun: [0.5, 1.5] },
      bulwark: { block: [3, 2.5], stun: [1.5, 4], stimulant: [1, 2.5] },
      balanced: {
        block: [2, 2],
        stun: [1, 3],
        stimulant: [1, 2.5],
        heal: [2, 1],
      },
      venom: { poison: [3, 2], stun: [1.2, 3], stimulant: [0.8, 2] },
      mender: {
        heal: [3, 2],
        block: [2.5, 2],
        stun: [0.6, 2],
        stimulant: [1, 2],
      },
      enchanter: { stimulant: [3, 4], stun: [1.5, 3], block: [1, 1] },
      trickster: { stun: [1.5, 2], stimulant: [1.5, 2], poison: [1.5, 2] },
    }[h.autoArchetype] || {};
  for (const [key, [target, weight]] of Object.entries(coverage))
    utility += Math.min(target, fx[key] || 0) * weight;
  const offence = fx.damage + fx.poison * 1.2,
    minDamage = solo
      ? Math.max(3, 2 + state.depth * 0.75)
      : Math.max(2, 1 + state.depth * 0.4);
  utility -= Math.max(0, minDamage - offence) * (solo ? 12 : 7);
  // Avoid support-only survivors and favour some self-recovery when alone.
  if (solo) utility += Math.min(2, fx.heal + fx.selfHeal) * 1.1;
  return utility + fx.crit * (h.job === "jester" ? 2 : 3);
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
        f.type !== "class" && !["attack", "magic", "poison"].includes(f.type),
    );
    if (j < 0) continue;
    const type = h.job === "mage" ? "magic" : "attack";
    let cost = faceEditCost(h, r, j, "swap", type);
    while (cost > h.points) {
      const candidate = h.reels
        .flatMap((reel, k) => reel.map((face, n) => ({ face, k, n })))
        .filter(
          ({ face }) =>
            face.type !== "class" &&
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
