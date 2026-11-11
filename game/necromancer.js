// One real adventurer; Skeletons are persistent auxiliaries, never party heroes.
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
  skeletonHpBase: 8,
  skeletonHpPerLevel: 3,
  skeletonAttackPerLevel: 0.45,
  skeletonDeathSouls: 3,
  skeletonDeathHeal: 0.03,
});
const necromancerOwner = () =>
  state?.party?.find((h) => h.job === "necromancer") || null;
const isSkeleton = (s) => !!s?.skeleton;
const canReceiveOrdinaryHealing = (h) =>
  h?.job !== "necromancer" && !isSkeleton(h);
const soulCapacity = (h) =>
  NECROMANCER.soulBase + NECROMANCER.soulPerLevel * Math.max(1, h.level || 1);
const skeletonMaxHp = (h) =>
  NECROMANCER.skeletonHpBase +
  NECROMANCER.skeletonHpPerLevel * Math.max(1, h.level || 1);
const skeletonAttack = (h) =>
  1 +
  Math.floor(
    Math.max(0, (h.level || 1) - 1) * NECROMANCER.skeletonAttackPerLevel,
  );
const necromancerSealPower = (h) =>
  2 + Math.floor(Math.max(0, (h.level || 1) - 1) / 4);
const harvestSpellPower = (power) =>
  Math.ceil(Math.max(0, power) * NECROMANCER.harvestDamage);
function normaliseNecromancer(h) {
  if (h?.job !== "necromancer") return;
  h.souls = Math.min(
    soulCapacity(h) - 0.00001,
    Math.max(0, Number.isFinite(h.souls) ? h.souls : 0),
  );
  h.summonSerial = Math.max(0, Math.floor(Number(h.summonSerial) || 0));
  h.skeletons = (Array.isArray(h.skeletons) ? h.skeletons : [])
    .filter((s) => s && s.hp > 0)
    .slice(0, 2)
    .map((s, i) => ({
      id: String(s.id || `${h.id}-bones-${i}`),
      skeleton: true,
      name: s.name || "Skeleton",
      hp: Math.min(skeletonMaxHp(h), Math.max(1, Math.floor(s.hp))),
      maxHp: skeletonMaxHp(h),
      born: Math.max(0, Math.floor(s.born || i)),
      stats: { damageDealt: 0, damageTaken: 0, attacks: 0, ...s.stats },
    }));
  h.summonSerial = Math.max(h.summonSerial, ...h.skeletons.map((s) => s.born));
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
function grantSouls(h, amount, label = "SOULS") {
  if (!alive(h) || h.job !== "necromancer" || !(amount > 0) || state.over)
    return 0;
  const before = h.souls || 0,
    cap = soulCapacity(h);
  // Damage grants fractional Souls. Avoid 23.99999999999999 missing a 24 bar.
  h.souls = Math.min(cap, Number((before + amount).toFixed(6)));
  const gained = h.souls - before;
  if (h.souls >= cap) {
    h.souls = 0; // One completion per grant; excess never chains free activations.
    if (h.skeletons.length < 2) {
      const s = {
        id: `${h.id}-skeleton-${++h.summonSerial}`,
        skeleton: true,
        name: "Skeleton",
        hp: skeletonMaxHp(h),
        maxHp: skeletonMaxHp(h),
        born: h.summonSerial,
        stats: { damageDealt: 0, damageTaken: 0, attacks: 0 },
      };
      h.skeletons.push(s);
      h.stats.summons = (h.stats.summons || 0) + 1;
      syncNecromancer(h);
      summonMomentFX(h, s, "rise");
      log(
        `${h.name} · Soul Call: a Skeleton rises (${s.hp} HP, ${skeletonAttack(h)} damage per action).`,
      );
    } else {
      const recovered = healNecromancer(
        h,
        Math.ceil(h.maxHp * NECROMANCER.overflowHeal),
        entityArt(h),
        "SOUL SURGE",
      );
      for (const s of h.skeletons) {
        const n = Math.min(
          s.maxHp - s.hp,
          Math.ceil(s.maxHp * NECROMANCER.overflowHeal),
        );
        s.hp += n;
        if (n) summonMomentFX(h, s, "heal");
      }
      log(
        `${h.name} · Soul Surge: ${recovered} HP restored; both Skeletons recover strength.`,
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
  if (!alive(h) || !damage || selfInflicted) return;
  grantSouls(h, damage * NECROMANCER.damageSouls);
}
function necromancerEnemyDeath(e) {
  const h = necromancerOwner();
  if (!alive(h) || e.hp > 0 || e.soulHarvested) return;
  e.soulHarvested = true;
  const n = Math.min(
    Math.ceil(e.maxHp * NECROMANCER.killHeal),
    Math.floor(h.maxHp * NECROMANCER.killHealCap),
  );
  const healed = healNecromancer(h, n, enemyArtEl(e));
  if (healed)
    log(`${h.name} · Soul Harvest: ${e.name}'s death restores ${healed} HP.`);
}
function necromancerBodyguard(h, e, { area = false, piercing = false } = {}) {
  if (
    h?.job !== "necromancer" ||
    !alive(h) ||
    e.necroGuardUsed ||
    area ||
    piercing ||
    e.piercing ||
    e.unblockable
  )
    return null;
  const s = h.skeletons
    .filter((s) => s.hp > 0)
    .sort((a, b) => b.hp - a.hp || a.born - b.born)[0];
  if (!s) return null;
  e.necroGuardUsed = true;
  combatCallout(skeletonArtEl(s), "BODYGUARD!", "soul");
  summonMomentFX(h, s, "guard");
  log(`${s.name} intercepts ${e.name}'s attack on ${h.name}.`);
  return s;
}
function damageSkeleton(h, s, amount, e, impact = {}) {
  if (!alive(h) || s.hp <= 0) return 0;
  const ward = wardActive(e),
    blocked = ward ? amount : Math.min(state.block, amount);
  if (!ward) state.block -= blocked;
  const n = Math.min(s.hp, Math.max(0, amount - blocked));
  if (blocked) {
    beam(enemyArtEl(e), $("#block"), "block", impact);
    armourFX(blocked, "Skeleton protected");
  }
  if (n) {
    beam(enemyArtEl(e), skeletonArtEl(s), impact.type || "attack", impact);
    s.hp -= n;
    s.stats.damageTaken += n;
    combatNumber(skeletonArtEl(s), n, "attack");
    shakeElement(skeletonArtEl(s), 4, "recoil");
    GameSound.play("hit");
  } else if (blocked) shieldedFX(skeletonArtEl(s));
  if (s.hp <= 0) {
    summonMomentFX(h, s, "death");
    h.skeletons = h.skeletons.filter((a) => a !== s);
    h.stats.skeletonsLost = (h.stats.skeletonsLost || 0) + 1;
    grantSouls(h, NECROMANCER.skeletonDeathSouls, "BONES");
    healNecromancer(
      h,
      Math.max(1, Math.floor(h.maxHp * NECROMANCER.skeletonDeathHeal)),
      null,
      "LAST SOUL",
    );
    log(`${s.name} crumbles. A little of its soul returns to ${h.name}.`);
  }
  renderBlock();
  syncNecromancer(h);
  return n;
}
async function skeletonCombatAction(h) {
  if (h?.job !== "necromancer" || !alive(h) || state.over) return;
  const run = state;
  for (const s of [...h.skeletons]) {
    if (state !== run || !alive(h) || state.over || !livingEnemies().length)
      break;
    if (s.hp <= 0 || !h.skeletons.includes(s)) continue;
    const e = livingEnemies().includes(state.enemy)
        ? state.enemy
        : livingEnemies()[0],
      origin = skeletonArtEl(s);
    portraitMotion(origin, "attack");
    await beam(origin, enemyArtEl(e), "attack", {
      fromPortrait: true,
      symbols: [{ type: "attack", tier: Math.min(4, skeletonAttack(h)) }],
      kind: "skeleton-attack",
    });
    if (state !== run || !alive(h) || !alive(e)) break;
    const n = damageEnemy(skeletonAttack(h), `${h.name}'s Skeleton`, e, {
      impact: { type: "attack" },
    });
    s.stats.damageDealt += n;
    s.stats.attacks++;
    h.stats.damageDealt += n;
    if (!alive(e)) h.stats.kills++;
    await feedbackPause(skip ? 45 : 120);
  }
}
function necromancerFallen(h) {
  if (h.job !== "necromancer") return;
  h.skeletons = [];
  h.souls = 0;
  if (h.death && !state.graveyard.some((d) => d.id === h.id))
    state.graveyard.push(h.death);
  state.pendingDeaths = state.pendingDeaths.filter((d) => d.id !== h.id);
  if (stageResolver) {
    stageResolver("cancel");
    stageResolver = null;
  }
  closeSpotlight();
  syncNecromancer(h);
  checkDefeat();
  save();
}
function necromancerAreaDamage(amount, e) {
  const h = necromancerOwner();
  if (!alive(h)) return;
  for (const s of [...h.skeletons])
    if (s.hp > 0)
      damageSkeleton(h, s, amount, e, {
        type: "attack",
        kind: "area",
        critical: true,
      });
}
