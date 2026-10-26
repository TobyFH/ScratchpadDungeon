// Trick charges a single mark burst within the paid action. It never rerolls
// the machine, grants a second turn, rolls crits or charges another burst.
const JESTER_ANTICIPATION_CAP = 6;
function jesterAnticipation(h, power) {
  if (h.job !== "jester" || power <= 0) return false;
  const total = (h.anticipation || 0) + power;
  h.anticipation = Math.min(JESTER_ANTICIPATION_CAP - 1, total);
  const ready = total >= JESTER_ANTICIPATION_CAP;
  if (ready)
    h.anticipation = Math.min(
      JESTER_ANTICIPATION_CAP - 1,
      total - JESTER_ANTICIPATION_CAP,
    );
  syncRangerAim(h);
  actionLabel(
    entityArt(h),
    ready ? "PUNCHLINE READY!" : `ANTICIPATION +${power}`,
  );
  burst(entityArt(h), "paper", ready ? 38 : 12);
  return ready;
}
function anticipationMarkup(h) {
  return `<span class="aim-meter anticipation-meter" role="meter" aria-label="Jester anticipation" aria-valuemin="0" aria-valuemax="${JESTER_ANTICIPATION_CAP}" aria-valuenow="${h.anticipation || 0}" data-tooltip="Trick marks build anticipation. At 6, fire six random ordinary marks from your reels. Each keeps its rank; no extra roll, critical, or anticipation from the burst. Clears after battle."><b>TRICK ${h.anticipation || 0}/${JESTER_ANTICIPATION_CAP}</b><span class="aim-track"><i style="width:${(100 * (h.anticipation || 0)) / JESTER_ANTICIPATION_CAP}%"></i></span><small>next: Punchline</small></span>`;
}
async function punchlineFX(h) {
  const machine = $("#machine-hero-" + state.party.indexOf(h));
  machine?.classList.add("punchline-ready");
  machine?.style.setProperty("--punchline-motion", String(preferences().shake));
  combatCallout(entityArt(h), "PUNCHLINE! · SIX-MARK BURST", "gold");
  GameSound.play("jesterTrick");
  screenFX("critical", 0.65);
  burst(machine, "confetti", 48);
  shakeElement(machine, 3, "rumble");
  await feedbackPause(skip ? 180 : 420);
}
function giftedReels(entity) {
  return entity.reels.map((reel, k) => {
    if (entity.blackout?.includes(k) || entity.crystalLocks?.includes(k))
      return [{ type: "blank", tier: 1, blackout: true }];
    if (!entity.reelGifts?.some((g) => g.reel === k && g.uses > 0)) return reel;
    return reel.map((f) =>
      f.type === "class"
        ? f
        : {
            ...f,
            type: f.type === "blank" ? primaryFace(entity) : f.type,
            tier:
              f.type === "blank"
                ? 1
                : Math.min(maxFaceTier(f.type), f.tier + 1),
            gifted: true,
          },
    );
  });
}
function spendReelGifts(entity) {
  entity.reelGifts = (entity.reelGifts || [])
    .map((g) => ({ ...g, uses: g.uses - 1 }))
    .filter((g) => g.uses > 0);
}
async function jesterWildcard(h) {
  const enemies = livingEnemies(),
    allies = state.party.filter(alive);
  if (!enemies.length || !allies.length) return;
  const trick = rand(6),
    power = 2 + Math.floor(h.level / 3),
    enemy = pick(enemies),
    ally = pick(allies);
  state.lastWildcard = {
    heroId: h.id,
    trick,
    enemyId: enemy.id,
    allyId: ally.id,
  };
  GameSound.play("jesterTrick");
  if (trick === 0) {
    const available = [0, 1, 2].filter((k) => !enemy.blackout?.includes(k));
    if (available.length) {
      enemy.blackout ??= [];
      enemy.blackout.push(pick(available));
    }
    combatCallout(enemyArtEl(enemy), "INK IN THE GEARS", "poison");
    renderEncounter();
    document
      .querySelectorAll(`#machine-${enemyMachine(enemy)} .slot-window`)
      .forEach((el, k) => {
        if (enemy.blackout?.includes(k)) {
          el.classList.add("blacked-out");
          smokePoof(el);
        }
      });
  } else if (trick === 1) {
    ally.reelGifts = [{ reel: rand(3), uses: 2 }];
    combatCallout(entityArt(ally), "GILDED REEL · TWO ROLLS", "gold");
    renderParty();
    burst(entityArt(ally), "gold", 30);
  } else if (trick === 2) {
    combatCallout(enemyArtEl(enemy), "TURNED TABLES!", "gold");
    const symbols = await runMachine(enemyMachine(enemy), giftedReels(enemy)),
      raw = calculate(symbols),
      damage = enemyHitPower(raw, enemy);
    enemy.last = symbols;
    if (damage) {
      const n = damageEnemy(damage, h.name + " turns the tables", enemy);
      h.stats.damageDealt += n;
      beam(
        enemyArtEl(enemy),
        enemyArtEl(enemy),
        raw.magic ? "magic" : "attack",
      );
      if (!enemy.hp) h.stats.kills++;
    }
    if (raw.heal) {
      const target = allies
        .slice()
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      h.stats.healingDone += healHero(state.party.indexOf(target), raw.heal);
      beam(enemyArtEl(enemy), entityArt(target), "heal", {
        fromPortrait: true,
      });
    }
    spendReelGifts(enemy);
  } else if (trick === 3) {
    combatCallout(entityArt(h), "PIE FIGHT!", "danger");
    for (const e of enemies) {
      const n = damageEnemy(power + 2, h.name + " starts a pie fight", e, {
        attacker: h,
        impact: { type: "attack" },
      });
      h.stats.damageDealt += n;
      if (!e.hp) h.stats.kills++;
    }
    for (const a of allies)
      damageHero(
        state.party.indexOf(a),
        Math.min(1, Math.max(0, a.hp - 1)),
        "A stray Jester pie",
        { piercing: true, selfInflicted: true },
      );
  } else if (trick === 4) {
    combatCallout(entityArt(h), "MERCY IN CONFETTI", "heal");
    for (const a of allies) {
      h.stats.healingDone += healHero(state.party.indexOf(a), power + 1);
      beam(entityArt(h), entityArt(a), "heal");
    }
    for (const e of enemies) {
      const healed = Math.min(1, e.maxHp - e.hp);
      e.hp += healed;
      spendFuryOnHealing(e, healed);
      syncEnemy(e);
    }
  } else {
    combatCallout(entityArt(h), "PICK A CARD!", "gold");
    const n = damageEnemy(power + 1, h.name + " throws a sharp card", enemy, {
      attacker: h,
      impact: { type: "magic" },
    });
    h.stats.damageDealt += n;
    if (!enemy.hp) h.stats.kills++;
    h.stats.healingDone += healHero(state.party.indexOf(ally), power);
    beam(entityArt(h), entityArt(ally), "heal");
  }
  await feedbackPause(skip ? 140 : 300);
}
async function heroCriticalMultiplier(h, symbols, base) {
  return rollCritical(h.name, symbols, false, {
    actor: h,
    details: effectDetails(base),
  });
}

async function jesterMarkBurst(h) {
  const run = state,
    i = state.party.indexOf(h);
  if (i < 0 || !alive(h) || !livingEnemies().length) return;
  await punchlineFX(h);
  if (state !== run) {
    $("#machine-hero-" + i)?.classList.remove("punchline-ready");
    return;
  }
  const reels = giftedReels(h).map((reel) =>
    reel.filter((f) => f.type !== "class"),
  );
  const shots = Array.from(
    { length: COMBAT_LIMITS.punchlineShots },
    (_, k) => ({
      ...(reels[k % 3].length
        ? weightedPick(reels[k % 3])
        : { type: "blank", tier: 1 }),
    }),
  );
  const report = { heroId: h.id, shots: [], damage: 0, healing: 0, block: 0 };
  state.lastPunchline = report;
  try {
    for (const face of shots) {
      if (state !== run) return;
      if (!alive(h) || !livingEnemies().length || state.over) break;
      const base = await planHeroRoll(h, [face], { singleMark: true });
      const foe = pick(livingEnemies()),
        wounded = state.party
          .filter(alive)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      const record = {
        type: face.type,
        tier: face.tier,
        power: 0,
        actual: 0,
        targetIds: [],
      };
      report.shots.push(record);
      const impact = {
        symbols: [face],
        machineId: "hero-" + i,
        reelIndex: (report.shots.length - 1) % 3,
        kind: "punchline",
      };
      if (base.attack || base.magic) {
        record.power = (base.attack || 0) + (base.magic || 0);
        const targets = face.tier >= 3 ? livingEnemies().slice() : [foe];
        for (const target of targets) {
          record.targetIds.push(target.id);
          const dealt = damageEnemy(
            record.power,
            h.name + "’s Punchline",
            target,
            { attacker: h, impact: { ...impact, type: face.type } },
          );
          record.actual += dealt;
          report.damage += dealt;
          h.stats.damageDealt += dealt;
          if (target.hp <= 0) h.stats.kills++;
        }
      } else if (base.heal) {
        record.power = base.heal;
        record.targetIds = [wounded.id];
        await beam(entityArt(h), entityArt(wounded), "heal", impact);
        const n = healHero(state.party.indexOf(wounded), base.heal);
        record.actual = n;
        report.healing += n;
        h.stats.healingDone += n;
      } else if (base.block) {
        const before = state.block;
        grantRolledBlock(h, base.block, impact);
        record.power = base.block;
        record.actual = state.block - before;
        report.block += record.actual;
      } else if (base.poison) {
        record.power = base.poison;
        record.targetIds = [foe.id];
        applyPoison(foe, base.poison, h);
        beam(entityArt(h), enemyArtEl(foe), "poison", impact);
      } else if (base.stun) {
        record.power = base.stun;
        record.targetIds = [foe.id];
        stunEnemy(base.stun, foe);
        beam(entityArt(h), enemyArtEl(foe), "stun", impact);
      } else if (base.rally) {
        const ally = supportStimulantTarget(h);
        record.power = base.rally;
        record.targetIds = [ally.id];
        applyStimulant(ally, base.rally);
        beam(entityArt(h), entityArt(ally), "rally", impact);
      } else {
        // Trick and empty marks still fly, but cannot create an infinite burst.
        beam(entityArt(h), entityArt(h), face.type, impact);
        combatCallout(
          entityArt(h),
          face.type === "trick" ? "TRICK · CONFETTI" : "EMPTY",
          "gold",
        );
      }
      await feedbackPause(skip ? 45 : Math.max(70, 150 / Math.sqrt(pace())));
    }
    if (state !== run) return;
    if (state.lastPlayerRoll?.heroId === h.id) {
      state.lastPlayerRoll.actualDamage =
        (state.lastPlayerRoll.actualDamage || 0) + report.damage;
      state.lastPlayerRoll.actualHealing =
        (state.lastPlayerRoll.actualHealing || 0) + report.healing;
    }
    result(
      `<span>PUNCHLINE · ${report.shots.length} marks</span><span class="damage">−${report.damage} HP</span><span class="healing">+${report.healing} HP</span><span>+${report.block} block</span>`,
    );
    log(
      `${h.name} fires ${report.shots.length} marks: ${report.damage} damage, ${report.healing} healing, ${report.block} team block.`,
    );
  } finally {
    $("#machine-hero-" + i)?.classList.remove("punchline-ready");
  }
}
