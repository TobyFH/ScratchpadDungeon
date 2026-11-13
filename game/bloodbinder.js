// Damage-triggered Seeds. Caster bonuses scale one shared healing pool per burst.
// No gameplay cap or expiry; all direct hits, poison and items use damageEnemy.
const BLOOD_BINDING = Object.freeze({
  selfCostRankStep: 2,
  seedHealing: 1,
  detonationDamage: 2,
  detonationHealing: 2,
  bloomBaseSeeds: 2,
  bloomLevelStep: 2,
  maturityInterval: 4,
  maturityCap: 2,
});
const bloodSeedBonus = (h) =>
  h?.job === "bloodbinder"
    ? Math.min(
        BLOOD_BINDING.maturityCap,
        Math.floor(
          Math.max(0, (h.level || 1) - 1) / BLOOD_BINDING.maturityInterval,
        ),
      ) + equipmentBonus(h, "seeds")
    : 0;
function bloodSeedCount(e) {
  return Math.max(0, Math.floor(Number(e?.bloodSeeds?.count) || 0));
}
function bloodSeedOwner(id) {
  return (
    state.party.find((h) => h.id === id) ||
    state.graveyard.find((h) => h.id === id) ||
    state.summonArchive?.find((h) => h.id === id)
  );
}
// FIFO source receipts prevent a second caster from taking credit for old Seeds.
function bloodSeedSources(e) {
  const count = bloodSeedCount(e),
    sources = [],
    record = e?.bloodSeeds;
  let remaining = count;
  for (const part of Array.isArray(record?.sources) ? record.sources : []) {
    const n = Math.min(
      remaining,
      Math.max(0, Math.floor(Number(part.count) || 0)),
    );
    if (n) {
      sources.push({
        sourceId: part.sourceId ?? record.sourceId ?? null,
        count: n,
      });
      remaining -= n;
    }
    if (!remaining) break;
  }
  if (remaining)
    sources.push({ sourceId: record?.sourceId ?? null, count: remaining });
  return sources;
}
function appendBloodSeeds(e, count, h) {
  count = Math.min(
    Number.MAX_SAFE_INTEGER - bloodSeedCount(e),
    Math.max(0, Math.floor(count)),
  );
  if (!count) return;
  const sources = bloodSeedSources(e),
    last = sources.at(-1),
    sourceId = h?.id ?? null;
  if (last?.sourceId === sourceId) last.count += count;
  else sources.push({ sourceId, count });
  e.bloodSeeds = { count: bloodSeedCount(e) + count, sourceId, sources };
}
function normaliseBloodStatuses(e) {
  const old = e.bleeding,
    count =
      e.bloodSeeds?.count ??
      (old
        ? Math.max(1, Number(old.damage) || 1) *
          Math.max(1, Number(old.turns) || 1)
        : 0);
  const bounded = Number.isFinite(Number(count))
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(count))))
    : 0;
  if (bounded) {
    e.bloodSeeds = {
      ...e.bloodSeeds,
      count: bounded,
      sourceId: e.bloodSeeds?.sourceId ?? old?.sourceId ?? null,
    };
    e.bloodSeeds.sources = bloodSeedSources(e);
  } else e.bloodSeeds = null;
  delete e.bleeding;
  delete e.clotted;
}
function bloodSeedCost(power, symbols = null) {
  const marks = symbols?.filter((f) => f.type === "bloodseed");
  return marks?.length
    ? marks.reduce(
        (n, f) => n + Math.ceil(f.tier / BLOOD_BINDING.selfCostRankStep),
        0,
      )
    : Math.ceil(Math.max(0, power) / BLOOD_BINDING.selfCostRankStep);
}
function bloodSeedPlan(e, power, h, symbols = null) {
  const rawPower = Number.isFinite(power) ? Math.max(0, power) : 0;
  const added = rawPower > 0 ? Math.ceil(rawPower) + bloodSeedBonus(h) : 0;
  return {
    added,
    count: Math.min(Number.MAX_SAFE_INTEGER, bloodSeedCount(e) + added),
    hpCost: added
      ? Math.min(Math.max(0, h.hp - 1), bloodSeedCost(rawPower, symbols))
      : 0,
  };
}
function applyBloodSeed(e, power, h, { symbols = null } = {}) {
  if (!alive(e) || !alive(h) || !(power > 0)) return 0;
  const plan = bloodSeedPlan(e, power, h, symbols);
  if (plan.hpCost) {
    damageHero(state.party.indexOf(h), plan.hpCost, "Blood Seed offering", {
      piercing: true,
      selfInflicted: true,
      impact: { type: "bleeding" },
    });
    h.stats.bloodSpent = (h.stats.bloodSpent || 0) + plan.hpCost;
    combatCallout(
      entityArt(h),
      `BLOOD OFFERING · −${plan.hpCost} HP`,
      "bleeding",
    );
  }
  appendBloodSeeds(e, plan.added, h);
  trackBloodFeedback(
    beam(entityArt(h), enemyArtEl(e), "bloodseed", {
      fromPortrait: true,
      symbols: [{ type: "bloodseed", tier: 1 }],
      kind: "blood-seed-plant",
    }),
  );
  combatCallout(enemyArtEl(e), `BLOOD SEEDS · ${plan.count}`, "bleeding");
  syncEnemy(e);
  log(
    `${h.name} plants ${plan.added} Blood Seeds on ${e.name}: ${plan.count} ready${plan.hpCost ? `; ${plan.hpCost} HP offered` : ""}.`,
  );
  return plan.added;
}
const bloomSeedsAdded = (h) =>
  BLOOD_BINDING.bloomBaseSeeds +
  Math.floor(Math.max(0, (h?.level || 1) - 1) / BLOOD_BINDING.bloomLevelStep);
function seedHealingOffered(amount, h) {
  if (!(amount > 0)) return 0;
  if (!h) return Math.floor(amount);
  return Math.max(
    0,
    classHealingPower(h, amount) +
      passive("heal") +
      equipmentBonus(h, "heal") +
      traitBonus(h, "heal") +
      lessonBonus("recovery") +
      (h.specialism === "defence" ? HERO_TUNING.temperament : 0),
  );
}
function distributeBloodHealing(amount, h, enemy = null) {
  amount = seedHealingOffered(amount, h);
  const allocations = new Map(),
    hp = new Map(state.party.map((a) => [a, a.hp]));
  // Bound work by actual missing HP, never by an arbitrarily large stack.
  amount = Math.min(
    Math.max(0, Math.floor(amount)),
    state.party
      .filter((a) => alive(a) && canReceiveOrdinaryHealing(a))
      .reduce((n, a) => n + a.maxHp - a.hp, 0),
  );
  while (amount-- > 0) {
    const allies = state.party
      .filter(
        (a) => alive(a) && canReceiveOrdinaryHealing(a) && hp.get(a) < a.maxHp,
      )
      .sort((a, b) => hp.get(a) / a.maxHp - hp.get(b) / b.maxHp);
    if (!allies.length) break;
    const a = allies[0];
    allocations.set(a, (allocations.get(a) || 0) + 1);
    hp.set(a, hp.get(a) + 1);
  }
  let total = 0;
  for (const [ally, n] of allocations) {
    if (enemy)
      trackBloodFeedback(
        beam(enemyArtEl(enemy), entityArt(ally), "heal", {
          fromPortrait: true,
          symbols: [{ type: "heal", tier: 1 }],
          kind: "blood-seed-heal",
        }),
      );
    total += healHero(state.party.indexOf(ally), n, { exact: true });
  }
  if (h) {
    h.stats.healingDone += total;
    if (h.death) h.death.stats.healingDone += total;
  }
  return total;
}
function consumeBloodSeeds(e, damage) {
  const used = Math.min(bloodSeedCount(e), Math.max(0, Math.floor(damage)));
  if (!used) return 0;
  const sources = bloodSeedSources(e),
    remaining = [];
  let spend = used,
    healed = 0;
  for (const part of sources) {
    const n = Math.min(spend, part.count);
    spend -= n;
    if (n)
      healed += distributeBloodHealing(
        n * BLOOD_BINDING.seedHealing,
        bloodSeedOwner(part.sourceId),
        e,
      );
    if (part.count > n) remaining.push({ ...part, count: part.count - n });
  }
  const left = bloodSeedCount(e) - used;
  e.bloodSeeds = left
    ? {
        count: left,
        sourceId: remaining.at(-1)?.sourceId ?? null,
        sources: remaining,
      }
    : null;
  trackBloodFeedback(bloodSeedBurstFX(e, used));
  log(
    `${e.name} · Blood Seeds: ${used} burst; ${healed} HP shared among injured allies.`,
  );
  return used;
}
function detonateDefeatedBloodSeeds(e) {
  const count = bloodSeedCount(e);
  if (!e || e.hp > 0 || !count) return 0;
  const sources = bloodSeedSources(e);
  // Clear first: death, poison, loot and repeated cleanup cannot pay twice.
  // The foe is already dead, so this is recovery, never extra damage or Souls.
  e.bloodSeeds = null;
  trackBloodFeedback(bloodSeedBurstFX(e, count, true));
  let healing = 0;
  for (const part of sources)
    healing += distributeBloodHealing(
      part.count * BLOOD_BINDING.detonationHealing,
      bloodSeedOwner(part.sourceId),
      e,
    );
  combatCallout(enemyArtEl(e), `BLOOD SEEDS BURST · ${count}`, "bleeding");
  log(
    `${e.name} falls: all ${count} Blood Seeds detonate; ${healing} HP shared among injured allies.`,
    { important: true },
  );
  return count;
}
function bloodDetonationPlan(h = null) {
  return battleEnemies()
    .filter((e) => alive(e) && (h || bloodSeedCount(e) > 0))
    .map((e) => ({
      enemy: e,
      seeds: bloodSeedCount(e) + (h ? bloomSeedsAdded(h) : 0),
    }));
}
async function detonateBloodSeeds(h) {
  const run = state,
    plan = bloodDetonationPlan(h);
  // Bloom plants free level-scaled marks first, without another HP offering.
  for (const { enemy: e, seeds: count } of plan) {
    appendBloodSeeds(e, count - bloodSeedCount(e), h);
    syncEnemy(e);
  }
  if (plan.reduce((n, p) => n + p.seeds, 0) > 5)
    await bloodBloomSignatureFX(h, plan);
  if (state !== run) return { seeds: 0, damage: 0, healing: 0 };
  let damage = 0,
    healing = 0,
    seeds = 0;
  for (const { enemy: e, seeds: count } of plan) {
    if (state !== run || !alive(h)) break;
    const sources = bloodSeedSources(e);
    e.bloodSeeds = null;
    seeds += count;
    trackBloodFeedback(bloodSeedBurstFX(e, count, true));
    const n = damageEnemy(
      count * BLOOD_BINDING.detonationDamage,
      "Blood Bloom",
      e,
      {
        piercing: true,
        bloodTransfer: true,
        skipBloodSeeds: true,
        impact: { type: "bloodseed", critical: true },
      },
    );
    damage += n;
    h.stats.damageDealt += n;
    if (!alive(e)) h.stats.kills++;
    for (const part of sources)
      healing += distributeBloodHealing(
        part.count * BLOOD_BINDING.detonationHealing,
        bloodSeedOwner(part.sourceId) || h,
        e,
      );
    combatCallout(enemyArtEl(e), `BLOOD BLOOM · ${count}`, "bleeding");
  }
  state.lastBloodDetonation = { heroId: h.id, seeds, damage, healing };
  if (state.lastPlayerRoll?.heroId === h.id)
    state.lastPlayerRoll.actualDamage =
      (state.lastPlayerRoll.actualDamage || 0) + damage;
  log(
    `${h.name} · Blood Bloom: ${seeds} Seeds burst across all enemies, ${damage} damage and ${healing} shared healing.`,
  );
  await settleBloodFeedback();
  return { seeds, damage, healing };
}
function bloodSeedForecast(h, power, e = state.enemy) {
  const cost = Math.min(
      Math.max(0, h.hp - 1),
      h.reels.reduce(
        (n, r) =>
          n +
          r.reduce(
            (v, f) =>
              v +
              (f.type === "bloodseed"
                ? Math.ceil(f.tier / BLOOD_BINDING.selfCostRankStep)
                : 0),
            0,
          ) /
            r.length,
        0,
      ),
    ),
    existing = bloodSeedCount(e);
  const chance =
    1 - h.reels.reduce((p, r) => p * (1 - faceShare(r, ["bloodseed"])), 1);
  const potential = Math.max(0, power) + bloodSeedBonus(h) * chance,
    demand = state.party
      .filter(alive)
      .reduce((n, a) => n + Math.max(1, expectedDirectMarkPower(a)), 0);
  return {
    damage: 0,
    heal: seedHealingOffered(
      Math.min(potential, Math.max(0, demand - existing)),
      h,
    ),
    cost,
    antiheal: 0,
  };
}
function expectedDirectMarkPower(h) {
  return (h.reels || []).reduce(
    (n, r) =>
      n +
      r.reduce(
        (s, f) =>
          s + (DAMAGE_TYPES.includes(f.type) ? markDamage(f.type, f.tier) : 0),
        0,
      ) /
        Math.max(1, r.length),
    0,
  );
}
function enemyRecovery(e, amount) {
  const n = Math.min(
    Math.max(0, e.maxHp - e.hp),
    Math.floor(Math.max(0, amount)),
  );
  if (alive(e)) {
    e.hp += n;
    spendFuryOnHealing(e, n);
    return n;
  }
  return 0;
}
function bloodStatusMarkup(e) {
  const n = bloodSeedCount(e);
  return n
    ? statusBadge(
        "Blood Seeds",
        `${n} Seeds ready. Each HP of enemy damage bursts one Seed, releasing shared healing strengthened by its Bloodbinder. Blood Bloom adds Seeds to every foe, then bursts all for 2 damage and 2 base healing each. No expiry or stack cap.`,
        "bleeding-badge",
        "bloodseed",
      )
    : "";
}

function bloodSeedCaption() {
  const total = battleEnemies()
    .filter(alive)
    .reduce((n, e) => n + bloodSeedCount(e), 0);
  return state.enemy
    ? `Seeds ${bloodSeedCount(state.enemy)} target · ${total} total`
    : "Plant Seeds; wounds release healing.";
}
function syncBloodSeedCounters() {
  state.party.forEach((h, i) => {
    if (h.job !== "bloodbinder") return;
    const node = $("#hero-" + i + " .machine-footnote");
    if (node && node.textContent !== bloodSeedCaption())
      node.textContent = bloodSeedCaption();
  });
}
