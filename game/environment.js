// Environmental overlays never own room contents. All durable state lives on
// the floor, and all topology changes use the game's slide/tunnel traversal.
const ENVIRONMENT_TUNING = Object.freeze({
  heartwoodChance: 0.7,
  rootInterval: 3,
  rootLimit: 5,
  clearingChance: 0.9,
  crustChance: 0.8,
  crustMoltenMoves: 3,
  crustSolidMoves: 5,
  faultChance: 0.6,
  faultInterval: 2,
  faultCollapseAge: 4,
  seismicChance: 0.6,
  seismicInterval: 4,
  corridorChance: 0.75,
  corridorInterval: 4,
});
const environmentState = (map = state?.map) => map?.[0]?.environment || null;
const environmentEdgeKey = (a, b) => (a < b ? `${a}:${b}` : `${b}:${a}`);
function environmentEdgeOpen(map, a, b) {
  const e = environmentState(map);
  if (!e?.corridors?.length || !neighbors(a).includes(b)) return true;
  const key = environmentEdgeKey(a, b);
  return e.corridors.every(
    (s) =>
      !s.edges.some(([x, y]) => environmentEdgeKey(x, y) === key) ||
      s.layouts[s.layout || 0].includes(key),
  );
}
function environmentRoot(c) {
  return !!(c?.env?.root || c?.env?.heartwood);
}
function environmentLight(map, i, kind, activeOnly = false) {
  return (environmentState(map)?.[kind] || []).some(
    (s) =>
      (!activeOnly || s.active) &&
      (s.tile === i || neighbors(s.tile).includes(i)),
  );
}
function environmentTraversalSafe(map, position = null) {
  if (position !== null && map[position]?.wall) return false;
  if (!allTilesCanReachStairs(map)) return false;
  const e = environmentState(map),
    saved = [];
  const close = new Set(
    map
      .map((c, i) => (["mudslide", "brittleIce"].includes(c.terrain) ? i : -1))
      .filter((i) => i >= 0),
  );
  for (const formation of e?.crust || [])
    for (const i of formation.tiles) close.add(i);
  for (const i of close) {
    saved.push([i, map[i].wall]);
    map[i].wall = true;
  }
  const layouts = (e?.corridors || []).map((s) => s.layout || 0);
  try {
    if (position !== null && map[position]?.wall) return false;
    // With at most two sections, exhaustively prove every future combination.
    const sections = e?.corridors || [];
    const prove = (n) => {
      if (n === sections.length) return allTilesCanReachStairs(map);
      for (let k = 0; k < sections[n].layouts.length; k++) {
        sections[n].layout = k;
        if (!prove(n + 1)) return false;
      }
      return true;
    };
    return prove(0);
  } finally {
    for (const [i, wall] of saved) map[i].wall = wall;
    (e?.corridors || []).forEach((s, n) => (s.layout = layouts[n]));
  }
}
function environmentWalls(map, changes, position = null) {
  const saved = changes.map(([i]) => [i, map[i].wall]);
  changes.forEach(([i, wall]) => (map[i].wall = wall));
  if (environmentTraversalSafe(map, position)) return true;
  saved.forEach(([i, wall]) => (map[i].wall = wall));
  return false;
}
function stableEnvironmentRoute(map) {
  const saved = map.map((c) => c.wall);
  try {
    map.forEach((c) => {
      if (["mudslide", "brittleIce"].includes(c.terrain)) c.wall = true;
    });
    const start = pos(1, 7),
      stairs = map.findIndex((c) => c.event === "stairs");
    return [
      start,
      ...(movementRoute(map, start, stairs, { omniscient: true }) || []),
    ];
  } finally {
    map.forEach((c, i) => (c.wall = saved[i]));
  }
}
function environmentFloorCell(
  map,
  i,
  { events = true, allowVisited = false } = {},
) {
  const c = map[i];
  return (
    i !== pos(1, 7) &&
    !c.wall &&
    !c.structure &&
    !c.room &&
    !c.env &&
    ["floor", "overgrown"].includes(c.terrain) &&
    (allowVisited || !c.visited) &&
    !["stairs", "tunnel", "stronghold", "recruit", "plate", "door"].includes(
      c.event,
    ) &&
    (events || !c.event)
  );
}
function environmentStable(map, i) {
  return environmentState(map)?.stable?.includes(i);
}
function initializeFloorEnvironment(map, depth) {
  const theme = floorBiome(map);
  if (!["overgrown", "lava", "unstable", "shadow", "maze"].includes(theme))
    return;
  const original = map.map((c) => ({ ...c }));
  const stable = stableEnvironmentRoute(map);
  const e = (map[0].environment = {
    version: 1,
    moves: 0,
    stable,
    clearings: [],
    lanterns: [],
    crust: [],
    corridors: [],
    faults: [],
    heartwood: null,
    seismic: null,
    pendingMovement: null,
    pendingEntry: null,
  });
  if (!stable.includes(map.findIndex((c) => c.event === "stairs"))) {
    delete map[0].environment;
    return;
  }
  const free = (options) =>
    map.map((c, i) => i).filter((i) => environmentFloorCell(map, i, options));
  const lights = (kind, count) => {
    for (let n = 0; n < count; n++) {
      let cells = free().filter(
        (i) => !(e[kind] || []).some((s) => tileDistance(s.tile, i) < 2),
      );
      if (!cells.length) break;
      // A near-start lantern is a dependable initial landmark.
      if (kind === "lanterns" && n === 0)
        cells.sort(
          (a, b) => tileDistance(a, pos(1, 7)) - tileDistance(b, pos(1, 7)),
        );
      const i = kind === "lanterns" && n === 0 ? cells[0] : pick(cells);
      e[kind].push({ tile: i, active: false });
      map[i].env = { [kind === "clearings" ? "clearing" : "lantern"]: true };
    }
  };
  if (theme === "overgrown") {
    if (Math.random() < ENVIRONMENT_TUNING.clearingChance)
      lights("clearings", 1 + rand(2));
    if (Math.random() < ENVIRONMENT_TUNING.heartwoodChance) {
      // Include both horizontal and vertical outer margins, without weakening
      // the same floor/escape/light constraints for either orientation.
      const edge = free({ events: false }).filter(
        (i) =>
          !e.stable.includes(i) &&
          ([1, W - 2].includes(i % W) ||
            [1, H - 2].includes(Math.floor(i / W))),
      );
      for (const i of edge.sort(
        (a, b) => tileDistance(b, pos(1, 7)) - tileDistance(a, pos(1, 7)),
      )) {
        const roots = neighbors(i).filter((j) => !map[j].wall);
        if (
          roots.length < 2 ||
          roots.length > 3 ||
          roots.some(
            (j) =>
              !environmentFloorCell(map, j) ||
              e.stable.includes(j) ||
              environmentLight(map, j, "clearings"),
          )
        )
          continue;
        if (!environmentWalls(map, [[i, true], ...roots.map((j) => [j, true])]))
          continue;
        map[i].env = { heartwood: true };
        roots.forEach((j) => (map[j].env = { root: true }));
        e.heartwood = { tile: i, alive: true, roots: [...roots], cleared: [] };
        break;
      }
    }
  }
  if (theme === "shadow") lights("lanterns", 2 + rand(2));
  if (theme === "lava" && Math.random() < ENVIRONMENT_TUNING.crustChance) {
    const lava = map
      .map((c, i) => i)
      .filter(
        (i) =>
          map[i].wall &&
          (map[i].terrain === "lava" || map[i].lavaRiver) &&
          !map[i].event &&
          !map[i].structure,
      );
    const formations = 1 + rand(2);
    for (let n = 0; n < formations; n++) {
      let chosen = null;
      for (const source of lava) {
        if (e.crust.some((f) => f.tiles.includes(source))) continue;
        const banks = neighbors(source).filter(
          (i) => !map[i].wall && !map[i].env,
        );
        for (const bank of banks) {
          const q = [[source]],
            seen = new Set();
          for (const path of q) {
            const last = path.at(-1);
            const other = neighbors(last).find(
              (j) =>
                j !== bank &&
                !map[j].wall &&
                !map[j].env &&
                (movementRoute(map, bank, j, { omniscient: true })?.length ||
                  0) >
                  path.length + 1,
            );
            if (other !== undefined) {
              chosen = path;
              break;
            }
            if (path.length >= 3) continue;
            for (const j of neighbors(last))
              if (
                lava.includes(j) &&
                !seen.has(j) &&
                !e.crust.some((f) => f.tiles.includes(j))
              ) {
                seen.add(j);
                q.push([...path, j]);
              }
          }
          if (chosen) break;
        }
        if (chosen) break;
      }
      if (!chosen) break;
      const f = {
        id: e.crust.length,
        tiles: chosen,
        phase: "molten",
        remaining: 1 + rand(3),
      };
      e.crust.push(f);
      chosen.forEach((i) => (map[i].env = { crust: f.id }));
    }
  }
  if (theme === "unstable") {
    const faultWanted = Math.random() < ENVIRONMENT_TUNING.faultChance;
    if (faultWanted) {
      let chain = [];
      for (const seed of free().filter((i) => !e.stable.includes(i))) {
        const path = [seed];
        while (path.length < 4) {
          const next = neighbors(path.at(-1)).find(
            (j) =>
              !path.includes(j) &&
              environmentFloorCell(map, j) &&
              !e.stable.includes(j),
          );
          if (next === undefined) break;
          path.push(next);
        }
        if (
          path.length >= 2 &&
          environmentWalls(
            map,
            path.map((i) => [i, true]),
          )
        ) {
          path.forEach((i) => (map[i].wall = false));
          chain = path;
          break;
        }
      }
      if (chain.length) {
        // Keep the signature hazards readable instead of maximizing ceilings,
        // collapses, mud and quakes on the same floor.
        const ceilings = map.filter((c) => c.terrain === "stalactite");
        ceilings.slice(3).forEach((c) => {
          c.terrain = "floor";
          delete c.stalactite;
        });
        map
          .filter((c) => c.terrain === "mudslide")
          .slice(1)
          .forEach((c) => (c.terrain = "floor"));
        e.faults = chain.map((tile, n) => ({
          tile,
          opensAt: n * ENVIRONMENT_TUNING.faultInterval,
          stage: n ? "dormant" : "cracked",
          stopped: false,
        }));
        chain.forEach((i) => (map[i].env = { fault: true }));
      }
    }
    // A single pair per quake; reduce stacking when the floor already has faults.
    if (
      Math.random() <
      (e.faults.length ? 0.35 : ENVIRONMENT_TUNING.seismicChance)
    )
      e.seismic = { interval: ENVIRONMENT_TUNING.seismicInterval };
  }
  if (theme === "maze" && Math.random() < ENVIRONMENT_TUNING.corridorChance) {
    const candidates = map
      .map((c, i) => i)
      .filter(
        (i) =>
          i % W > 0 &&
          i % W < W - 1 &&
          i >= W &&
          i < W * (H - 1) &&
          map[i].wall &&
          map[i].terrain === "stone" &&
          !map[i].structure &&
          !map[i].event &&
          !map[i].env &&
          neighbors(i).filter(
            (j) =>
              !map[j].wall &&
              !map[j].env &&
              !map[j].structure &&
              !map[j].room &&
              !["tunnel", "door", "plate", "stairs"].includes(map[j].event),
          ).length >= 2,
      );
    const count = 1 + rand(2);
    for (const i of candidates) {
      if (e.corridors.length >= count) break;
      const adjacent = neighbors(i).filter(
        (j) =>
          !map[j].wall &&
          !map[j].env &&
          !map[j].structure &&
          !map[j].room &&
          !["tunnel", "door", "plate", "stairs"].includes(map[j].event),
      );
      if (
        adjacent.length < 2 ||
        neighbors(i).some(
          (j) =>
            !map[j].wall &&
            (map[j].env ||
              map[j].structure ||
              map[j].room ||
              ["tunnel", "door", "plate", "stairs"].includes(
                map[j].event || map[j].feature,
              )),
        )
      )
        continue;
      const old = { ...map[i] },
        edges = adjacent.slice(0, 3).map((j) => [i, j]),
        keys = edges.map(([a, b]) => environmentEdgeKey(a, b));
      const section = {
        tile: i,
        edges,
        layouts:
          keys.length >= 3
            ? [
                [keys[0], keys[1]],
                [keys[0], keys[2]],
              ]
            : [[...keys], [keys[0]]],
        layout: 0,
      };
      map[i].wall = false;
      map[i].terrain = "floor";
      map[i].env = { corridor: true };
      e.corridors.push(section);
      const stairs = map.findIndex((c) => c.event === "stairs");
      if (!environmentTraversalSafe(map) || mapDistances(map).get(stairs) < 8) {
        e.corridors.pop();
        map[i] = old;
      }
    }
  }
  if (!environmentTraversalSafe(map)) {
    // A final backstop never turns a failed optional feature into a broken run.
    // Room data and the original legal topology are restored as one unit.
    original.forEach((c, i) => (map[i] = c));
    console.warn(
      "Skipped unsafe environmental features; retained the original floor.",
    );
  }
}
function normaliseFloorEnvironment(map = state.map) {
  const e = environmentState(map);
  if (!e) return;
  e.moves = Math.max(0, Math.floor(e.moves || 0));
  for (const key of ["clearings", "lanterns", "crust", "corridors", "faults"])
    e[key] ||= [];
  for (const f of e.crust) {
    if (!["molten", "solid", "cracking"].includes(f.phase)) f.phase = "molten";
    f.tiles.forEach((i) => {
      if (map[i]) map[i].wall = f.phase === "molten";
    });
  }
  for (const c of map)
    if (c.env?.root || c.env?.heartwood || c.env?.collapsedFault) c.wall = true;
  // Light is derived from saved active landmarks, never rerolled on loading.
  map.forEach((c, i) => {
    if (c.visited && environmentLight(map, i, "lanterns", true))
      c.shadowCovered = false;
  });
}
function activateEnvironmentalArrival(i) {
  const e = environmentState();
  if (!e) return;
  for (const [kind, flag] of [
    ["clearings", "clearing"],
    ["lanterns", "lantern"],
  ]) {
    const landmark = e[kind].find((s) => s.tile === i);
    if (!landmark || landmark.active) continue;
    landmark.active = true;
    const affected = [];
    for (const j of [i, ...neighbors(i)]) {
      if (kind === "clearings") {
        if (!state.map[j].seen) markSeen(j);
        affected.push(j);
      } else if (state.map[j].visited) {
        state.map[j].shadowCovered = false;
        state.map[j].fogged = false;
        affected.push(j);
      }
    }
    environmentalFeedback(affected, flag);
    log(
      kind === "clearings"
        ? "Sunlit clearing: nearby rooms are revealed; their discoveries wait untouched."
        : "Lantern island: visited passages within its light stay clear.",
      { category: "exploration" },
    );
  }
}
// Tile coordinates, visibility and physical overlays stay anchored. Everything
// else belongs to the unresolved discovery, including future reward metadata.
const ENVIRONMENT_TILE_FIELDS = new Set([
  "wall",
  "terrain",
  "seen",
  "visited",
  "doodle",
  "corpses",
  "room",
  "roomRevealedAt",
  "structure",
  "env",
  "riverId",
  "lavaRiver",
  "hint",
  "hintChecked",
  "lastNearCommand",
  "lastVisitedStep",
  "fogged",
  "fogSince",
  "shadowCovered",
  "shadowDelay",
  "shadowDue",
  "stalactite",
  "environment",
]);
function seismicRoomEligible(c, i, map = state.map) {
  return (
    i !== pos(1, 7) &&
    i !== state.position &&
    !c.wall &&
    !c.visited &&
    !c.activated &&
    !c.structure &&
    !c.env &&
    ["floor", "overgrown", "stalactite"].includes(c.terrain) &&
    !["stairs", "tunnel", "stronghold", "recruit", "plate", "door"].includes(
      c.event,
    )
  );
}
function swapUnresolvedRooms(a, b, map = state.map) {
  if (
    a === b ||
    !seismicRoomEligible(map[a], a, map) ||
    !seismicRoomEligible(map[b], b, map)
  )
    return false;
  const fields = (c) =>
    Object.keys(c).filter((k) => !ENVIRONMENT_TILE_FIELDS.has(k));
  const payload = (c) => Object.fromEntries(fields(c).map((k) => [k, c[k]]));
  const x = payload(map[a]),
    y = payload(map[b]);
  for (const [i, p] of [
    [a, y],
    [b, x],
  ]) {
    fields(map[i]).forEach((k) => delete map[i][k]);
    Object.assign(map[i], p);
    map[i].hint = null;
    map[i].hintChecked = false;
  }
  return true;
}
function environmentHunterAt(map, tile) {
  return map === state?.map && state.pursuer?.position === tile;
}
function advanceFloorEnvironment(map = state.map, position = state.position) {
  const e = environmentState(map);
  if (!e) return [];
  e.moves++;
  const effects = [];
  const push = (tiles, kind) => effects.push({ tiles, kind });
  for (const f of e.crust) {
    if (--f.remaining > 0) {
      if (f.phase === "solid" && f.remaining === 1) {
        f.phase = "cracking";
        push(f.tiles, "crust-warning");
      }
      continue;
    }
    if (f.phase === "molten") {
      if (
        environmentWalls(
          map,
          f.tiles.map((i) => [i, false]),
          position,
        )
      ) {
        f.phase = "solid";
        f.remaining = ENVIRONMENT_TUNING.crustSolidMoves;
        push(f.tiles, "cooling");
      } else f.remaining = 1;
    } else {
      // Hold the entire crossing, not only the occupied stone.
      if (
        f.tiles.includes(position) ||
        f.tiles.some((i) => environmentHunterAt(map, i)) ||
        !environmentWalls(
          map,
          f.tiles.map((i) => [i, true]),
          position,
        )
      ) {
        f.remaining = 1;
        f.phase = "cracking";
        continue;
      }
      f.phase = "molten";
      f.remaining = ENVIRONMENT_TUNING.crustMoltenMoves;
      push(f.tiles, "melting");
    }
  }
  for (const f of e.faults) {
    if (f.stopped || f.stage === "collapsed") continue;
    const age = e.moves - f.opensAt;
    if (age < 0) continue;
    const stage =
      age >= ENVIRONMENT_TUNING.faultCollapseAge
        ? "collapsed"
        : age >= 2
          ? "unstable"
          : "cracked";
    if (stage === f.stage) continue;
    if (stage === "collapsed") {
      // Do not leave the moving hunter embedded in newly blocking terrain.
      if (environmentHunterAt(map, f.tile)) continue;
      if (
        f.tile === position ||
        environmentStable(map, f.tile) ||
        !environmentWalls(map, [[f.tile, true]], position)
      ) {
        f.stopped = true;
        continue;
      }
      map[f.tile].env.collapsedFault = true;
    }
    f.stage = stage;
    push([f.tile], stage === "collapsed" ? "collapse" : "fault");
  }
  if (e.heartwood?.alive && e.moves % ENVIRONMENT_TUNING.rootInterval === 0) {
    const h = e.heartwood;
    if (h.roots.length < ENVIRONMENT_TUNING.rootLimit) {
      const candidates = [
        ...new Set([h.tile, ...h.roots].flatMap((i) => neighbors(i))),
      ].filter(
        (i) =>
          i !== position &&
          !environmentHunterAt(map, i) &&
          environmentFloorCell(map, i, { allowVisited: true }) &&
          !e.stable.includes(i) &&
          !h.cleared.includes(i) &&
          !environmentLight(map, i, "clearings"),
      );
      candidates.sort(
        (a, b) =>
          tileDistance(a, position) - tileDistance(b, position) || a - b,
      );
      for (const i of candidates)
        if (environmentWalls(map, [[i, true]], position)) {
          map[i].env = { root: true };
          h.roots.push(i);
          push([i], "roots");
          break;
        }
    }
  }
  if (e.seismic && e.moves % e.seismic.interval === 0) {
    const cells = map
      .map((c, i) => i)
      .filter((i) => seismicRoomEligible(map[i], i, map));
    if (cells.length >= 2) {
      // Prefer a meaningful scouted preview, while keeping both hidden rooms legal.
      const known = cells.filter((i) => map[i].seen),
        a = pick(known.length ? known : cells),
        rest = cells.filter((i) => i !== a && map[i].event !== map[a].event),
        b = rest.length ? pick(rest) : null;
      if (b !== null && swapUnresolvedRooms(a, b, map)) push([a, b], "seismic");
    }
  }
  for (const s of e.corridors) {
    if (
      e.moves % ENVIRONMENT_TUNING.corridorInterval ===
      ENVIRONMENT_TUNING.corridorInterval - 1
    )
      push([s.tile], "corridor-warning");
    if (e.moves % ENVIRONMENT_TUNING.corridorInterval) continue;
    const old = s.layout;
    s.layout = (old + 1) % s.layouts.length;
    if (environmentTraversalSafe(map, position))
      push([s.tile, ...s.edges.map((x) => x[1])], "corridor");
    else s.layout = old;
  }
  return effects;
}
let environmentUpdating = false;
function beginEnvironmentalMovement() {
  const e = environmentState();
  if (!e) return;
  e.pendingMovement ||= { from: state.position, moved: false };
}
function markEnvironmentalMovement() {
  beginEnvironmentalMovement();
  const e = environmentState();
  if (e) e.pendingMovement.moved = true;
}
async function flushEnvironmentalMovement() {
  const e = environmentState();
  if (!e?.pendingMovement || environmentUpdating || !canExplore() || travel)
    return;
  if (!e.pendingMovement.moved) {
    e.pendingMovement = null;
    return;
  }
  const run = state,
    map = state.map;
  environmentUpdating = true;
  busy = true;
  try {
    e.pendingMovement = null;
    const effects = advanceFloorEnvironment(map, state.position);
    save();
    renderMap();
    const notices = {
      cooling: [
        "Cooling crust",
        "A temporary crossing has hardened. It lasts five journeys and holds while occupied.",
      ],
      melting: [
        "Cooling crust",
        "The unoccupied crossing melts; its permanent alternative remains.",
      ],
      collapse: [
        "Fault collapse",
        "Old cracks give way to impassable rubble. Another route remains.",
      ],
      seismic: [
        "Seismic shift",
        "Two unvisited discoveries exchange places. Their contents are unchanged.",
      ],
      corridor: [
        "Shifting corridors",
        "Sliding walls change connections. The permanent escape route stays open.",
      ],
      roots: [
        "Heartwood roots",
        "A connected root grows across a side passage. Fight to clear it permanently.",
      ],
    };
    for (const effect of effects) {
      environmentalFeedback(effect.tiles, effect.kind);
      const notice = notices[effect.kind];
      if (notice && effect.tiles.some((i) => relevantLogTile(i)))
        log(`${notice[0]}: ${notice[1]}`, {
          category: "exploration",
          terms: [{ name: notice[0], description: notice[1] }],
        });
    }
    if (effects.length) await pause(420);
  } finally {
    environmentUpdating = false;
    if (state === run && state.map === map) {
      busy = false;
      render();
      save();
    }
  }
}
async function confrontEnvironmentalBlock(i) {
  const c = state.map[i];
  if (!environmentRoot(c)) return false;
  const run = state,
    kind = c.env.heartwood ? "heartwood" : "root";
  showSpotlight(
    kind === "heartwood" ? "The Heartwood" : "Roots bar the passage",
    kind === "heartwood"
      ? "An old, hostile tree guards a rich prize. The staircase lies elsewhere."
      : "Cut these roots to reach the room beneath them.",
    `<div class="stage-art environmental-encounter-art">${environmentSketch(kind)}</div><div class="stage-result">${kind === "heartwood" ? "Defeat the tree for a guaranteed artefact. Every remaining root will wither." : "Win one fight to clear this passage permanently. Its original discovery remains untouched."}</div>`,
    "environment-choice",
  );
  const choice = await eventChoice([
    {
      id: "environment-fight",
      label:
        kind === "heartwood"
          ? "Challenge the Heartwood"
          : "Cut through the roots",
      value: "fight",
    },
    { id: "environment-leave", label: "Leave this passage", value: "leave" },
  ]);
  if (state !== run || choice !== "fight") {
    if (state === run) closeSpotlight();
    return false;
  }
  closeSpotlight();
  environmentState().pendingEntry = {
    tile: i,
    from: state.position,
    kind,
    ready: false,
  };
  beginEncounter(false, {
    count: 1,
    elite: kind === "heartwood",
    environment: { kind, tile: i },
  });
  render();
  save();
  await encounterEntrance();
  return true;
}
function completeEnvironmentalEncounter(enemy) {
  if (!enemy.environmentKind) return;
  const e = environmentState();
  if (!e) return;
  const i = enemy.environmentTile,
    c = state.map[i];
  if (!c) return;
  if (
    (enemy.environmentKind === "heartwood" && !e.heartwood?.alive) ||
    (enemy.environmentKind === "root" && !c.env?.root)
  ) {
    if (e.pendingEntry?.tile === i) e.pendingEntry.ready = true;
    return;
  }
  if (enemy.environmentKind === "heartwood" && e.heartwood) {
    e.heartwood.alive = false;
    const roots = [...e.heartwood.roots];
    for (const j of roots) {
      state.map[j].wall = false;
      state.map[j].env.root = false;
      state.map[j].env.rootCleared = true;
    }
    e.heartwood.cleared = [...new Set([...e.heartwood.cleared, ...roots])];
    e.heartwood.roots = [];
    c.env.heartwood = false;
    c.env.heartwoodDefeated = true;
    c.wall = false;
    environmentalFeedback([i, ...roots], "wither");
    log("The Heartwood falls. Its roots wither throughout the floor.", {
      category: "exploration",
    });
  } else if (e.heartwood) {
    c.wall = false;
    c.env.root = false;
    c.env.rootCleared = true;
    e.heartwood.roots = e.heartwood.roots.filter((j) => j !== i);
    e.heartwood.cleared.push(i);
    const connected = new Set([e.heartwood.tile]),
      queue = [e.heartwood.tile];
    for (const j of queue)
      for (const k of neighbors(j))
        if (e.heartwood.roots.includes(k) && !connected.has(k)) {
          connected.add(k);
          queue.push(k);
        }
    const detached = e.heartwood.roots.filter((j) => !connected.has(j));
    for (const j of detached) {
      state.map[j].wall = false;
      state.map[j].env.root = false;
      state.map[j].env.rootCleared = true;
      e.heartwood.cleared.push(j);
    }
    e.heartwood.roots = e.heartwood.roots.filter((j) => connected.has(j));
    environmentalFeedback([i, ...detached], "wither");
    log("Root cluster cleared. The passage will not regrow.", {
      category: "exploration",
    });
  }
  if (e.pendingEntry?.tile === i) e.pendingEntry.ready = true;
  save();
}
function pumpEnvironmentalContinuation() {
  if (environmentUpdating || !canExplore() || travel) return;
  const e = environmentState();
  if (!e) return;
  const entry = e.pendingEntry;
  if (entry?.ready) {
    e.pendingEntry = null;
    if (state.position === entry.from && !state.map[entry.tile].wall) {
      move(entry.tile, { environmentContinuation: true }).catch((error) =>
        console.error("Root arrival failed:", error),
      );
      return;
    }
  }
  flushEnvironmentalMovement().catch((error) =>
    console.error("Environment update failed:", error),
  );
}
