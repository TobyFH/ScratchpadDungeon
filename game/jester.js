// Jester rules use symbol kinds, not ranks: three different meaningful kinds
// Jackpot; a normal matching triple backfires. One paid action has one encore.
function jesterJackpot(symbols) {
  return (
    symbols.length === 3 &&
    symbols.every((s) => !["blank", "miss"].includes(s.type)) &&
    new Set(symbols.map((s) => s.type)).size === 3
  );
}
function jesterOdds(h) {
  let jackpot = 0,
    backfire = 0;
  const totals = h.reels.map((r) => r.reduce((n, f) => n + (f.weight || 1), 0));
  for (const a of h.reels[0])
    for (const b of h.reels[1])
      for (const c of h.reels[2]) {
        const faces = [a, b, c],
          p = faces.reduce((n, f, k) => (n * (f.weight || 1)) / totals[k], 1);
        if (jesterJackpot(faces)) jackpot += p;
        else if (matchCount(faces) === 3) backfire += p;
      }
  return { jackpot, backfire };
}
function giftedReels(entity) {
  return entity.reels.map((reel, k) => {
    if (entity.blackout?.includes(k))
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
function jesterBackfire(h) {
  h.stun = 1;
  h.stunAge = 0;
  h.stunAppliedRoll = state.stunRollSerial || 0;
  combatCallout(entityArt(h), "THE JOKE'S ON ME · STUNNED", "danger");
  burst(entityArt(h), "scary", 22);
  GameSound.play("jesterFail");
  log(h.name + " rolls matching marks and stuns themself.");
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
      e.hp = Math.min(e.maxHp, e.hp + 1);
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
  if (h.job === "jester") {
    if (jesterJackpot(symbols))
      return rollCritical(h.name, symbols, false, {
        actor: h,
        forceCrit: true,
        jackpot: true,
        details: effectDetails(base),
      });
    return 1;
  }
  return rollCritical(h.name, symbols, false, {
    actor: h,
    details: effectDetails(base),
  });
}
