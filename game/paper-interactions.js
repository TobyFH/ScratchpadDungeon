// Release and shared interaction rules. Cosmetic effects never consume world RNG.
const EXPEDITION_RELEASE = "2026-11-paper-interactions-1";
function prepareUpdatedNotebook() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (!save || save.release === EXPEDITION_RELEASE) return false;
    // Profile/banking and settings have independent storage. Never erase them.
    if (save.won && save.depth === 10) recordDungeonVictory(save);
    localStorage.removeItem(SAVE_KEY);
    for (let v = 1; v <= 7; v++)
      localStorage.removeItem("scratchpad-dungeon-v" + v);
    return true;
  } catch {
    return false;
  }
}
const classMotionTempo = (h) =>
  ({
    rogue: 0.82,
    ranger: 0.94,
    fighter: 1.12,
    mage: 1.04,
    berserker: 0.95,
    jester: 0.88,
    bloodbinder: 1.06,
    necromancer: 1.14,
  })[h?.job] || 1;
function biomeSummary(kind) {
  return (
    {
      cave: "Open stone passages, underground rivers and forgotten rooms.",
      overgrown:
        "Thick roots, healing fruit and restless swarms. Watch the undergrowth.",
      fungal:
        "Glowing mushrooms spread light; purple caps poison, swollen caps explode.",
      ice: "Slippery paths and fragile crossings. Plan where your slide will end.",
      lava: "Molten channels and crumbling crust. Lava is impassable; bridges and tunnels cross it.",
      crystal:
        "Blue quartz fields can seal reels in nearby fights. Smash a deposit to silence it.",
      unstable:
        "Shifting stone and falling rocks. Keep an escape route in sight.",
      shadow:
        "Old passages darken again; something may be waiting when you return.",
      maze: "Winding corridors, secret doors and linked pressure gates.",
    }[kind] ||
    BIOMES[kind]?.note ||
    "A quiet stretch of dungeon."
  );
}
// Rejection is queued by the actual healing operation, then paid off on arrival.
const rejectedHeals = new WeakMap();
const healingAcceptance = (h) => (h?.clotted || h?.healingPenalty ? 0.5 : 1);
function rejectHealing(h, amount, reason) {
  if (!(amount > 0)) return;
  const prior = rejectedHeals.get(h);
  rejectedHeals.set(h, {
    amount: (prior?.amount || 0) + amount,
    reason,
    at: performance.now(),
    run: state,
  });
}
function rejectedHealingFX(h) {
  const pending = rejectedHeals.get(h);
  if (
    !pending ||
    pending.run !== state ||
    performance.now() - pending.at > 2500
  )
    return;
  rejectedHeals.delete(h);
  const host = entityArt(h);
  if (!host?.isConnected) return;
  const r = host.getBoundingClientRect(),
    node = document.createElement("span");
  node.className = "rejected-heal";
  node.dataset.effect = "rejected-heal";
  node.innerHTML =
    icon("heal") +
    `<small>${pending.reason === "immune" ? "NO EFFECT" : "REDUCED"}</small>`;
  node.style.left = r.left + r.width * 0.5 + "px";
  node.style.top = r.top + r.height * 0.45 + "px";
  document.body.append(node);
  const anim = node.animate(
    [
      { transform: "translate(-50%,-50%) scale(1.1)", opacity: 1 },
      {
        transform: "translate(-10%,-110%) rotate(24deg) scale(.85)",
        opacity: 1,
        offset: 0.35,
      },
      { transform: "translate(45%,15%) rotate(65deg) scale(.6)", opacity: 0 },
    ],
    { duration: skip ? 180 : 650 / Math.sqrt(pace()), fill: "forwards" },
  );
  anim.juice = true;
  liveAnimations.add(anim);
  if (utilityOpen) {
    anim.pause();
    anim.utilityPaused = true;
  }
  return anim.finished
    .catch(() => {})
    .finally(() => {
      node.remove();
      liveAnimations.delete(anim);
    });
}
function shopItemForDepth(family, depth = state.depth) {
  return lootItemForDepth(family, depth + (depth >= 3 ? 1 : 0));
}
function addPremiumShopStock(c) {
  c.premiumRolled = true;
  if (Math.random() >= 0.38) return;
  const family = pick(["potion", "bomb", "ward", "firebomb", "salve"]),
    type = lootItemForDepth(family, state.depth + 3);
  if (ITEM_DEFS[type]) {
    c.shop[type] = 1;
    c.premium = type;
  }
}
// Contextual reactions stay infrequent and use only the separate visual stream.
function reactToAllyAction(actor, roll) {
  if (!roll || Date.now() - lastPartySpeechAt < 6500 || fxRandom() > 0.23)
    return;
  const others = state.party.filter(
    (h) => h !== actor && alive(h) && Date.now() - (h.lastQuipAt || 0) > 12000,
  );
  if (!others.length) return;
  const lines =
    roll.actualDamage > 0 && actor.job === "ranger"
      ? ["Nice shot!", "Right on target.", "That’s our opening!"]
      : roll.actualHealing > 0
        ? ["Just in time.", "I needed that.", "Much better!"]
        : roll.actualDamage > 0 && roll.multiplier > 1
          ? ["What a hit!", "Keep it up!", "They felt that!"]
          : roll.totals?.block
            ? ["Behind your shield!", "That’ll help."]
            : null;
  if (!lines) return;
  const ally = visualPick(others);
  ally.lastQuipAt = lastPartySpeechAt = Date.now();
  speech(entityArt(ally), visualPick(lines));
}
const FAIRY_PRANKS = Object.freeze([
  {
    id: "rusty",
    name: "Rusty fingers",
    text: "One adventurer loses 1 level (never below level 1). Purchased reel marks stay intact.",
  },
  {
    id: "nap",
    name: "Forty winks",
    text: "One adventurer cannot roll for the first 2 party actions next battle. A solo adventurer sleeps for 1 action.",
  },
  {
    id: "dizzy",
    name: "Dizzy spell",
    text: "The party starts its next battle stunned.",
  },
  {
    id: "pep",
    name: "Wrong tonic",
    text: "Both enemies gain 4 stimulant doses at the start of the next battle.",
  },
  {
    id: "pockets",
    name: "Leaky purse",
    text: "The fairy takes 10% of your carried gold. Banked gold is safe.",
  },
  {
    id: "thorns",
    name: "Thorny welcome",
    text: "One adventurer starts the next battle with 3 turns of weak poison.",
  },
  {
    id: "chalk",
    name: "Chalk fingers",
    text: "One random reel per adventurer is blanked for their first roll next battle.",
  },
  {
    id: "brittle",
    name: "Glass slippers",
    text: "All adventurers start the next battle Vulnerable to the first damaging hit.",
  },
  {
    id: "ward",
    name: "Borrowed armour",
    text: "The enemies begin the next battle with 6 shared block.",
  },
  {
    id: "cotton",
    name: "Cotton stitches",
    text: "One adventurer receives half ordinary healing during the next battle.",
  },
]);
async function fairyPrank(forced = null) {
  const run = state,
    prank = forced
      ? FAIRY_PRANKS.find((p) => p.id === forced)
      : pick(FAIRY_PRANKS),
    heroes = state.party.filter((h) => alive(h) && !isSummon(h));
  if (!prank || !heroes.length) return;
  const hero = pick(heroes),
    receipt = { id: prank.id, heroId: hero.id };
  if (prank.id === "pockets") {
    const loss = Math.ceil(state.gold * 0.1);
    state.gold -= loss;
    receipt.gold = loss;
  } else if (prank.id === "rusty") {
    if (hero.level > 1) {
      hero.level--;
      hero.maxHp = Math.max(1, hero.maxHp - 6);
      hero.hp = Math.min(hero.hp, hero.maxHp);
      hero.xp = Math.min(hero.xp, hero.level * 12 - 1);
      if (hero.job === "necromancer")
        summonsOf(hero).forEach((s) => normaliseSummon(s, hero));
    }
  } else {
    state.fairyPranks ??= [];
    state.fairyPranks.push(receipt);
  }
  log(`Fairy prank — ${prank.name}: ${prank.text}`, {
    category: "exploration",
    important: true,
    terms: [{ name: prank.name, description: prank.text }],
  });
  showSpotlight(
    "A fairy’s prank!",
    prank.name,
    `<div class="stage-art">${icon("fairy")}</div><div class="stage-result fairy-prank-result"><b>${prank.name}</b><p>${prank.text}</p>${["nap", "thorns", "cotton", "rusty"].includes(prank.id) ? `<small>${escapeHTML(hero.name)} is the unlucky one.</small>` : ""}</div>`,
    "fairy-prank",
  );
  burst($("#stage-card"), "confetti", 45);
  GameSound.play("trait");
  await eventChoice([
    { id: "stage-confirm", label: "You little trickster…", value: true },
  ]);
  if (state === run) {
    closeSpotlight();
    save();
  }
}
function applyPendingFairyPranks() {
  const pranks = state.fairyPranks || [];
  state.fairyPranks = [];
  for (const p of pranks) {
    const hero =
      state.party.find((h) => h.id === p.heroId && alive(h)) ||
      state.party.find(alive);
    if (!hero) continue;
    switch (p.id) {
      case "nap":
        hero.fairySleep = state.party.filter(alive).length === 1 ? 1 : 2;
        break;
      case "dizzy":
        state.party.filter(alive).forEach((h) => {
          h.stun = 1;
          h.stunAge = 0;
        });
        break;
      case "pep":
        livingEnemies().forEach((e) => applyStimulant(e, 4));
        break;
      case "thorns":
        applyPoison(hero, 2, null);
        break;
      case "chalk":
        state.party.filter(alive).forEach((h) => {
          h.blackout = [rand(3)];
        });
        break;
      case "brittle":
        state.party.filter(alive).forEach((h) => {
          h.vulnerable = { createdAction: -1 };
        });
        break;
      case "ward":
        gainEnemyBlock(6);
        break;
      case "cotton":
        hero.healingPenalty = 0.5;
        break;
    }
    const d = FAIRY_PRANKS.find((x) => x.id === p.id);
    combatCallout(entityArt(hero), d.name.toUpperCase(), "event");
    log(`Fairy prank — ${d.name}: ${d.text}`, {
      category: "combat",
      important: true,
    });
  }
}
function advanceFairySleep() {
  state.party.forEach((h) => {
    if (h.fairySleep) h.fairySleep = Math.max(0, h.fairySleep - 1);
  });
}
// The two rolls are normal hostile class builds, with ordinary enemy budgets.
async function banditEncounter() {
  const run = state,
    primary = pick(["fighter", "rogue", "ranger", "berserker"]),
    secondary = pick(["fighter", "rogue", "ranger", "mage", "bloodbinder"]),
    jobs = [primary, secondary];
  const bandits = jobs.map((job, i) => {
    const h = makeHero(i ? "Rook the Tollkeeper" : "Ash the Cutpurse", job);
    h.level = Math.max(
      1,
      Math.round(
        state.party.filter(alive).reduce((n, h) => n + h.level, 0) /
          state.party.filter(alive).length,
      ),
    );
    return h;
  });
  const toll = 35 + state.depth * 22;
  state.banditEncounters = (state.banditEncounters || 0) + 1;
  state.lastBanditFloor = state.depth;
  showSpotlight(
    "Two bandits block the way",
    `${className(primary)} & ${className(secondary)} · pay or fight`,
    `<div class="bandit-preview">${bandits.map((h) => `<figure>${portraitArt(h.job, h)}<figcaption>${escapeHTML(h.name)}<small>${className(h.job)}</small></figcaption></figure>`).join("")}</div><div class="stage-result">“Your gold, or your blood.”<br>They demand <b>${toll} gold</b>.`,
    "bandits",
  );
  const choice = await eventChoice([
    { id: "bandit-fight", label: "Fight both bandits", value: "fight" },
    {
      id: "bandit-pay",
      label: `Pay ${toll} gold${state.gold < toll ? " · not enough gold" : ""}`,
      value: "pay",
      disabled: state.gold < toll,
    },
  ]);
  if (state !== run) return true;
  closeSpotlight();
  if (choice === "pay" && state.gold >= toll) {
    state.gold -= toll;
    log(`Paid two bandits ${toll} gold. They clear the passage.`, {
      category: "exploration",
    });
  } else {
    beginEncounter(false, { count: 2, adventurers: bandits });
    renderEncounter();
    log("Two bandits attack the party.", { category: "combat" });
    await encounterEntrance();
  }
  save();
  return true;
}
function maybeBandits() {
  if (state.depth < 2) return false;
  if (!state.banditSchedule)
    state.banditSchedule = [
      2 + rand(4),
      ...(Math.random() < 0.65 ? [6 + rand(5)] : []),
    ];
  if (
    (state.banditEncounters || 0) >= 2 ||
    state.depth === state.lastBanditFloor ||
    !state.banditSchedule.includes(state.depth)
  )
    return false;
  return state.steps - (state.floorStart?.steps || 0) >= 3;
}

function fitArtefactLibrary() {
  if (modalKind !== "artefacts" || $("#overlay").hidden) return false;
  const modal = $("#modal"),
    flow = modal.querySelector(".modal-flow"),
    layer = $("#overlay"),
    toolbar = $(".desk-top").getBoundingClientRect();
  const top =
    toolbar.top >= 0 && toolbar.top < innerHeight / 3
      ? Math.max(10, toolbar.bottom + 10)
      : 10;
  const bottom =
    $("#keyboard-bar").offsetHeight +
    14 +
    (innerWidth <= 760 ? $(".notebook-tabs").offsetHeight + 12 : 0);
  layer.style.paddingTop = top + "px";
  layer.style.paddingBottom = bottom + "px";
  modal.style.setProperty(
    "height",
    Math.min(690, Math.max(180, innerHeight - top - bottom)) + "px",
    "important",
  );
  modal.style.zoom = "1";
  if (flow) {
    flow.style.zoom = "1";
    flow.style.width = "100%";
  }
  return true;
}

function autoHealingRecipient(health = autoHealth()) {
  return (
    health.party
      .filter(({ h }) => canReceiveOrdinaryHealing(h) && h.hp < h.maxHp)
      .sort(
        (a, b) => a.h.hp / a.h.maxHp - b.h.hp / b.h.maxHp || a.h.hp - b.h.hp,
      )[0] || null
  );
}
