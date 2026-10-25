const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  { chromium } = require("playwright");
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
async function game(t, width = 1920, height = 1080) {
  const p = await browser.newPage({ viewport: { width, height } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(async () => {
    newRun("fighter");
    setPace("skip");
    setPreference("shake", 0);
    setPreference("skipCriticals", true);
    window.seededCharacterLuck = characterLuck;
    characterLuck = () => 0.999999;
    campInitial = false;
    await document.fonts.ready;
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, [], "no browser runtime errors");
  });
  return p;
}

test("camp has eight five-tier lesson families, eight untiered challenges and three equal adventurer cards", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    campPage("classes");
    return {
      families: Object.keys(CAMP_LESSONS).map((f) =>
        Object.values(CAMP_UNLOCKS)
          .filter((d) => d.family === f)
          .map((d) => d.rank),
      ),
      challenges: Object.values(CAMP_UNLOCKS)
        .filter((d) => d.category === "challenges")
        .map((d) => d.rank || 0),
      boons: Object.values(CAMP_UNLOCKS).filter((d) => d.category === "boons")
        .length,
      cards: [...document.querySelectorAll(".camp-card")].map(
        (e) => e.getBoundingClientRect().height,
      ),
    };
  });
  assert.equal(r.families.length, 8);
  for (const ranks of r.families) assert.deepEqual(ranks, [1, 2, 3, 4, 5]);
  assert.deepEqual(r.challenges, Array(8).fill(0));
  assert.equal(r.boons, 0);
  assert.equal(r.cards.length, 3);
  assert.ok(Math.max(...r.cards) - Math.min(...r.cards) < 1);
});

test("owned ranks and active ranks are separate, bounded, persisted and snapshotted only on the next run", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ ...emptyProfile(), gold: 100000 }),
    );
    campPage("training");
    for (let rank = 1; rank <= 5; rank++)
      if (!purchaseUnlock("vitality" + rank)) throw Error("purchase failed");
    const owned = readProfile();
    setActiveLesson("vitality", 2);
    const current = [...state.runRules],
      tooHigh = setActiveLesson("vitality", 6);
    newRun();
    const hp = state.party[0].maxHp,
      rules = [...state.runRules];
    campPage("training");
    setActiveLesson("vitality", 0);
    const active = readProfile().activeTraining.vitality,
      unchanged = state.party[0].maxHp;
    newRun();
    return {
      earned: ownedLessonRank("vitality", owned),
      owned: owned.owned.length,
      current,
      tooHigh,
      hp,
      rules,
      active,
      unchanged,
      base: state.party[0].maxHp,
    };
  });
  assert.equal(r.earned, 5);
  assert.equal(r.owned, 5);
  assert.equal(r.tooHigh, false);
  assert.deepEqual(r.current, []);
  assert.equal(r.hp, Math.round(50 * 1.2));
  assert.deepEqual(r.rules, ["vitality2"]);
  assert.equal(r.active, 0);
  assert.equal(r.unchanged, r.hp);
  assert.equal(r.base, 50);
});

test("legacy provisions migrate without losing banked gold, deposit receipts, existing training or disabled choices", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const old = {
      version: 1,
      gold: 4000,
      owned: [
        "provisions",
        "company",
        "springs",
        "hearty",
        "vitality1",
        "vitality2",
      ],
      enabled: ["provisions", "company"],
      deposits: { "prior-run:2": 99 },
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(old));
    const a = readProfile(),
      b = readProfile();
    return {
      same: JSON.stringify(a) === JSON.stringify(b),
      gold: a.gold,
      deposits: a.deposits,
      purse: selectedLessonRank("purse", a),
      company: selectedLessonRank("fellowship", a),
      recovery: selectedLessonRank("recovery", a),
      vitality: selectedLessonRank("vitality", a),
      old: a.owned.filter((id) => Object.hasOwn(LEGACY_CAMP_LESSONS, id)),
    };
  });
  assert.equal(r.same, true);
  assert.equal(r.gold, 4000);
  assert.deepEqual(r.deposits, { "prior-run:2": 99 });
  assert.equal(r.purse, 3);
  assert.equal(r.company, 5);
  assert.equal(r.recovery, 0);
  assert.equal(r.vitality, 2);
  assert.deepEqual(r.old, []);
});

test("reset progress has a cancel and explicit confirmation, clears only game progress and preserves every option", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("3");
    setPalette("dark");
    setPreference("masterVolume", 0.23);
    setPreference("shake", 0.4);
    setPreference("ambientEffects", false);
    setAutoplay(true);
    localStorage.setItem(
      PROFILE_KEY,
      JSON.stringify({ ...emptyProfile(), gold: 999, owned: ["ranger"] }),
    );
    localStorage.setItem(
      BESTIARY_KEY,
      JSON.stringify({ version: 1, records: {} }),
    );
    localStorage.setItem("unrelated-app", "keep");
    window.oldSettings = localStorage.getItem("scratchpad-dungeon-settings");
    optionsPage("play");
  });
  await p.locator("#option-reset-save").click();
  await p.locator("#cancel-save-reset").click();
  assert.equal(await p.evaluate(() => campProfile().gold), 999);
  await p.locator("#option-reset-save").click();
  await p.locator("#confirm-save-reset").click();
  const r = await p.evaluate(() => ({
    settings:
      localStorage.getItem("scratchpad-dungeon-settings") ===
      window.oldSettings,
    gold: campProfile().gold,
    owned: campProfile().owned,
    bestiary: localStorage.getItem(BESTIARY_KEY),
    other: localStorage.getItem("unrelated-app"),
    starter: state.awaitingStarter,
    speed: state.speed,
    theme: state.palette,
    lighting: preferences().ambientEffects,
  }));
  assert.equal(r.settings, true);
  assert.equal(r.gold, 0);
  assert.deepEqual(r.owned, []);
  assert.equal(r.bestiary, null);
  assert.equal(r.other, "keep");
  assert.equal(r.starter, true);
  assert.equal(r.speed, "3");
  assert.equal(r.theme, "dark");
  assert.equal(r.lighting, false);
});

test("class and temperament choose different legal starting palettes while rank power is identical across classes", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() =>
    heroJobs(["ranger", "berserker", "jester"]).map((job) => {
      const a = makeHero("A", job, null, [], { specialism: "offence" }),
        b = makeHero("B", job, null, [], { specialism: "defence" });
      return {
        job,
        hp: a.maxHp,
        different: JSON.stringify(a.reels) !== JSON.stringify(b.reels),
        legal: [...a.reels, ...b.reels].every((r) =>
          r.every(
            (f) => f.type === "class" || editableTypes(a).includes(f.type),
          ),
        ),
        base: temperamentEffects(
          a,
          calculate([
            { type: "attack", tier: 2 },
            { type: "heal", tier: 2 },
            { type: "block", tier: 2 },
          ]),
        ),
        other: temperamentEffects(
          b,
          calculate([
            { type: "attack", tier: 2 },
            { type: "heal", tier: 2 },
            { type: "block", tier: 2 },
          ]),
        ),
      };
    }),
  );
  assert.equal(r.length, 6);
  for (const hero of r) {
    assert.equal(hero.different, true, hero.job);
    assert.equal(hero.legal, true, hero.job);
    assert.deepEqual(hero.base, hero.other, hero.job);
    assert.equal(hero.base.attack, 4);
    assert.equal(hero.base.heal, 4);
    assert.equal(hero.base.block, 2);
  }
  assert.equal(r[0].hp, 50);
  assert.equal(
    await p.evaluate(() =>
      classAbilityDescription({ job: "berserker" }).includes("NaN"),
    ),
    false,
  );
});

test("long travel counts one command, redirection counts another, invalid/no-op destinations do not age passages", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.map.forEach((c, i) =>
      Object.assign(c, {
        wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
        seen: true,
        event: null,
        feature: null,
        terrain: "floor",
        fogged: false,
        lastNearCommand: 0,
      }),
    );
    state.position = pos(1, 7);
    state.pursuer = null;
    advancePursuer = async () => false;
    minorTravelEvent = async () => false;
    render();
    window.longMove = move(pos(8, 7));
  });
  await p.waitForFunction(() => !!travel);
  await p.evaluate(() => move(pos(5, 6)));
  await p.evaluate(() => window.longMove);
  const r = await p.evaluate(async () => {
    const before = state.moveCommands;
    await move(state.position);
    await move(pos(0, 0));
    return {
      before,
      after: state.moveCommands,
      position: state.position,
      goal: pos(5, 6),
    };
  });
  assert.equal(r.before, 2);
  assert.equal(r.after, 2);
  assert.equal(r.position, r.goal);
});

test("ambush age is exactly command-based, stays invisible and can still create a wandering battle on entry", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const i = pos(8, 2),
      c = state.map[i];
    Object.assign(c, {
      seen: true,
      wall: false,
      event: null,
      terrain: "floor",
      fogged: false,
      lastNearCommand: 0,
    });
    state.moveCommands = 11;
    refreshStaleMap(performance.now() + 1000000);
    const early = c.fogged;
    state.exploreTime = 999999;
    refreshStaleMap();
    const waiting = c.fogged;
    registerMoveCommand();
    const aged = c.fogged;
    state.position = pos(7, 2);
    Object.assign(state.map[state.position], {
      seen: true,
      wall: false,
      event: null,
      terrain: "floor",
    });
    render();
    const hasOverlay = document
      .querySelector(`[data-tile="${i}"]`)
      .classList.contains("stale-fog");
    advancePursuer = async () => false;
    minorTravelEvent = async () => false;
    encounterEntrance = async () => {};
    const real = Math.random;
    Math.random = () => 0;
    await move(i);
    Math.random = real;
    return {
      early,
      waiting,
      aged,
      hasOverlay,
      ambush: state.encounterReward?.ambush,
      age: state.moveCommands,
    };
  });
  assert.equal(r.early, false);
  assert.equal(r.waiting, false);
  assert.equal(r.aged, true);
  assert.equal(r.hasOverlay, false);
  assert.equal(r.ambush, true);
  assert.equal(r.age, 13);
});

test("many generated floors keep reachable distant stairs and never place a discovery on a bridge", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let bridges = 0;
    for (let n = 0; n < 150; n++) {
      const map = generateFloor(1 + (n % 10), 1, 2, ["echoes"]),
        dist = mapDistances(map),
        stairs = map.findIndex((c) => c.event === "stairs");
      if (!dist.has(stairs) || dist.get(stairs) < 8) throw Error("stair route");
      for (const c of map)
        if (c.terrain === "bridge") {
          bridges++;
          if (c.event || c.feature || c.wall) throw Error("bridge discovery");
        }
    }
    return bridges;
  });
  assert.ok(r > 0);
});

test("lava light stops at stone and its distance-sensitive ambient glow follows the ambient toggle", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.map.forEach((c) =>
      Object.assign(c, {
        seen: false,
        wall: false,
        terrain: "floor",
        event: null,
        room: null,
      }),
    );
    const lava = pos(5, 4),
      wall = pos(4, 4);
    Object.assign(state.map[lava], { wall: true, terrain: "lava" });
    Object.assign(state.map[wall], { wall: true, terrain: "stone" });
    state.position = pos(3, 4);
    markSeen(wall);
    const blocked = !state.map[lava].seen;
    markSeen(pos(5, 5));
    const lit = state.map[lava].seen;
    state.position = pos(5, 5);
    setPreference("ambientEffects", true);
    updateLavaGlow();
    const adjacent = Number(
      document
        .querySelector("#lava-lighting")
        .style.getPropertyValue("--lava-strength"),
    );
    state.position = pos(5, 6);
    updateLavaGlow();
    const near = Number(
      document
        .querySelector("#lava-lighting")
        .style.getPropertyValue("--lava-strength"),
    );
    setPreference("ambientEffects", false);
    const off = Number(
      document
        .querySelector("#lava-lighting")
        .style.getPropertyValue("--lava-strength"),
    );
    return {
      blocked,
      lit,
      adjacent,
      near,
      off,
      frame: icon("lava").includes("terrain-boundary"),
    };
  });
  assert.equal(r.blocked, true);
  assert.equal(r.lit, true);
  assert.ok(r.adjacent > r.near && r.near > 0);
  assert.equal(r.off, 0);
  assert.equal(r.frame, true);
});

test("tunnel teleport draws a directed route between the two real map positions and remains reusable", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    for (const c of state.map)
      if (c.event === "tunnel") {
        c.event = null;
        c.feature = null;
        delete c.tunnelTo;
        delete c.tunnelPair;
      }
    const from = pos(1, 7),
      to = pos(7, 2);
    state.position = from;
    for (const i of [from, to])
      Object.assign(state.map[i], {
        seen: true,
        wall: false,
        event: "tunnel",
        feature: "tunnel",
        terrain: "floor",
        tunnelTo: i === from ? to : from,
      });
    render();
    window.tunnelPaths = [];
    new MutationObserver((rs) =>
      rs.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.classList?.contains("tunnel-transit"))
            window.tunnelPaths.push(n.querySelector("path").getAttribute("d"));
        }),
      ),
    ).observe(document.body, { childList: true });
    window.teleport = tunnelEncounter(state.map[from]);
  });
  await p.locator("#tunnel-use").click();
  await p.evaluate(() => window.teleport);
  const r = await p.evaluate(() => ({
    position: state.position,
    goal: pos(7, 2),
    paths: window.tunnelPaths,
    tunnels: state.map.filter((c) => c.event === "tunnel").length,
    remaining: document.querySelectorAll(".tunnel-transit").length,
  }));
  assert.equal(r.position, r.goal);
  assert.equal(r.paths.length, 1);
  assert.match(r.paths[0], /^M[\d.]+ [\d.]+ Q/);
  assert.equal(r.tunnels, 2);
  assert.equal(r.remaining, 0);
});

test("Jester ordinary critical odds ignore distinct kinds and the permanent seal is still unique", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = makeHero("Quill", "jester");
    const distinct = [
        { type: "attack", tier: 1 },
        { type: "heal", tier: 1 },
        { type: "block", tier: 1 },
      ],
      same = [
        { type: "attack", tier: 1 },
        { type: "attack", tier: 2 },
        { type: "attack", tier: 3 },
      ];
    h.reels = distinct.map((f) => [{ ...f, weight: 1 }]);
    return {
      distinct: matchCount(distinct) === 3,
      ranks: matchCount(same) === 3,
      blank: matchCount([
        distinct[0],
        distinct[1],
        { type: "blank", tier: 1 },
      ]) === 3,
      odds: heroCriticalOdds(h),
      types: editableTypes(h).length,
      seal: makeHero("Q", "jester").reels.map(
        (r) => r.filter((f) => f.type === "class").length,
      ),
    };
  });
  assert.equal(r.distinct, false);
  assert.equal(r.ranks, false);
  assert.equal(r.blank, false);
  assert.deepEqual(r.odds, []);
  assert.equal(r.types, 9);
  assert.deepEqual(r.seal, [0, 1, 0]);
});

test("a real Jester mixed roll grants no special multiplier, critical EXP or free encore", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter(false, { count: 1 });
    state.enemy.hp = state.enemy.maxHp = 10000;
    state.enemy.countdown = 20;
    finishOpeningRoll();
    const real = Math.random;
    Math.random = () => 0;
    let calls = 0;
    runMachine = async (id) =>
      id.startsWith("hero")
        ? (calls++,
          [
            { type: "attack", tier: 1 },
            { type: "block", tier: 1 },
            { type: "heal", tier: 1 },
          ])
        : [{ type: "multiplier", value: 4, tier: 1 }];
    await spin(0);
    Math.random = real;
    return {
      calls,
      count: state.enemy.countdown,
      spins: state.party[0].stats.spins,
      xp: state.party[0].stats.criticalXP,
      multiplier: state.lastPlayerRoll.multiplier,
      stun: state.party[0].stun,
      damage: state.party[0].stats.damageDealt,
    };
  });
  assert.equal(r.calls, 1);
  assert.equal(r.spins, 1);
  assert.equal(r.count, 19);
  assert.equal(r.xp || 0, 0);
  assert.equal(r.multiplier, 1);
  assert.equal(r.stun, 0);
  assert.ok(r.damage > 0);
});

test("a matching Jester triple has a normal critical without self-stun or a free encore", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter(false, { count: 1 });
    state.enemy.hp = state.enemy.maxHp = 10000;
    state.enemy.countdown = 20;
    finishOpeningRoll();
    runMachine = async () =>
      Array.from({ length: 3 }, () => ({ type: "attack", tier: 1 }));
    await spin(0);
    return {
      stun: state.party[0].stun,
      spins: state.party[0].stats.spins,
      xp: state.party[0].stats.criticalXP || 0,
      multiplier: state.lastPlayerRoll.multiplier,
      count: state.enemy.countdown,
    };
  });
  assert.equal(r.stun, 0);
  assert.equal(r.spins, 1);
  assert.equal(r.xp, 1);
  assert.ok([2, 2.5, 3, 4].includes(r.multiplier));
  assert.equal(r.count, 19);
});

test("all six Wildcards work, gifts are temporary and enemy blackouts actually replace a reel with blank", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const out = [];
    for (let trick = 0; trick < 6; trick++) {
      newRun("jester");
      setPace("skip");
      beginEncounter(false, { count: 1 });
      const h = state.party[0],
        e = state.enemy;
      e.hp = e.maxHp = 100;
      e.passive = null;
      e.rage = 0;
      e.stimulant = null;
      setEnemyBlock(0);
      h.hp = 10;
      const reels = JSON.stringify(h.reels),
        real = Math.random;
      Math.random = () => (trick + 0.01) / 6;
      runMachine = async () => [
        { type: "attack", tier: 1 },
        { type: "heal", tier: 1 },
        { type: "blank", tier: 1 },
      ];
      await jesterWildcard(h);
      Math.random = real;
      out.push({
        trick: state.lastWildcard.trick,
        covered: e.blackout?.length || 0,
        gift: h.reelGifts?.length || 0,
        hp: h.hp,
        enemy: e.hp,
        reels: JSON.stringify(h.reels) === reels,
        blank: giftedReels(e).some((r) => r.every((f) => f.type === "blank")),
      });
      clearBattleStatuses();
      if (h.reelGifts?.length || e.blackout?.length)
        throw Error("temporary trick leaked");
    }
    return out;
  });
  assert.deepEqual(
    r.map((v) => v.trick),
    [0, 1, 2, 3, 4, 5],
  );
  assert.equal(r[0].covered, 1);
  assert.equal(r[0].blank, true);
  assert.equal(r[1].gift, 1);
  assert.ok(r[2].enemy < 100 && r[2].hp > 10);
  assert.ok(r[3].enemy < 100 && r[3].hp < 10);
  assert.ok(r[4].hp > 10);
  assert.ok(r[5].enemy < 100 && r[5].hp > 10);
  assert.ok(r.every((v) => v.reels));
});

test("ten rare personal moments split five combat/five travel, obey receipts and cooldowns and can grant a related trait", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const defs = Object.values(CHARACTER_EVENTS);
    beginEncounter(false, { count: 1 });
    const h = state.party[0];
    characterLuck = () => 0;
    const survival = luckyDamage(h, 1000, {
        source: "An enemy",
        piercing: true,
      }),
      hp = h.hp;
    const trait = h.trait?.id,
      again = characterMoment("heroic", h);
    const second = characterMoment("ironWill", h),
      third = characterMoment("inspired", h);
    state.enemy = null;
    state.enemies = [];
    const travel = characterMoment("insight", h),
      tooSoon = characterMoment("scavenger", h);
    state.moveCommands += 8;
    const later = characterMoment("scavenger", h);
    return {
      contexts: defs.map((d) => d.context),
      chances: defs.map((d) => d.chance),
      survival,
      hp,
      trait,
      again,
      second,
      third,
      travel,
      tooSoon,
      later,
      records: state.characterEvents.length,
    };
  });
  assert.equal(r.contexts.filter((x) => x === "combat").length, 5);
  assert.equal(r.contexts.filter((x) => x === "travel").length, 5);
  assert.ok(r.chances.every((x) => x > 0 && x < 0.06));
  assert.equal(r.survival, r.hp - 1);
  assert.equal(r.trait, "heroic");
  assert.equal(r.again, false);
  assert.equal(r.second, true);
  assert.equal(r.third, false);
  assert.equal(r.travel, true);
  assert.equal(r.tooSoon, false);
  assert.equal(r.later, true);
  assert.equal(r.records, 4);
});

test("event luck is saved and repeatable while passive renders, waiting and cosmetic FX cannot advance it", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    characterLuck = window.seededCharacterLuck;
    state.characterLuckSeed = 123456;
    const a = Array.from({ length: 10 }, () => characterLuck()),
      seed = state.characterLuckSeed;
    render();
    refreshStaleMap(performance.now() + 999999);
    const stable = state.characterLuckSeed === seed;
    state.characterLuckSeed = 123456;
    const b = Array.from({ length: 10 }, () => characterLuck());
    return { a, b, stable };
  });
  assert.deepEqual(r.a, r.b);
  assert.equal(r.stable, true);
  assert.ok(new Set(r.a).size === 10);
});

test("autoplay keeps different build preferences, develops support marks and can respec a support-only solo survivor into damage", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const out = [];
    for (const role of ["assault", "bulwark", "balanced"]) {
      newRun("fighter");
      state.depth = 4;
      const h = state.party[0];
      h.autoArchetype = role;
      h.points = 90;
      autoUpgradeHero(h);
      const f = expectedHeroEffects(h);
      out.push({
        role,
        damage: f.damage,
        block: f.block,
        stun: f.stun,
        buffs: f.stimulant,
        marks: h.reels
          .flat()
          .map((f) => f.type + f.tier)
          .join(","),
      });
    }
    newRun("mage");
    const h = state.party[0];
    h.points = 0;
    h.reels = [0, 1, 2].map((k) => [
      { type: "heal", tier: 4, weight: 1 },
      ...(k === 1 ? [{ type: "class", tier: 1, weight: 1, job: "mage" }] : []),
    ]);
    const edits = repairSoloBuild(h);
    return { out, edits, damage: autoDamageScore(h), points: h.points };
  });
  assert.equal(new Set(r.out.map((x) => x.marks)).size, 3);
  assert.ok(r.out.every((x) => x.damage >= 3));
  assert.ok(r.out[1].block > r.out[0].block);
  assert.ok(
    r.out.some((x) => x.stun > 1 || x.buffs > 1),
    JSON.stringify(r.out),
  );
  assert.ok(r.edits > 0);
  assert.ok(r.damage >= 2);
  assert.ok(r.points >= 0);
});

test("guide topics are scannable lists, toolbar actions are moved to Options and round appears beside Combat only during a fight", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    help("statuses");
    const lists = FIELD_GUIDE.every(
        (t) => t.body.startsWith("<ul") && !t.body.includes("<p>"),
      ),
      points = document
        .querySelector(".current-topic")
        .querySelectorAll("li").length;
    closeModal();
    const hiddenRound = document.querySelector("#round").hidden,
      hiddenTools = ["help", "download"].every(
        (id) => document.getElementById(id).hidden,
      );
    beginEncounter(false, { count: 1 });
    render();
    const round = document.querySelector("#round").getBoundingClientRect(),
      title = document.querySelector("#combat-title").getBoundingClientRect();
    optionsPage("play");
    return {
      lists,
      points,
      hiddenRound,
      hiddenTools,
      combatRound: !document.querySelector("#round").hidden,
      offset: round.left - title.right,
      sameLine: Math.abs(round.top - title.top) < 40,
      save: !!document.querySelector("#option-download"),
      reset: !!document.querySelector("#option-reset-save"),
    };
  });
  assert.equal(r.lists, true);
  assert.ok(r.points >= 4);
  assert.equal(r.hiddenRound, true);
  assert.equal(r.hiddenTools, true);
  assert.equal(r.combatRound, true);
  assert.ok(r.offset >= 0 && r.offset < 35, JSON.stringify(r));
  assert.equal(r.sameLine, true);
  assert.equal(r.save, true);
  assert.equal(r.reset, true);
});

test("camp choices, cards and description/control rows fit at desktop and compact sizes; navigation stays stationary across pages", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    for (const category of ["classes", "training", "challenges", "oddities"]) {
      await p.evaluate((category) => campPage(category, 0), category);
      await p.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      const result = await p.evaluate(() => {
        const rect = (e) => e.getBoundingClientRect(),
          cards = [...document.querySelectorAll(".camp-card")],
          nav = rect(document.querySelector(".camp-leaf-nav"));
        return {
          nav: nav.top,
          footer: rect(document.querySelector("#camp-return")).top,
          items: cards.map((e) => ({
            height: rect(e).height,
            bottom: rect(e).bottom,
            children: [...e.children].map((c) => ({
              tag: c.tagName,
              top: rect(c).top,
              bottom: rect(c).bottom,
            })),
            description: rect(e.querySelector("p")).bottom,
            control: rect(
              e.querySelector(".active-lesson") ||
                e.querySelector("button") ||
                e.querySelector(".camp-owned"),
            ).top,
          })),
          count: cards.length,
        };
      });
      assert.ok(
        result.items.every((c) => c.bottom <= result.footer + 1),
        `${width} ${category} footer`,
      );
      assert.ok(
        result.items.every((c) => c.description <= c.control + 1),
        `${width} ${category} text: ${JSON.stringify(result.items)}`,
      );
      if (category === "classes")
        assert.ok(
          Math.max(...result.items.map((c) => c.height)) -
            Math.min(...result.items.map((c) => c.height)) <
            1,
        );
      if (width <= 760 && category !== "classes") assert.ok(result.count <= 2);
      const before = result.nav;
      await p.evaluate(() => {
        if (!document.querySelector("#camp-next").disabled)
          document.querySelector("#camp-next").click();
      });
      const after = await p
        .locator(".camp-leaf-nav")
        .evaluate((e) => e.getBoundingClientRect().top);
      assert.ok(Math.abs(before - after) < 1, `${width} ${category} nav`);
    }
  }
});

test("non-gold critical themes remain, coin pours are quiet and item finds keep their sequential pulse and sound", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const calls = [],
      real = GameSound.play;
    GameSound.play = (id) => (calls.push(id), true);
    playCriticalTheme({ context: "well" }, [{ icon: "heal", value: 4 }]);
    playCriticalTheme({ context: "treasure" }, [{ icon: "coin", value: 8 }]);
    playCriticalTheme({}, [{ icon: "poison", value: 2 }]);
    startCoinRain(100, false, document.querySelector("#book"));
    stopCoinRain();
    GameSound.play = real;
    return {
      calls,
      rush: !!SOUND_CUES.coinsRush,
      goldTheme: !!SOUND_CUES.criticalGold,
    };
  });
  assert.deepEqual(r.calls, [
    "criticalHeal",
    "criticalPoison",
  ]);
  assert.equal(r.rush, false);
  assert.equal(r.goldTheme, false);
  await p.evaluate(() => {
    showSpotlight(
      "Finds",
      "Two useful finds.",
      '<div id="artefact-loot"></div>',
      "treasure",
    );
    window.findSounds = [];
    GameSound.play = (id) => (window.findSounds.push(id), true);
    lootFindCarousel([
      '<div class="incoming-item">' +
        icon("ration") +
        "<b>Trail ration</b></div>",
      '<div class="incoming-item">' + icon("potion") + "<b>Tonic</b></div>",
    ]);
  });
  await p.waitForFunction(
    () =>
      document.querySelector("#artefact-loot").dataset.presenting === "false",
  );
  const sequence = await p.evaluate(() => ({
    sounds: window.findSounds.filter((x) => x === "itemFind").length,
    count: document.querySelector("#loot-count").textContent,
  }));
  assert.equal(sequence.sounds, 2);
  assert.match(sequence.count, /2 \/ 2/);
});

test("fountain artwork, reels, critical heading and all recipient rows stay fixed before and after its roll", async (t) => {
  const p = await game(t, 390, 844);
  await p.addStyleTag({
    content: "#stage-card {animation:none!important;transition:none!important}",
  });
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "mage"), makeHero("Wren", "rogue"));
    state.party.forEach((h) => (h.hp = 1));
    render();
    runMachine = async (id) => {
      if (id === "fountain") {
        await new Promise((r) => (window.releaseWell = r));
        return Array.from({ length: 3 }, () => ({ type: "heal", tier: 1 }));
      }
      return [{ type: "multiplier", tier: 1, value: 1.5 }];
    };
    window.wellAction = wellEncounter({ event: "well" });
  });
  await p.locator("#well-use").click();
  await p.waitForSelector("#fountain-result .well-heal-total");
  const before = await p.evaluate(() =>
    Object.fromEntries(
      [
        ".trap-art",
        "#machine-fountain",
        "#event-critical",
        "#fountain-result",
      ].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [s, [r.x, r.y, r.width, r.height]];
      }),
    ),
  );
  await p.evaluate(() => window.releaseWell());
  await p.waitForSelector("#stage-confirm");
  const after = await p.evaluate(() =>
    Object.fromEntries(
      [
        ".trap-art",
        "#machine-fountain",
        "#event-critical",
        "#fountain-result",
      ].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return [s, [r.x, r.y, r.width, r.height]];
      }),
    ),
  );
  for (const key of Object.keys(before))
    for (let i = 0; i < 4; i++)
      assert.ok(Math.abs(before[key][i] - after[key][i]) < 1, key);
  assert.equal(
    await p.locator("#fountain-result .well-heal-total[data-after]").count(),
    3,
  );
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.wellAction);
});

test("inviting a fourth companion and then declining the replacement follows the same refusal path", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.party.push(makeHero("Mira", "mage"), makeHero("Wren", "rogue"));
    window.refused = [];
    declinedRecruit = async (h) => window.refused.push(h.name);
    window.recruitAction = recruitEncounter();
  });
  const name = await p.evaluate(() => recruitOffer.name);
  await p.locator("#recruit-accept").click();
  await p.waitForSelector(".replacement-grid");
  await p.locator("#recruit-decline").click();
  await p.evaluate(() => window.recruitAction);
  assert.deepEqual(await p.evaluate(() => window.refused), [name]);
  assert.equal(await p.evaluate(() => state.party.length), 3);
});

test("Jester healing triples restore HP without self-stun and last-stand survival prevents an actual death record", async (t) => {
  const p = await game(t);
  const result = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = state.enemy.maxHp = 10000;
    state.enemy.countdown = 99;
    state.party[0].hp = 1;
    runMachine = async () =>
      Array.from({ length: 3 }, () => ({ type: "heal", tier: 1 }));
    const real = Math.random;
    Math.random = () => 0;
    await spin(0);
    Math.random = real;
    const backfire = { hp: state.party[0].hp, stun: state.party[0].stun };
    newRun("fighter");
    beginEncounter(false, { count: 1 });
    state.block = 0;
    characterLuck = () => 0;
    const damage = damageHero(0, 10000, "A terrible blow", { piercing: true });
    return {
      backfire,
      damage,
      hp: state.party[0].hp,
      dead: state.party[0].dead,
      pending: state.pendingDeaths.length,
      trait: state.party[0].trait?.id,
    };
  });
  assert.ok(result.backfire.hp > 1);
  assert.equal(result.backfire.stun, 0);
  assert.equal(result.hp, 1);
  assert.equal(result.dead, false);
  assert.equal(result.pending, 0);
  assert.equal(result.trait, "heroic");
});

test("decimal and Jackpot multiplier lettering fits its reel, and fountain offers include real healing bonuses", async (t) => {
  const p = await game(t);
  await p.addStyleTag({
    content: "#stage-card {animation:none!important;transition:none!important}",
  });
  for (const [width, height] of [
    [1920, 1080],
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    for (const value of [1.25, 2.5, 4, 8, 16]) {
      const r = await p.evaluate((value) => {
        showSpotlight(
          "Jackpot!",
          "A doubled critical multiplier.",
          drawMachine(
            "fit-multiplier",
            [{ type: "multiplier", value, tier: 1 }],
            { one: true, title: "Multiplier" },
          ),
          "critical",
        );
        fitDialogs();
        const node = document.querySelector(".multiplier-value"),
          window = document
            .querySelector("#machine-fit-multiplier .slot-window")
            .getBoundingClientRect(),
          range = document.createRange();
        range.selectNodeContents(node);
        const text = range.getBoundingClientRect();
        return {
          fits:
            text.left >= window.left - 1 &&
            text.right <= window.right + 1 &&
            text.top >= window.top - 1 &&
            text.bottom <= window.bottom + 1,
          text: [text.x, text.y, text.width, text.height],
          window: [window.x, window.y, window.width, window.height],
        };
      }, value);
      assert.equal(r.fits, true, JSON.stringify({ width, value, ...r }));
    }
  }
  const offered = await p.evaluate(() => {
    closeSpotlight();
    state.runRules = ["recovery3"];
    const h = state.party[0];
    h.hp = 1;
    h.maxHp = 200;
    const before = [{ value: 10 }],
      after = [{ value: 15 }];
    const box = document.createElement("div");
    box.innerHTML = wellResultsMarkup(before, after, 1.5);
    return {
      label: box.querySelector("strong").textContent,
      amount: healHero(0, 15),
    };
  });
  assert.equal(offered.label, "18 HP");
  assert.equal(offered.amount, 18);
});
