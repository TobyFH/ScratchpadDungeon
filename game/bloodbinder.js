// Bloodbinder rules: one shared calculation for real rolls, previews and AI.
const BLOOD_BINDING = Object.freeze({
  turns: 3,
  potency: 12,
  basePotency: 3,
  potencyPerLevel: 0.75,
  healingBase: 0.75,
  healingPerLevel: 0.075,
  healingStart: 4,
  healingMax: 1.5,
  clotBase: 0.35,
  clotPerLevel: 0.03,
  clotStart: 3,
  clotMax: 0.65,
  exchange: 0.18,
  exchangePerLevel: 0.01,
  exchangeStart: 3,
  exchangeMax: 0.28,
  bossCap: 0.1,
  costBand: 4,
});
function bloodProfile(h) {
  const level = Math.max(1, Math.min(100, Math.floor(Number(h?.level) || 1)));
  return {
    level,
    cap: Math.min(
      BLOOD_BINDING.potency,
      BLOOD_BINDING.basePotency +
        Math.floor((level - 1) * BLOOD_BINDING.potencyPerLevel),
    ),
    healing: Math.min(
      BLOOD_BINDING.healingMax,
      BLOOD_BINDING.healingBase +
        Math.max(0, level - BLOOD_BINDING.healingStart) *
          BLOOD_BINDING.healingPerLevel,
    ),
    clot: Math.min(
      BLOOD_BINDING.clotMax,
      BLOOD_BINDING.clotBase +
        Math.max(0, level - BLOOD_BINDING.clotStart) *
          BLOOD_BINDING.clotPerLevel,
    ),
    exchange: Math.min(
      BLOOD_BINDING.exchangeMax,
      BLOOD_BINDING.exchange +
        Math.max(0, level - BLOOD_BINDING.exchangeStart) *
          BLOOD_BINDING.exchangePerLevel,
    ),
  };
}
function bloodHealingAmount(b, damage = b.damage) {
  return damage > 0
    ? Math.max(1, Math.floor(damage * bloodProfile(b).healing))
    : 0;
}
function normalisedBleeding(raw, h = null) {
  if (!raw || typeof raw !== "object") return null;
  const bounded = (n, min, max, fallback) =>
    Math.min(
      max,
      Math.max(
        min,
        Math.floor(Number.isFinite(Number(n)) ? Number(n) : fallback),
      ),
    );
  const turns = bounded(raw.turns, 0, BLOOD_BINDING.turns, 0);
  if (!turns) return null;
  // Legacy saves acquire the owner's current profile; never charge old wounds.
  const level = bloodProfile({ level: raw.level ?? h?.level }).level,
    profile = bloodProfile({ level });
  const b = {
    turns,
    duration: bounded(raw.duration, turns, BLOOD_BINDING.turns, turns),
    damage: bounded(raw.damage, 1, profile.cap, 1),
    level,
    ticks: bounded(raw.ticks, 0, BLOOD_BINDING.turns - 1, 0),
    sourceId: raw.sourceId,
  };
  b.healing = bloodHealingAmount(b);
  return b;
}
function normaliseBloodStatuses(e) {
  const owner = [...(state?.party || []), ...(state?.graveyard || [])].find(
    (h) => h.id === e.bleeding?.sourceId,
  );
  e.bleeding = normalisedBleeding(e.bleeding, owner);
  const c = e.clotted;
  e.clotted =
    c && typeof c === "object" && Math.floor(Number(c.turns)) > 0
      ? {
          turns: Math.min(
            BLOOD_BINDING.turns,
            Math.floor(Number(c.turns) || 0),
          ),
          // Old Clotted receipts keep their original 50% reduction until expiry.
          reduction: Math.min(
            BLOOD_BINDING.clotMax,
            Math.max(
              BLOOD_BINDING.clotBase,
              Number.isFinite(Number(c.reduction)) ? Number(c.reduction) : 0.5,
            ),
          ),
        }
      : null;
}
function bloodOfferingCost(strength) {
  const band = Math.ceil(strength / BLOOD_BINDING.costBand);
  return (band * (band + 1)) / 2; // Strength 1–4 / 5–8 / 9–12: 1 / 3 / 6 HP.
}
function bloodOfferingBands() {
  return Array.from(
    { length: Math.ceil(BLOOD_BINDING.potency / BLOOD_BINDING.costBand) },
    (_, i) => {
      const from = i * BLOOD_BINDING.costBand + 1,
        to = Math.min(BLOOD_BINDING.potency, (i + 1) * BLOOD_BINDING.costBand);
      return `${bloodOfferingCost(from)} HP at strength ${from}–${to}`;
    },
  ).join(", ");
}
function bloodSeedPlan(e, power, h) {
  const profile = bloodProfile(h),
    previous = normalisedBleeding(e?.bleeding, h);
  let b = previous
      ? { ...previous, level: Math.max(previous.level, profile.level) }
      : null,
    hpCost = 0;
  const available = Math.max(0, (Number(h?.hp) || 0) - 1),
    units = Math.min(
      BLOOD_BINDING.turns + BLOOD_BINDING.potency,
      Math.max(0, Math.ceil(Number(power) || 0)),
    ); // Further units are guaranteed to hit the cap and cannot change the plan.
  for (let n = 0; n < units; n++) {
    if (!b)
      b = {
        turns: 1,
        duration: 1,
        damage: 1,
        level: profile.level,
        ticks: 0,
        sourceId: h.id,
      };
    else if (b.turns < BLOOD_BINDING.turns) b.turns++;
    else {
      if (b.damage >= bloodProfile(b).cap) break;
      const cost = bloodOfferingCost(b.damage);
      if (hpCost + cost > available) break; // Never buy free potency at 1 HP or kill the caster.
      hpCost += cost;
      b.damage++;
    }
    b.duration = Math.max(b.duration, b.turns);
    b.sourceId = h.id;
  }
  if (b) b.healing = bloodHealingAmount(b);
  return { bleeding: b, hpCost, previous };
}
function bloodSeedForecast(h, power, e = state.enemy) {
  if (power <= 0) return { damage: 0, heal: 0, cost: 0, antiheal: 0 };
  const totals = { damage: 0, heal: 0, cost: 0, antiheal: 0 },
    frequency = Math.max(1, e?.frequency || 3);
  // Interpolate fractional mean power instead of rounding every forecast up.
  for (const [n, p] of [
    [Math.floor(power), 1 - (power % 1)],
    [Math.ceil(power), power % 1],
  ]) {
    if (!p || !n) continue;
    const { bleeding: b, previous: old, hpCost } = bloodSeedPlan(e, n, h);
    if (!b) continue;
    const lifetime = (s, key) => (s ? s[key] * s.turns : 0);
    totals.damage +=
      (p * Math.max(0, lifetime(b, "damage") - lifetime(old, "damage"))) /
      frequency;
    totals.heal +=
      (p * Math.max(0, lifetime(b, "healing") - lifetime(old, "healing"))) /
      frequency;
    totals.cost += p * hpCost;
    const recovery = e?.reels ? faceShare(e.reels.flat(), ["heal"]) * 4 : 0;
    totals.antiheal +=
      ((p * Math.max(0, b.turns - (old?.turns || 0))) / BLOOD_BINDING.turns) *
      bloodProfile(b).clot *
      recovery;
  }
  return totals;
}
function applyBloodSeed(e, power, h) {
  if (!alive(e) || !alive(h) || power <= 0) return;
  const { bleeding: b, hpCost } = bloodSeedPlan(e, power, h);
  if (!b) return;
  if (hpCost) {
    damageHero(state.party.indexOf(h), hpCost, "Blood Seed offering", {
      piercing: true,
      selfInflicted: true,
      impact: { type: "bleeding" },
    });
    h.stats.bloodSpent = (h.stats.bloodSpent || 0) + hpCost;
    combatCallout(entityArt(h), `BLOOD OFFERING · −${hpCost} HP`, "bleeding");
  }
  e.bleeding = b;
  combatCallout(
    enemyArtEl(e),
    `BLOOD SEED · ${b.damage} × ${b.turns}`,
    "bleeding",
  );
  beam(entityArt(h), enemyArtEl(e), "bloodseed");
  burst(enemyArtEl(e), "damage", 20);
  syncEnemy(e);
  log(
    `${h.name} plants Blood Seed on ${e.name}: ${b.damage} bleeding damage and up to ${b.healing} shared healing per enemy turn for ${b.turns} turns${hpCost ? `; ${hpCost} HP offered` : ""}.`,
  );
}
function bloodExchangePlan(h, e = state.enemy) {
  const allies = state.party.filter(alive);
  if (!alive(e) || !allies.length)
    return { loss: 0, healing: 0, ally: null, rate: 0 };
  const lowest = allies.reduce((a, b) =>
      a.hp / a.maxHp <= b.hp / b.maxHp ? a : b,
    ),
    highest = allies.reduce((a, b) =>
      a.hp / a.maxHp >= b.hp / b.maxHp ? a : b,
    ),
    enemyRate = e.hp / e.maxHp,
    difference = enemyRate - lowest.hp / lowest.maxHp;
  if (difference > 0) {
    const rate = Math.min(
        difference * bloodProfile(h).exchange,
        e.boss ? BLOOD_BINDING.bossCap : 1,
      ),
      loss = Math.min(e.hp, Math.floor(e.maxHp * rate));
    // Healing uses the percentage actually removed after rounding and boss cap.
    return {
      loss,
      healing: Math.floor((lowest.maxHp * loss) / e.maxHp),
      ally: lowest,
      rate: loss / e.maxHp,
      transfer: true,
    };
  }
  const rate =
    Math.max(0, highest.hp / highest.maxHp - enemyRate) *
    bloodProfile(h).exchange;
  return {
    loss: Math.min(
      e.hp,
      Math.floor(e.maxHp * Math.min(rate, e.boss ? BLOOD_BINDING.bossCap : 1)),
    ),
    healing: 0,
    ally: null,
    rate,
    transfer: false,
  };
}
async function bloodExchange(h, e = state.enemy) {
  const run = state;
  const plan = bloodExchangePlan(h, e),
    enemyMax = e?.maxHp;
  if (!alive(h) || !alive(e)) return;
  // Percentage loss is a separate fixed transfer: never crits, cleaves, receives
  // camp/equipment bonuses, or consumes Vulnerable a second time.
  const n = damageEnemy(plan.loss, "Blood Exchange", e, {
    piercing: true,
    bloodTransfer: true,
    impact: { type: "bloodexchange" },
  });
  h.stats.damageDealt += n;
  if (!e.hp && n) h.stats.kills++;
  const healed = plan.ally
    ? healHero(
        state.party.indexOf(plan.ally),
        Math.floor((plan.ally.maxHp * n) / enemyMax),
        { exact: true },
      )
    : 0;
  h.stats.healingDone += healed;
  combatCallout(enemyArtEl(e), `BLOOD EXCHANGE · −${n}`, "bleeding");
  const flight = beam(entityArt(h), enemyArtEl(e), "bloodseed");
  if (flight?.then) await flight;
  if (state !== run) return;
  if (healed) beam(enemyArtEl(e), entityArt(plan.ally), "heal");
  if (state.lastPlayerRoll?.heroId === h.id)
    state.lastPlayerRoll.actualDamage =
      (state.lastPlayerRoll.actualDamage || 0) + n;
  state.lastBloodExchange = {
    heroId: h.id,
    targetId: e.id,
    loss: n,
    healing: healed,
    allyId: plan.ally?.id || null,
    transfer: plan.transfer,
  };
  log(
    `${h.name} · Blood Exchange: ${n} HP taken${healed ? `, ${healed} HP restored to ${plan.ally.name}` : ""}.`,
  );
}
function distributeBloodHealing(amount, h) {
  let total = 0;
  // One shared pool, allocated to the most injured health ratios; no per-ally
  // multiplication and no revival. Shared healHero owns Fury/stun interactions.
  const allocations = new Map(),
    hp = new Map(state.party.map((a) => [a, a.hp]));
  while (amount-- > 0) {
    const allies = state.party
      .filter((a) => alive(a) && hp.get(a) < a.maxHp)
      .sort((a, b) => hp.get(a) / a.maxHp - hp.get(b) / b.maxHp);
    if (!allies.length) break;
    const ally = allies[0];
    allocations.set(ally, (allocations.get(ally) || 0) + 1);
    hp.set(ally, hp.get(ally) + 1);
  }
  for (const [ally, n] of allocations)
    total += healHero(state.party.indexOf(ally), n, { exact: true });
  if (h) {
    h.stats.healingDone += total;
    if (h.death) h.death.stats.healingDone += total;
  }
  return total;
}
async function tickBleeding(e) {
  if (!alive(e) || !state.party.some(alive) || !state.enemy || !e.bleeding)
    return;
  const b = e.bleeding,
    owner =
      state.party.find((h) => h.id === b.sourceId) ||
      state.graveyard.find((h) => h.id === b.sourceId),
    n = damageEnemy(b.damage, "Bleeding", e, {
      piercing: true,
      bloodTransfer: true,
    });
  if (owner) {
    owner.stats.damageDealt += n;
    if (!e.hp && n) owner.stats.kills++;
  }
  const healed = distributeBloodHealing(
    Math.min(b.healing, bloodHealingAmount(b, n)),
    owner,
  );
  combatCallout(enemyArtEl(e), `BLEEDING · −${n}`, "bleeding");

  b.turns--;
  log(
    `${e.name} · Bleeding: ${n} damage; ${healed} HP shared among injured allies.`,
  );
  b.ticks = (b.ticks || 0) + 1;
  // Maintaining Bleeding must not indefinitely postpone its anti-heal payoff.
  if (b.turns <= 0 || b.ticks >= BLOOD_BINDING.turns) {
    b.ticks = 0;
    if (alive(e)) {
      e.clotted = {
        turns: Math.max(e.clotted?.turns || 0, b.duration),
        reduction: Math.max(e.clotted?.reduction ?? 0, bloodProfile(b).clot),
      };
      combatCallout(
        enemyArtEl(e),
        `CLOTTED · −${Math.round(e.clotted.reduction * 100)}% HEALING`,
        "clotted",
      );
    }
  }
  if (b.turns <= 0) e.bleeding = null;
  syncEnemy(e);
  await feedbackPause(skip ? 70 : 180);
}
function finishClottedTurn(e, prior) {
  if (prior && e.clotted === prior && --prior.turns <= 0) e.clotted = null;
}
function enemyRecovery(e, amount) {
  const n = Math.min(
    Math.max(0, e.maxHp - e.hp),
    Math.floor(
      Math.max(0, amount) *
        (1 - (e.clotted?.turns > 0 ? (e.clotted.reduction ?? 0.5) : 0)),
    ),
  );
  if (alive(e)) {
    e.hp += n;
    spendFuryOnHealing(e, n);
    return n;
  }
  return 0;
}
function bloodStatusMarkup(e) {
  return `${e.bleeding ? statusBadge("Bleeding", `${e.bleeding.damage}/${bloodProfile(e.bleeding).cap} damage each enemy turn; up to ${e.bleeding.healing} HP shared among injured allies. ${e.bleeding.turns} turns left. Clotted on expiry or after ${BLOOD_BINDING.turns - (e.bleeding.ticks || 0)} more ticks: −${Math.round(bloodProfile(e.bleeding).clot * 100)}% healing. Strengthening costs the caster increasing HP; refreshing duration is free.`, "bleeding-badge", "bloodseed") : ""}${e.clotted ? statusBadge("Clotted", `Healing received reduced by ${Math.round((e.clotted.reduction ?? 0.5) * 100)}% for ${e.clotted.turns} more enemy turns.`, "clotted-badge", "bloodseed") : ""}`;
}
