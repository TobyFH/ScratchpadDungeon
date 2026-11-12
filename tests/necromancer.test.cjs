const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"));
  server = http.createServer((_, r) => {
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
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate(() => {
    const profile=emptyProfile();profile.dungeonCleared=true;localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));
    newRun("necromancer");
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("skipCriticals", true);
    setPreference("shake", 0);
    characterLuck = () => 0.99999;
    state.runRules = [];
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
async function fight(p, count = 1) {
  await p.evaluate((count) => {
    beginEncounter(false, { count });
    finishOpeningRoll();
    closeSpotlight();
    state.enemies.forEach((e) =>
      Object.assign(e, { hp: 1000, maxHp: 1000, passive: null, countdown: 99 }),
    );
    setEnemyBlock(0);
    render();
  }, count);
}
test("Necromancer is available only at the start, has three rankable families and one immutable middle seal", async (t) => {
  const p = await game(t);
  await p.evaluate(() => chooseStartingClass(false));
  await p.locator('[data-start-job="necromancer"]').click();
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 100;
    const editable = editableTypes(h);
    const seal = h.reels[1].findIndex((f) => f.type === "class");
    return {
      job: h.job,
      hp: h.maxHp,
      editable,
      recruitJobs: heroJobs(["ranger", "jester", "bloodbinder"]),
      seals: h.reels.flat().filter((f) => f.type === "class").length,
      private: editableTypes(makeHero("J", "jester")).includes("harvest"),
      edit: applyFaceEdit(h, 1, seal, "swap", "magic"),
      upgrades: editable
        .filter((t) => t !== "blank")
        .reduce((n, t) => n + maxFaceTier(t), 0),
      portrait: portraitArt(h.job, h),
    };
  });
  assert.equal(r.job, "necromancer");
  assert.equal(r.hp, 22);
  assert.deepEqual(r.editable, ["magic", "poison", "harvest", "blank"]);
  assert.ok(!r.recruitJobs.includes("necromancer"));
  assert.equal(r.seals, 1);
  assert.equal(r.private, false);
  assert.equal(r.edit, false);
  assert.equal(r.upgrades, 12);
  assert.match(r.portrait, /necromancer-art/);
});
test("full bars raise at most two persistent Skeletons, then heal everyone without replacing them", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      grantSouls(h, soulCapacity(h));
      grantSouls(h, soulCapacity(h));
      h.hp = 1;
      h.skeletons.forEach((s) => (s.hp = 1));
      const ids = h.skeletons.map((s) => s.id);
      grantSouls(h, soulCapacity(h));
      return {
        ids,
        after: h.skeletons.map((s) => s.id),
        hp: h.hp,
        bones: h.skeletons.map((s) => s.hp),
        souls: h.souls,
        party: state.party.length,
        spins: document.querySelectorAll(".skeleton-card [data-spin]").length,
        gear: document.querySelectorAll(".skeleton-card [data-edit]").length,
      };
    });
  assert.deepEqual(r.ids, r.after);
  assert.equal(r.hp, 4);
  assert.deepEqual(r.bones, [3, 3]);
  assert.equal(r.souls, 0);
  assert.equal(r.party, 1);
  assert.equal(r.spins, 0);
  assert.equal(r.gear, 0);
});
test("fractional damage Souls fill an exact bar without a floating-point extra hit", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      for (let i = 0; i < 80; i++) grantSouls(h, NECROMANCER.damageSouls);
      return { souls: h.souls, skeletons: h.skeletons.length };
    });
  assert.deepEqual(r, { souls: 0, skeletons: 1 });
});
test("a real Harvest critical deals small spell damage and gathers Souls to summon automatically", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.reels = [
      [{ type: "harvest", tier: 4, weight: 1 }],
      [{ type: "class", tier: 1, job: h.job, weight: 1 }],
      [{ type: "harvest", tier: 4, weight: 1 }],
    ];
    render();
    await spin(0);
    return {
      roll: state.lastPlayerRoll,
      count: h.skeletons.length,
      souls: h.souls,
      stats: h.stats,
      enemy: state.enemy.hp,
      level: h.level,
    };
  });
  assert.ok(r.roll.multiplier > 1);
  assert.ok(r.roll.totals.harvest > 0);
  assert.ok(r.count >= 1 && r.count <= 2);
  assert.ok(r.enemy < 1000);
  assert.equal(r.level, 1);
});
test("each Skeleton attacks the selected target once per paid action, without an extra enemy-clock advance", async (t) => {
  const p = await game(t);
  await fight(p, 2);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    grantSouls(h, soulCapacity(h));
    grantSouls(h, soulCapacity(h));
    h.reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1, weight: 1 }]);
    const [a, b] = state.enemies;
    state.enemy = b;
    render();
    await spin(0);
    return {
      hp: [a.hp, b.hp],
      attacks: h.skeletons.map((s) => s.stats.attacks),
      countdown: state.enemies.map((e) => e.countdown),
      spins: h.stats.spins,
    };
  });
  assert.deepEqual(r.hp, [1000, 998]);
  assert.deepEqual(r.attacks, [1, 1]);
  assert.deepEqual(r.countdown, [98, 98]);
  assert.equal(r.spins, 1);
});
test("bodyguard protects only the first single-target attack per enemy turn, choosing the healthiest Skeleton", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      e = state.enemy;
    h.hp = h.maxHp = 100;
    grantSouls(h, soulCapacity(h));
    grantSouls(h, soulCapacity(h));
    h.skeletons[0].hp = 4;
    h.skeletons[1].hp = 11;
    e.strikes = 3;
    e.damage = 3;
    e.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1, weight: 1 }]);
    const old = rollCritical;
    rollCritical = async () => 1;
    try {
      await enemyTurn(e);
      return {
        hp: h.hp,
        bones: h.skeletons.map((s) => s.hp),
        taken: h.stats.damageTaken,
        interceptor: state.lastEnemyRoll.interceptorId,
      };
    } finally {
      rollCritical = old;
    }
  });
  assert.equal(r.hp, 100 - r.taken);
  assert.ok(r.taken > 0);
  assert.equal(r.bones[0], 4);
  assert.ok(r.bones[1] < 11);
});
test("a Skeleton absorbs a whole critical attack even when the first damage segment kills it", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      e = state.enemy;
    h.hp = 10;
    grantSouls(h, soulCapacity(h));
    h.skeletons[0].hp = 1;
    e.strikes = 1;
    e.damage = 4;
    e.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1, weight: 1 }]);
    const old = rollCritical;
    rollCritical = async () => 2;
    try {
      await enemyTurn(e);
      return {
        hp: h.hp,
        bones: h.skeletons.length,
        lost: h.stats.skeletonsLost,
        grave: state.graveyard.length,
        pending: state.pendingDeaths.length,
        souls: h.souls,
      };
    } finally {
      rollCritical = old;
    }
  });
  assert.ok(r.hp >= 10);
  assert.equal(r.bones, 0);
  assert.equal(r.lost, 1);
  assert.equal(r.grave, 0);
  assert.equal(r.pending, 0);
  assert.ok(r.souls >= 3);
});
test("area and piercing attacks bypass interception; an eligible later turn can be guarded", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      e = state.enemy;
    grantSouls(h, soulCapacity(h));
    const area = necromancerBodyguard(h, e, { area: true }),
      pierce = necromancerBodyguard(h, e, { piercing: true }),
      guard = necromancerBodyguard(h, e),
      again = necromancerBodyguard(h, e);
    return { area: !!area, pierce: !!pierce, guard: !!guard, again: !!again };
  });
  assert.deepEqual(r, {
    area: false,
    pierce: false,
    guard: true,
    again: false,
  });
});
test("Soul Harvest uses enemy maximum HP, caps at half the master’s maximum, and never pays twice", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      e = state.enemy;
    h.maxHp = 100;
    h.hp = 1;
    damageEnemy(1000, "An item", e, { piercing: true });
    const once = h.hp;
    necromancerEnemyDeath(e);
    return { once, after: h.hp, receipt: e.soulHarvested };
  });
  assert.equal(r.once, 51);
  assert.equal(r.after, 51);
  assert.equal(r.receipt, true);
});
test("poison and Skeleton kills grant death recovery; a phase split is not a second death reward", async (t) => {
  const p = await game(t);
  await fight(p, 2);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      [a, b] = state.enemies;
    h.maxHp = 100;
    h.hp = 1;
    a.maxHp = 20;
    a.hp = 1;
    a.poison = {
      turns: 1,
      damage: 1,
      sourceId: h.id,
      sourceName: h.name,
      appliedAt: -1,
    };
    await tickPoison();
    const poison = h.hp;
    b.maxHp = 20;
    b.hp = 1;
    state.enemy = b;
    grantSouls(h, soulCapacity(h));
    await skeletonCombatAction(h);
    const skeleton = h.hp;
    const e = {
      ...b,
      id: "phase-test",
      hp: 1,
      maxHp: 100,
      passive: { key: "split" },
      soulHarvested: false,
    };
    state.enemies = [e];
    state.enemy = e;
    h.hp = 1;
    damageEnemy(1, "Spell", e, { piercing: true });
    const phase = h.hp;
    return { poison, skeleton, phase, fragment: e.fragment };
  });
  assert.equal(r.poison, 4);
  assert.equal(r.skeleton, 7);
  assert.equal(r.phase, 1);
  assert.ok(r.fragment);
});
test("ordinary and exact healing are blocked, but Soul recovery works and autoplay avoids wasted wells/items", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.hp = 1;
      state.bag = { potion: 1 };
      const normal = healHero(0, 50),
        exact = healHero(0, 50, { exact: true }),
        offer = offeredHealing(h, 50),
        plan = autoItemPlan(),
        well = autoNeedsWell();
      const soul = healNecromancer(h, 4);
      return { normal, exact, offer, plan, well, soul, hp: h.hp };
    });
  assert.equal(r.normal, 0);
  assert.equal(r.exact, 0);
  assert.equal(r.offer, 0);
  assert.equal(r.plan, null);
  assert.equal(r.well, false);
  assert.equal(r.soul, 4);
  assert.equal(r.hp, 5);
});
test("Skeleton HP and Souls survive battle cleanup and reload, and level growth grants no conventional recovery", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    grantSouls(h, soulCapacity(h));
    h.skeletons[0].hp = 5;
    grantSouls(h, 7);
    h.hp = 2;
    clearBattleStatuses();
    save();
    const loaded = load();
    const saved = {
      souls: state.party[0].souls,
      hp: state.party[0].skeletons[0].hp,
    };
    addXP(state.party[0], 12);
    return {
      loaded,
      saved,
      level: state.party[0].level,
      hp: state.party[0].hp,
      max: state.party[0].maxHp,
      damage: skeletonAttack(state.party[0]),
      bonesMax: state.party[0].skeletons[0].maxHp,
    };
  });
  assert.equal(r.loaded, true);
  assert.deepEqual(r.saved, { souls: 7, hp: 5 });
  assert.equal(r.level, 2);
  assert.equal(r.hp, 2);
  assert.equal(r.max, 28);
  assert.equal(r.bonesMax, 14);
});
test("Necromancer death immediately ends the run and discards summons without revival or summon memorials", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    grantSouls(h, soulCapacity(h));
    grantSouls(h, soulCapacity(h));
    state.artefacts = [{ id: "stone", key: "revive" }];
    damageHero(0, 999, "A fatal test", { piercing: true });
    return {
      over: state.over,
      job: h.job,
      skeletons: h.skeletons.length,
      grave: state.graveyard.map((x) => x.job),
      pending: state.pendingDeaths.length,
      modal: modalKind,
      revive: !!document.querySelector("#revive-use"),
      stone: state.artefacts.length,
    };
  });
  assert.equal(r.over, true);
  assert.equal(r.skeletons, 0);
  assert.deepEqual(r.grave, ["necromancer"]);
  assert.equal(r.pending, 0);
  assert.equal(r.modal, "defeat");
  assert.equal(r.revive, false);
  assert.equal(r.stone, 1);
});
test("wandering adventurers become real hostile encounters instead of recruitment menus", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    window.recruitTask = recruitEncounter();
  });
  await p.locator("#stage-confirm").waitFor();
  assert.equal(await p.locator("#recruit-accept").count(), 0);
  assert.equal(await p.evaluate(() => state.party.length), 1);
  assert.match(await p.locator("#stage-card").innerText(),/frightened|Fear|recoils/);
  await p.locator("#stage-confirm").click();
  await p.waitForFunction(()=>!!state.enemy);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => recruitTask);
  assert.equal(await p.evaluate(() => !!state.enemy), true);
});
test("autoplay upgrades only legal Necromancer marks and preserves Harvest and personal offence", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.level = 9;
      h.points = 80;
      state.depth = 6;
      autoUpgradeHero(h);
      return {
        types: [...new Set(h.reels.flat().map((f) => f.type))],
        harvest: faceShare(h.reels.flat(), ["harvest"]),
        spell: faceShare(h.reels.flat(), ["magic"]),
        poison: faceShare(h.reels.flat(), ["poison"]),
        points: h.points,
      };
    });
  assert.ok(
    r.types.every((x) =>
      ["magic", "poison", "harvest", "blank", "class"].includes(x),
    ),
  );
  assert.ok(r.harvest > 0);
  assert.ok(r.spell + r.poison > 0.1);
  assert.ok(r.points >= 0);
});
for (const [width, height] of [
  [1920, 1080],
  [1280, 800],
  [390, 844],
  [320, 844],
])
  test(`Necromancer cards, Soul bar, workshop, guide and starting choice fit at ${width}px`, async (t) => {
    const p = await game(t);
    await p.setViewportSize({ width, height });
    await fight(p);
    await p.evaluate(async () => {
      const h = state.party[0];
      grantSouls(h, soulCapacity(h));
      grantSouls(h, soulCapacity(h));
      h.points = 100;
      render();
      await document.fonts.ready;
      fitNotebook(true);
    });
    const r = await p.evaluate(() => {
      const meter = $(".soul-meter").getBoundingClientRect(),
        hp = $("#hero-0 .hp-bar").getBoundingClientRect(),
        machine = $("#machine-hero-0").getBoundingClientRect();
      return {
        rows: $("#party").children.length,
        meter: meter.toJSON(),
        hp: hp.toJSON(),
        machine: machine.toJSON(),
        boneBars: [...document.querySelectorAll(".skeleton-card .hp-bar")].map(
          (n) => n.getBoundingClientRect().height,
        ),
      };
    });
    assert.equal(r.rows, 3);
    assert.ok(r.meter.top >= r.hp.bottom - 1, JSON.stringify(r));
    assert.ok(r.meter.bottom <= r.machine.top + 1, JSON.stringify(r));
    assert.ok(r.boneBars.every((x) => x > 3));
    fs.mkdirSync(path.join(__dirname, "../test-results/soul-classes"), {
      recursive: true,
    });
    await p.screenshot({
      path: path.join(
        __dirname,
        `../test-results/soul-classes/necro-${width}.png`,
      ),
      fullPage: width < 1260,
    });
    await p.evaluate(() => {
      const h = state.party[0];
      editorSelection = {
        heroId: h.id,
        reel: 0,
        face: h.reels[0].findIndex((f) => f.type === "harvest"),
      };
      editorView = "edit";
      editor(0);
    });
    assert.match(await p.locator(".face-effect").textContent(), /Souls/);
    await p.screenshot({
      path: path.join(
        __dirname,
        `../test-results/soul-classes/workshop-${width}.png`,
      ),
    });
    await p.evaluate(() => {
      closeModal();
      help("classes");
    });
    await p.screenshot({
      path: path.join(
        __dirname,
        `../test-results/soul-classes/guide-${width}.png`,
      ),
    });
    await p.evaluate(() => {
      closeModal();
      chooseStartingClass(false);
    });
    assert.ok(await p.locator('[data-start-job="necromancer"]').isVisible());
    await p.screenshot({
      path: path.join(
        __dirname,
        `../test-results/soul-classes/start-${width}.png`,
      ),
    });
  });
test("a missed stunned Necromancer turn still gives each Skeleton exactly one action", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    grantSouls(h, soulCapacity(h));
    h.stun = 1;
    render();
    await spin(0);
    return {
      spins: h.stats.spins,
      missed: h.stats.turnsMissed,
      attacks: h.skeletons[0].stats.attacks,
      countdown: state.enemy.countdown,
    };
  });
  assert.equal(r.spins, 0);
  assert.equal(r.missed, 1);
  assert.equal(r.attacks, 1);
  assert.equal(r.countdown, 98);
});
test("personal spell tuning changes the real hit and its captured segments, while other classes retain raw damage", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.specialism = "defence";
    h.trait = null;
    h.reels = [0, 1, 2].map(() => [{ type: "magic", tier: 4, weight: 1 }]);
    const plan = await planHeroRoll(h, h.reels.flat());
    const old = rollCritical;
    rollCritical = async () => 1;
    try {
      render();
      await spin(0);
      return {
        power: plan.magic,
        segments: plan.hitSegments,
        actual: state.lastPlayerRoll.actualDamage,
        hp: state.enemy.hp,
        mage: heroDamagePower({ job: "mage" }, 12),
      };
    } finally {
      rollCritical = old;
    }
  });
  assert.equal(r.power, 10);
  assert.deepEqual(r.segments, [10]);
  assert.equal(r.actual, 10);
  assert.equal(r.hp, 990);
  assert.equal(r.mage, 12);
});
test("area damage reaches Skeletons without using Bodyguard and their deaths never create adventurer records", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      e = state.enemy;
    h.hp = 5;
    grantSouls(h, soulCapacity(h));
    grantSouls(h, soulCapacity(h));
    necromancerAreaDamage(20, e);
    return {
      skeletons: h.skeletons.length,
      hp: h.hp,
      souls: h.souls,
      lost: h.stats.skeletonsLost,
      guard: e.necroGuardUsed,
      grave: state.graveyard.length,
    };
  });
  assert.equal(r.skeletons, 0);
  assert.equal(r.hp, 7);
  assert.equal(r.souls, 6);
  assert.equal(r.lost, 2);
  assert.ok(!r.guard);
  assert.equal(r.grave, 0);
});
