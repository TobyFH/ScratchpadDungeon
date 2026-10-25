// Biome data is stored on the first map cell, so ordinary JSON save/HTML exports
// retain it. Presentation never rolls a theme or consumes world RNG.
const BIOMES = Object.freeze({
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
    const goal = map.findIndex((c) => c.event === "stairs");
    for (const i of candidates) {
      if (map[i].event || Math.random() >= 0.17) continue;
      map[i].terrain = "ice";
      // Walking connectivity alone is insufficient: the forced slide must also
      // admit a real route. Reject only the newly proposed slippery tile.
      if (!movementRoute(map, pos(1, 7), goal, { omniscient: true }))
        map[i].terrain = "floor";
    }
  } else if (kind === "lava") {
    // Rooms are connected, non-blocking reveal groups. Do not turn one of
    // their floor cells into a hazard after room generation has validated it.
    const free = candidates.filter((i) => !map[i].event && !map[i].room);
    for (const i of free)
      if (Math.random() < 0.07) {
        const before = mapDistances(map).size;
        map[i].wall = true;
        map[i].terrain = "lava";
        if (mapDistances(map).size < before - 1) {
          map[i].wall = false;
          map[i].terrain = "floor";
        }
      }
  }
}
function normaliseBiome(map = state.map) {
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
  while (map[n].terrain === "ice") {
    const x = (n % W) + dx,
      y = Math.floor(n / W) + dy;
    if (x < 0 || x >= W || y < 0 || y >= H) break;
    const next = pos(x, y);
    if (knownOnly && !map[next].seen) return null;
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
  const cost = new Map([[start, 0]]),
    came = new Map(),
    queue = [start],
    closed = new Set();
  while (queue.length) {
    queue.sort((a, b) => cost.get(a) - cost.get(b));
    const n = queue.shift();
    if (closed.has(n)) continue;
    closed.add(n);
    if (n === goal) {
      const path = [];
      let cursor = n;
      while (cursor !== start) {
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
      if (c.wall && (omniscient || c.seen)) continue;
      if (!omniscient && !c.seen && j !== goal) continue;
      let cells =
        !portal && !ignoreIce && (c.seen || omniscient) && c.terrain === "ice"
          ? glideCells(map, n, j, { knownOnly: !omniscient })
          : [j];
      if (!cells) {
        if (directIce && n === start && j === goal) cells = [j];
        else continue;
      }
      if (!omniscient && cells.some((i) => !map[i].seen && i !== goal))
        continue;
      const end = cells.at(-1),
        danger = !omniscient
          ? cells.filter(
              (i) =>
                i !== goal &&
                ["enemy", "guardian", "stronghold", "trap"].includes(
                  map[i].event,
                ),
            ).length * 1000
          : 0;
      const next = cost.get(n) + cells.length + danger;
      if (directIce && n === start && j === goal && end !== goal) {
        return cells;
      }
      if (next < (cost.get(end) ?? Infinity)) {
        cost.set(end, next);
        came.set(end, { from: n, cells });
        queue.push(end);
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
    (i) => state.map[i].seen && state.map[i].terrain === "ice",
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
  return c.terrain === "ice"
    ? icon("ice")
    : c.terrain === "mushroom"
      ? icon("mushroom")
      : c.terrain === "overgrown"
        ? icon("overgrown")
        : "";
}
