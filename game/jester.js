// Jesters use ordinary triple criticals. Trick marks charge one bonus Punchline;
// its temporary tier increase never edits purchased faces or chains free rolls.
const JESTER_ANTICIPATION_CAP = 6;
function jesterAnticipation(h, power) {
  if (h.job !== "jester" || power <= 0) return false;
  const total = (h.anticipation || 0) + power;
  h.anticipation = Math.min(JESTER_ANTICIPATION_CAP - 1, total);
  const ready = total >= JESTER_ANTICIPATION_CAP;
  if (ready) h.anticipation = Math.min(JESTER_ANTICIPATION_CAP - 1, total - JESTER_ANTICIPATION_CAP);
  syncRangerAim(h);
  actionLabel(entityArt(h), ready ? "PUNCHLINE READY!" : `ANTICIPATION +${power}`);
  burst(entityArt(h), "paper", ready ? 38 : 12);
  return ready;
}
function anticipationMarkup(h) {
  return `<span class="aim-meter anticipation-meter" role="meter" aria-label="Jester anticipation" aria-valuemin="0" aria-valuemax="${JESTER_ANTICIPATION_CAP}" aria-valuenow="${h.anticipation || 0}" data-tooltip="Trick marks build anticipation. At 6, gain one free Punchline roll with every non-empty ordinary mark one rank stronger (maximum IV). Punchlines cannot charge another Punchline. Clears after battle."><b>TRICK ${h.anticipation || 0}/${JESTER_ANTICIPATION_CAP}</b><span class="aim-track"><i style="width:${100 * (h.anticipation || 0) / JESTER_ANTICIPATION_CAP}%"></i></span><small>next: Punchline</small></span>`;
}
function punchlineReels(h) {
  return giftedReels(h).map((reel) => reel.map((face) =>
    ["blank", "class"].includes(face.type) ? { ...face } :
      { ...face, tier: Math.min(maxFaceTier(face.type), face.tier + 1), punchline: true },
  ));
}
async function punchlineFX(h) {
  const machine = $("#machine-hero-" + state.party.indexOf(h));
  machine?.classList.add("punchline-ready");
  machine?.style.setProperty("--punchline-motion", String(preferences().shake));
  combatCallout(entityArt(h), "PUNCHLINE! · +1 REEL RANK", "gold");
  GameSound.play("jesterTrick");
  screenFX("critical", 0.65);
  burst(machine, "confetti", 48);
  shakeElement(machine, 3, "rumble");
  await feedbackPause(skip ? 180 : 420);
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
  return rollCritical(h.name, symbols, false, {
    actor: h,
    details: effectDetails(base),
  });
}
