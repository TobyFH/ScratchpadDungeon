const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => {
    newRun("fighter", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    setPreference("shake", 0);
    closeModal();
    closeSpotlight();
    state.autoplay = false;
    state.autoresolve = false;
    characterLuck = () => 0.99999;
    Math.random = () => 0.99999;
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
function flat(theme = "overgrown") {
  state.depth = 5;
  state.position = pos(1, 7);
  state.pursuer = null;
  state.pursuerSpawned = true;
  state.lastMinorEventStep = 100000;
  state.map = Array.from({ length: W * H }, (_, i) => ({
    wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    terrain: "floor",
    seen: true,
    visited: false,
    event: null,
    feature: null,
    corpses: [],
    room: null,
    lastNearCommand: 0,
  }));
  state.map[state.position].visited = true;
  state.map[pos(9, 1)].event = state.map[pos(9, 1)].feature = "stairs";
  state.map[0].biome = theme;
  state.map[0].environment = {
    version: 1,
    moves: 0,
    stable: stableEnvironmentRoute(state.map),
    clearings: [],
    lanterns: [],
    crust: [],
    corridors: [],
    faults: [],
    heartwood: null,
    seismic: null,
    pendingMovement: null,
    pendingEntry: null,
  };
  busy = false;
  travel = null;
  render();
  return environmentState();
}
test("generated environmental features and repeated mutations preserve permanent slide/tunnel escapes and room counts", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let seed = 81617;
    Math.random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const counts = {
      heartwood: 0,
      clearings: 0,
      lanterns: 0,
      crust: 0,
      faults: 0,
      seismic: 0,
      corridors: 0,
    };
    const rooms = (m) =>
      JSON.stringify(
        Object.entries(
          m.reduce(
            (a, c) => (
              (a[c.event || "empty"] = (a[c.event || "empty"] || 0) + 1),
              a
            ),
            {},
          ),
        ).sort(),
      );
    for (const theme of ["overgrown", "lava", "unstable", "shadow", "maze"])
      for (let n = 0; n < 60; n++) {
        const map = generateFloor(5 + (n % 6), 1, 0, [], theme),
          e = environmentState(map);
        state.map = map;
        state.position = pos(1, 7);
        if (!e) throw Error("missing controller " + theme);
        const before = rooms(map);
        counts.heartwood += !!e.heartwood;
        counts.seismic += !!e.seismic;
        for (const key of [
          "clearings",
          "lanterns",
          "crust",
          "faults",
          "corridors",
        ])
          counts[key] += e[key].length;
        for (let move = 0; move < 20; move++) {
          const possible = e.stable.filter(
            (i) =>
              !map[i].wall &&
              !["ice", "mudslide", "brittleIce"].includes(map[i].terrain),
          );
          state.position = possible[move % possible.length];
          map[state.position].visited = true;
          advanceFloorEnvironment(map, state.position);
          if (!environmentTraversalSafe(map, state.position))
            throw Error("unsafe " + theme + " " + n + " " + move);
          if (before !== rooms(map)) throw Error("room counts changed");
          if (e.heartwood?.roots.some((i) => e.stable.includes(i)))
            throw Error("root on stable route");
          if (e.heartwood && e.heartwood.roots.length > 5)
            throw Error("too many roots");
        }
      }
    return counts;
  });
  for (const [key, n] of Object.entries(r))
    assert.ok(n > 0, key + " should generate");
});
test("a journey, a full ice slide and an in-place tunnel each count once; invalid clicks and menus do not tick", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  await p.evaluate(async () => {
    await move(pos(5, 7));
  });
  assert.deepEqual(
    await p.evaluate(() => ({
      moves: environmentState().moves,
      steps: state.steps,
    })),
    { moves: 1, steps: 4 },
  );
  await p.evaluate(async () => {
    state.map[pos(6, 7)].terrain = "ice";
    state.map[pos(7, 7)].terrain = "ice";
    render();
    await move(pos(6, 7));
  });
  assert.deepEqual(
    await p.evaluate(() => ({
      moves: environmentState().moves,
      position: state.position,
    })),
    { moves: 2, position: 85 },
  );
  await p.evaluate(async () => {
    await move(0);
    help();
    await move(pos(8, 6));
    closeModal();
  });
  assert.equal(await p.evaluate(() => environmentState().moves), 2);
  await p.evaluate(() => {
    const a = state.position,
      b = pos(2, 2);
    for (const [i, j] of [
      [a, b],
      [b, a],
    ])
      Object.assign(state.map[i], {
        event: "tunnel",
        feature: "tunnel",
        tunnelTo: j,
        tunnelPair: 1,
      });
    render();
    window.trip = move(state.position);
  });
  await p.locator("#tunnel-leave").click();
  await p.evaluate(() => window.trip);
  assert.equal(await p.evaluate(() => environmentState().moves), 2);
  await p.evaluate(() => {
    window.trip = move(state.position);
  });
  await p.locator("#tunnel-use").click();
  await p.evaluate(() => window.trip);
  assert.deepEqual(
    await p.evaluate(() => ({
      moves: environmentState().moves,
      position: state.position,
    })),
    { moves: 3, position: 24 },
  );
});
test("completed movement waits for battle and confirmation UI and is committed once after they finish", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(async () => {
    const e = environmentState();
    e.pendingMovement = { from: state.position, moved: true };
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    await flushEnvironmentalMovement();
    const battle = e.moves;
    state.enemy = null;
    state.enemies = [];
    showSpotlight(
      "Still choosing",
      "A pending confirmation",
      "<p>Wait.</p>",
      "test",
    );
    await flushEnvironmentalMovement();
    const popup = e.moves;
    closeSpotlight();
    help();
    await flushEnvironmentalMovement();
    const menu = e.moves;
    closeModal();
    await flushEnvironmentalMovement();
    await flushEnvironmentalMovement();
    return { battle, popup, menu, after: e.moves, pending: e.pendingMovement };
  });
  assert.deepEqual(r, {
    battle: 0,
    popup: 0,
    menu: 0,
    after: 1,
    pending: null,
  });
});
test("sunlit clearings scout without activating rooms; lanterns protect only visited information", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      a = pos(4, 4),
      b = pos(7, 4),
      enemy = a + 1,
      hidden = b + 1,
      old = b - W;
    e.clearings = [{ tile: a, active: false }];
    state.map[a].env = { clearing: true };
    Object.assign(state.map[enemy], {
      seen: false,
      event: "enemy",
      feature: "enemy",
    });
    e.lanterns = [{ tile: b, active: false }];
    state.map[b].env = { lantern: true };
    Object.assign(state.map[hidden], {
      seen: false,
      visited: false,
      event: "treasure",
    });
    Object.assign(state.map[old], {
      seen: true,
      visited: true,
      shadowCovered: true,
      event: "well",
      activated: false,
    });
    activateEnvironmentalArrival(a);
    activateEnvironmentalArrival(b);
    state.map[0].biome = "shadow";
    for (let n = 0; n < 60; n++) advanceShadowTime(2);
    return {
      scouted: state.map[enemy].seen,
      event: state.map[enemy].event,
      enemy: state.enemy,
      hidden: state.map[hidden].seen,
      old: state.map[old].shadowCovered,
      well: state.map[old].event,
      active: state.map[old].activated,
      light: environmentLight(state.map, a + W, "clearings"),
      lamps: e.lanterns[0].active,
    };
  });
  assert.deepEqual(r, {
    scouted: true,
    event: "enemy",
    enemy: null,
    hidden: false,
    old: false,
    well: "well",
    active: false,
    light: true,
    lamps: true,
  });
});
test("sunlight suppresses only the extra Overgrowth surprise modifier", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    state.map[state.position].terrain = "overgrown";
    const e = environmentState();
    e.clearings = [{ tile: state.position, active: true }];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    Math.random = () => 0.2;
    setupBattleOpening({ fresh: true });
    const lit = !!state.opening.surprise;
    e.clearings = [];
    setupBattleOpening({ fresh: true });
    return { lit, dark: !!state.opening.surprise };
  });
  assert.deepEqual(r, { lit: false, dark: true });
});
test("crust cycles as a whole, never melts while occupied, and has a permanent alternative", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      tiles = [pos(4, 4), pos(5, 4)];
    e.crust = [{ id: 0, tiles, phase: "molten", remaining: 3 }];
    tiles.forEach((i) =>
      Object.assign(state.map[i], {
        wall: true,
        terrain: "lava",
        env: { crust: 0 },
      }),
    );
    for (let n = 0; n < 3; n++) advanceFloorEnvironment();
    const solid = tiles.every((i) => !state.map[i].wall);
    state.position = tiles[0];
    for (let n = 0; n < 7; n++) advanceFloorEnvironment();
    const held = tiles.every((i) => !state.map[i].wall),
      phase = e.crust[0].phase;
    state.position = pos(3, 4);
    advanceFloorEnvironment();
    const molten = tiles.every((i) => state.map[i].wall),
      safe = environmentTraversalSafe(state.map, state.position);
    return { solid, held, phase, molten, safe };
  });
  assert.deepEqual(r, {
    solid: true,
    held: true,
    phase: "cracking",
    molten: true,
    safe: true,
  });
});
test("faults warn before collapse, preserve their room, and reject current-tile and choke-point collapses", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      a = pos(4, 4),
      b = pos(5, 4);
    e.faults = [
      { tile: a, opensAt: 0, stage: "cracked" },
      { tile: b, opensAt: 2, stage: "dormant" },
    ];
    for (const i of [a, b]) state.map[i].env = { fault: true };
    state.map[a].event = "treasure";
    advanceFloorEnvironment();
    const first = e.faults[0].stage;
    advanceFloorEnvironment();
    const warning = e.faults.map((f) => f.stage);
    advanceFloorEnvironment();
    advanceFloorEnvironment();
    const fallen = { wall: state.map[a].wall, event: state.map[a].event };
    state.position = b;
    for (let n = 0; n < 3; n++) advanceFloorEnvironment();
    const occupied = !state.map[b].wall && e.faults[1].stopped;
    return {
      first,
      warning,
      fallen,
      occupied,
      safe: environmentTraversalSafe(state.map, state.position),
    };
  });
  assert.deepEqual(r, {
    first: "cracked",
    warning: ["unstable", "cracked"],
    fallen: { wall: true, event: "treasure" },
    occupied: true,
    safe: true,
  });
});
test("seismic swaps carry complete unresolved payloads while preserving terrain, visibility and visited rooms", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const a = pos(3, 3),
      b = pos(7, 3),
      c = pos(8, 3);
    Object.assign(state.map[a], {
      event: "treasure",
      feature: "treasure",
      seen: true,
      generatedReward: { gold: 97, item: { id: "stable-relic" } },
      discoveryId: "treasure-1",
    });
    Object.assign(state.map[b], {
      event: "shop",
      feature: "shop",
      seen: false,
      shop: { potion: true, reveal: false },
      discoveryId: "shop-1",
      terrain: "stalactite",
      stalactite: { remaining: 5 },
    });
    Object.assign(state.map[c], { event: "well", visited: true });
    const swapped = swapUnresolvedRooms(a, b),
      blocked = swapUnresolvedRooms(a, c);
    return {
      swapped,
      blocked,
      a: {
        event: state.map[a].event,
        seen: state.map[a].seen,
        terrain: state.map[a].terrain,
        shop: state.map[a].shop,
        id: state.map[a].discoveryId,
      },
      b: {
        event: state.map[b].event,
        seen: state.map[b].seen,
        terrain: state.map[b].terrain,
        stalactite: state.map[b].stalactite,
        reward: state.map[b].generatedReward,
        id: state.map[b].discoveryId,
      },
      fixed: state.map[c].event,
    };
  });
  assert.deepEqual(r, {
    swapped: true,
    blocked: false,
    a: {
      event: "shop",
      seen: true,
      terrain: "floor",
      shop: { potion: true, reveal: false },
      id: "shop-1",
    },
    b: {
      event: "treasure",
      seen: false,
      terrain: "stalactite",
      stalactite: { remaining: 5 },
      reward: { gold: 97, item: { id: "stable-relic" } },
      id: "treasure-1",
    },
    fixed: "well",
  });
});
test("shifting corridor connections are shared by actual routing, ice and permanent escape validation", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      a = pos(4, 4),
      b = a + 1,
      key = environmentEdgeKey(a, b);
    e.corridors = [
      { tile: a, edges: [[a, b]], layouts: [[key], []], layout: 0 },
    ];
    const open = movementRoute(state.map, a, b).length;
    e.corridors[0].layout = 1;
    const closed = movementRoute(state.map, a, b).length;
    state.map[a].terrain = "ice";
    const slide = glideCells(state.map, a - 1, a);
    state.map[b].seen = false;
    const hiddenLanding = glideCells(state.map, a - 1, a, { knownOnly: true });
    state.map[b].seen = true;
    const safe = environmentTraversalSafe(state.map, b);
    for (let n = 0; n < 4; n++) advanceFloorEnvironment();
    return {
      open,
      closed,
      slide,
      hiddenLanding,
      safe,
      layout: e.corridors[0].layout,
    };
  });
  assert.equal(r.open, 1);
  assert.ok(r.closed > 1);
  assert.deepEqual(r.slide, [48]);
  assert.deepEqual(r.hiddenLanding, [48]);
  assert.equal(r.safe, true);
  assert.equal(r.layout, 0);
});
test("root victory clears once, disconnected roots wither, and Heartwood ends growth without defeating the stair guardian", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      tree = pos(5, 4),
      roots = [tree - 1, tree - 2, tree + W];
    e.heartwood = { tile: tree, alive: true, roots: [...roots], cleared: [] };
    state.map[tree].env = { heartwood: true };
    state.map[tree].wall = true;
    roots.forEach((i) => {
      state.map[i].env = { root: true };
      state.map[i].wall = true;
    });
    state.map[roots[0]].event = "treasure";
    completeEnvironmentalEncounter({
      environmentKind: "root",
      environmentTile: roots[0],
    });
    const cleared = {
      wall: state.map[roots[0]].wall,
      event: state.map[roots[0]].event,
      detached: state.map[roots[1]].wall,
    };
    beginEncounter(false, {
      count: 1,
      elite: true,
      environment: { kind: "heartwood", tile: tree },
    });
    const boss = {
      name: state.enemy.name,
      stair: state.enemy.boss,
      stronghold: state.enemy.stronghold,
    };
    completeEnvironmentalEncounter(state.enemy);
    state.enemy = null;
    state.enemies = [];
    const before = e.heartwood.cleared.length;
    for (let n = 0; n < 9; n++) advanceFloorEnvironment();
    return {
      cleared,
      boss,
      alive: e.heartwood.alive,
      roots: e.heartwood.roots.length,
      noRegrowth: e.heartwood.cleared.length === before,
      stair: state.floorBossDefeated,
    };
  });
  assert.deepEqual(r.cleared, {
    wall: false,
    event: "treasure",
    detached: false,
  });
  assert.equal(r.boss.name, "The Heartwood");
  assert.equal(r.boss.stair, false);
  assert.equal(r.boss.stronghold, true);
  assert.equal(r.alive, false);
  assert.equal(r.roots, 0);
  assert.equal(r.noRegrowth, true);
  assert.equal(r.stair, false);
});
test("environment phase, room payload and in-flight movement receipts restore without rerolling", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      i = pos(4, 4);
    e.crust = [{ id: 0, tiles: [i], phase: "cracking", remaining: 1 }];
    state.map[i].terrain = "lava";
    state.map[i].env = { crust: 0 };
    e.pendingMovement = { from: state.position, moved: true };
    e.moves = 7;
    const before = JSON.stringify(e);
    save();
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.9;
    };
    const restored = load();
    return {
      restored,
      same: JSON.stringify(environmentState()) === before,
      walkable: !state.map[i].wall,
      draws,
    };
  });
  assert.deepEqual(r, { restored: true, same: true, walkable: true, draws: 0 });
});

test("a root fight keeps the player outside, then resumes entry and the original treasure only after battle spoils", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  await p.evaluate(() => {
    const e = environmentState(),
      root = pos(2, 7),
      tree = pos(3, 7);
    e.heartwood = { tile: tree, alive: true, roots: [root], cleared: [] };
    state.map[tree].env = { heartwood: true };
    state.map[tree].wall = true;
    Object.assign(state.map[root], {
      env: { root: true },
      wall: true,
      event: "treasure",
      feature: "treasure",
    });
    Math.random = () => 0.4;
    render();
    window.rootJourney = move(root);
  });
  await p.locator("#environment-fight").click();
  assert.equal(await p.evaluate(() => state.position), 78);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.rootJourney);
  assert.deepEqual(
    await p.evaluate(() => ({
      kind: state.enemy.environmentKind,
      wall: state.map[pos(2, 7)].wall,
      event: state.map[pos(2, 7)].event,
      moves: environmentState().moves,
    })),
    { kind: "root", wall: true, event: "treasure", moves: 0 },
  );
  await p.evaluate(() => {
    state.enemy.hp = 1;
    state.enemy.countdown = 100;
    const h = state.party[0];
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 2, weight: 1 }]);
    render();
  });
  await p.locator('[data-spin="0"]').click();
  await p.locator("#stage-confirm").waitFor();
  assert.equal(
    await p.evaluate(() => state.position),
    78,
    "battle loot is claimed before entering",
  );
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(
    () =>
      state.position === pos(2, 7) &&
      document.querySelector("#stage-confirm") &&
      !document.querySelector("#spotlight").hidden,
  );
  assert.equal(
    await p.evaluate(() => environmentState().moves),
    0,
    "underlying treasure confirmation still holds the tick",
  );
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(() => !busy && environmentState().moves === 1);
  assert.deepEqual(
    await p.evaluate(() => ({
      wall: state.map[pos(2, 7)].wall,
      event: state.map[pos(2, 7)].event,
      cleared: state.map[pos(2, 7)].env.rootCleared,
      kills: state.party[0].stats.kills,
    })),
    { wall: false, event: null, cleared: true, kills: 1 },
  );
});
test("declining roots never moves, ticks, clears the barrier or rerolls its underlying room", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  await p.evaluate(() => {
    const c = state.map[pos(2, 7)];
    Object.assign(c, {
      wall: true,
      env: { root: true },
      event: "treasure",
      generatedReward: { gold: 42 },
    });
    render();
    window.decline = move(pos(2, 7));
  });
  await p.locator("#environment-leave").click();
  await p.evaluate(() => window.decline);
  assert.deepEqual(
    await p.evaluate(() => ({
      position: state.position,
      moves: environmentState().moves,
      wall: state.map[pos(2, 7)].wall,
      event: state.map[pos(2, 7)].event,
      reward: state.map[pos(2, 7)].generatedReward,
      enemy: state.enemy,
    })),
    {
      position: 78,
      moves: 0,
      wall: true,
      event: "treasure",
      reward: { gold: 42 },
      enemy: null,
    },
  );
});
test("the conservative validator rejects a collapse that strands a side passage and does not rely on waiting for crust", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    state.map.forEach((c) => (c.wall = true));
    const path = [
      pos(1, 7),
      pos(2, 7),
      pos(3, 7),
      pos(3, 6),
      pos(3, 5),
      pos(4, 5),
      pos(5, 5),
      pos(6, 5),
      pos(7, 5),
      pos(8, 5),
      pos(9, 5),
      pos(9, 4),
      pos(9, 3),
      pos(9, 2),
      pos(9, 1),
    ];
    path.forEach((i) => (state.map[i].wall = false));
    const choke = pos(3, 6),
      before = state.map[choke].wall;
    const rejected = !environmentWalls(
        state.map,
        [[choke, true]],
        state.position,
      ),
      same = state.map[choke].wall === before;
    const e = environmentState();
    e.crust = [{ id: 0, tiles: [choke], phase: "solid", remaining: 5 }];
    return {
      rejected,
      same,
      permanent: environmentTraversalSafe(state.map, state.position),
    };
  });
  assert.deepEqual(r, { rejected: true, same: true, permanent: false });
});

test("a saved root encounter retains its barrier, combat identity and pending arrival without rerolling", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      tile = pos(2, 7),
      tree = pos(3, 7);
    e.heartwood = { tile: tree, alive: true, roots: [tile], cleared: [] };
    Object.assign(state.map[tile], {
      wall: true,
      env: { root: true },
      event: "treasure",
    });
    Object.assign(state.map[tree], { wall: true, env: { heartwood: true } });
    e.pendingMovement = { from: state.position, moved: false };
    e.pendingEntry = { tile, from: state.position, kind: "root", ready: false };
    beginEncounter(false, { count: 1, environment: { kind: "root", tile } });
    finishOpeningRoll();
    save();
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.9;
    };
    const loaded = load();
    return {
      loaded,
      draws,
      kind: state.enemy.environmentKind,
      tile: state.enemy.environmentTile,
      wall: state.map[tile].wall,
      under: state.map[tile].event,
      ready: environmentState().pendingEntry.ready,
      moved: environmentState().pendingMovement.moved,
      moves: environmentState().moves,
    };
  });
  assert.deepEqual(r, {
    loaded: true,
    draws: 0,
    kind: "root",
    tile: 79,
    wall: true,
    under: "treasure",
    ready: false,
    moved: false,
    moves: 0,
  });
});

test("passive environmental rendering and finite feedback spend no gameplay RNG or movement ticks", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      i = pos(4, 4);
    e.clearings = [{ tile: i, active: true }];
    state.map[i].env = { clearing: true };
    const before = JSON.stringify(state.map);
    let draws = 0;
    Math.random = () => {
      draws++;
      return 0.9;
    };
    render();
    render();
    environmentalFeedback([i, ...neighbors(i)], "clearing");
    return {
      draws,
      unchanged: JSON.stringify(state.map) === before,
      moves: e.moves,
    };
  });
  assert.deepEqual(r, { draws: 0, unchanged: true, moves: 0 });
});

test("environmental closures cannot strand the moving hunter inside blocking terrain", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      a = pos(4, 4),
      b = pos(6, 4);
    e.crust = [{ id: 0, tiles: [a], phase: "cracking", remaining: 1 }];
    state.map[a].env = { crust: 0 };
    state.map[a].terrain = "lava";
    e.faults = [{ tile: b, opensAt: 1, stage: "unstable", stopped: false }];
    state.map[b].env = { fault: true };
    e.moves = 3;
    state.pursuer = { position: a };
    advanceFloorEnvironment();
    const crustHeld = !state.map[a].wall;
    state.pursuer.position = b;
    advanceFloorEnvironment();
    const faultHeld = !state.map[b].wall;
    state.pursuer.position = pos(7, 4);
    advanceFloorEnvironment();
    return {
      crustHeld,
      faultHeld,
      crustMolten: state.map[a].wall,
      faultCollapsed: state.map[b].wall,
      hunterWalkable: !state.map[state.pursuer.position].wall,
    };
  });
  assert.deepEqual(r, {
    crustHeld: true,
    faultHeld: true,
    crustMolten: true,
    faultCollapsed: true,
    hunterWalkable: true,
  });
});

test("roots may reclaim visited side passages while retaining completed discovery state", async (t) => {
  const p = await game(t);
  await p.evaluate(flat);
  const r = await p.evaluate(() => {
    const e = environmentState(),
      tree = pos(5, 4),
      root = pos(4, 4),
      target = pos(3, 4);
    state.position = pos(3, 5);
    e.heartwood = { tile: tree, alive: true, roots: [root], cleared: [] };
    state.map[tree].wall = true;
    state.map[tree].env = { heartwood: true };
    state.map[root].wall = true;
    state.map[root].env = { root: true };
    Object.assign(state.map[target], {
      visited: true,
      activated: true,
      event: null,
      feature: "treasure",
    });
    e.stable = [
      ...new Set([
        ...e.stable.filter((i) => i !== target),
        ...neighbors(tree),
        ...neighbors(root),
      ]),
    ].filter((i) => i !== target);
    e.moves = 2;
    advanceFloorEnvironment();
    const rooted = !!state.map[target].env?.root;
    completeEnvironmentalEncounter({
      environmentKind: "root",
      environmentTile: target,
    });
    return {
      rooted,
      wall: state.map[target].wall,
      event: state.map[target].event,
      feature: state.map[target].feature,
      activated: state.map[target].activated,
      visited: state.map[target].visited,
    };
  });
  assert.deepEqual(r, {
    rooted: true,
    wall: false,
    event: null,
    feature: "treasure",
    activated: true,
    visited: true,
  });
});
