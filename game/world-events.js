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
  shakeBook(7, "rumble");
  shakeElement($("#stage-card"), 8, "rumble");
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
  shopChance: 0.40,
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
    get offer() {
      return `Trade ${this.cost} gold for a supply`;
    },
    reward: "item",
    get cost() {
      return Math.round(shopPrices().potion * 0.8);
    },
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
  if (
    revealingLava ||
    !state.map[i] ||
    (state.map[i].wall && state.map[i].terrain !== "lava")
  )
    return;
  const queue = [i, ...neighbors(i)].filter(
    (j) => state.map[j].terrain === "lava" && lineOfSight(i, j),
  );
  if (!queue.length) return;
  revealingLava = true;
  try {
    const visited = new Set(),
      lit = new Set();
    for (const source of queue) {
      if (visited.has(source)) continue;
      visited.add(source);
      for (const j of [source, ...neighbors(source)]) {
        if (!lineOfSight(source, j)) continue;
        lit.add(j);
        if (state.map[j].terrain === "lava" && !visited.has(j)) queue.push(j);
      }
    }
    let newlyLit = 0;
    for (const j of lit)
      if (!state.map[j].seen) {
        markSeen(j);
        state.map[j].lavaLitAt = Date.now();
        burst($(`[data-tile="${j}"]`), "gold", 7);
        newlyLit++;
      }
    if (newlyLit) log("Lava lights the neighbouring stones.");
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

// A tunnel is an explicit bidirectional graph edge, never an event on a bridge.
// Invalid/asymmetric save pointers cannot satisfy connectivity or route repair.
function tunnelDestination(map, from) {
  const c = map[from], to = c?.tunnelTo;
  return c?.event === "tunnel" && !c.wall && Number.isInteger(to) && to !== from &&
    map[to]?.event === "tunnel" && !map[to].wall && map[to].tunnelTo === from
    ? to : null;
}
function floorNeighbors(map, from, tunnels = true) {
  const next = neighbors(from), to = tunnels ? tunnelDestination(map, from) : null;
  if (to !== null && !next.includes(to)) next.push(to);
  return next;
}
function tunnelPairCount(rules) {
  return Math.random() < (rules.includes("echoes") ? 0.5 : 0.18)
    ? Math.random() < 0.08 ? 2 : 1 : 0;
}
function addTunnels(map, rules = state?.runRules || [], { pairs = tunnelPairCount(rules) } = {}) {
  for (let pair = 0; pair < pairs; pair++) {
    const reachable = mapDistances(map),
      free = map.map((c, i) => i).filter((i) => i !== pos(1, 7) && !map[i].wall &&
        !map[i].event && !map[i].structure && map[i].terrain !== "bridge"),
      entrances = free.filter((i) => reachable.has(i));
    if (!entrances.length) break;
    // Prefer linking a detached bank/stone chamber, retaining a real barrier.
    const detached = free.filter((i) => !reachable.has(i)),
      possible = entrances.filter((i) => (detached.length ? detached : free).some((j) => tileDistance(i, j) >= 3));
    if (!possible.length) break;
    const a = pick(possible),
      b = pick((detached.length ? detached : free).filter((i) => tileDistance(a, i) >= 3));
    for (const [from, to] of [[a, b], [b, a]])
      Object.assign(map[from], { event: "tunnel", feature: "tunnel", tunnelTo: to, tunnelPair: pair });
  }
}
function ensureStairDistance(map) {
  const stair = map.findIndex((c) => c.event === "stairs");
  let distances = mapDistances(map);
  if (distances.get(stair) >= 8) return;
  let choices = [...distances.keys()].filter((i) => distances.get(i) >= 8 &&
    !map[i].event && !map[i].structure && map[i].terrain === "floor");
  if (!choices.length) {
    // A pair of shortcuts can exceptionally make the entire graph too small.
    // Retire those shortcuts and repair a conventional distant route instead.
    for (const c of map) if (c.event === "tunnel") {
      c.event = c.feature = null;
      delete c.tunnelTo;
      delete c.tunnelPair;
    }
    const far = pos(W - 2, 1);
    if (stair === far) { ensureStairsPath(map); return; }
    Object.assign(map[far], { wall: false, terrain: "floor" });
    ensureStairsPath(map, far);
    choices = [far];
  }
  const target = map[pick(choices)], old = map[stair],
    displaced = { event: target.event, feature: target.feature };
  Object.assign(target, { event: "stairs", feature: "stairs", bossDefeated: false });
  old.event = displaced.event;
  old.feature = displaced.feature;
  delete old.bossDefeated;
}
async function tunnelEncounter(c) {
  const destination = tunnelDestination(state.map, state.map.indexOf(c));
  if (
    destination === null ||
    !Number.isInteger(destination) ||
    !state.map[destination] ||
    state.map[destination].wall
  ) {
    toast("This tunnel has collapsed.");
    return false;
  }
  showSpotlight(
    "A narrow tunnel",
    "A draught rises from a passage beneath the stone.",
    `<div class="stage-art">${icon("tunnel")}</div><div class="stage-result">Follow the passage, or leave it open for later.<br>${state.map[destination].seen ? "The other entrance is marked on your map." : "The far entrance is still unexplored."}</div>`,
    "tunnel",
  );
  const choice = await eventChoice([
    { id: "tunnel-use", label: "Take the tunnel", value: true },
    { id: "tunnel-leave", label: "Leave it open", value: false },
  ]);
  closeSpotlight();
  if (choice !== "true") return false;
  const source = state.position;
  c.activated = true;
  smokePoof($("#map-player"), true);
  await feedbackPause(skip ? 100 : 260);
  markSeen(destination);
  renderMap();
  await tunnelTransit(source, destination);
  state.position = destination;
  const end = state.map[destination];
  end.visited = true;
  end.activated = true;
  end.lastVisitedStep = state.steps;
  end.fogged = false;
  end.lastNearCommand = state.moveCommands || 0;
  renderMap();
  smokePoof($("#map-player"), true);
  positionPlayer(false);
  log(
    `The tunnel leads from column ${(source % W) + 1}, row ${Math.floor(source / W) + 1} to column ${(destination % W) + 1}, row ${Math.floor(destination / W) + 1}.`,
  );
  result(
    icon("tunnel") +
      " The other end of the tunnel. Both entrances remain open.",
  );
  refreshStaleMap();
  save();
  return true;
}
