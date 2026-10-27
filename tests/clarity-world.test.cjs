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
    window.actualScheduleStunRecovery = scheduleStunRecovery;
    scheduleStunRecovery = () => {};
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

async function fight(p, jobs = ["fighter"]) {
  await p.evaluate((jobs) => {
    closeModal();
    closeSpotlight();
    state.party = jobs.map((job) => makeHero(job, job));
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      countdown: 99,
      passive: null,
    });
    setEnemyBlock(0);
    state.block = 0;
    render();
  }, jobs);
}
async function flat(p, theme = "cave") {
  await p.evaluate((theme) => {
    closeModal();
    closeSpotlight();
    state.enemy = null;
    state.enemies = [];
    busy = false;
    travel = null;
    state.position = pos(1, 7);
    state.map = Array.from({ length: W * H }, (_, i) => ({
      wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
      seen: true,
      visited: false,
      event: null,
      feature: null,
      terrain:
        i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1)
          ? "stone"
          : "floor",
      doodle: 0,
      corpses: [],
    }));
    state.map[pos(9, 1)].event = "stairs";
    state.map[pos(9, 1)].feature = "stairs";
    state.map[0].biome = theme;
    state.map[0].floorName = BIOMES[theme].names[0];
    state.pursuerSpawned = true;
    minorTravelEvent = async () => false;
    travelCharacterMoment = () => false;
    render();
  }, theme);
}

test("enemy critical payoff uses a defensive skip label, without altering the multiplier", async (t) => {
  const p = await game(t);
  await fight(p);
  await p.evaluate(() => {
    setPreference("skipCriticals", false);
    criticalHold = () =>
      new Promise((resolve) => {
        criticalHoldResolver = resolve;
      });
    window.crit = rollCritical(
      "Test foe",
      [0, 1, 2].map(() => ({ type: "attack", tier: 1 })),
      true,
      { details: [{ icon: "sword", label: "Damage", value: 3 }] },
    );
  });
  await p.waitForSelector("#stage-skip:not([disabled])");
  assert.match(
    await p.locator("#stage-skip").innerText(),
    /Resolve enemy roll/,
  );
  await p.locator("#stage-skip").click();
  await p.evaluate(() => window.crit);
});

test("a stunned hero is visibly unavailable with a ready ally; ally rolls recover it without a wasted click", async (t) => {
  const p = await game(t);
  await fight(p, ["fighter", "mage"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.stun = 1;
    h.stunAge = 0;
    h.stunAppliedRoll = -1;
    render();
    const locked = {
      reason: heroLockReason(h),
      disabled: $("#machine-hero-0 .machine-face").disabled,
      overlay: $("#machine-hero-0 .reel-unavailable").textContent,
    };
    const clock = state.enemy.countdown;
    await spin(0);
    const after = state.enemy.countdown;
    Math.random = () => 0;
    await runMachine("hero-1", state.party[1].reels, {
      results: [
        { type: "blank", tier: 1 },
        { type: "blank", tier: 1 },
        { type: "blank", tier: 1 },
      ],
    });
    return { locked, clock, after, recovered: !h.stun, ward: h.stunWard };
  });
  assert.equal(r.locked.disabled, true);
  assert.match(r.locked.overlay, /STUNNED/);
  assert.equal(r.clock, r.after);
  assert.equal(r.recovered, true);
  assert.equal(r.ward, 2);
});

test("a solo stun loses one real turn, advances the enemy clock and visibly recovers", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.stun = 1;
    h.stunAge = 0;
    state.enemy.countdown = 8;
    await spin(0);
    return {
      stun: h.stun,
      ward: h.stunWard,
      clock: state.enemy.countdown,
      missed: h.stats.turnsMissed,
      spins: h.stats.spins,
    };
  });
  assert.deepEqual(r, { stun: 0, ward: 2, clock: 7, missed: 1, spins: 0 });
});

test("surprise and shadow denial cover the machine, and a veiled last actor must switch unless alone", async (t) => {
  const p = await game(t);
  await fight(p, ["fighter", "rogue"]);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    state.opening.firstRoll = true;
    h.surprised = true;
    render();
    const surprise = $("#machine-hero-0 .reel-unavailable").className;
    finishOpeningRoll();
    state.enemy.passive = { key: "veil" };
    finishShadowAction(h);
    render();
    const shadow = $("#machine-hero-0 .reel-unavailable").className,
      blocked = heroCannotRoll(h);
    state.autoCombat.supportSpins = 2;
    const ai = autoChooseActor(state.party.map((h, i) => ({ h, i }))).i;
    finishShadowAction(state.party[1]);
    const cleared = !h.shadowRest;
    state.party = [h];
    h.shadowRest = true;
    return { surprise, shadow, blocked, cleared, ai, solo: heroCannotRoll(h) };
  });
  assert.match(r.surprise, /surprise/);
  assert.match(r.shadow, /shadow/);
  assert.equal(r.blocked, true);
  assert.equal(r.ai, 1);
  assert.equal(r.cleared, true);
  assert.equal(r.solo, false);
});

test("Jesters own exactly one immutable mystery on every reel, and old saved wheels gain them once", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = makeHero("Fool", "jester");
    h.points = 100;
    const counts = h.reels.map(
      (r) => r.filter((f) => f.type === "mystery").length,
    );
    const seal = h.reels.map((r) => r.filter((f) => f.type === "class").length);
    const edits = h.reels.map((r, k) =>
      ["upgrade", "weaken", "swap"].map((op) =>
        applyFaceEdit(
          h,
          k,
          r.findIndex((f) => f.type === "mystery"),
          op,
          "attack",
        ),
      ),
    );
    h.reels.forEach((r) =>
      r.splice(
        r.findIndex((f) => f.type === "mystery"),
        1,
      ),
    );
    normaliseHeroBuild(h);
    normaliseHeroBuild(h);
    state.party = [h];
    save();
    load();
    return {
      counts,
      seal,
      edits,
      after: state.party[0].reels.map(
        (r) => r.filter((f) => f.type === "mystery").length,
      ),
      points: state.party[0].points,
    };
  });
  assert.deepEqual(r.counts, [1, 1, 1]);
  assert.deepEqual(r.seal, [0, 1, 0]);
  assert.ok(r.edits.flat().every((x) => !x));
  assert.deepEqual(r.after, [1, 1, 1]);
  assert.equal(r.points, 100);
});

test("mystery ranks follow the reel distribution exactly, resolve unrestricted powers and add exact odds", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const reel = [
      { type: "attack", tier: 1 },
      { type: "heal", tier: 1 },
      { type: "magic", tier: 4 },
      { type: "block", tier: 4 },
      { type: "class", tier: 1 },
      { type: "mystery", tier: 1 },
    ];
    const tiers = [];
    for (let n = 0; n < 100; n++) {
      let k = 0;
      tiers.push(
        resolveMysteryFace(reel.at(-1), reel, () =>
          k++ === 0 ? (n + 0.5) / 100 : 0.85,
        ).tier,
      );
    }
    const probabilities = expandedReelProbabilities(reel);
    return {
      low: tiers.filter((t) => t === 1).length,
      high: tiers.filter((t) => t === 4).length,
      sum: Object.values(probabilities).reduce((a, b) => a + b, 0),
      selfharm: probabilities["selfharm:4"],
      description: mysteryDescription(),
    };
  });
  assert.equal(r.low, 50);
  assert.equal(r.high, 50);
  assert.ok(Math.abs(r.sum - 1) < 1e-10);
  assert.ok(r.selfharm > 0);
  assert.match(r.description, /Cannot be upgraded/);
});

test("Punchline groups its hits into one readable log entry and preserves the true total", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1, weight: 1 }]);
    state.logs = [];
    await jesterMarkBurst(h);
    return {
      logs: state.logs,
      damage: state.lastPunchline.damage,
      hits: state.lastPunchline.shots.map((s) => s.actual),
    };
  });
  assert.equal(r.logs.length, 1);
  assert.match(r.logs[0], /Punchline ×6/);
  assert.ok(r.logs[0].includes(" = " + r.damage + " damage"));
  assert.equal(
    r.damage,
    r.hits.reduce((a, b) => a + b, 0),
  );
});

test("Iron Pennant adds once after critical scaling and once across a whole Punchline", async (t) => {
  const p = await game(t);
  await fight(p, ["fighter"]);
  const r = await p.evaluate(async () => {
    state.artefacts = [
      { id: "p", key: "block", power: 3, name: "Iron Pennant" },
    ];
    state.equippedArtefact = "p";
    const h = state.party[0];
    state.actionSerial++;
    h.last = [
      { type: "block", tier: 1 },
      { type: "block", tier: 1 },
      { type: "block", tier: 1 },
    ];
    const raw = await planHeroRoll(h, h.last);
    const scaled = scaleEffects(raw, 2);
    grantRolledBlock(h, scaled.block);
    const first = state.block;
    grantRolledBlock(h, 1);
    return { raw: raw.block, scaled: scaled.block, first, again: state.block };
  });
  assert.equal(r.raw, 6);
  assert.equal(r.scaled, 12);
  assert.equal(r.first, 15);
  assert.equal(r.again, 16);
});

test("blank inscription follows the chosen power; class prices and high-rank icons fit the workshop", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.party[0].points = 99;
    editor(0);
    editorSelection.face = state.party[0].reels[0].findIndex(
      (f) => f.type === "blank",
    );
    editor(0);
  });
  await p.locator("#blank-choose").click();
  await p.locator("#face-destination").selectOption("heal");
  assert.match(await p.locator("#face-swap").innerText(), /Inscribe Healing/);
  await p.locator("#face-swap").click();
  assert.equal(
    await p.evaluate(() => state.party[0].reels[0][editorSelection.face].type),
    "heal",
  );
  await p.locator('[data-workshop-view="prices"]').click();
  assert.match(
    await p.locator(".workshop-prices-page").innerText(),
    /Affinity changes point costs/,
  );
});

test("shop and bag distinguish services, gear and consumables; equipped gear opens compatible alternatives", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.bag = { ironSignet: 1, potion: 1, starLens: 1 };
    state.party[0].equipment = "bulwarkBadge";
    inspectHeroEquipment(0);
    return {
      categories: ["heal", "ironSignet", "potion"].map(
        (t) => itemCategory(t).kind,
      ),
      names: [...document.querySelectorAll("[data-equip-alternative]")].map(
        (b) => b.dataset.equipAlternative,
      ),
      text: $("#modal").textContent,
    };
  });
  assert.deepEqual(r.categories, ["instant", "equipment", "consumable"]);
  assert.deepEqual(r.names, ["ironSignet"]);
  assert.match(r.text, /Bulwark Badge/);
});

test("all treasure finds are visible together, with no carousel controls or shifting action area", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    showSpotlight("Treasure", "", `<div id="artefact-loot"></div>`, "treasure");
    lootFindCarousel(
      ["potion", "bomb", "ward", "artefact"].map(
        (name) =>
          `<div class="item-find">${icon("bag")}<div><b>${name}</b><p>A find.</p></div></div>`,
      ),
    );
  });
  assert.equal(await p.locator(".loot-find-tile").count(), 4);
  assert.equal(await p.locator("#loot-next").count(), 0);
  for (const tile of await p.locator(".loot-find-tile").all())
    assert.equal(await tile.isVisible(), true);
});

test("particle motion and lifetime use elapsed time at low frame rates, including spin", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const make = () => ({
      x: 0,
      y: 0,
      vx: 2,
      vy: 2,
      size: 2,
      angle: 0,
      spin: 0.2,
      life: 0,
      max: 1000,
      kind: "paper",
    });
    particles = [make()];
    fxLast = 1000;
    drawParticles(1100);
    cancelAnimationFrame(fxFrame);
    const slow = { ...particles[0] };
    particles = [make()];
    fxLast = 1000;
    drawParticles(1050);
    cancelAnimationFrame(fxFrame);
    drawParticles(1100);
    cancelAnimationFrame(fxFrame);
    const fast = { ...particles[0] };
    particles = [];
    return { slow, fast };
  });
  assert.equal(r.slow.life, 100);
  assert.equal(r.slow.x, 12.5);
  assert.equal(r.slow.angle, 1.25);
  assert.ok(Math.abs(r.fast.y - r.slow.y) < 1e-9);
});

test("pun identities and names are unique across every bestiary entry, including guardians", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() =>
    BESTIARY_ENTRIES.map((e) => {
      const id = punIdentity({
        art: e.art,
        boss: !!e.depth,
        stairBossDepth: e.depth,
      });
      return { id, name: PUN_ENEMIES[id], entry: e.id };
    }),
  );
  assert.equal(new Set(r.map((x) => x.id)).size, r.length, JSON.stringify(r));
  assert.equal(new Set(r.map((x) => x.name)).size, r.length);
});

test("mudslides work from all four approaches, collapse after departure and keep a stair route", async (t) => {
  const p = await game(t);
  await flat(p);
  const r = await p.evaluate(async () => {
    const mud = pos(4, 4);
    state.map[mud].terrain = "mudslide";
    const plans = [];
    for (const from of neighbors(mud)) {
      const cells = glideCells(state.map, from, mud);
      plans.push({ from, cells, safe: !state.map[cells.at(-1)].wall });
    }
    state.position = pos(3, 4);
    render();
    await move(mud);
    return {
      plans,
      position: state.position,
      wall: state.map[mud].wall,
      terrain: state.map[mud].terrain,
      safe: allTilesCanReachStairs(state.map),
      returnRoute: movementRoute(state.map, state.position, pos(3, 4)),
    };
  });
  assert.ok(r.plans.every((x) => x.safe && x.cells.length === 2));
  assert.equal(r.position, 49);
  assert.equal(r.wall, true);
  assert.equal(r.terrain, "mudwall");
  assert.equal(r.safe, true);
  assert.ok(r.returnRoute.every((i) => i !== 48));
});

test("a generated thousand-floor sample keeps every stair route and confines lava to lava themes", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let rng = 811;
    Math.random = () =>
      (rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0) / 4294967296;
    const bad = [],
      themes = {},
      counts = { mud: 0, stalactite: 0, crystal: 0 };
    for (let n = 0; n < 1000; n++) {
      const map = generateFloor(1 + (n % 10), 1, 0, []);
      themes[floorBiome(map)] = (themes[floorBiome(map)] || 0) + 1;
      if (
        !allTilesCanReachStairs(map) ||
        !safeWithClosedTiles(map) ||
        mapDistances(map).get(map.findIndex((c) => c.event === "stairs")) < 8
      )
        bad.push(n);
      if (map.some((c) => c.terrain === "lava") && floorBiome(map) !== "lava")
        bad.push("lava" + n);
      for (const c of map) {
        if (c.terrain === "mudslide") counts.mud++;
        if (c.terrain === "stalactite") counts.stalactite++;
        if (c.terrain === "crystal") {
          counts.crystal++;
          if (!c.wall) bad.push("crystal");
        }
      }
    }
    return { bad, themes, counts };
  });
  assert.deepEqual(r.bad, []);
  assert.ok(r.themes.shadow > 0 && r.themes.unstable > 0);
  assert.ok(
    r.counts.mud > 0 && r.counts.stalactite > 0 && r.counts.crystal > 0,
  );
});

test("dynamic rockfalls only place safe permanent walls, while stalactites tick per footstep and kill the pursuer without XP", async (t) => {
  const p = await game(t);
  await flat(p, "unstable");
  const r = await p.evaluate(async () => {
    const before = state.party[0].xp,
      drop = pos(5, 4);
    state.map[drop].terrain = "stalactite";
    state.map[drop].stalactite = { remaining: 1, drops: 0 };
    state.pursuer = { position: drop };
    await livingDungeonStep();
    const chest = {
      event: state.map[drop].event,
      stalactite: state.map[drop].stalactite,
      pursuer: state.pursuer,
      xp: state.party[0].xp,
    };
    const wall = createRockfallWall();
    return {
      before,
      chest,
      wall,
      blocked: state.map[wall].wall,
      safe: allTilesCanReachStairs(state.map),
    };
  });
  assert.equal(r.chest.event, "treasure");
  assert.equal(r.chest.stalactite, null);
  assert.equal(r.chest.pursuer, null);
  assert.equal(r.before, r.chest.xp);
  assert.equal(r.blocked, true);
  assert.equal(r.safe, true);
});

test("shadow cover preserves known routes and event contents, pauses in menus, slows with coverage and clears on entry", async (t) => {
  const p = await game(t);
  await flat(p, "shadow");
  const r = await p.evaluate(async () => {
    const i = pos(4, 4);
    state.map[i].visited = true;
    state.map[i].event = "well";
    state.map[i].feature = "well";
    state.map[i].shadowDue = 1;
    state.map[0].shadowClock = 0;
    advanceShadowTime(2);
    const covered = state.map[i].shadowCovered,
      event = state.map[i].event,
      path = movementRoute(state.map, state.position, i);
    const clock = state.map[0].shadowClock;
    help();
    advanceShadowTime(2);
    const held = state.map[0].shadowClock;
    closeModal();
    await uncoverShadow(i);
    return {
      covered,
      event,
      path: !!path,
      clock,
      held,
      clear: !state.map[i].shadowCovered,
      still: state.map[i].event,
      known: state.map[i].seen,
    };
  });
  assert.equal(r.covered, true);
  assert.equal(r.event, "well");
  assert.equal(r.path, true);
  assert.equal(r.clock, r.held);
  assert.equal(r.clear, true);
  assert.equal(r.known, true);
  assert.equal(r.still, "well");
});

test("crystal deposits are blocking and their visible aura matches line of sight", async (t) => {
  const p = await game(t);
  await flat(p, "crystal");
  const r = await p.evaluate(() => {
    const i = pos(5, 4);
    state.map[i].wall = true;
    state.map[i].terrain = "crystal";
    state.map[pos(4, 4)].wall = true;
    renderMap();
    return {
      blocked: state.map[i].wall,
      sourceDisabled: $(`[data-tile="${i}"]`).disabled,
      near: $(`[data-tile="${pos(6, 4)}"] .crystal-radius`) !== null,
      behind: $(`[data-tile="${pos(3, 4)}"] .crystal-radius`) !== null,
    };
  });
  assert.deepEqual(r, {
    blocked: true,
    sourceDisabled: true,
    near: true,
    behind: false,
  });
});

test("solo stun recovery runs automatically, while a ready ally prevents an automatic wasted turn", async (t) => {
  const p = await game(t);
  await fight(p);
  await p.evaluate(() => {
    scheduleStunRecovery = window.actualScheduleStunRecovery;
    state.party[0].stun = 1;
    state.enemy.countdown = 8;
    render();
  });
  await p.waitForFunction(
    () =>
      !busy && !state.party[0].stun && state.party[0].stats.turnsMissed === 1,
  );
  assert.equal(await p.evaluate(() => state.enemy.countdown), 7);
  await fight(p, ["fighter", "rogue"]);
  await p.evaluate(() => {
    state.party[0].stun = 1;
    render();
  });
  await p.waitForTimeout(650);
  assert.deepEqual(
    await p.evaluate(() => ({
      stun: state.party[0].stun,
      missed: state.party[0].stats.turnsMissed,
      clock: state.enemy.countdown,
    })),
    { stun: 1, missed: 0, clock: 99 },
  );
});

test("ordinary ally stimulant respects the selected healthy ally rather than the most used or wounded one", async (t) => {
  const p = await game(t);
  await fight(p, ["mage", "fighter", "rogue"]);
  const r = await p.evaluate(async () => {
    state.target = 1;
    state.party[1].hp = state.party[1].maxHp;
    state.party[2].hp = 1;
    state.party[2].stats.spins = 90;
    const real = runMachine;
    runMachine = (id, reels, options) =>
      real(
        id,
        reels,
        id === "hero-0"
          ? {
              results: [
                { type: "rally", tier: 1 },
                { type: "blank", tier: 1 },
                { type: "blank", tier: 1 },
              ],
            }
          : options,
      );
    await spin(0);
    return state.party.map((h) => !!h.stimulant);
  });
  assert.deepEqual(r, [false, true, false]);
});

test("a paid Flurry action groups its impacts and healing in one log with correct actual damage", async (t) => {
  const p = await game(t);
  await fight(p, ["rogue"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.hp = h.maxHp - 6;
    state.logs = [];
    const real = runMachine;
    runMachine = (id, reels, options) =>
      real(
        id,
        reels,
        id === "hero-0"
          ? {
              results: [
                { type: "attack", tier: 1 },
                { type: "class", tier: 1, job: "rogue" },
                { type: "heal", tier: 1 },
              ],
            }
          : options,
      );
    await spin(0);
    return {
      logs: state.logs,
      hits: state.lastPlayerRoll.hits,
      damage: h.stats.damageDealt,
      group: groupedCombatLog,
    };
  });
  assert.equal(r.logs.length, 1);
  assert.match(r.logs[0], /FLURRY ×/);
  assert.ok(r.logs[0].includes(" = " + r.damage + " damage"));
  assert.equal(
    r.hits.reduce((n, h) => n + h.actual, 0),
    r.damage,
  );
  assert.equal(r.group, null);
});

test("Heroic survival keeps a large notice through rendering and waits for explicit confirmation", async (t) => {
  const p = await game(t);
  await fight(p);
  await p.evaluate(() => {
    characterLuck = () => 0;
    damageHero(0, 999, "Test foe", { piercing: true });
    render();
    window.moment = showPendingCharacterMoments();
  });
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.party[0].hp), 1);
  assert.match(await p.locator("#stage-title").innerText(), /HEROIC/);
  assert.equal(await p.locator("#machine-hero-0 .hero-notice").count(), 1);
  await p.waitForTimeout(250);
  assert.equal(await p.locator("#spotlight").isVisible(), true);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.moment);
  assert.equal(await p.locator("#spotlight").isVisible(), false);
});

test("music switches battle scores and depth ambience, while all existing volume buses still mute", async (t) => {
  const p = await game(t);
  // Start audio through its real controls, not an unlabelled desk coordinate.
  // Chromium may defer Web Audio activation; scene assertions begin only once
  // the context is actually ready, independently of parallel browser workload.
  await p.bringToFront();
  await p.locator("#options-tab").click();
  await p.locator("#tab-audio").click();
  await p.locator("#sound-preview").click();
  await p.waitForFunction(() => GameSound.context?.state === "running");
  await p.evaluate(async () => {
    await GameSound.unlock();
    setPreference("musicVolume", 0.25);
    setPreference("ambienceVolume", 0.25);
  });
  await p.waitForFunction(() => GameSound.stats.musicScene === "exploration");
  await fight(p);
  await p.waitForFunction(() => GameSound.stats.musicScene === "battle");
  await p.evaluate(() => {
    state.depth = 10;
  });
  await p.waitForFunction(
    () => GameSound.stats.ambienceDepth === 1,
    {},
    { timeout: 10000 },
  );
  // Volume ramps use AudioContext time, which stops when a background/hidden
  // browser suspends it. Measure the fade on a foreground, running context.
  await p.bringToFront();
  await p.evaluate(async () => {
    await GameSound.unlock();
    setPreference("musicVolume", 0);
    setPreference("ambienceVolume", 0);
  });
  await p.waitForFunction(
    () => GameSound.gains.music < 0.0001 && GameSound.gains.ambience < 0.0001,
  );
  const r = await p.evaluate(() => ({
    gains: GameSound.gains,
    samples: GameSound.samplesReady,
    expectedSamples: Object.keys(SFX_ASSETS).length,
  }));
  assert.ok(r.gains.music < 0.0001);
  assert.ok(r.gains.ambience < 0.0001);
  assert.equal(r.samples, r.expectedSamples);
});

test("a found high-level Jester preserves permanent mysteries and Punchline cannot repeat the Pennant", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party[0].level = 10;
    const h = prepareRecruit(makeHero("Folly", "jester"));
    const mystery = h.reels.map(
      (r) => r.filter((f) => f.type === "mystery").length,
    );
    state.party = [h];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.artefacts = [
      { id: "p", key: "block", power: 3, name: "Iron Pennant" },
    ];
    state.equippedArtefact = "p";
    state.block = 0;
    state.actionSerial++;
    h.reels = [0, 1, 2].map(() => [{ type: "block", tier: 1, weight: 1 }]);
    await jesterMarkBurst(h);
    return { mystery, block: state.block, reported: state.lastPunchline.block };
  });
  assert.deepEqual(r.mystery, [1, 1, 1]);
  assert.equal(r.block, 15);
  assert.equal(r.reported, 15);
});

test("grouped damage includes Wildcard impacts before the main roll and never reports a false sum", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      group = beginHeroRollLog(h);
    state.logs = [];
    Math.random = () => 0.9;
    await jesterWildcard(h);
    h.stats.damageDealt += damageEnemy(1, "Test follow-up", state.enemy, {
      attacker: h,
    });
    finishHeroRollLog(group, h);
    return {
      logs: state.logs,
      hits: group.actualHits,
      total: h.stats.damageDealt,
      group: groupedCombatLog,
    };
  });
  assert.equal(r.logs.length, 1);
  assert.ok(
    r.logs[0].includes(r.hits.join(" + ") + " = " + r.total + " damage"),
  );
  assert.equal(
    r.hits.reduce((a, b) => a + b, 0),
    r.total,
  );
  assert.equal(r.group, null);
});

test("falling ceilings wound a standing hero, refresh within range and an impossible rockfall places nothing", async (t) => {
  const p = await game(t);
  await flat(p, "unstable");
  const r = await p.evaluate(async () => {
    const c = state.map[state.position],
      hp = state.party[0].hp;
    c.terrain = "stalactite";
    c.stalactite = { remaining: 1, drops: 0 };
    await livingDungeonStep();
    const hit = hp - state.party[0].hp,
      remaining = c.stalactite.remaining,
      drops = c.stalactite.drops;
    state.map.forEach((c, i) => {
      c.wall = i !== state.position;
      c.event = null;
      c.terrain = "stone";
    });
    state.map[state.position].terrain = "floor";
    return {
      hit,
      remaining,
      drops,
      candidates: rockfallWallCandidates().length,
      wall: createRockfallWall(),
    };
  });
  assert.equal(r.hit, 2);
  assert.ok(r.remaining >= 4 && r.remaining <= 8);
  assert.equal(r.drops, 1);
  assert.equal(r.candidates, 0);
  assert.equal(r.wall, null);
});

test("four artefacts keep their rules accessible and their controls inside compact fixed loot cards", async (t) => {
  const p = await game(t, 320, 844);
  await p.evaluate(() => {
    showSpotlight(
      "Treasure",
      "Four finds.",
      `<div class="trap-art">${icon("treasure")}</div>${drawMachine(
        "treasure",
        [0, 1, 2].map(() => ({ type: "coin", tier: 1 })),
      )}${criticalSpace()}<div id="treasure-result" class="stage-result">100 gold</div><div id="artefact-loot"></div>`,
      "treasure",
    );
    const finds = ARTEFACT_TYPES.filter((a) =>
      ["attack", "block", "guard", "revive"].includes(a.key),
    ).map((a, i) => ({
      ...a,
      power: 8,
      id: "find-" + i,
      name: a.name + " · IV",
    }));
    state.artefacts = finds;
    lootFindCarousel(
      finds.map(
        (a) =>
          `<div class="artefact-card">${icon("artefact")}<div><b>${a.name}</b><p>${artefactText(a)}</p>${artefactButton(a)}</div></div>`,
      ),
    );
    eventChoice([{ id: "stage-confirm", label: "Collect", value: true }]);
    fitDialogs();
  });
  await p.waitForTimeout(700);
  const r = await p.evaluate(() =>
    [...document.querySelectorAll(".loot-find-tile")].map((el) => {
      const bounds = el.getBoundingClientRect();
      return {
        tooltip: el.dataset.tooltip,
        overflow: [...el.querySelectorAll("b,p,button,small")]
          .filter((n) => {
            const r = n.getBoundingClientRect();
            return r.right > bounds.right + 1 || r.bottom > bounds.bottom + 1;
          })
          .map((n) => n.textContent),
      };
    }),
  );
  assert.equal(r.length, 4);
  assert.ok(r.every((row) => !!row.tooltip));
  assert.deepEqual(
    r.flatMap((row) => row.overflow),
    [],
  );
});

test("mysteries respect temporary reel ranks in a Punchline and resolve for a hostile Jester too", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.reels = [0, 1, 2].map(() => [
      { type: "attack", tier: 1, weight: 1 },
      { type: "mystery", tier: 1, weight: 1 },
    ]);
    h.reelGifts = [{ reel: 0, uses: 1 }];
    Math.random = () => 0.75;
    await jesterMarkBurst(h);
    const tiers = state.lastPunchline.shots.map((f) => f.tier);
    state.enemy.art = "jester";
    const rolled = await runMachine(enemyMachine(state.enemy), h.reels, {
      results: [0, 1, 2].map(() => ({ type: "mystery", tier: 1 })),
    });
    return { tiers, rolled };
  });
  assert.deepEqual(r.tiers, [2, 1, 1, 2, 1, 1]);
  assert.ok(r.rolled.every((f) => f.fromMystery && f.type !== "mystery"));
});

test("Autofight and Autoplay read and confirm Heroic moments without stalling", async (t) => {
  const p = await game(t);
  await fight(p);
  for (const mode of ["autoresolve", "autoplay"]) {
    await p.evaluate((mode) => {
      state[mode] = true;
      busy = true;
      state.pendingCharacterMoments = [
        {
          heroId: state.party[0].id,
          title: "HEROIC!",
          text: "holds on at 1 HP",
        },
      ];
      window.autoMoment = showPendingCharacterMoments();
    }, mode);
    await p.waitForFunction(() => document.querySelector("#spotlight").hidden);
    await p.evaluate(async (mode) => {
      state[mode] = false;
      await window.autoMoment;
      busy = false;
    }, mode);
  }
});
