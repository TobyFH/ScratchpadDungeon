// Changing terrain uses conservative graph proofs. Removing every unused mudslide
// must still leave every ordinary tile a route to the stairs, from any approach.
const LIVING_FLOOR = Object.freeze({
  shadowMinSeconds: 38,
  shadowMaxSeconds: 64,
  shadowCoverPenalty: 0.08,
  stalactiteMin: 4,
  stalactiteMax: 8,
});
function mudApproachesSafe(map, i) {
  return (
    neighbors(i).length === 4 &&
    neighbors(i).every(
      (j) => !map[j].wall && !["ice", "mudslide"].includes(map[j].terrain),
    )
  );
}
function safeWithClosedTiles(map, extra = []) {
  const closing = [
    ...new Set([
      ...extra,
      ...map
        .map((c, i) => (c.terrain === "mudslide" ? i : -1))
        .filter((i) => i >= 0),
    ]),
  ];
  const saved = closing.map((i) => [i, map[i].wall]);
  try {
    closing.forEach((i) => (map[i].wall = true));
    return allTilesCanReachStairs(map);
  } finally {
    saved.forEach(([i, wall]) => (map[i].wall = wall));
  }
}
function canCloseTile(map, i, { avoidPlayer = true } = {}) {
  const c = map[i];
  if (
    !c ||
    c.wall ||
    c.event ||
    c.structure ||
    c.room ||
    c.terrain !== "floor" ||
    i === pos(1, 7) ||
    (avoidPlayer && i === state.position)
  )
    return false;
  if (neighbors(i).some((j) => map[j].terrain === "mudslide")) return false;
  return safeWithClosedTiles(map, [i]);
}
function rockfallWallCandidates(map = state.map) {
  return map.map((c, i) => i).filter((i) => canCloseTile(map, i));
}
function createRockfallWall() {
  const candidates = rockfallWallCandidates();
  if (!candidates.length) return null;
  const i = pick(candidates),
    c = state.map[i];
  Object.assign(c, {
    wall: true,
    terrain: "stone",
    event: null,
    feature: null,
    room: null,
    rockfallWall: true,
  });
  renderMap();
  smokePoof($(`[data-tile="${i}"]`), true);
  if (c.seen)
    combatCallout($(`[data-tile="${i}"]`), "PASSAGE BLOCKED", "danger");
  log(
    `Fallen stone blocks column ${(i % W) + 1}, row ${Math.floor(i / W) + 1}. Another route remains.`,
  );
  state.lastRockfallWall = i;
  return i;
}
function decorateLivingFloor(map, depth) {
  const theme = floorBiome(map);
  if (
    ["cave", "overgrown", "unstable"].includes(theme) &&
    Math.random() < 0.3
  ) {
    const candidates = map
      .map((c, i) => i)
      .filter(
        (i) =>
          i !== pos(1, 7) &&
          !map[i].wall &&
          !map[i].event &&
          !map[i].room &&
          !map[i].structure &&
          map[i].terrain === "floor",
      );
    const count = Math.random() < 0.2 ? 2 : 1;
    for (const i of candidates) {
      if (map.filter((c) => c.terrain === "mudslide").length >= count) break;
      if (Math.random() > 0.3 || !mudApproachesSafe(map, i)) continue;
      const c = map[i];
      c.terrain = "mudslide";
      if (!safeWithClosedTiles(map) || !allTilesCanReachStairs(map))
        c.terrain = "floor";
    }
  }
  if (theme === "unstable") {
    const free = map
      .map((c, i) => i)
      .filter(
        (i) =>
          !map[i].wall &&
          !map[i].event &&
          !map[i].room &&
          !map[i].structure &&
          map[i].terrain === "floor" &&
          i !== pos(1, 7),
      );
    const count = Math.min(free.length, 3 + rand(3));
    for (let n = 0; n < count; n++) {
      const i = free.splice(rand(free.length), 1)[0];
      map[i].terrain = "stalactite";
      map[i].stalactite = { remaining: stalactiteReset(), drops: 0 };
    }
  }
  normaliseLivingFloor(map, { fresh: true });
}
function stalactiteReset() {
  return (
    LIVING_FLOOR.stalactiteMin +
    rand(LIVING_FLOOR.stalactiteMax - LIVING_FLOOR.stalactiteMin + 1)
  );
}
function normaliseLivingFloor(map = state.map, { fresh = false } = {}) {
  if (fresh) map[0].shadowClock = 0;
  map[0].shadowClock = Math.max(0, Number(map[0].shadowClock) || 0);
  for (const c of map) {
    if (c.terrain === "mudwall") c.wall = true;
    if (c.terrain === "crystal") c.wall = true;
    if (c.terrain === "lava" && floorBiome(map) !== "lava") {
      c.terrain = "stone";
      c.wall = true;
    }
    if (c.terrain === "stalactite") {
      c.wall = false;
      c.stalactite ??= { remaining: stalactiteReset(), drops: 0 };
      c.stalactite.remaining = Math.max(
        1,
        Math.min(8, Math.floor(c.stalactite.remaining) || 4),
      );
    }
    c.shadowCovered =
      !!c.shadowCovered && c.visited && !c.wall && floorBiome(map) === "shadow";
    if (fresh) delete c.shadowDue;
  }
  // Old saves/corrupt one-way cells must never create an inescapable island.
  if (!safeWithClosedTiles(map))
    for (const c of map) if (c.terrain === "mudslide") c.terrain = "floor";
}
function consumeMudslide(from) {
  const c = state.map[from];
  if (c?.terrain !== "mudslide") return;
  Object.assign(c, {
    wall: true,
    terrain: "mudwall",
    event: null,
    feature: null,
    mudUsed: true,
  });
  const tile = $(`[data-tile="${from}"]`);
  smokePoof(tile);
  GameSound.play("mudSlide");
}
function shadowThreshold() {
  return (
    LIVING_FLOOR.shadowMinSeconds +
    rand(LIVING_FLOOR.shadowMaxSeconds - LIVING_FLOOR.shadowMinSeconds + 1)
  );
}
function advanceShadowTime(seconds) {
  if (floorBiome() !== "shadow" || !canExplore() || seconds <= 0) return false;
  const map = state.map,
    covered = map.filter((c) => c.shadowCovered).length;
  map[0].shadowClock =
    (map[0].shadowClock || 0) +
    Math.min(2, seconds) / (1 + covered * LIVING_FLOOR.shadowCoverPenalty);
  const now = map[0].shadowClock;
  let changed = false;
  map.forEach((c, i) => {
    if (!c.visited || c.wall || i === state.position) {
      if (i === state.position) {
        c.shadowCovered = false;
        c.shadowDue = now + (c.shadowDelay ??= shadowThreshold());
      }
      return;
    }
    c.shadowDue ??= now + shadowThreshold();
    if (!c.shadowCovered && now >= c.shadowDue) {
      c.shadowCovered = true;
      c.fogged = true;
      changed = true;
    }
  });
  if (changed) renderMap();
  return changed;
}
async function uncoverShadow(i) {
  const c = state.map[i];
  if (!c.shadowCovered) return false;
  const tile = $(`[data-tile="${i}"]`);
  tile?.classList.add("erasing");
  burst(tile, "smoke", 20);
  GameSound.play("erase");
  await pause(150);
  c.shadowCovered = false;
  c.shadowDue = (state.map[0].shadowClock || 0) + shadowThreshold();
  tile?.classList.remove("shadow-covered", "erasing");
  return true;
}
function killPursuerByTerrain(i, reason = "falling stone") {
  if (state.pursuer?.position !== i) return false;
  const c = state.map[i];
  state.pursuer = null;
  state.pursuerSpawned = true;
  Object.assign(c, {
    wall: false,
    terrain: "floor",
    event: "treasure",
    feature: "treasure",
    activated: false,
    unwrittenRemains: true,
    stalactite: null,
  });
  smokePoof($(`[data-tile="${i}"]`), true);
  log(`The Unwritten is crushed by ${reason}. Its gold lies in the rubble.`);
  toast("The Unwritten falls · gold remains");
  return true;
}
async function livingDungeonStep() {
  let changed = false;
  for (let i = 0; i < state.map.length; i++) {
    const c = state.map[i];
    if (c.terrain !== "stalactite" || !c.stalactite) continue;
    if (--c.stalactite.remaining > 0) {
      const badge = $(`[data-tile="${i}"] .stalactite-count`);
      if (badge) badge.textContent = c.stalactite.remaining;
      continue;
    }
    c.stalactite.drops++;
    c.stalactite.remaining = stalactiteReset();
    const tile = $(`[data-tile="${i}"]`);
    if (c.seen) {
      burst(tile, "dust", 25);
      GameSound.play("rockDrop");
      tile?.classList.add("stalactite-drop");
      setTimeout(() => tile?.classList.remove("stalactite-drop"), 450);
      shakeElement(tile, 3, "impact");
    }
    if (killPursuerByTerrain(i, "a stalactite")) {
      changed = true;
      continue;
    }
    if (i === state.position) {
      const power = 2 + Math.floor(state.depth / 3);
      damageHero(state.party.findIndex(alive), power, "A falling stalactite");
      combatCallout($("#map-player"), "STALACTITE!", "danger");
      shakeBook(4, "impact");
      await processDeaths();
      if (checkDefeat()) return true;
    }
    changed = true;
  }
  if (changed) renderMap();
  return false;
}
function terrainTileAdornment(c, i, influence) {
  const parts = [];
  if (c.seen && c.terrain === "stalactite")
    parts.push(
      `<span class="stalactite-count" aria-label="Falling stone in ${c.stalactite?.remaining || 4} steps">${c.stalactite?.remaining || 4}</span>`,
    );
  if (c.shadowCovered)
    parts.push('<span class="shadow-pencil" aria-hidden="true"></span>');
  if (c.seen && !c.wall && influence?.has(i))
    parts.push('<span class="crystal-radius" aria-hidden="true"></span>');
  return parts.join("");
}
function fogPartyReels(e) {
  if (e.passive?.key !== "veil" || e.hp <= 0) return;
  state.party.forEach((h) => (h.shadowLocks = []));
  const choices = state.party
    .filter(alive)
    .flatMap((h) => [0, 1, 2].map((k) => ({ h, k })));
  const count = Math.min(choices.length, state.depth >= 7 ? 2 : 1);
  for (let n = 0; n < count; n++) {
    const { h, k } = choices.splice(rand(choices.length), 1)[0];
    h.shadowLocks ??= [];
    h.shadowLocks.push(k);
    smokePoof($(`#machine-hero-${state.party.indexOf(h)} [data-reel="${k}"]`));
  }
  combatCallout(enemyArtEl(e), "VEIL OF DOUBT", "poison");
  log(`${e.name} fogs ${count} reels. They count as Empty for one roll.`);
}
function finishShadowAction(h) {
  state.party.forEach((other) => (other.shadowRest = false));
  if (
    livingEnemies().some((e) => e.passive?.key === "veil") &&
    state.party.filter(alive).length > 1
  )
    h.shadowRest = true;
}
function clearShadowReels(h) {
  h.shadowLocks = [];
}

function crystalInfluencedTiles() {
  const result = new Set();
  const sources = state.map
    .map((c, i) => (c.seen && c.terrain === "crystal" ? i : -1))
    .filter((i) => i >= 0);
  for (const source of sources)
    state.map.forEach((c, i) => {
      if (!c.wall && tileDistance(i, source) <= 2 && lineOfSight(source, i))
        result.add(i);
    });
  return result;
}
