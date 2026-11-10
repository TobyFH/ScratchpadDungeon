const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
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
  await new Promise((r) => server.close(r));
});
async function game(t) {
  const p = await browser.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate(() => {
    newRun("fighter");
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("skipCriticals", true);
    setPreference("shake", 0);
    state.runRules = [];
    state.party = [
      makeHero("Vesper", "bloodbinder", null, [], { specialism: "defence" }),
      makeHero("Ash", "rogue"),
    ];
    characterLuck = () => 0.99999;
    scheduleStunRecovery = () => {};
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    closeSpotlight();
    Object.assign(state.enemy, {
      hp: 1000,
      maxHp: 1000,
      passive: null,
      boss: true,
      countdown: 99,
    });
    setEnemyBlock(0);
    render();
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("Bloodbinder grows into an attrition specialist without increasing the boss transfer cap", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() =>
      [1, 4, 7, 10, 13, 30].map((level) => bloodProfile({ level })),
    );
  assert.deepEqual(
    r.map((x) => x.cap),
    [3, 5, 7, 9, 12, 12],
  );
  assert.equal(r[0].exchange, 0.18);
  assert.equal(r[4].exchange, 0.28);
  assert.equal(r[0].healing, 0.75);
  assert.equal(r[5].healing, 1.5);
  assert.equal(Math.round(r[0].clot * 100), 35);
  assert.equal(Math.round(r[4].clot * 100), 65);
  assert.ok(r.every((x) => x.cap <= 12));
});
test("Seed offerings rise with active potency, bypass block and never trigger Vulnerable or a death", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      h.maxHp = h.hp = 200;
      h.vulnerable = { turns: 1 };
      gainPartyBlock(20);
      const costs = [];
      applyBloodSeed(e, 3, h);
      for (let n = 0; n < 11; n++) {
        const before = h.hp;
        applyBloodSeed(e, 1, h);
        costs.push(before - h.hp);
      }
      const full = {
        damage: e.bleeding.damage,
        cost: 200 - h.hp,
        block: state.block,
        vulnerable: !!h.vulnerable,
      };
      const before = h.hp;
      applyBloodSeed(e, 999, h);
      const capped = h.hp === before;
      e.bleeding = null;
      h.hp = 2;
      applyBloodSeed(e, 20, h);
      return {
        costs,
        full,
        capped,
        limited: { hp: h.hp, damage: e.bleeding.damage, dead: h.dead },
      };
    });
  assert.deepEqual(r.costs, [1, 1, 1, 1, 3, 3, 3, 3, 6, 6, 6]);
  assert.deepEqual(r.full, {
    damage: 12,
    cost: 34,
    block: 20,
    vulnerable: true,
  });
  assert.ok(r.capped);
  assert.deepEqual(r.limited, { hp: 1, damage: 2, dead: false });
});
test("duration refresh is free at high potency and unaffordable power cannot create free strength", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      h.maxHp = h.hp = 100;
      applyBloodSeed(e, 100, h);
      await tickBleeding(e);
      h.hp = 1;
      const before = { ...e.bleeding };
      const plan = bloodSeedPlan(e, 20, h);
      applyBloodSeed(e, 20, h);
      return { before, plan, after: e.bleeding, hp: h.hp };
    });
  assert.equal(r.before.damage, 12);
  assert.equal(r.plan.hpCost, 0);
  assert.equal(r.after.turns, 3);
  assert.equal(r.after.damage, 12);
  assert.equal(r.hp, 1);
});
test("maintained Bleeding applies Clotted after three real enemy turns without expiring", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      applyBloodSeed(e, 3, h);
      const history = [];
      for (let i = 0; i < 3; i++) {
        const old = e.clotted;
        await tickBleeding(e);
        finishClottedTurn(e, old);
        history.push(!!e.clotted);
        applyBloodSeed(e, 1, h);
      }
      e.hp = 100;
      const recovered = enemyRecovery(e, 100);
      return { history, b: e.bleeding, c: e.clotted, recovered };
    });
  assert.deepEqual(r.history, [false, false, true]);
  assert.equal(r.b.turns, 3);
  assert.equal(r.b.damage, 1);
  assert.equal(r.c.turns, 3);
  assert.equal(Math.round(r.c.reduction * 100), 65);
  assert.equal(r.recovered, 35);
});
test("late leech is one shared pool scaled from actual damage, not multiplied per ally or by camp healing", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 14;
      h.maxHp = h.hp = 100;
      state.party.push(makeHero("Wren", "mage"));
      applyBloodSeed(e, 99, h);
      state.party.forEach((a) => (a.hp = 1));
      state.runRules = ["recovery5"];
      const first = state.party.reduce((n, h) => n + h.hp, 0);
      await tickBleeding(e);
      const pool = state.party.reduce((n, h) => n + h.hp, 0) - first;
      e.hp = 2;
      const before = state.party.reduce((n, h) => n + h.hp, 0);
      await tickBleeding(e);
      return {
        pool,
        overkill: state.party.reduce((n, h) => n + h.hp, 0) - before,
        alive: state.party.every(alive),
        enemy: e.hp,
      };
    });
  assert.equal(r.pool, 18);
  assert.equal(r.overkill, 3);
  assert.equal(r.enemy, 0);
  assert.ok(r.alive);
});
test("critical Seed power pays once up to its cap, while ordinary healing remains available afterward", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const h = state.party[0];
    h.level = 13;
    h.hp = h.maxHp = 100;
    h.reels = [
      [{ type: "bloodseed", tier: 4, weight: 1 }],
      [{ type: "class", tier: 1, weight: 1, job: "bloodbinder" }],
      [{ type: "bloodseed", tier: 4, weight: 1 }],
    ];
    renderParty();
  });
  await p.evaluate(() => spin(0));
  const r = await p.evaluate(() => ({
    b: state.enemy.bleeding,
    hp: state.party[0].hp,
    spent: state.party[0].stats.bloodSpent,
    roll: state.lastPlayerRoll,
  }));
  assert.equal(r.b.damage, 12);
  assert.equal(r.spent, 34);
  assert.equal(r.hp, 66);
  assert.ok(r.roll.multiplier > 1);
});
test("AI values capped Seed refresh without pricing a second drain or multiplying leech by lessons", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      h.hp = h.maxHp = 100;
      applyBloodSeed(e, 99, h);
      const full = bloodSeedForecast(h, 12, e);
      e.bleeding.turns = 1;
      h.hp = 1;
      const refresh = bloodSeedForecast(h, 3, e);
      state.runRules = ["power5", "recovery5"];
      const boosted = bloodSeedForecast(h, 3, e);
      return { full, refresh, boosted };
    });
  assert.equal(r.full.damage, 0);
  assert.equal(r.full.heal, 0);
  assert.equal(r.full.cost, 0);
  assert.ok(r.refresh.damage > 0 && r.refresh.heal > 0);
  assert.equal(r.refresh.cost, 0);
  assert.deepEqual(r.refresh, r.boosted);
});
test("long fights keep the strongest Clotted when a lower-level caster joins, including save/load", async (t) => {
  const p = await game(t),
    r = await p.evaluate(async () => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      h.maxHp = h.hp = 100;
      applyBloodSeed(e, 5, h);
      await tickBleeding(e);
      await tickBleeding(e);
      applyBloodSeed(e, 2, h);
      await tickBleeding(e);
      const novice = makeHero("Newcomer", "bloodbinder");
      state.party.push(novice);
      applyBloodSeed(e, 1, novice);
      save();
      load();
      return { b: state.enemy.bleeding, c: state.enemy.clotted };
    });
  assert.equal(r.b.level, 13);
  assert.equal(r.b.damage, 3);
  assert.equal(r.b.ticks, 0);
  assert.equal(Math.round(r.c.reduction * 100), 65);
});
test("Exchange improves with level, always caps bosses, and never gains camp or critical multipliers", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        e = state.enemy;
      h.maxHp = 100;
      h.hp = 60;
      state.party[1].hp = state.party[1].maxHp;
      const early = bloodExchangePlan(h, e);
      h.level = 13;
      const late = bloodExchangePlan(h, e);
      h.hp = 1;
      state.runRules = ["power5", "recovery5"];
      const capped = bloodExchangePlan(h, e);
      return {
        early: early.loss,
        late: late.loss,
        capped: capped.loss,
        heal: capped.healing,
      };
    });
  assert.equal(r.early, 72);
  assert.equal(r.late, 100);
  assert.equal(r.capped, 100);
  assert.equal(r.heal, 10);
});
test("autoplay preserves a mixed paid build rather than filling every face with Seeds", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const builds = [];
      for (const specialism of ["offence", "defence"]) {
        state.enemy = null;
        state.enemies = [];
        state.depth = 10;
        const h = makeHero("Vesper", "bloodbinder", null, [], { specialism });
        h.level = 13;
        h.hp = h.maxHp = 104;
        h.points = 100;
        state.party = [
          h,
          makeHero("Tank", "fighter"),
          makeHero("Rogue", "rogue"),
        ];
        autoUpgradeHero(h);
        builds.push({
          points: h.points,
          seed: faceShare(h.reels.flat(), ["bloodseed"]),
          heal: faceShare(h.reels.flat(), ["heal"]),
          direct: directDamageShare(h),
          seal: h.reels.flat().filter((f) => f.type === "class").length,
        });
      }
      return builds;
    });
  for (const b of r) {
    assert.ok(b.points >= 0 && b.points < 100);
    assert.ok(b.seed >= 0.1 && b.seed <= 0.4, JSON.stringify(b));
    assert.ok(b.heal >= 0.125 && b.direct >= 0.15, JSON.stringify(b));
    assert.equal(b.seal, 1);
  }
});
test("refreshing a wound never mutates the pure forecast and bad saved status values remain bounded", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        e = state.enemy;
      h.level = 13;
      applyBloodSeed(e, 3, h);
      const before = JSON.stringify(e.bleeding),
        hp = h.hp;
      bloodSeedPlan(e, 20, h);
      bloodSeedForecast(h, 12, e);
      const pure = before === JSON.stringify(e.bleeding) && h.hp === hp;
      e.bleeding = {
        turns: Infinity,
        damage: Infinity,
        healing: Infinity,
        level: Infinity,
        ticks: Infinity,
      };
      e.clotted = { turns: 0.5, reduction: Infinity };
      normaliseBloodStatuses(e);
      return { pure, b: e.bleeding, c: e.clotted };
    });
  assert.ok(r.pure);
  assert.equal(r.b, null);
  assert.equal(r.c, null);
});
