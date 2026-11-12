// Current Seed reservoirs supersede the old Bleeding/Clotted balance checks.
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
  const p = await browser.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate(() => {
    newRun("bloodbinder");
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("shake", 0);
    setPreference("skipCriticals", true);
    setPreference("combatEffects", "icons");
    characterLuck = () => 0.99999;
    state.runRules = [];
    state.party[0].specialism = "defence";
    beginEncounter(false, { count: 2 });
    finishOpeningRoll();
    closeSpotlight();
    state.enemies.forEach((e) =>
      Object.assign(e, { hp: 1000, maxHp: 1000, passive: null, countdown: 99 }),
    );
    setEnemyBlock(0);
    render();
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("Seeds grow past the retired cap, do not expire on enemy turns, and cost nonlethal HP per rolled face", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.hp = 1;
      applyBloodSeed(e, 100000, h, {
        symbols: [{ type: "bloodseed", tier: 4 }],
      });
      e.reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1, weight: 1 }]);
      for (let i = 0; i < 4; i++) await enemyTurn(e);
      return { seeds: bloodSeedCount(e), hp: h.hp, dead: h.dead };
    });
  assert.deepEqual(r, { seeds: 100000, hp: 1, dead: false });
});
test("actual HP damage consumes exactly one Seed per point, with one shared healing pool and no camp multiplier", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        a = makeHero("M", "mage"),
        b = makeHero("R", "rogue");
      state.party.push(a, b);
      state.party.forEach((h) => (h.hp = 1));
      state.runRules = ["recovery5", "power5"];
      const e = state.enemy;
      e.bloodSeeds = { count: 50, sourceId: h.id };
      gainEnemyBlock(5);
      const before = state.party.reduce((n, a) => n + a.hp, 0);
      const blocked = damageEnemy(5, "Blocked", e);
      const first = bloodSeedCount(e);
      const actual = damageEnemy(9, "Blade", e);
      return {
        blocked,
        first,
        actual,
        seeds: bloodSeedCount(e),
        healing: state.party.reduce((n, a) => n + a.hp, 0) - before,
        stats: h.stats.healingDone,
      };
    });
  assert.deepEqual(r, {
    blocked: 0,
    first: 50,
    actual: 9,
    seeds: 41,
    healing: 9,
    stats: 9,
  });
});
test("poison, item-style piercing damage and overkill consume only actual HP damage", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.hp = 1;
      e.bloodSeeds = { count: 50, sourceId: h.id };
      e.poison = {
        turns: 2,
        damage: 3,
        sourceId: h.id,
        sourceName: h.name,
        appliedAt: -1,
      };
      await tickPoison();
      const poison = bloodSeedCount(e);
      e.hp = 2;
      const n = damageEnemy(100, "Ink bomb", e, { piercing: true });
      return { poison, n, seeds: bloodSeedCount(e), heal: h.stats.healingDone };
    });
  assert.equal(r.poison, 47);
  assert.equal(r.n, 2);
  assert.equal(r.seeds, 45);
  assert.equal(r.heal, 5);
});
test("Blood Bloom bursts all enemies once, including overkill healing, without a critical or recovery multiplier", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0];
      h.maxHp = 200;
      h.hp = 1;
      state.runRules = ["power5", "recovery5"];
      state.enemies.forEach((e, i) => {
        e.hp = 5;
        e.maxHp = 1000;
        e.boss = true;
        e.bloodSeeds = { count: 20 + i * 10, sourceId: h.id };
      });
      const receipt = await detonateBloodSeeds(h);
      return {
        receipt,
        hp: h.hp,
        seeds: state.enemies.map(bloodSeedCount),
        hpEnemies: state.enemies.map((e) => e.hp),
      };
    });
  assert.deepEqual(r.receipt, { seeds: 50, damage: 10, healing: 50 });
  assert.equal(r.hp, 51);
  assert.deepEqual(r.seeds, [0, 0]);
  assert.deepEqual(r.hpEnemies, [0, 0]);
});
test("a real mixed roll plants Seeds before its own spell damage, and a critical Bloom pays its HP cost only once", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.specialism = "offence";
    h.hp = 8;
    h.reels = [
      [{ type: "bloodseed", tier: 2, weight: 1 }],
      [{ type: "blank", tier: 1, weight: 1 }],
      [{ type: "magic", tier: 2, weight: 1 }],
    ];
    render();
    await spin(0);
    const mixed = {
      hp: h.hp,
      seeds: bloodSeedCount(state.enemy),
      damage: state.lastPlayerRoll.actualDamage,
    };
    h.hp = 10;
    h.reels = [
      [{ type: "bloodseed", tier: 4, weight: 1 }],
      [{ type: "class", tier: 1, weight: 1, job: h.job }],
      [{ type: "bloodseed", tier: 4, weight: 1 }],
    ];
    render();
    const before = h.stats.bloodSpent;
    await spin(0);
    return {
      mixed,
      cost: h.stats.bloodSpent - before,
      multi: state.lastPlayerRoll.multiplier,
      receipt: state.lastBloodDetonation,
      raw: state.lastPlayerRoll.totals.bloodseed,
    };
  });
  assert.equal(r.mixed.seeds, 0);
  assert.equal(r.mixed.hp, 9);
  assert.equal(r.mixed.damage, 4);
  assert.equal(r.cost, 4);
  assert.ok(r.multi > 1);
  assert.equal(r.receipt.seeds, r.raw);
  assert.equal(r.receipt.damage, r.raw);
});
test("Bloodbinder permissions, paid save migration and private Harvest faces stay consistent", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.reels[0][0] = {
        type: "attack",
        tier: 4,
        weight: 1,
        investments: { 2: 5, 3: 8, 4: 12 },
      };
      h.reels[0][1] = { type: "stimulant", tier: 2, weight: 1 };
      const points = h.points;
      normaliseHeroBuild(h);
      save();
      load();
      return {
        types: editableTypes(h),
        face: state.party[0].reels[0][0],
        rally: h.reels[0][1],
        points: state.party[0].points,
        old: points,
        primary: primaryFace(h),
        jester: editableTypes(makeHero("J", "jester")),
      };
    });
  assert.deepEqual(r.types, ["heal", "bloodseed", "magic", "rally", "blank"]);
  assert.equal(r.face.type, "magic");
  assert.equal(r.face.tier, 4);
  assert.equal(r.face.investments[4], 12);
  assert.equal(r.rally.type, "rally");
  assert.equal(r.points, r.old);
  assert.equal(r.primary, "heal");
  assert.ok(!r.jester.includes("harvest"));
});
test("legacy wounds become saved reservoirs; battle cleanup removes stacks", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const e = state.enemy,
        h = state.party[0];
      e.bleeding = { damage: 5, turns: 3, sourceId: h.id };
      e.clotted = { turns: 2 };
      normaliseBloodStatuses(e);
      save();
      load();
      const saved = { ...state.enemy.bloodSeeds };
      clearBattleStatuses();
      return {
        saved,
        cleared: state.enemy.bloodSeeds,
        oldClot: state.enemy.clotted,
      };
    });
  assert.equal(r.saved.count, 15);
  assert.equal(r.cleared, null);
  assert.equal(r.oldClot, undefined);
});
test("consumed Seeds pop at varied enemy locations and healing flies to the actual wounded ally without gameplay RNG", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.hp = 1;
    const e = state.enemy;
    e.bloodSeeds = { count: 10, sourceId: h.id };
    setPace("1");
    const random = Math.random;
    Math.random = () => {
      throw Error("FX used gameplay RNG");
    };
    let burst;
    try {
      burst = bloodSeedBurstFX(e, 10);
      const nodes = [...document.querySelectorAll(".blood-seed-pop")];
      const positions = new Set(
        nodes.map((n) => n.style.left + ":" + n.style.top),
      ).size;
      nodes.forEach((n) => n.getAnimations().forEach((a) => a.finish()));
      await burst;
      damageEnemy(3, "A hit", e);
      const heals = [
        ...document.querySelectorAll('[data-effect="blood-seed-heal"]'),
      ].map((n) => n.dataset.target);
      await settleBloodFeedback();
      return {
        positions,
        heals,
        remaining: document.querySelectorAll(".blood-seed-pop").length,
      };
    } finally {
      Math.random = random;
    }
  });
  assert.ok(r.positions > 1);
  assert.ok(r.heals.includes("portrait-0"));
  assert.equal(r.remaining, 0);
});
test("autoplay keeps a sustainable mix of Seeds, legal spell attacks and recovery", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      state.enemy = null;
      state.enemies = [];
      const h = state.party[0];
      h.level = 10;
      h.points = 100;
      state.depth = 8;
      autoUpgradeHero(h);
      return {
        types: [...new Set(h.reels.flat().map((f) => f.type))],
        seed: faceShare(h.reels.flat(), ["bloodseed"]),
        spell: faceShare(h.reels.flat(), ["magic"]),
        points: h.points,
      };
    });
  assert.ok(r.seed > 0 && r.seed < 0.6);
  assert.ok(r.spell > 0.1);
  assert.ok(!r.types.includes("attack"));
  assert.ok(r.points >= 0);
});
