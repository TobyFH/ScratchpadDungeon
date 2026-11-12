// Damage-triggered Seed stacks. One unit is one shared HP of healing.
// No gameplay cap or expiry; all direct hits, poison and items use damageEnemy.
const BLOOD_BINDING = Object.freeze({
  selfCostRankStep: 2,
  seedHealing: 1,
  detonationDamage: 1,
  maturityInterval: 4,
  maturityCap: 2,
});
const bloodSeedBonus = (h) => h?.job === "bloodbinder"
  ? Math.min(BLOOD_BINDING.maturityCap,Math.floor(Math.max(0,(h.level||1)-1)/BLOOD_BINDING.maturityInterval)) + equipmentBonus(h,"seeds")
  : 0;
function bloodSeedCount(e) {
  return Math.max(0, Math.floor(Number(e?.bloodSeeds?.count) || 0));
}
function normaliseBloodStatuses(e) {
  const old = e.bleeding;
  const count =
    e.bloodSeeds?.count ??
    (old
      ? Math.max(1, Number(old.damage) || 1) *
        Math.max(1, Number(old.turns) || 1)
      : 0);
  const bounded = Number.isFinite(Number(count))
    ? Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(count))))
    : 0;
  e.bloodSeeds = bounded
    ? {
        count: bounded,
        sourceId: e.bloodSeeds?.sourceId ?? old?.sourceId ?? null,
      }
    : null;
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
    hpCost: added ? Math.min(Math.max(0, h.hp - 1), bloodSeedCost(rawPower, symbols)) : 0,
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
  e.bloodSeeds = { count: plan.count, sourceId: h.id };
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
function distributeBloodHealing(amount, h, enemy = null) {
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
  const owner =
    state.party.find((h) => h.id === e.bloodSeeds.sourceId) ||
    state.graveyard.find((h) => h.id === e.bloodSeeds.sourceId);
  e.bloodSeeds.count -= used;
  if (!e.bloodSeeds.count) e.bloodSeeds = null;
  trackBloodFeedback(bloodSeedBurstFX(e, used));
  const healed = distributeBloodHealing(
    used * BLOOD_BINDING.seedHealing,
    owner,
    e,
  );
  log(
    `${e.name} · Blood Seeds: ${used} burst; ${healed} HP shared among injured allies.`,
  );
  return used;
}
function bloodDetonationPlan() {
  return battleEnemies()
    .filter((e) => alive(e) && bloodSeedCount(e) > 0)
    .map((e) => ({ enemy: e, seeds: bloodSeedCount(e) }));
}
async function detonateBloodSeeds(h) {
  const run = state,
    plan = bloodDetonationPlan();
  let damage = 0,
    healing = 0,
    seeds = 0;
  for (const { enemy: e, seeds: count } of plan) {
    if (state !== run || !alive(h)) break;
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
    healing += distributeBloodHealing(count * BLOOD_BINDING.seedHealing, h, e);
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
  const chance = 1-h.reels.reduce((p,r)=>p*(1-faceShare(r,["bloodseed"])),1);
  const potential = Math.max(0, power) + bloodSeedBonus(h)*chance,
    demand = state.party
      .filter(alive)
      .reduce((n, a) => n + Math.max(1, expectedDirectMarkPower(a)), 0);
  return {
    damage: 0,
    heal: Math.min(potential, Math.max(0, demand - existing)),
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
        `${n} Seeds ready. Each actual HP of damage consumes one Seed and shares one HP of healing among injured allies. No expiry or stack cap. Blood Bloom detonates all remaining Seeds for damage and shared healing.`,
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
    if (node) node.textContent = bloodSeedCaption();
  });
}
