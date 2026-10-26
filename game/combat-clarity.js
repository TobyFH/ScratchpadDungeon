// Shared interaction language: the same availability rules drive cards, AI and keys.
function availableCompanions(except = null) {
  return state.party.filter(
    (h) =>
      h !== except &&
      alive(h) &&
      !h.stun &&
      openingEligible(h) &&
      !h.shadowRest,
  );
}
function heroLockReason(h) {
  if (!alive(h)) return "FALLEN";
  if (!openingEligible(h)) return "SURPRISED · use a ready ally";
  if (h.shadowRest && availableCompanions(h).length)
    return "VEILED · use another ally";
  if (h.stun)
    return availableCompanions(h).length
      ? "STUNNED · an ally’s roll helps recovery"
      : "STUNNED · a turn will be lost";
  return "";
}
function heroCannotRoll(h) {
  return (
    !alive(h) ||
    !openingEligible(h) ||
    (!!h.shadowRest && availableCompanions(h).length > 0) ||
    (!!h.stun && availableCompanions(h).length > 0)
  );
}
function reelLockMarkup(h) {
  const reason = heroLockReason(h);
  if (!reason) return "";
  const kind = !alive(h)
    ? "fallen"
    : h.stun
      ? "stun"
      : !openingEligible(h)
        ? "surprise"
        : "shadow";
  return `<div class="reel-unavailable ${kind}" role="status">${icon(kind === "stun" ? "stun" : kind === "shadow" ? "shadow" : kind === "fallen" ? "skull" : "surprise")}<strong>${reason}</strong></div>`;
}
let soloStunTimer = null;
function scheduleStunRecovery() {
  if (
    soloStunTimer ||
    busy ||
    !state?.enemy ||
    state.over ||
    !$("#overlay").hidden ||
    !$("#spotlight").hidden
  )
    return;
  const eligible = state.party.filter((h) => alive(h) && openingEligible(h));
  if (!eligible.length || !eligible.every((h) => !!h.stun)) return;
  const run = state;
  soloStunTimer = setTimeout(
    () => {
      soloStunTimer = null;
      if (
        state !== run ||
        busy ||
        !state?.enemy ||
        state.over ||
        !$("#overlay").hidden ||
        !$("#spotlight").hidden
      )
        return;
      const hero = state.party.find(
        (h) => alive(h) && openingEligible(h) && h.stun,
      );
      if (hero && !availableCompanions(hero).length)
        spin(state.party.indexOf(hero));
    },
    Math.max(180, 550 / (skip ? 5 : pace())),
  );
}
async function advanceEnemyClocks(foes = battleEnemies().slice()) {
  for (const e of foes.filter((e) => e.hp > 0)) {
    e.countdown--;
    syncEnemy(e);
    if (e.countdown <= 0) {
      if (e.stun) {
        tryBreakStun(e, { missedAction: true });
        log(`${e.name} misses its turn to stun.`);
        combatCallout(enemyArtEl(e), "STUNNED · TURN LOST", "recovery");
        advanceRangerEnemyTurn();
        await feedbackPause(230);
      } else await enemyTurn(e);
      if (!state.over) {
        e.countdown = e.frequency;
        state.round++;
      }
    }
    if (checkDefeat()) break;
  }
}
async function missStunnedTurn(h, foes) {
  if (availableCompanions(h).length) return;
  state.actionSerial++;
  h.stats.turnsMissed++;
  const machine = $("#machine-hero-" + state.party.indexOf(h));
  machine?.classList.add("stun-breaking");
  showHeroNotice(
    h,
    "STUNNED · TURN LOST",
    "Shaking free. Enemy clocks advance.",
    "recovery",
  );
  GameSound.play("stunBreak");
  burst(machine, "paper", 28);
  shakeElement(machine, 5, "recoil");
  await feedbackPause(skip ? 180 : 500);
  tryBreakStun(h, { missedAction: true });
  advanceRangerPatience(h, false);
  tickStimulant(h);
  finishOpeningRoll();
  await tickPoison();
  if (checkDefeat()) return;
  if (!livingEnemies().length) {
    await victory(foes[0]);
    return;
  }
  log(`${h.name} loses a turn to stun and recovers. Enemy clocks advance.`);
  await advanceEnemyClocks(foes);
  await showPendingCharacterMoments();
  if (!state.over && !livingEnemies().length) await victory(foes[0]);
}
function itemCategory(type) {
  if (type === "heal" || type === "reveal")
    return { kind: "instant", label: "Instant service · used here" };
  return ITEM_DEFS[type]?.equipment
    ? { kind: "equipment", label: "Equipment · carried, then equipped" }
    : { kind: "consumable", label: "Consumable · carried in the satchel" };
}
function itemCategoryMarkup(type) {
  const c = itemCategory(type);
  return `<small class="item-category ${c.kind}">${c.label}</small>`;
}
function inspectHeroEquipment(index) {
  if (busy || !alive(state.party[index])) return;
  const h = state.party[index],
    current = EQUIPMENT_DEFS[h.equipment];
  const choices = Object.keys(state.bag).filter(
    (type) => EQUIPMENT_DEFS[type] && canEquipGear(h, EQUIPMENT_DEFS[type]),
  );
  openModal(
    `${h.name}’s equipment`,
    `<div class="equipped-detail">${icon(current?.icon || "bag")}<div><h3>${current?.name || "Empty equipment slot"}</h3><p>${current ? `<b class="equipment-scope">${equipmentScope(current)}</b> ${current.description}` : "Equip one item from your satchel."}</p></div></div><h3>Compatible equipment in the satchel</h3><div class="equipment-alternatives">${choices.map((type) => `<button data-equip-alternative="${type}">${icon(EQUIPMENT_DEFS[type].icon)}<span><b>${EQUIPMENT_DEFS[type].name}</b><small>${EQUIPMENT_DEFS[type].description}</small></span></button>`).join("") || "<p>No compatible equipment is packed.</p>"}</div><div class="modal-actions"><button data-close class="primary">Back to the party</button></div>`,
    "hero-equipment",
  );
  document
    .querySelectorAll("[data-equip-alternative]")
    .forEach(
      (b) =>
        (b.onclick = () => equipCharacter(b.dataset.equipAlternative, index)),
    );
}
const heroNoticeStates = new WeakMap();
function showHeroNotice(h, title, description, kind = "gold") {
  const note = {
    title,
    description,
    kind,
    until: Date.now() + Math.max(1000, 2300 / Math.sqrt(skip ? 5 : pace())),
    opening: title.startsWith("INITIATIVE"),
  };
  heroNoticeStates.set(h, note);
  mountHeroNotice(h, note, true);
}
function restoreHeroNotices() {
  for (const h of state.party) {
    const note = heroNoticeStates.get(h);
    if (!note) continue;
    if (
      note.until <= Date.now() ||
      (note.opening && (!h.initiative || !state.opening?.firstRoll))
    ) {
      heroNoticeStates.delete(h);
      continue;
    }
    mountHeroNotice(h, note, false);
  }
}
function mountHeroNotice(h, note, animateIn) {
  const machine = $("#machine-hero-" + state.party.indexOf(h));
  if (!machine) return;
  machine.querySelector(".hero-notice")?.remove();
  const notice = document.createElement("div");
  notice.className = "hero-notice " + note.kind;
  notice.innerHTML = `<strong>${escapeHTML(note.title)}</strong><small>${escapeHTML(note.description || "")}</small>`;
  machine.append(notice);
  machine.classList.add("showing-notice");
  if (animateIn)
    animate(
      notice,
      [
        { opacity: 0, transform: "scale(.8)" },
        { opacity: 1, transform: "scale(1.07)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 450, juice: true },
    );
  setTimeout(
    () => {
      notice.remove();
      if (!machine.querySelector(".hero-notice"))
        machine.classList.remove("showing-notice");
    },
    Math.max(0, note.until - Date.now()),
  );
}
async function showPendingCharacterMoments() {
  while (state.pendingCharacterMoments?.length) {
    const moment = state.pendingCharacterMoments.shift(),
      h = state.party.find((h) => h.id === moment.heroId);
    if (!h || !alive(h) || state.over) continue;
    showSpotlight(
      moment.title,
      `${h.name} · ${className(h.job)}`,
      `<div class="stage-art personal-moment">${portraitArt(h.job, h)}</div><div class="stage-result"><b>${escapeHTML(h.name)} ${escapeHTML(moment.text)}.</b><p>Still standing at ${h.hp} HP.</p></div>`,
      "personal-moment",
    );
    burst($("#stage-card"), "gold", 55);
    shakeElement($("#stage-card"), 4, "settle");
    await eventChoice([
      { id: "stage-confirm", label: "Still standing · continue", value: true },
    ]);
    closeSpotlight();
  }
}
function classAffinityHint(h) {
  const prices = CLASS_PRICES[h.job] || {};
  const cheap = Object.entries(prices)
    .filter(([, n]) => n < 1)
    .map(([t]) => FACE_LABELS[t]);
  const dear = Object.entries(prices)
    .filter(([, n]) => n > 1)
    .map(([t]) => FACE_LABELS[t]);
  return `${className(h.job)} prices: ${cheap.length ? cheap.join(", ") + " cost less. " : "Standard prices for native powers. "}${dear.length ? dear.join(", ") + " cost more. " : ""}Each mark keeps the same base power; criticals and class abilities differ.`;
}
function pennantRollBonus(h, symbols = []) {
  if (
    !symbols.some(
      (f) =>
        f.type === "block" ||
        (f.type === "class" &&
          (h.job === "fighter" ||
            (h.job === "mage" && h.lastResonance === "block"))),
    )
  )
    return 0;
  const bonus = passive("block");
  if (!bonus || state.pennantAction === state.actionSerial) return 0;
  state.pennantAction = state.actionSerial;
  return bonus;
}
let groupedCombatLog = null;
function beginCombatLogGroup(h, activity) {
  const previous = groupedCombatLog;
  const group = {
    run: state,
    hero: h.name,
    activity,
    entries: [],
    actualHits: [],
    previous,
  };
  groupedCombatLog = group;
  return group;
}
function finishCombatLogGroup(group, report) {
  groupedCombatLog = group.previous;
  if (state !== group.run) return;
  const damage = report.shots
    .filter((s) => s.actual > 0 && ["attack", "magic"].includes(s.type))
    .map((s) => s.actual);
  const utility = report.shots
    .filter((s) => ["poison", "stun", "rally", "stimulant"].includes(s.type))
    .map((s) => FACE_LABELS[s.type]);
  const extras = [...new Set(utility)];
  log(
    `${group.hero} · ${group.activity} ×${report.shots.length}: ${damage.length ? damage.join(" + ") + " = " + report.damage + " damage; " : ""}${report.healing} HP restored; ${report.block} block${extras.length ? "; " + extras.join(", ") : ""}.`,
  );
  const important = group.entries.filter((s) =>
    /second wind|summon|splits|falls|dies/i.test(s),
  );
  important.slice(0, 2).forEach(log);
}
function classPricesMarkup(h) {
  const types = editableTypes(h).filter((t) => t !== "blank");
  return `<section class="workshop-page workshop-prices-page" ${editorView === "prices" ? "" : "hidden inert"}><h3>${className(h.job)} specialities</h3><p>${escapeHTML(CLASS_BALANCE[h.job]?.path || "Flexible reels.")} ${escapeHTML(CLASS_COMBOS[h.job]?.hint || "")}</p><p>Affinity changes point costs, not the base power of a mark. Critical range: <b>${criticalRange(h)}</b>.</p><table class="class-price-table"><thead><tr><th>Power</th><th>Inscribe I</th><th>II</th><th>III</th><th>IV</th></tr></thead><tbody>${types.map((t) => `<tr><th>${FACE_LABELS[t]}</th><td>${classFacePrice(h, t, 3)}</td>${[2, 3, 4].map((tier) => `<td>${classFacePrice(h, t, FACE_COST[tier])}</td>`).join("")}</tr>`).join("")}</tbody></table><small>Downgrades refund half of the points actually paid. Permanent marks cannot be changed.</small></section>`;
}

function beginHeroRollLog(h) {
  const group = beginCombatLogGroup(h, "roll");
  group.heroId = h.id;
  group.before = {
    damage: h.stats.damageDealt || 0,
    healing: h.stats.healingDone || 0,
    punchlines: h.stats.punchlines || 0,
  };
  group.block = 0;
  return group;
}
function finishHeroRollLog(group, h) {
  groupedCombatLog = group.previous;
  if (state !== group.run) return;
  const roll =
    state.lastPlayerRoll?.heroId === h.id ? state.lastPlayerRoll : null;
  const hits = group.actualHits;
  const damage = hits.reduce((n, value) => n + value, 0),
    healing = Math.max(0, (h.stats.healingDone || 0) - group.before.healing);
  const punch = (h.stats.punchlines || 0) > group.before.punchlines;
  const powers = [
    ...new Set(
      (roll?.symbols || [])
        .filter((f) =>
          ["stun", "poison", "rally", "stimulant", "trick"].includes(f.type),
        )
        .map((f) => FACE_LABELS[f.type]),
    ),
  ];
  const activity = punch
    ? "roll + Punchline"
    : roll?.symbols?.some((f) => f.type === "class")
      ? classAbilityName(h)
      : "roll";
  const critical = Math.max(roll?.multiplier || 1, roll?.flurryMultiplier || 1);
  log(
    `${h.name} · ${activity}${hits.length > 1 ? " ×" + hits.length : ""}${critical > 1 ? " · CRITICAL ×" + critical : ""}: ${hits.length > 1 ? hits.join(" + ") + " = " : ""}${damage} damage; ${healing} HP restored; ${group.block} block${powers.length ? "; marks: " + powers.join(", ") : ""}.`,
  );
  group.entries
    .filter((s) =>
      /second wind|summon|splits|becomes|refuses to fall|shrugs off|turns aside/i.test(
        s,
      ),
    )
    .slice(0, 3)
    .forEach(log);
}

// Record where HP was actually lost; nested bursts contribute to their parent
// action as well, including Wildcard hits that precede the ordinary roll plan.
function recordCombatHit(actual) {
  for (let group = groupedCombatLog; group; group = group.previous)
    if (group.run === state) group.actualHits.push(actual);
}
