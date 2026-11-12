// Bound summons are ordinary combat actors in state.party. Their seeded reels
// are fixed, and their strength tracks their master's level with a saved offset.
const NECROMANCER = Object.freeze({
  soulBase: 22,
  soulPerLevel: 2,
  damageSouls: 0.3,
  harvestSouls: 2,
  harvestDamage: 0.5,
  personalDamage: 0.9,
  killHeal: 0.12,
  killHealCap: 0.5,
  overflowHeal: 0.1,
  summonDamage: 0.8,
  zombieChance: 0.25,
  consumeBase: 0.12,
  consumeCurrentHp: 0.5,
  consumeCap: 0.5,
});
const SUMMON_TYPES = Object.freeze({
  blade: {
    name: "Boneblade",
    job: "rogue",
    role: "Damage",
    hp: 15,
    specialism: "offence",
    seal: "REND",
    icon: "sword",
    pool: [
      "attack",
      "attack",
      "attack",
      "poison",
      "stun",
      "stimulant",
      "blank",
    ],
    passives: ["venom", "ambusher"],
  },
  guard: {
    name: "Graveguard",
    job: "fighter",
    role: "Tank",
    hp: 25,
    specialism: "defence",
    seal: "GRAVE WARD",
    icon: "block",
    pool: ["block", "block", "attack", "heavy", "stun", "selfheal", "blank"],
    passives: ["carapace", "ward"],
  },
  wisp: {
    name: "Hexwisp",
    job: "mage",
    role: "Spell damage",
    hp: 13,
    specialism: "offence",
    seal: "COLD FLAME",
    icon: "magic",
    pool: ["magic", "magic", "magic", "poison", "stun", "rally", "blank"],
    passives: ["arcane", "ward"],
  },
  cantor: {
    name: "Bonecantor",
    job: "mage",
    role: "Support",
    hp: 17,
    specialism: "defence",
    seal: "MENDING CHANT",
    icon: "heal",
    pool: ["heal", "heal", "block", "rally", "magic", "selfheal", "blank"],
    passives: ["mender", "secondWind"],
  },
  bomber: {
    name: "Powderghoul",
    job: "berserker",
    role: "Explosive damage",
    hp: 18,
    specialism: "offence",
    seal: "BONEBURST",
    icon: "bomb",
    pool: [
      "attack",
      "heavy",
      "attack",
      "selfheal",
      "stimulant",
      "blank",
      "blank",
    ],
    passives: ["volatile", "carapace"],
  },
});
const SUMMON_PASSIVES = Object.freeze({
  venom: {
    name: "Venom bones",
    text: "Every third damaging roll adds 1 poison power.",
  },
  ambusher: {
    name: "First cut",
    text: "The first damaging roll each battle gains 2 physical damage.",
  },
  carapace: {
    name: "Thick bones",
    text: "Resists 1 damage from each ordinary hit.",
  },
  ward: { name: "Soul ward", text: "Every third roll adds 2 team block." },
  arcane: { name: "Cold spark", text: "Spell rolls gain 1 spell damage." },
  mender: {
    name: "Grave medicine",
    text: "Healing rolls restore 2 extra HP. Cannot heal the Necromancer.",
  },
  secondWind: {
    name: "Second wind",
    text: "Once per battle, surviving below 30% HP restores 20% maximum HP.",
  },
  volatile: { name: "Overpacked", text: "Boneburst deals 3 extra damage." },
});
const necromancerOwner = () =>
  state?.party?.find((h) => h.job === "necromancer" && !isSummon(h)) || null;
const isSummon = (h) => !!h?.summonOwnerId && !!h.summonKind;
const summonsOf = (h) =>
  (state?.party || []).filter(
    (s) => isSummon(s) && String(s.summonOwnerId) === String(h?.id),
  );
const canReceiveOrdinaryHealing = (h) => h?.job !== "necromancer";
const soulCapacity = (h) =>
  NECROMANCER.soulBase + NECROMANCER.soulPerLevel * Math.max(1, h.level || 1);
const necromancerSealPower = (h) =>
  2 + Math.floor(Math.max(0, (h.level || 1) - 1) / 4);
const harvestSpellPower = (power) =>
  Math.ceil(Math.max(0, power) * NECROMANCER.harvestDamage);
function summonRandom(seed) {
  let value = Number(seed) >>> 0 || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}
function summonSeed(value) {
  let hash = 2166136261;
  for (const c of String(value))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return hash >>> 0 || 1;
}
function normaliseNecromancer(h) {
  if (h?.job !== "necromancer" || isSummon(h)) return;
  h.souls = Math.min(
    soulCapacity(h) - 0.00001,
    Math.max(0, Number.isFinite(h.souls) ? h.souls : 0),
  );
  h.summonSerial = Math.max(0, Math.floor(Number(h.summonSerial) || 0));
  h.pendingRaises = Math.min(
    2,
    Math.max(0, Math.floor(Number(h.pendingRaises) || 0)),
  );
  for (const s of summonsOf(h)) normaliseSummon(s, h);
}
function summonDefinition(s) {
  return SUMMON_TYPES[s.summonKind] || null;
}
function summonLevel(s, h = necromancerOwner()) {
  return Math.max(
    1,
    (h?.level || s.level || 1) +
      Math.max(-1, Math.min(1, Math.floor(s.levelOffset || 0))),
  );
}
function summonFacePool(s) {
  if (s.summonKind !== "zombie") return summonDefinition(s).pool;
  const legal = CLASS_FACE_TYPES[s.job] || CLASS_FACE_TYPES.fighter;
  const pool = (s.originalFaces || []).filter(
    (t) => legal.includes(t) && !["class", "blank"].includes(t),
  );
  return pool.length
    ? [...pool.slice(0, 12), "blank"]
    : startingFaces(s.job, s.specialism).map((f) => f[0]);
}
function summonReels(s) {
  const random = summonRandom(s.buildSeed),
    pool = summonFacePool(s),
    base = 1 + Math.floor((s.level - 1) / 6);
  return [0, 1, 2].map((k) => {
    const faces = Array.from({ length: 6 }, (_, j) => {
      const type = pool[Math.floor(random() * pool.length)],
        rank = random();
      const tier =
        type === "blank"
          ? 1
          : Math.max(
              1,
              Math.min(
                4,
                base + (s.level >= 3 && rank < 0.2 ? 1 : rank > 0.82 ? -1 : 0),
              ),
            );
      return { type, tier, weight: 1 };
    });
    // Keep every build usable alone without making its focus uniform.
    if (!faces.some((f) => DAMAGE_TYPES.includes(f.type)))
      faces[0] = {
        type:
          ["wisp", "cantor"].includes(s.summonKind) ||
          ["mage", "bloodbinder"].includes(s.job)
            ? "magic"
            : "attack",
        tier: Math.min(4, base),
        weight: 1,
      };
    const focus =
      {
        blade: "attack",
        guard: "block",
        wisp: "magic",
        cantor: "heal",
        bomber: "attack",
      }[s.summonKind] || primaryFace(s);
    faces[1] = { type: focus, tier: Math.min(4, base), weight: 1 };
    if (k === 1)
      faces.push({
        type: "class",
        tier: 1,
        weight: 1,
        job: s.job,
        summonKind: s.summonKind,
      });
    return faces;
  });
}
function normaliseSummon(s, h = necromancerOwner()) {
  if (!isSummon(s) || !h) return;
  if (!SUMMON_TYPES[s.summonKind] && s.summonKind !== "zombie")
    s.summonKind = "blade";
  const def = summonDefinition(s),
    before = s.level;
  s.job =
    def?.job ||
    (CLASS_FACE_TYPES[s.job] && s.job !== "necromancer" ? s.job : "fighter");
  s.buildSeed = Number.isFinite(s.buildSeed)
    ? s.buildSeed >>> 0
    : summonSeed(s.id);
  s.levelOffset = Math.max(-1, Math.min(1, Math.floor(s.levelOffset || 0)));
  s.level = summonLevel(s, h);
  s.xp = 0;
  s.points = 0;
  s.equipment = null;
  s.trait = null;
  s.stats = { ...emptyStats(), ...s.stats };
  s.specialism =
    def?.specialism || (s.specialism === "defence" ? "defence" : "offence");
  s.summonPassive = Object.hasOwn(SUMMON_PASSIVES, s.summonPassive)
    ? s.summonPassive
    : def?.passives[0] || null;
  const baseHp = def?.hp || Math.round((CLASS_BALANCE[s.job]?.hp || 30) * 0.6);
  s.maxHp = Math.round(
    (baseHp + 4 * (s.level - 1)) * (1 + lessonBonus("vitality") / 100),
  );
  s.hp = Math.min(
    s.maxHp,
    Math.max(0, Number.isFinite(s.hp) ? Math.floor(s.hp) : s.maxHp),
  );
  s.dead = s.hp <= 0;
  if (!s.reels || before !== s.level || s.summonBuildVersion !== 1) {
    s.reels = summonReels(s);
    s.summonBuildVersion = 1;
  }
  if (!Array.isArray(s.last) || s.last.length !== 3)
    s.last = [s.reels[0][0], s.reels[1][1], s.reels[2][0]].map((f) => ({
      ...f,
    }));
  normaliseTacticalStatuses(s);
}
function defeatedSummonCandidates() {
  const victims = [
    ...(state.necromancerVictims || []),
    ...(state.graveyard || []).filter((v) => !isSummon(v)),
  ];
  return victims.filter(
    (v) =>
      !v.raised &&
      v.job !== "necromancer" &&
      Object.hasOwn(CLASS_FACE_TYPES, v.job),
  );
}
function createSummon(
  h,
  { kind = null, seed = null, corpse = null, legacy = null } = {},
) {
  seed = seed ?? rand(0x7fffffff);
  const random = summonRandom(seed),
    kinds = Object.keys(SUMMON_TYPES);
  if (!kind && !corpse) {
    const candidates = defeatedSummonCandidates();
    if (candidates.length && Math.random() < NECROMANCER.zombieChance)
      corpse = pick(candidates);
  }
  if (corpse) {
    kind = "zombie";
    corpse.raised = true;
  }
  kind = kind || kinds[Math.floor(random() * kinds.length)];
  const def = SUMMON_TYPES[kind] || SUMMON_TYPES.blade;
  const s = {
    id: `${h.id}-summon-${++h.summonSerial}`,
    summonOwnerId: h.id,
    summonKind: kind,
    buildSeed: seed,
    name: corpse ? `${corpse.name}, returned` : def.name,
    job: corpse?.job || def.job,
    specialism: corpse?.specialism || def.specialism,
    levelOffset: legacy ? 0 : Math.floor(random() * 3) - 1,
    level: 0,
    hp: legacy?.hp,
    stats: legacy?.stats || emptyStats(),
    dead: false,
    originalFaces: corpse?.reels?.flat().map((f) => f.type),
    originalName: corpse?.name || null,
    summonPassive: corpse
      ? null
      : def.passives[Math.floor(random() * def.passives.length)],
    joinedAt: Date.now(),
    joinedSteps: state.steps,
    origin: {
      depth: state.depth,
      tile: state.position,
      description: corpse
        ? "Raised from " + corpse.name
        : "Raised by " + h.name,
    },
    stun: 0,
    poison: null,
    stimulant: null,
    blackout: [],
    reelGifts: [],
    momentReceipts: {},
    traitProgress: {},
  };
  normaliseSummon(s, h);
  if (!legacy) s.hp = s.maxHp;
  return s;
}
function migrateNecromancerParty() {
  const h = necromancerOwner();
  state.necromancerVictims = Array.isArray(state.necromancerVictims)
    ? state.necromancerVictims
        .filter((v) => v && typeof v === "object" && CLASS_FACE_TYPES[v.job])
        .slice(-20)
    : [];
  state.summonArchive = Array.isArray(state.summonArchive)
    ? state.summonArchive.filter((v) => v && typeof v === "object").slice(-100)
    : [];
  if (!h) {
    state.party = state.party.filter((s) => !isSummon(s));
    return;
  }
  if (!alive(h)) {
    delete h.skeletons;
    necromancerFallen(h);
    return;
  }
  const legacy = Array.isArray(h.skeletons)
    ? h.skeletons.filter((s) => s?.hp > 0).slice(0, 2)
    : [];
  delete h.skeletons;
  state.party = state.party
    .filter((s) => !isSummon(s) || String(s.summonOwnerId) === String(h.id))
    .slice(0, 3);
  for (const old of legacy) {
    if (state.party.length >= 3) break;
    state.party.push(
      createSummon(h, { kind: "blade", seed: summonSeed(old.id), legacy: old }),
    );
  }
  normaliseNecromancer(h);
}
function healNecromancer(h, amount, from = null, label = "SOUL HARVEST") {
  if (!alive(h)) return 0;
  const n = healHero(state.party.indexOf(h), Math.max(0, Math.floor(amount)), {
    exact: true,
    soulRecovery: true,
  });
  h.stats.healingDone += n;
  if (n) {
    if (from)
      trackBloodFeedback(
        beam(from, entityArt(h), "heal", {
          fromPortrait: true,
          symbols: [{ type: "harvest", tier: 1 }],
          sourceType: "harvest",
          kind: "soul-harvest",
        }),
      );
    combatCallout(entityArt(h), `${label} · +${n}`, "soul");
  }
  return n;
}
function raiseBoundAlly(h, refresh = true) {
  const s = createSummon(h),
    run = state;
  state.party.push(s);
  h.stats.summons = (h.stats.summons || 0) + 1;
  if (refresh) {
    renderParty();
    renderTargets();
    summonMomentFX(h, s, "rise");
  } else
    requestAnimationFrame(() => {
      if (state === run && alive(s) && state.party.includes(s))
        summonMomentFX(h, s, "rise");
    });
  log(
    `${h.name} · Soul Call: ${s.name} rises — level ${s.level} ${summonRole(s)}. Choose its reels to act.`,
  );
  return s;
}
function grantSouls(h, amount, label = "SOULS") {
  if (!alive(h) || h.job !== "necromancer" || !(amount > 0) || state.over)
    return 0;
  const before = h.souls || 0,
    cap = soulCapacity(h);
  h.souls = Math.min(cap, Number((before + amount).toFixed(6)));
  const gained = h.souls - before;
  if (h.souls >= cap) {
    h.souls = 0;
    if (state.party.length < 3) {
      raiseBoundAlly(h);
    } else if (3 - state.party.filter(alive).length > (h.pendingRaises || 0)) {
      // Keep indices stable until the current multi-hit action is complete.
      h.pendingRaises = (h.pendingRaises || 0) + 1;
    } else {
      const recovered = healNecromancer(
        h,
        Math.ceil(h.maxHp * NECROMANCER.overflowHeal),
        entityArt(h),
        "SOUL SURGE",
      );
      for (const s of summonsOf(h).filter(alive)) {
        const n = healHero(
          state.party.indexOf(s),
          Math.ceil(s.maxHp * NECROMANCER.overflowHeal),
          { exact: true, soulRecovery: true },
        );
        if (n) summonMomentFX(h, s, "heal");
      }
      log(
        `${h.name} · Soul Surge: ${recovered} HP restored; bound allies recover strength.`,
      );
    }
  }
  syncNecromancer(h);
  if (gained >= 1)
    combatCallout(entityArt(h), `${label} +${Math.floor(gained)}`, "soul");
  return gained;
}
function necromancerDamage(e, damage, { selfInflicted = false } = {}) {
  const h = necromancerOwner();
  if (alive(h) && damage && !selfInflicted)
    grantSouls(h, damage * NECROMANCER.damageSouls);
}
function necromancerEnemyDeath(e) {
  const h = necromancerOwner();
  if (!alive(h) || e.hp > 0 || e.soulHarvested) return;
  e.soulHarvested = true;
  if (e.hostileRecruit && e.adventurerRecord) {
    state.necromancerVictims ??= [];
    if (!state.necromancerVictims.some((v) => v.id === e.adventurerRecord.id))
      state.necromancerVictims.push({ ...e.adventurerRecord, raised: false });
    state.necromancerVictims = state.necromancerVictims.slice(-20);
  }
  const n = Math.min(
    Math.ceil(e.maxHp * NECROMANCER.killHeal) +
      equipmentBonus(h, "soulRecovery"),
    Math.floor(h.maxHp * NECROMANCER.killHealCap),
  );
  const healed = healNecromancer(h, n, enemyArtEl(e));
  if (healed)
    log(`${h.name} · Soul Harvest: ${e.name}'s death restores ${healed} HP.`);
}
function summonRole(s) {
  return summonDefinition(s)?.role || `${className(s.job)} zombie`;
}
function summonAbilityName(s) {
  return summonDefinition(s)?.seal || classAbilityName(s.job);
}
function summonAbilityDescription(s) {
  return (
    {
      blade: "Rend: extra physical damage and poison on your target.",
      guard: "Grave Ward: strike your target and raise a large team shield.",
      wisp: "Cold Flame: spell damage and stun power against your target.",
      cantor:
        "Mending Chant: heal bound allies and grant team block. Cannot heal the Necromancer.",
      bomber:
        "Boneburst: explode against every enemy. This summon dies after the roll.",
    }[s.summonKind] || classAbilityDescription(s.job)
  );
}
function summonSealEffects(s, base) {
  const rank = Math.floor((s.level - 1) / 4);
  switch (s.summonKind) {
    case "blade":
      base.attack += 2 + rank;
      base.poison += 1;
      break;
    case "guard":
      base.attack += 1 + rank;
      base.block += 4 + rank * 2;
      break;
    case "wisp":
      base.magic += 2 + rank;
      base.stun += 1;
      break;
    case "cantor":
      base.teamHeal = (base.teamHeal || 0) + 2 + rank;
      base.block += 2 + rank;
      break;
    case "bomber":
      base.attack +=
        6 +
        Math.floor(s.level * 0.8) +
        (s.summonPassive === "volatile" ? 3 : 0);
      Object.defineProperty(base, "summonBlast", { value: true });
      break;
  }
}
function summonPassiveEffects(s, base) {
  if (!isSummon(s)) return;
  const turns = Math.max(
    0,
    (s.stats.spins || 0) - (s.battleMemo?.stats?.spins || 0),
  );
  if (s.summonPassive === "venom" && turns % 3 === 0 && base.attack > 0)
    base.poison += 1;
  if (s.summonPassive === "ward" && turns % 3 === 0) base.block += 2;
  if (s.summonPassive === "arcane" && base.magic > 0) base.magic++;
  if (s.summonPassive === "mender" && base.heal > 0) base.heal += 2;
  if (
    s.summonPassive === "ambusher" &&
    base.attack > 0 &&
    s.summonFirstCutBattle !== state.encounterSerial
  ) {
    base.attack += 2;
    s.summonFirstCutBattle = state.encounterSerial;
  }
}
function summonDamageRecovery(s) {
  if (
    !isSummon(s) ||
    !alive(s) ||
    s.summonPassive !== "secondWind" ||
    s.hp / s.maxHp > 0.3 ||
    s.summonSecondWindBattle === state.encounterSerial
  )
    return;
  s.summonSecondWindBattle = state.encounterSerial;
  const n = healHero(state.party.indexOf(s), Math.ceil(s.maxHp * 0.2), {
    exact: true,
  });
  combatCallout(entityArt(s), `SECOND WIND · +${n}`, "recovery");
  summonMomentFX(necromancerOwner(), s, "heal");
}
function recordSummonDeath(
  s,
  cause,
  { consumed = false, persist = true } = {},
) {
  if (!isSummon(s) || s.dead) return;
  const h = necromancerOwner();
  s.hp = 0;
  s.dead = true;
  s.stun = 0;
  summonMomentFX(h, s, consumed ? "consume" : "death");
  state.summonArchive ??= [];
  state.summonArchive.push({
    id: s.id,
    name: s.name,
    job: s.job,
    summonKind: s.summonKind,
    level: s.level,
    stats: { ...s.stats },
    cause,
    depth: state.depth,
  });
  state.summonArchive = state.summonArchive.slice(-100);
  if (h) {
    h.stats.summonsLost = (h.stats.summonsLost || 0) + 1;
    if (consumed) h.stats.summonsConsumed = (h.stats.summonsConsumed || 0) + 1;
  }
  log(
    `${s.name} ${consumed ? "is consumed by " + h.name : "crumbles"}: ${cause}.`,
  );
  if (persist) save();
}
function pruneSummons() {
  const master = necromancerOwner();
  if (
    !state.party.some((s) => isSummon(s) && !alive(s)) &&
    !(master?.pendingRaises > 0)
  )
    return;
  const selected = state.party[state.target];
  state.party = state.party.filter((h) => !isSummon(h) || alive(h));
  const h = necromancerOwner();
  while (
    alive(h) &&
    h.pendingRaises > 0 &&
    state.party.length < 3 &&
    !state.over
  ) {
    h.pendingRaises--;
    raiseBoundAlly(h, false);
  }
  state.target = Math.max(
    0,
    state.party.findIndex((h) => h === selected),
  );
}
function consumeSummonHealing(s, h = necromancerOwner()) {
  return h && alive(s)
    ? Math.min(
        Math.ceil(h.maxHp * NECROMANCER.consumeCap),
        Math.ceil(
          h.maxHp * NECROMANCER.consumeBase +
            s.hp * NECROMANCER.consumeCurrentHp,
        ),
      )
    : 0;
}
async function consumeSummon(id) {
  const h = necromancerOwner(),
    s = summonsOf(h).find((s) => String(s.id) === String(id));
  if (
    busy ||
    state.over ||
    !alive(h) ||
    !alive(s) ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return false;
  if (state.enemy && (h.stun || heroCannotRoll(h) || !openingEligible(h))) {
    toast("The Necromancer must be ready to consume a summon.");
    return false;
  }
  const run = state,
    inCombat = !!state.enemy,
    foes = battleEnemies().slice(),
    offered = consumeSummonHealing(s, h),
    ward = h.stunWard || 0;
  busy = true;
  sceneFast = false;
  if (inCombat) {
    state.currentHero = state.party.indexOf(h);
    state.actionSerial++;
  }
  try {
    render();
    const from = entityArt(s);
    recordSummonDeath(s, "Sacrificed for healing", {
      consumed: true,
      persist: false,
    });
    // Commit the sacrifice and its healing together before yielding to effects.
    const n = healNecromancer(h, offered, null, "CONSUME");
    await beam(from, entityArt(h), "harvest", {
      fromPortrait: true,
      symbols: [{ type: "harvest", tier: 1 }],
      kind: "consume-summon",
    });
    if (state !== run) return false;
    log(`${h.name} · Consume: ${s.name} restores ${n} HP.`);
    result(icon("harvest") + `${h.name} consumes ${s.name} · +${n} HP`);
    if (inCombat) {
      finishOpeningRoll();
      advanceCrystalAura();
      await tickPoison();
      tickStimulant(h);
      advanceStunWard(h, ward);
      if (!checkDefeat() && livingEnemies().length)
        await advanceEnemyClocks(foes);
      if (!state.over && !livingEnemies().length) await victory(foes[0]);
    }
    return true;
  } finally {
    if (state === run) {
      state.currentHero = null;
      actingEnemy = null;
      busy = false;
      sceneFast = false;
      pruneSummons();
      render();
      save();
    }
  }
}
function necromancerFallen(h) {
  if (h.job !== "necromancer" || isSummon(h)) return;
  for (const s of summonsOf(h).filter(alive))
    recordSummonDeath(s, "The binding ends");
  state.party = state.party.filter((a) => !isSummon(a));
  h.souls = 0;
  h.pendingRaises = 0;
  if (h.death && !state.graveyard.some((d) => d.id === h.id))
    state.graveyard.push(h.death);
  state.pendingDeaths = state.pendingDeaths.filter((d) => d.id !== h.id);
  if (stageResolver) {
    stageResolver("cancel");
    stageResolver = null;
  }
  closeSpotlight();
  checkDefeat();
  save();
}
function autoConsumeCandidate() {
  const h = necromancerOwner();
  if (
    !alive(h) ||
    h.hp / h.maxHp > 0.45 ||
    h.stun ||
    (state.enemy && (heroCannotRoll(h) || !openingEligible(h)))
  )
    return null;
  return (
    summonsOf(h)
      .filter(
        (s) =>
          alive(s) &&
          consumeSummonHealing(s, h) >=
            Math.min(h.maxHp - h.hp, Math.ceil(h.maxHp * 0.15)),
      )
      .sort(
        (a, b) =>
          a.hp / a.maxHp +
          expectedHeroEffects(a).damage * 0.04 -
          (b.hp / b.maxHp + expectedHeroEffects(b).damage * 0.04),
      )[0] || null
  );
}
