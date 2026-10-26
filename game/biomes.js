// Biome data is stored on the first map cell, so ordinary JSON save/HTML exports
// retain it. Presentation never rolls a theme or consumes world RNG.
const BIOMES = Object.freeze({
  shadow: {
    name: "Shadow galleries",
    tint: "#726682",
    minDepth: 4,
    names: ["The unlit margins", "The veiled corridors", "The charcoal hollow"],
    note: "Pencil-dark mist creeps back over old footsteps.",
  },
  unstable: {
    name: "Shaky caverns",
    tint: "#a08a67",
    minDepth: 2,
    names: [
      "The trembling galleries",
      "The hollow ceiling",
      "The shifting undercroft",
    ],
    note: "Loose stone ticks and settles above the torch.",
  },
  crystal: {
    name: "Crystal caves",
    tint: "#7395b6",
    minDepth: 3,
    names: ["The singing geodes", "The fractured gallery", "The quartz hollow"],
    note: "Crystal seams hum against the turning reels.",
  },
  cave: {
    name: "Caverns",
    tint: "#8e8474",
    minDepth: 1,
    names: [
      "The hollow descent",
      "The slate galleries",
      "The quiet undercroft",
    ],
    note: "Cold stone carries each footstep into the dark.",
  },
  overgrown: {
    name: "Overgrowth",
    tint: "#6c8757",
    minDepth: 1,
    names: [
      "The rootbound halls",
      "The moss-veiled cellar",
      "The tangled undercroft",
    ],
    note: "Roots stir in the dark. Leaves hide more than stone.",
  },
  fungal: {
    name: "Mushroom caves",
    tint: "#9676a2",
    minDepth: 2,
    names: [
      "The violet grotto",
      "The sporelit galleries",
      "The mycelium hollow",
    ],
    note: "Pale caps answer one another with a soft, travelling glow.",
  },
  lava: {
    name: "Lava caverns",
    tint: "#bd7448",
    minDepth: 5,
    names: ["The ember cleft", "The cinder galleries", "The furnace below"],
    note: "Warm air shivers above cracks in the blackened stone.",
  },
  ice: {
    name: "Frozen caves",
    tint: "#729eb4",
    minDepth: 3,
    names: [
      "The rimebound vault",
      "The glassy descent",
      "The frozen undercroft",
    ],
    note: "Frost muffles the cave. Smooth ice makes every step uncertain.",
  },
});
function floorBiome(map = state.map) {
  return BIOMES[map?.[0]?.biome] ? map[0].biome : "cave";
}
function floorName(map = state.map) {
  return map[0].floorName || BIOMES[floorBiome(map)].names[0];
}
function biomeChance(depth) {
  return Math.min(0.72, 0.16 + Math.max(0, depth - 1) * 0.062);
}
function assignFloorBiome(map, depth, { force = null } = {}) {
  const options = Object.keys(BIOMES).filter(
    (k) => k !== "cave" && depth >= BIOMES[k].minDepth,
  );
  const kind =
    force && BIOMES[force]
      ? force
      : options.length && Math.random() < biomeChance(depth)
        ? pick(options)
        : "cave";
  map[0].biome = kind;
  map[0].floorName = pick(BIOMES[kind].names);
  const candidates = map
    .map((c, i) => i)
    .filter(
      (i) =>
        i !== pos(1, 7) &&
        !map[i].wall &&
        map[i].terrain === "floor" &&
        !map[i].structure,
    );
  if (kind === "overgrown") {
    for (const i of candidates)
      if (Math.random() < 0.27) map[i].terrain = "overgrown";
  } else if (kind === "fungal") {
    // Connected patches provide a readable chain rather than scattered singles.
    const free = candidates.filter((i) => !map[i].event);
    const spread = free.length ? [pick(free)] : [];
    const grown = new Set();
    for (const i of spread) {
      if (grown.size >= 14) break;
      if (grown.has(i) || !candidates.includes(i) || map[i].event) continue;
      grown.add(i);
      map[i].terrain = "mushroom";
      for (const j of neighbors(i, true))
        if (
          !grown.has(j) &&
          candidates.includes(j) &&
          !map[j].event &&
          Math.random() < 0.65
        )
          spread.push(j);
    }
  } else if (kind === "ice") {
    for (const i of candidates) {
      if (map[i].event || Math.random() >= 0.17) continue;
      map[i].terrain = "ice";
      // Walking connectivity alone is insufficient: the forced slide must also
      // admit a real route. Reject only the newly proposed slippery tile.
      if (!allTilesCanReachStairs(map)) map[i].terrain = "floor";
    }
  } else if (kind === "lava" || kind === "crystal") {
    // Rooms are connected, non-blocking reveal groups. Do not turn one of
    // their floor cells into a hazard after room generation has validated it.
    const free = candidates.filter((i) => !map[i].event && !map[i].room);
    const placeBarrier = (i) => {
      const before = mapDistances(map).size;
      map[i].wall = true;
      map[i].terrain = kind === "crystal" ? "crystal" : "lava";
      if (mapDistances(map).size < before - 1) {
        map[i].wall = false;
        map[i].terrain = "floor";
        return false;
      }
      return true;
    };
    for (const i of free) if (Math.random() < 0.07) placeBarrier(i);
    if (kind === "crystal" && !map.some((c) => c.terrain === "crystal"))
      free.some(placeBarrier);
  }
}
function normaliseBiome(map = state.map) {
  state.crystalRolls = Math.max(0, Math.floor(Number(state.crystalRolls) || 0));
  // Repair old one-way ice layouts without rerolling discoveries or walls.
  if (map.some((c) => c.terrain === "ice") && !allTilesCanReachStairs(map)) {
    for (const c of map.filter((c) => c.terrain === "ice").reverse()) {
      c.terrain = "floor";
      if (allTilesCanReachStairs(map)) break;
    }
  }
  if (!BIOMES[map[0].biome]) map[0].biome = "cave";
  if (typeof map[0].floorName !== "string" || !map[0].floorName.trim())
    map[0].floorName = BIOMES[floorBiome(map)].names[(state.depth - 1) % 3];
}
function updateBiomePresentation() {
  const theme = floorBiome(),
    def = BIOMES[theme];
  document.body.dataset.biome = theme;
  $(".map-wrap")?.style.setProperty("--biome-tint", def.tint);
  $("#floor-name").textContent = floorName();
  $("#floor-name").title = def.name;
  const key = $("#biome-key"),
    terrain = {
      overgrown: ["overgrown", "Overgrowth"],
      fungal: ["mushroom", "Mushrooms"],
      ice: ["ice", "Ice"],
      crystal: ["crystal", "Crystal · aura"],
      shadow: ["shadow", "Returning shadows"],
      unstable: ["stalactite", "Falling stone"],
    }[theme];
  if (key) {
    key.hidden = !terrain;
    key.innerHTML = terrain ? icon(terrain[0]) + terrain[1] : "";
  }
}
// Returns all physical slide steps, including its landing tile. An ice tile
// against a wall is a valid stopping position. Portals are optional, never ice.
function glideCells(map, from, entry, { knownOnly = false } = {}) {
  const cells = [entry],
    dx = (entry % W) - (from % W),
    dy = Math.floor(entry / W) - Math.floor(from / W);
  let n = entry;
  while (["ice", "mudslide"].includes(map[n].terrain)) {
    const x = (n % W) + dx,
      y = Math.floor(n / W) + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) break;
    const next = pos(x, y);
    if (knownOnly && !map[next].seen) return [...cells, next];
    if (map[next].wall) break;
    cells.push(next);
    n = next;
  }
  return cells;
}
function movementRoute(
  map,
  start,
  goal,
  { omniscient = false, ignoreIce = false, directIce = true } = {},
) {
  if (!Number.isInteger(goal) || !map[goal]) return null;
  const mud = map
    .map((c, i) => (c.terrain === "mudslide" ? i : -1))
    .filter((i) => i >= 0);
  const bit = new Map(mud.map((i, k) => [i, 2 ** k]));
  const encode = (i, mask) => i + mask * map.length;
  const startKey = encode(start, 0),
    cost = new Map([[startKey, 0]]),
    came = new Map(),
    queue = [startKey],
    closed = new Set();
  const blocked = (i, mask) => map[i].wall || !!(mask & (bit.get(i) || 0));
  while (queue.length) {
    queue.sort((a, b) => cost.get(a) - cost.get(b));
    const key = queue.shift();
    if (closed.has(key)) continue;
    closed.add(key);
    const n = key % map.length,
      mask = Math.floor(key / map.length);
    if (n === goal) {
      const path = [];
      let cursor = key;
      while (cursor !== startKey) {
        const edge = came.get(cursor);
        if (!edge) return null;
        path.unshift(...edge.cells);
        cursor = edge.from;
      }
      return path;
    }
    for (const j of floorNeighbors(map, n)) {
      const portal = !neighbors(n).includes(j),
        c = map[j];
      if (portal && !omniscient && (!map[n].seen || !c.seen)) continue;
      if (blocked(j, mask) && (omniscient || c.seen)) continue;
      if (!omniscient && !c.seen && j !== goal) continue;
      let cells =
        !portal &&
        !ignoreIce &&
        (c.seen || omniscient) &&
        ["ice", "mudslide"].includes(c.terrain)
          ? glideCells(map, n, j, { knownOnly: !omniscient })
          : [j];
      if (
        !omniscient &&
        directIce &&
        j === goal &&
        ["ice", "mudslide"].includes(c.terrain) &&
        cells.some((i) => !map[i].seen)
      )
        cells = [j];
      if (!omniscient && cells.some((i) => !map[i].seen && i !== goal))
        continue;
      let nextMask = mask,
        valid = true;
      for (const i of cells) {
        if (blocked(i, nextMask) && (omniscient || map[i].seen)) {
          valid = false;
          break;
        }
        if (bit.has(i)) nextMask |= bit.get(i);
      }
      if (!valid) continue;
      const end = cells.at(-1),
        nextKey = encode(end, nextMask);
      const danger = !omniscient
        ? cells.filter(
            (i) =>
              i !== goal &&
              ["enemy", "guardian", "stronghold", "trap"].includes(
                map[i].event,
              ),
          ).length * 1000
        : 0;
      const next = cost.get(key) + cells.length + danger;
      if (directIce && n === start && j === goal && end !== goal) return cells;
      if (next < (cost.get(nextKey) ?? Infinity)) {
        cost.set(nextKey, next);
        came.set(nextKey, { from: key, cells });
        queue.push(nextKey);
      }
    }
  }
  return null;
}
function movementPlan(goal) {
  const path = movementRoute(state.map, state.position, goal);
  if (path)
    return { path, goal: path.at(-1) ?? goal, requested: goal, stopped: false };
  const relaxed = movementRoute(state.map, state.position, goal, {
    ignoreIce: true,
  });
  if (!relaxed) return null;
  const ice = relaxed.findIndex(
    (i) =>
      state.map[i].seen && ["ice", "mudslide"].includes(state.map[i].terrain),
  );
  if (ice < 0) return null;
  const prefix = relaxed.slice(0, ice);
  return {
    path: prefix,
    goal: prefix.at(-1) ?? state.position,
    requested: goal,
    stopped: true,
  };
}
function revealMushrooms(source) {
  if (state.map[source]?.terrain !== "mushroom") return;
  const queue = [source],
    visited = new Set([source]);
  let revealed = 0;
  for (const i of queue) {
    for (const j of neighbors(i, true)) {
      if (
        visited.has(j) ||
        state.map[j].terrain !== "mushroom" ||
        !lineOfSight(i, j)
      )
        continue;
      visited.add(j);
      queue.push(j);
      if (!state.map[j].seen && revealed < 8) {
        markSeen(j);
        revealed++;
        const el = $(`[data-tile="${j}"]`);
        burst(el, "poison", 8);
      }
      if (revealed >= 8) break;
    }
    if (revealed >= 8) break;
  }
  if (revealed) {
    state.lastMushroomReveal = { source, count: revealed };
    log(`Mushroom light reveals ${revealed} nearby caps.`);
    renderMap();
  }
}
function biomeStep(i) {
  const c = state.map[i];
  if (c.terrain === "mushroom") revealMushrooms(i);
}
function biomeCoverArt(c) {
  if (["mudslide", "mudwall", "stalactite"].includes(c.terrain))
    return icon(c.terrain);
  return c.terrain === "ice"
    ? icon("ice")
    : c.terrain === "mushroom"
      ? icon("mushroom")
      : c.terrain === "overgrown"
        ? icon("overgrown")
        : "";
}

// Reverse reachability catches one-way traps from EVERY approach, including
// stopping on ice after an encounter. Reciprocal tunnels remain valid edges.
function allTilesCanReachStairs(map) {
  const goal = map.findIndex((c) => c.event === "stairs");
  if (goal < 0) return false;
  const reverse = Array.from({ length: map.length }, () => []);
  map.forEach((c, from) => {
    if (c.wall) return;
    for (const entry of floorNeighbors(map, from)) {
      if (map[entry].wall) continue;
      const portal = !neighbors(from).includes(entry);
      const end =
        !portal && ["ice", "mudslide"].includes(map[entry].terrain)
          ? glideCells(map, from, entry).at(-1)
          : entry;
      reverse[end].push(from);
    }
  });
  const reached = new Set([goal]),
    queue = [goal];
  for (const i of queue)
    for (const j of reverse[i])
      if (!reached.has(j)) {
        reached.add(j);
        queue.push(j);
      }
  return map.every((c, i) => c.wall || reached.has(i));
}
function crystalSources(origin = state.position, knownOnly = false) {
  return state.map
    .map((c, i) =>
      c.terrain === "crystal" &&
      (!knownOnly || c.seen) &&
      tileDistance(i, origin) <= 2 &&
      lineOfSight(origin, i)
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
}
function advanceCrystalAura() {
  if (!state.enemy || !livingEnemies().length || !crystalSources().length)
    return;
  state.crystalRolls = (state.crystalRolls || 0) + 1;
  if (state.crystalRolls % 3) return;
  const choices = state.party
    .filter(alive)
    .flatMap((h) =>
      [0, 1, 2]
        .filter((k) => !h.crystalLocks?.includes(k))
        .map((k) => ({ h, k })),
    );
  for (let n = 0; n < 2 && choices.length; n++) {
    const { h, k } = choices.splice(rand(choices.length), 1)[0];
    h.crystalLocks ??= [];
    h.crystalLocks.push(k);
    const el = $(`#machine-hero-${state.party.indexOf(h)} [data-reel="${k}"]`);
    el?.classList.add("gem-locked");
    burst(el, "block", 18);
    combatCallout(entityArt(h), "CRYSTAL SEAL!", "block");
  }
  log(
    "Nearby crystals seal two reels. Roll an affected hero to crack the gems.",
  );
  GameSound.play("lockBig");
}
function crackRolledCrystals(h, i) {
  if (!h.crystalLocks?.length) return;
  h.crystalLocks = [];
  document.querySelectorAll(`#machine-hero-${i} .gem-locked`).forEach((el) => {
    el.classList.add("gem-cracking");
    burst(el, "block", 24);
    shakeElement(el, 3, "settle");
    setTimeout(() => el.classList.remove("gem-locked", "gem-cracking"), 220);
  });
  GameSound.play("lock");
}
