async function oldTravelEvent(c, kind) {
  if (kind === "body") {
    showSpotlight(
      "A forgotten traveller",
      "A quiet life, ended between the pages.",
      `<div class="stage-art">${corpseArt("fighter")}</div><div class="stage-result">A worn satchel rests beside the body.</div>`,
      "body",
    );
    await eventChoice([
      { id: "stage-confirm", label: "Search the satchel", value: true },
      { id: "body-leave", label: "Let them rest", value: false },
    ]).then(async (choice) => {
      closeSpotlight();
      if (choice === "true") await treasureRoll("body");
    });
    c.corpses.push({
      kind: "fighter",
      name: "A forgotten traveller",
      enemy: false,
    });
    return true;
  }
  showSpotlight(
    "ROCKFALL!",
    "The ceiling answers your footsteps.",
    `<div class="rockfall-scene">${Array.from({ length: 8 }, (_, i) => `<span style="--rock:${i}">${icon("wall")}</span>`).join("")}</div>${drawMachine(
      "rockfall",
      [
        { type: "safe", tier: 1 },
        { type: "trap", tier: 1 },
        { type: "safe", tier: 1 },
      ],
    )}${criticalSpace()}<div class="stage-result" id="rockfall-result">Keep your head down…</div>`,
    "rockfall",
  );
  shakeBook(9);
  burst($("#stage-card"), "dust", 85);
  const faces = [
      { type: "safe", tier: 1, weight: 7 },
      { type: "trap", tier: 1, weight: 2 },
      { type: "trap", tier: 2, weight: 1 },
    ],
    symbols = await runMachine("rockfall", [faces, faces, faces]);
  const danger = symbols.reduce(
      (n, f) => n + (f.type === "trap" ? f.tier : 0),
      0,
    ),
    base = danger ? danger + Math.floor(state.depth / 4) : 0;
  const mult = await rollCritical("Rockfall", symbols, false, {
    context: "rockfall",
    details: [{ label: "Falling stone", value: base, icon: "trap" }],
  });
  const target = state.party.findIndex(alive),
    damage = base ? Math.ceil(base * mult) : 0;
  $("#rockfall-result").textContent = damage
    ? `${state.party[target].name} is caught beneath ${damage} damage worth of falling stone.`
    : "The rocks miss the party. A dusty escape.";
  await eventChoice([
    { id: "stage-confirm", label: "Find solid ground", value: true },
  ]);
  closeSpotlight();
  if (damage) damageHero(target, damage, "A sudden rockfall");
  await processDeaths();
  checkDefeat();
  return true;
}

const WORLD_BALANCE = Object.freeze({
  shopChance: 0.36,
  marketChance: 0.66,
  riverChance: 0.41,
  doubleRiverChance: 0.015,
  relicWeight: 22,
});
async function minorTravelEvent(c) {
  if (
    state.steps - (state.lastMinorEventStep ?? -20) < 12 ||
    Math.random() >= 0.025
  )
    return false;
  state.lastMinorEventStep = state.steps;
  const roll = Math.random(),
    kind =
      roll < 0.3
        ? "body"
        : roll < 0.48
          ? "press"
          : roll < 0.64
            ? "cartographer"
            : roll < 0.78
              ? "altar"
              : "rockfall";
  if (["body", "rockfall"].includes(kind)) return oldTravelEvent(c, kind);
  await choiceTravelEvent(kind);
  return true;
}
const TRAVEL_EVENTS = Object.freeze({
  press: {
    title: "An abandoned coin press",
    subtitle: "A few coins gleam beneath a jammed iron lever.",
    icon: "coin",
    offer: "Turn the crank · risk a pinched hand",
    reward: "gold",
    cost: 0,
  },
  cartographer: {
    title: "A stranded cartographer",
    subtitle:
      "A traveller offers a wrapped supply for help repairing their lantern.",
    icon: "beacon",
    offer: "Trade 8 gold for a supply",
    reward: "item",
    cost: 8,
  },
  altar: {
    title: "A cracked offering bowl",
    subtitle: "Something valuable lies beneath a needle-sharp rim.",
    icon: "ruin",
    offer: "Reach inside · risk a cut",
    reward: "relic",
    cost: 0,
  },
});
async function choiceTravelEvent(kind) {
  const event = TRAVEL_EVENTS[kind],
    offered =
      kind === "cartographer"
        ? pick(availableLootTypes().filter((t) => !ITEM_DEFS[t].equipment))
        : null;
  showSpotlight(
    event.title,
    event.subtitle,
    `<div class="stage-art">${icon(event.icon)}</div><div class="stage-result">${kind === "cartographer" ? ITEM_DEFS[offered].name + " · " + ITEM_DEFS[offered].brief + (bagWillOverflow(offered) ? " · BAG FULL: make room after buying." : "") : "A careful turn of fortune could bring gold or a useful find."}</div>`,
    "travel-choice",
  );
  $("#stage-card").dataset.travelKind = kind;
  const choices = [
    { id: "travel-leave", label: "Leave it alone", value: false },
  ];
  if (state.gold >= event.cost)
    choices.unshift({ id: "stage-confirm", label: event.offer, value: true });
  const choice = await eventChoice(choices);
  closeSpotlight();
  if (choice !== "true") return false;
  if (kind === "cartographer") {
    state.gold -= event.cost;
    const type = offered;
    showSpotlight(
      "A fair exchange",
      "The traveller hands over the wrapped supply.",
      `<div class="incoming-item">${icon(ITEM_DEFS[type].icon)}<b>${ITEM_DEFS[type].name}</b><p>${ITEM_DEFS[type].description}</p></div><div class="stage-result">${bagWillOverflow(type) ? "BAG FULL · choose what to leave before collecting this." : "A free pocket, or a matching stack, is ready."}</div>`,
      "travel-reward",
    );
    await eventChoice([
      { id: "stage-confirm", label: "Collect the supply", value: true },
    ]);
    closeSpotlight();
    state.pendingItems.push({ type, count: 1 });
    await processPendingItems();
    render();
    save();
    return true;
  }
  const faces = [
    { type: "coin", tier: 1, weight: 6 },
    { type: "coin", tier: 2, weight: 2 },
    { type: "trap", tier: 1, weight: 2 },
  ];
  showSpotlight(
    event.title,
    "One careful try…",
    `${drawMachine("travel", [faces[0], faces[2], faces[0]], { title: "Reward or risk" })}${criticalSpace()}<div class="stage-result" id="travel-result">What will come loose?</div>`,
    "travel-roll",
  );
  const symbols = await runMachine("travel", [faces, faces, faces]),
    danger = symbols
      .filter((f) => f.type === "trap")
      .reduce((n, f) => n + f.tier, 0),
    coins = symbols
      .filter((f) => f.type === "coin")
      .reduce((n, f) => n + f.tier, 0);
  const baseGold = coins * (2 + state.depth),
    baseDamage = danger ? Math.ceil(danger * (0.6 + state.depth * 0.15)) : 0;
  const multiplier = await rollCritical(event.title, symbols, false, {
    context: "travel",
    details: [
      { label: "Gold", icon: "coin", value: baseGold },
      { label: "A caught hand", icon: "trap", value: baseDamage },
    ],
  });
  const gold = Math.ceil(baseGold * multiplier),
    damage = Math.ceil(baseDamage * multiplier);
  let relic = null,
    item = null;
  if (!danger && kind === "altar" && Math.random() < 0.08)
    relic = makeArtefact(state.depth);
  else if (!danger && Math.random() < 0.24) item = pick(availableLootTypes());
  $("#travel-result").innerHTML =
    `<b>+${gold} gold</b>${damage ? ` · ${damage} damage` : " · unhurt"}${relic ? `<br>Artefact: ${relic.name}` : item ? `<br>${ITEM_DEFS[item].name}${bagWillOverflow(item) ? " · BAG FULL" : ""}` : ""}`;
  if (gold) goldCelebration(gold);
  await eventChoice([
    { id: "stage-confirm", label: "Take the result and continue", value: true },
  ]);
  closeSpotlight();
  state.gold += gold;
  if (damage)
    damageHero(state.party.findIndex(alive), damage, "A dangerous discovery");
  if (relic) {
    state.artefacts.push(relic);
    if (!state.equippedArtefact && relic.key !== "revive")
      state.equippedArtefact = relic.id;
  }
  if (item) {
    state.pendingItems.push({ type: item, count: 1 });
    await processPendingItems();
  }
  await processDeaths();
  checkDefeat();
  render();
  save();
  return true;
}
const bagWillOverflow = (type) =>
  !state.bag[type] && Object.keys(state.bag).length >= 3;
function addLavaPuddles(map, depth) {
  if (depth < 5 || Math.random() >= 0.35) return;
  const count = Math.random() < 0.12 ? 2 : 1;
  for (let n = 0; n < count; n++) {
    const candidates = map
      .map((c, i) => ({ c, i }))
      .filter(
        ({ c, i }) =>
          !c.wall &&
          c.terrain === "floor" &&
          !c.event &&
          !c.structure &&
          i % W > 1 &&
          i % W < W - 2 &&
          Math.floor(i / W) > 1 &&
          Math.floor(i / W) < H - 2 &&
          Math.abs((i % W) - 1) + Math.abs(Math.floor(i / W) - 7) > 3,
      );
    if (!candidates.length) break;
    const before = mapDistances(map).size;
    const safe = candidates.filter(({ c }) => {
      c.wall = true;
      const valid = mapDistances(map).size >= before - 1;
      c.wall = false;
      return valid;
    });
    if (!safe.length) break;
    const { c } = pick(safe);
    Object.assign(c, { wall: true, terrain: "lava", room: null });
  }
}
let revealingLava = false;
function revealLavaLight(i) {
  if (revealingLava) return;
  const sources = [i, ...neighbors(i)].filter(
    (j) => state.map[j].terrain === "lava",
  );
  if (!sources.length) return;
  revealingLava = true;
  try {
    const lit = new Set(sources.flatMap((j) => [j, ...neighbors(j)]));
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const j of [...lit])
        for (const source of [j, ...neighbors(j)].filter(
          (k) => state.map[k].terrain === "lava",
        ))
          for (const k of [source, ...neighbors(source)])
            if (!lit.has(k)) {
              lit.add(k);
              expanded = true;
            }
    }
    for (const j of lit)
      if (!state.map[j].seen) {
        markSeen(j);
        state.map[j].lavaLitAt = Date.now();
        burst($(`[data-tile="${j}"]`), "gold", 7);
      }
    log("Lava lights the neighbouring stones.");
  } finally {
    revealingLava = false;
  }
}

function chaserRewardFaces(faces) {
  const items = faces.filter((f) => ITEM_DEFS[f.type]);
  const prizes = items.filter(
    (f) =>
      ITEM_DEFS[f.type].equipment ||
      (ITEM_DEFS[f.type].quality || 1) >= 3 ||
      ITEM_DEFS[f.type].family === "aegis",
  );
  return prizes.length ? prizes : items;
}
