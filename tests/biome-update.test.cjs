const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((_, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function game(t, width = 1920, height = 1080) {
  const page = await browser.newPage({ viewport: { width, height } }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.evaluate(async () => {
    newRun("fighter");
    setPace("skip");
    setPreference("shake", 0);
    setPreference("skipCriticals", true);
    characterLuck = () => 0.99999;
    await document.fonts.ready;
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
  });
  return page;
}

function blankMap() {
  state.map = Array.from({ length: W * H }, (_, i) => ({
    wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    seen: true,
    terrain: "floor",
    event: null,
    feature: null,
    corpses: [],
    room: null,
    visited: false,
    lastNearCommand: state.moveCommands || 0,
  }));
  state.map[0].biome = "cave";
  state.map[0].floorName = "Test cave";
  state.position = pos(1, 7);
  state.pursuerSpawned = true;
  state.lastMinorEventStep = 100000;
  render();
}

test("small balance adjustments share canonical formulas while raw mark tiers remain identical across classes", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = makeHero("Rowan", "ranger");
    h.level = 4;
    h.charge = 6;
    const e = { hp: 50, maxHp: 100 };
    return {
      hp: makeHero("Wall", "fighter").maxHp,
      exec: executionBonus(h, e),
      old: Math.ceil((3 + 0.75 * 4) * (0.5 + 2.5 * 0.5)),
      rogue: heroDamagePower({ job: "rogue" }, 100),
      heal: heroHealingPower(20),
      shop: WORLD_BALANCE.shopChance,
      well1: fountainBaseRate(1),
      well10: fountainBaseRate(10),
      roll1: fountainRollRate(1),
      roll10: fountainRollRate(10),
      raw: calculate([
        { type: "attack", tier: 4 },
        { type: "heal", tier: 4 },
      ]),
    };
  });
  assert.equal(r.hp, 50);
  assert.ok(r.exec > r.old);
  assert.equal(r.rogue, 100);
  assert.equal(r.heal, 20);
  assert.equal(r.shop, 0.4);
  assert.ok(r.well10 > r.well1);
  assert.ok(r.roll10 > r.roll1);
  assert.equal(r.raw.attack, 4);
  assert.equal(r.raw.heal, 8);
});

test("Fury capacity and lifesteal scale with level and actual restored health spends some Fury", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("berserker");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    h.level = 6;
    h.fury = 100;
    normaliseHeroBuild(h);
    const cap = furyCapacity(h),
      before = h.fury,
      bonus = furyBonus(h);
    h.hp = 5;
    const n = await settleFuryLeech(
      h,
      [{ enemy: state.enemy, damage: 20 }],
      [Promise.resolve()],
    );
    const after = h.fury,
      spent = state.lastLifesteal.furySpent;
    h.hp = h.maxHp;
    const full = await settleFuryLeech(
      h,
      [{ enemy: state.enemy, damage: 20 }],
      [],
    );
    return {
      cap,
      first: furyCapacity({ level: 1 }),
      before,
      after,
      bonus,
      n,
      spent,
      full,
      still: h.fury,
      bar: furyMarkup(h),
    };
  });
  assert.equal(r.first, 24);
  assert.equal(r.cap, 39);
  assert.equal(r.before, 39);
  assert.ok(r.bonus > 5);
  assert.ok(r.n > 0);
  assert.equal(r.after, r.before - r.spent);
  assert.ok(r.spent > 0);
  assert.equal(r.still, r.after);
  assert.equal(r.full, 0);
  assert.match(r.bar, /39/);
});

test("Tank Shield Bash block grows every three levels in actual roll planning", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    const out = [];
    for (const level of [1, 4, 7, 10]) {
      h.level = level;
      state.block = 5;
      const b = await planHeroRoll(h, [
        { type: "blank", tier: 1 },
        { type: "class", tier: 1, job: "fighter" },
        { type: "blank", tier: 1 },
      ]);
      out.push({ block: b.block, bash: b.bash });
    }
    return out;
  });
  assert.deepEqual(r, [
    { block: 2, bash: 6 },
    { block: 3, bash: 8 },
    { block: 4, bash: 9 },
    { block: 5, bash: 10 },
  ]);
});

test("Blood Price and Trick are exclusive, including legacy edited faces and saved last-result migration", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() =>
    ["fighter", "rogue", "mage", "ranger", "berserker", "jester"].map((job) => {
      const h = makeHero(job, job);
      h.reels[0][0] = { type: "selfharm", tier: 4, weight: 3 };
      h.last[0] = { type: "selfharm", tier: 4 };
      normaliseHeroBuild(h);
      return {
        job,
        types: editableTypes(h),
        face: h.reels[0][0],
        last: h.last[0],
      };
    }),
  );
  for (const x of r) {
    assert.equal(x.types.includes("selfharm"), x.job === "berserker");
    assert.equal(x.types.includes("trick"), x.job === "jester");
    assert.equal(
      x.face.type,
      x.job === "berserker"
        ? "selfharm"
        : x.job === "jester"
          ? "trick"
          : "blank",
    );
    assert.equal(x.last.type, x.face.type);
    assert.equal(x.face.weight, 1);
    if (x.face.type === "blank") assert.equal(x.face.tier, 1);
  }
});

test("automated identities restore Trick and Mage support through paid edits and retain offensive capacity", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.depth = 4;
    const j = makeHero("Fool", "jester");
    state.party = [j];
    j.reels = [0, 1, 2].map((k) => [
      { type: "stun", tier: 4, weight: 1 },
      { type: "stun", tier: 3, weight: 1 },
      ...(k === 1
        ? [{ type: "class", tier: 1, job: "jester", weight: 1 }]
        : []),
    ]);
    j.points = 40;
    autoUpgradeHero(j);
    const trick = faceShare(j.reels.flat(), ["trick"]),
      damage = soloOffence(j);
    const m = makeHero("Orin", "mage", null, [], { specialism: "offence" });
    state.party = [
      m,
      makeHero("Wren", "rogue"),
      makeHero("Rowan", "ranger", null, [], { specialism: "defence" }),
    ];
    m.reels = m.reels.map((r) =>
      r.map((f) =>
        f.type === "class" ? f : { type: "magic", tier: 3, weight: 1 },
      ),
    );
    m.points = 80;
    m.autoArchetype = "assault";
    autoUpgradeHero(m);
    return {
      trick,
      damage,
      mage: expectedHeroEffects(m),
      types: m.reels.flat().map((f) => f.type),
      role: m.autoArchetype,
      points: m.points,
    };
  });
  assert.ok(r.trick >= 0.15, JSON.stringify(r));
  assert.ok(r.damage >= 2);
  assert.ok(r.types.includes("heal"));
  assert.ok(r.types.includes("block"));
  assert.equal(r.role, "mender");
  assert.ok(r.mage.heal + r.mage.teamHeal > 1);
  assert.ok(r.points >= 0);
});

test("autobattle banks a low Ranger charge, but uses a full charge and rewards stacked Fury and anticipation", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const a = makeHero("A", "fighter"),
      r = makeHero("R", "ranger");
    state.party = [a, r];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.enemy.countdown = 20;
    a.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    r.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 2 }]);
    r.charge = 0;
    const low = autoChooseActor(state.party.map((h, i) => ({ h, i }))).h.name;
    r.charge = 6;
    const high = autoChooseActor(state.party.map((h, i) => ({ h, i }))).h.name;
    const b = makeHero("B", "berserker"),
      j = makeHero("J", "jester");
    state.party = [b, j];
    const emptyB = chargedActorScore(b),
      emptyJ = chargedActorScore(j);
    b.fury = furyCapacity(b);
    j.anticipation = 5;
    return {
      low,
      high,
      b: chargedActorScore(b) > emptyB,
      j: chargedActorScore(j) > emptyJ,
    };
  });
  assert.equal(r.low, "A");
  assert.equal(r.high, "R");
  assert.equal(r.b, true);
  assert.equal(r.j, true);
});

test("named biome generation preserves directed ice/tunnel routes to distant stairs and grows more themed with depth", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let seed = 217311;
    const old = Math.random;
    Math.random = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    let bad = 0,
      early = 0,
      deep = 0;
    const kinds = new Set();
    for (let n = 0; n < 350; n++) {
      const depth = (n % 10) + 1,
        map = generateFloor(depth),
        goal = map.findIndex((c) => c.event === "stairs"),
        route = movementRoute(map, pos(1, 7), goal, {
          omniscient: true,
          directIce: false,
        });
      if (
        !route ||
        route.length < 8 ||
        !map[0].floorName ||
        map.some((c) => c.room && c.wall) ||
        (floorBiome(map) === "fungal" &&
          !map.some((c) => c.terrain === "mushroom")) ||
        map.some((c) => c.terrain === "bridge" && c.event)
      )
        bad++;
      if (depth === 1 && floorBiome(map) !== "cave") early++;
      if (depth === 10 && floorBiome(map) !== "cave") deep++;
      kinds.add(floorBiome(map));
    }
    Math.random = old;
    return { bad, early, deep, kinds: [...kinds] };
  });
  assert.equal(r.bad, 0);
  assert.ok(r.deep > r.early);
  assert.equal(r.kinds.length, 6);
});

test("long ice routes take the forced landing into account and stop before ice when a turn is impossible", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(async () => {
    state.map.forEach((c) => {
      c.wall = true;
      c.terrain = "stone";
    });
    for (const i of [pos(1, 7), pos(2, 7), pos(3, 7), pos(4, 7), pos(3, 6)])
      Object.assign(state.map[i], { wall: false, terrain: "floor" });
    state.map[pos(3, 7)].terrain = "ice";
    render();
    const impossible = shortestPath(pos(3, 6)),
      plan = movementPlan(pos(3, 6));
    await move(pos(3, 6));
    const stopped = state.position;
    state.position = pos(1, 7);
    Object.assign(state.map[pos(5, 7)], { wall: false, terrain: "floor" });
    state.map[pos(4, 7)].terrain = "ice";
    render();
    await move(pos(5, 7));
    return {
      impossible,
      plan,
      stopped,
      before: pos(2, 7),
      finish: state.position,
      goal: pos(5, 7),
    };
  });
  assert.equal(r.impossible, null);
  assert.equal(r.plan.stopped, true);
  assert.equal(r.stopped, r.before);
  assert.equal(r.finish, r.goal);
});

test("an adjacent ice click slides the token through all ice, with no secret route through unseen rooms", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(async () => {
    const ice = pos(2, 7);
    state.map[ice].terrain = "ice";
    state.map[pos(3, 7)].terrain = "ice";
    render();
    const path = shortestPath(ice);
    await move(ice);
    const land = state.position;
    state.position = pos(1, 7);
    state.map[ice].seen = false;
    state.map[pos(3, 7)].seen = false;
    const hidden = shortestPath(pos(4, 7));
    return { path, land, end: pos(4, 7), hidden };
  });
  assert.equal(r.path.length, 3);
  assert.equal(r.land, r.end);
  assert.ok(r.hidden === null || !r.hidden.includes(79 + 1));
});

test("mushroom reveal chains at most eight new caps without activating events, and stone stops a chain", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(() => {
    for (let y = 2; y < 6; y++)
      for (let x = 2; x < 6; x++)
        Object.assign(state.map[pos(x, y)], {
          terrain: "mushroom",
          seen: false,
        });
    const source = pos(2, 2);
    state.map[source].seen = true;
    state.map[pos(3, 2)].event = "treasure";
    revealMushrooms(source);
    const count = state.lastMushroomReveal.count,
      event = state.map[pos(3, 2)].event;
    state.map.forEach((c) => {
      c.terrain = "floor";
      c.seen = false;
    });
    for (let x = 1; x <= 8; x++) state.map[pos(x, 4)].terrain = "mushroom";
    state.map[pos(5, 4)].terrain = "stone";
    state.map[pos(5, 4)].wall = true;
    state.map[pos(1, 4)].seen = true;
    revealMushrooms(pos(1, 4));
    return { count, event, beyond: state.map[pos(6, 4)].seen };
  });
  assert.equal(r.count, 8);
  assert.equal(r.event, "treasure");
  assert.equal(r.beyond, false);
});

test("overgrowth increases party surprise and can catch enemies unaware instead", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    const old = Math.random;
    state.map[state.position].terrain = "floor";
    Math.random = () => 0.25;
    setupBattleOpening({ fresh: true });
    const ordinary = !!state.opening.surprise;
    state.map[state.position].terrain = "overgrown";
    setupBattleOpening({ fresh: true });
    const grown = !!state.opening.surprise;
    let first = true;
    Math.random = () => (first ? ((first = false), 0.9) : 0.1);
    setupBattleOpening({ fresh: true });
    Math.random = old;
    return { ordinary, grown, caught: state.enemy.caughtUnaware };
  });
  assert.equal(r.ordinary, false);
  assert.equal(r.grown, true);
  assert.equal(r.caught, true);
});

test("each biome has depth-specific creatures with pencil art, lore and distinct cries", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const old = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    const art = Object.keys(BIOME_ENEMIES).map((k) => ({
      k,
      svg: portraitArt(k),
      corpse: corpseArt(k),
      lore: SPECIES_LORE[k],
      cry: biomeCryProfiles()[k],
    }));
    Math.random = old;
    return {
      calls,
      art,
      low: biomeEnemyPool(3, "ice").map((e) => e.art),
      deep: biomeEnemyPool(9, "ice").map((e) => e.art),
      bad: biomeEnemyPool(2, "lava"),
    };
  });
  assert.equal(r.calls, 0);
  assert.equal(r.art.length, 9);
  for (const x of r.art) {
    assert.match(x.svg, new RegExp("species-" + x.k));
    assert.ok(x.lore[1]);
    assert.ok(x.cry[1] > 0);
    assert.match(x.corpse, /fallen|corpse/);
  }
  assert.deepEqual(r.low, ["frostmite"]);
  assert.deepEqual(r.deep, ["rimewarden"]);
  assert.deepEqual(r.bad, []);
});

test("Powder imp visibly counts down, self-destructs into team block and ends a surviving party battle", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const e = state.enemy;
    Object.assign(e, {
      art: "powderimp",
      name: "Powder imp",
      passive: { key: "detonate" },
      fuseLeft: 2,
      countdown: 1,
      frequency: 1,
      damage: 4,
      hp: 30,
      maxHp: 30,
    });
    setEnemyBlock(0);
    state.block = 2;
    render();
    treasureRoll = async () => {};
    runMachine = async () => [
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(0);
    const first = {
      fuse: e.fuseLeft,
      hp: state.party[0].hp,
      intent: enemyIntent(e),
    };
    await spin(0);
    return {
      first,
      after: state.party[0].hp,
      dead: e.hp,
      exploded: e.selfDestructed,
      battles: state.battlesWon,
      enemy: state.enemy,
      block: state.block,
    };
  });
  assert.equal(r.first.fuse, 1);
  assert.match(r.first.intent, /Fuse/);
  assert.ok(r.after < r.first.hp);
  assert.equal(r.dead, 0);
  assert.equal(r.exploded, true);
  assert.equal(r.battles, 1);
  assert.equal(r.enemy, null);
  assert.equal(r.block, 0);
});

test("stun pauses the Powder imp fuse, and Unbroken page protects the whole party from its detonation", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const e = state.enemy;
    Object.assign(e, {
      art: "powderimp", name: "Powder imp", passive: { key: "detonate" },
      fuseLeft: 1, countdown: 1, frequency: 1, damage: 30, hp: 30, maxHp: 30,
      stun: 1,
    });
    state.party.push(makeHero("Orin", "mage"));
    runMachine = async () => Array.from({ length: 3 }, () => ({ type: "blank", tier: 1 }));
    tryBreakStun = () => false;
    treasureRoll = async () => {};
    render();
    await spin(0);
    const paused = { fuse: e.fuseLeft, intent: enemyIntent(e) };
    clearStuns(e, 1, { all: true });
    const before = state.party.map(h => h.hp);
    state.bag.aegis = 1;
    await useItem("aegis");
    await spin(0);
    return { paused, before, after: state.party.map(h => h.hp),
      ward: state.invulnerable, item: state.bag.aegis || 0,
      exploded: e.selfDestructed, won: state.battlesWon };
  });
  assert.equal(r.paused.fuse, 1);
  assert.match(r.paused.intent, /Stunned/);
  assert.deepEqual(r.after, r.before);
  assert.equal(r.ward, null);
  assert.equal(r.item, 0);
  assert.equal(r.exploded, true);
  assert.equal(r.won, 1);
});

test("gold critical math is already visible at payoff and does not introduce another calculation phase", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    setPreference("skipCriticals", false);
    const oldHold = criticalHold;
    let during = "";
    criticalHold = async () => {
      during = document.querySelector("#treasure-result").textContent;
    };
    runMachine = async (id, reels, opts) =>
      id === "treasure"
        ? Array.from({ length: 3 }, () => ({ type: "coin", tier: 1 }))
        : opts.results;
    eventChoice = async () => "true";
    await treasureRoll();
    criticalHold = oldHold;
    return {
      during,
      final:
        document.querySelector("#treasure-result")?.textContent ||
        state.lastResult,
      multi: state.lastLoot.multiplier,
    };
  });
  assert.match(r.during, /CRITICAL GOLD/);
  assert.match(r.during, /×/);
  assert.ok(r.multi >= 2);
  assert.doesNotMatch(r.final, /JACKPOT| = /);
});

test("class faces are icon-only, glow within reels and retain workshop geometry with a permanent mark selected", async (t) => {
  const p = await game(t, 390, 844);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.last[1] = { type: "class", tier: 1, job: "fighter" };
    render();
    const text = document.querySelector(
      "#machine-hero-0 .class-face",
    ).textContent;
    editorSelection = { heroId: h.id, reel: 1, face: 0 };
    editor(0);
    await new Promise((r) => setTimeout(r, 650));
    const box = () => {
      const r = document
        .querySelector(".workshop-actions")
        .getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    };
    const normal = box();
    editorSelection.face = h.reels[1].findIndex((f) => f.type === "class");
    editor(0);
    await new Promise((r) => setTimeout(r, 150));
    const locked = box();
    return {
      text,
      normal,
      locked,
      help: !!document.querySelector("#reveal-help"),
      classMarkup: symbolMarkup({ type: "class", tier: 1, job: "ranger" }),
    };
  });
  assert.equal(r.text, "");
  assert.equal(r.help, false);
  assert.doesNotMatch(r.classMarkup, /<small>/);
  for (const k of ["x", "y", "w", "h"])
    assert.ok(Math.abs(r.normal[k] - r.locked[k]) < 2, JSON.stringify(r));
});

test("tile captions use hyphens and activated, and biome identity survives a run reload", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const used = tileName({
      seen: true,
      event: null,
      feature: "treasure",
      terrain: "floor",
    });
    state.map[0].biome = "fungal";
    state.map[0].floorName = "The violet grotto";
    save();
    const loaded = load();
    render();
    return {
      used,
      loaded,
      theme: floorBiome(),
      name: document.querySelector("#floor-name").textContent,
      version: state.version,
    };
  });
  assert.match(r.used, /Treasure - activated/);
  assert.doesNotMatch(r.used, /\//);
  assert.equal(r.loaded, true);
  assert.equal(r.theme, "fungal");
  assert.equal(r.name, "The violet grotto");
  assert.equal(r.version, 21);
});

test("actual Rogue damage and healing rolls use readable shared base tiers without hidden multipliers", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("rogue");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.enemy.countdown = 20;
    state.enemy.passive = null;
    setEnemyBlock(0);
    state.party[0].hp = 5;
    runMachine = async () => [
      { type: "attack", tier: 3 },
      { type: "attack", tier: 4 },
      { type: "heal", tier: 4 },
    ];
    await spin(0);
    return {
      damage: state.lastPlayerRoll.actualDamage,
      heal: state.lastPlayerRoll.actualHealing,
      hp: state.party[0].hp,
      enemy: state.enemy.hp,
      hits: state.lastPlayerRoll.hits.map((h) => h.power),
    };
  });
  assert.equal(r.damage, 7);
  assert.equal(r.enemy, 993);
  assert.equal(r.heal, 8);
  assert.equal(r.hp, 13);
  assert.equal(
    r.hits.reduce((a, b) => a + b, 0),
    7,
  );
});

test("every supply pickup keeps its full name, class scope and description inside its reserved card", async (t) => {
  const p = await game(t);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 800 : 844,
    });
    const bad = await p.evaluate(async () => {
      showSpotlight(
        "Spoils",
        "A useful find.",
        `<div class="trap-art">${icon("skull")}</div>${drawMachine("treasure", [
          { type: "coin", tier: 1 },
          { type: "coin", tier: 2 },
          { type: "coin", tier: 3 },
        ])}${criticalSpace()}<div id="treasure-result" class="stage-result">A useful find</div><div id="artefact-loot"></div>`,
        "treasure",
      );
      const bad = [];
      for (const [type, d] of Object.entries(ITEM_DEFS)) {
        lootFindCarousel([
          `<div class="item-find">${icon(d.icon)}<div><b>${d.name} ×12</b><p>${d.equipment ? `<b class="equipment-scope">${equipmentScope(d)}</b><br>` : ""}${d.description}</p></div></div>`,
        ]);
        fitDialogs();
        fitLootFind(document.querySelector(".loot-find-page"));
        const card = document
            .querySelector(".item-find")
            .getBoundingClientRect(),
          text = document.querySelector(".item-find > div");
        const range = document.createRange();
        range.selectNodeContents(text);
        const box = range.getBoundingClientRect();
        if (
          box.right > card.right + 2 ||
          box.bottom > card.bottom + 2 ||
          box.top < card.top - 2
        )
          bad.push({
            type,
            card: { h: card.height, w: card.width },
            text: { h: box.height, w: box.width },
            bottom: box.bottom - card.bottom,
          });
      }
      return bad;
    });
    assert.deepEqual(bad, [], JSON.stringify({ width, bad }));
  }
});

test("new shake profiles differ by action and stronger scaling still obeys zero and reduced motion", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const frames = [
      "rumble",
      "impact",
      "critical",
      "explosion",
      "fuse",
      "healing",
      "settle",
    ].map((k) => JSON.stringify(shakeFrames(10, k)));
    setPreference("shake", 0);
    const none = shakeElement(document.querySelector("#book"), 5);
    setPreference("shake", 1);
    const active = shakeElement(
      document.querySelector("#book"),
      5,
      "explosion",
    );
    const max = Math.max(
      ...active.effect
        .getKeyframes()
        .map((f) =>
          Math.abs(
            Number((f.transform.match(/translate\(([-\d.]+)/) || [])[1]) || 0,
          ),
        ),
    );
    active.cancel();
    return { unique: new Set(frames).size, none, max };
  });
  assert.equal(r.unique, 7);
  assert.equal(r.none, null);
  assert.ok(r.max >= 10);
});

test("version-20 migration buffs living Tanks without reviving corpses or changing settings, ownership or edited marks", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.hp = 12;
    h.maxHp = 48;
    h.points = 27;
    h.reels[0][0] = { type: "block", tier: 4, weight: 3 };
    state.version = 20;
    save();
    const key = localStorage.getItem(SAVE_KEY),
      loaded = load();
    const a = {
      hp: state.party[0].hp,
      max: state.party[0].maxHp,
      face: state.party[0].reels[0][0],
      points: state.party[0].points,
    };
    const dead = JSON.parse(key);
    dead.party[0].hp = 0;
    dead.party[0].dead = true;
    dead.over = true;
    localStorage.setItem(SAVE_KEY, JSON.stringify(dead));
    load();
    return { loaded, a, dead: state.party[0].hp, version: state.version };
  });
  assert.equal(r.loaded, true);
  assert.equal(r.a.hp, 14);
  assert.equal(r.a.max, 50);
  assert.equal(r.a.points, 39); // 12 points refunded for retired weight III.
  assert.deepEqual(r.a.face, { type: "block", tier: 4, weight: 1 });
  assert.equal(r.dead, 0);
  assert.equal(r.version, 21);
});
