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

test("Fury follows real wounds, Blood Price efficiency rises by tier and every kind of actual healing spends charge once", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.party = [makeHero("Rook", "berserker")];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    h.hp = h.maxHp = 200;
    state.block = 0;
    damageHero(0, 4, "Wound");
    const regular = h.fury;
    const blood = [];
    for (let tier = 1; tier <= 4; tier++) {
      h.fury = 0;
      damageHero(0, 2, "Blood Price", {
        piercing: true,
        selfInflicted: true,
        bloodPriceTier: tier,
      });
      blood.push(h.fury);
    }
    h.fury = 20;
    h.hp = 100;
    const healed = healHero(0, 5),
      after = h.fury;
    h.hp = h.maxHp;
    const wasted = healHero(0, 10),
      unchanged = h.fury;
    return { regular, blood, healed, after, wasted, unchanged };
  });
  assert.equal(r.regular, 4);
  assert.deepEqual(r.blood, [5, 6, 7, 8]);
  assert.equal(r.healed, 5);
  assert.equal(r.after, 15);
  assert.equal(r.wasted, 0);
  assert.equal(r.unchanged, 15);
});

test("a real Blood Price roll uses each face tier and cannot manufacture Fury from healing or Bloodrush", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("berserker");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.enemy.passive = null;
    state.enemy.countdown = 99;
    setEnemyBlock(0);
    h.hp = 30;
    h.fury = 0;
    runMachine = async () => [
      { type: "selfharm", tier: 2 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(0);
    const blood = { hp: h.hp, fury: h.fury };
    h.fury = 0;
    h.hp = 10;
    runMachine = async () => [
      { type: "blank", tier: 1 },
      { type: "class", tier: 1, job: "berserker" },
      { type: "blank", tier: 1 },
    ];
    await spin(0);
    return {
      blood,
      seal: { fury: h.fury, hp: h.hp },
      baseFury: state.lastPlayerRoll.base.fury || 0,
    };
  });
  assert.deepEqual(r.blood, { hp: 26, fury: 12 });
  assert.equal(r.seal.fury, 0);
  assert.ok(r.seal.hp >= 14);
  assert.equal(r.baseFury, 0);
});

test("lifesteal spends Fury through the shared healing path exactly once and waits for returning marks", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party = [makeHero("Fang", "berserker")];
    beginEncounter(false, { count: 1 });
    const h = state.party[0];
    h.hp = 5;
    h.fury = 20;
    const actual = await settleFuryLeech(
      h,
      [{ enemy: state.enemy, damage: 20 }],
      [Promise.resolve()],
    );
    return {
      actual,
      fury: h.fury,
      spent: state.lastLifesteal.furySpent,
      ordered:
        state.lastLifesteal.healedAt >= state.lastLifesteal.returnStartedAt,
    };
  });
  assert.equal(r.fury, 20 - r.actual);
  assert.equal(r.spent, r.actual);
  assert.ok(r.ordered);
});

test("team protection caps at 20 or 30 with a Tank; enemy protection uses one bounded shared pool", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.party = [makeHero("Sage", "mage")];
    beginEncounter(false, { count: 2 });
    setEnemyBlock(0);
    state.block = 0;
    const a = gainPartyBlock(100),
      solo = state.block;
    state.party.push(makeHero("Wall", "fighter"));
    const b = gainPartyBlock(100),
      tank = state.block;
    gainEnemyBlock(100);
    const enemy = enemyBlock();
    state.enemies[0].boss = true;
    gainEnemyBlock(100);
    const boss = enemyBlock();
    state.party[1].hp = 0;
    normalisePartyBlock();
    renderBlock();
    return {
      a,
      solo,
      b,
      tank,
      enemy,
      boss,
      after: state.block,
      label: $("#block").textContent,
    };
  });
  assert.deepEqual(
    [r.a, r.solo, r.b, r.tank, r.enemy, r.boss, r.after],
    [20, 20, 10, 30, 20, 30, 20],
  );
  assert.match(r.label, /cap 20/);
});

test("Shield Bash consumes its bounded protection budget and cannot turn a critical into an 80-block attack", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    setEnemyBlock(0);
    state.block = 30;
    runMachine = async () => [
      { type: "block", tier: 4 },
      { type: "class", tier: 1, job: "fighter" },
      { type: "block", tier: 4 },
    ];
    await spin(0);
    return {
      block: state.block,
      bash: state.lastPlayerRoll.bash,
      limit: Math.ceil(bashLimit(h) * state.lastPlayerRoll.multiplier),
      hp: state.enemy.hp,
    };
  });
  assert.ok(r.bash.power <= r.limit);
  assert.ok(r.bash.power <= 30);
  assert.equal(r.block, 30 - r.bash.power);
  assert.equal(r.hp, 1000 - r.bash.actual);
});

test("repeated stuns never refresh duration, cost at most one missed action and protect both sides for two own actions", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.block = 0;
    setEnemyBlock(0);
    Math.random = () => 0.99;
    const h = state.party[0],
      e = state.enemy;
    stunHero(0, 40);
    h.stunAge = 1;
    stunHero(0, 40);
    const heroAge = h.stunAge;
    const recovered = tryBreakStun(h, { missedAction: true });
    stunHero(0, 40);
    const blocked = !h.stun;
    stunEnemy(40, e);
    e.stunAge = 1;
    stunEnemy(40, e);
    const enemyAge = e.stunAge;
    tryBreakStun(e, { missedAction: true });
    stunEnemy(40, e);
    const enemyBlocked = !e.stun;
    advanceStunWard(e, 2);
    stunEnemy(40, e);
    const stillBlocked = !e.stun;
    advanceStunWard(e, 1);
    stunEnemy(40, e);
    return {
      heroAge,
      enemyAge,
      recovered,
      blocked,
      enemyBlocked,
      stillBlocked,
      canStunAgain: !!e.stun,
      ward: h.stunWard,
    };
  });
  assert.deepEqual(r, {
    heroAge: 1,
    enemyAge: 1,
    recovered: true,
    blocked: true,
    enemyBlocked: true,
    stillBlocked: true,
    canStunAgain: true,
    ward: 2,
  });
});

test("a missed hero go leaves enemy clocks unchanged; an enemy must get real turns before its stun protection expires", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0],
      e = state.enemy;
    e.countdown = 8;
    e.reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1 }]);
    h.stun = 1;
    Math.random = () => 0.999;
    await spin(0);
    const missed = { clock: e.countdown, stun: h.stun, ward: h.stunWard };
    grantStunWard(e);
    await enemyTurn(e);
    const first = e.stunWard;
    await enemyTurn(e);
    return { missed, first, last: e.stunWard };
  });
  assert.deepEqual(r, {
    missed: { clock: 8, stun: 0, ward: 2 },
    first: 1,
    last: 0,
  });
});

test("Jester Punchline fires six actual reel marks without a reroll, extra spin, critical or anticipation chain", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0],
      e = state.enemy;
    e.hp = e.maxHp = 1000;
    e.countdown = 20;
    e.passive = null;
    setEnemyBlock(0);
    h.hp = 10;
    h.anticipation = 5;
    h.reels = [
      [{ type: "attack", tier: 2, weight: 1 }],
      [
        { type: "heal", tier: 1, weight: 1 },
        { type: "class", tier: 1, job: "jester", weight: 1 },
      ],
      [{ type: "block", tier: 1, weight: 1 }],
    ];
    const purchased = JSON.stringify(h.reels),
      flights = [],
      originalBeam = beam;
    beam = (from, to, type, impact = {}) => {
      if (impact.kind === "punchline")
        flights.push({
          reel: impact.reelIndex,
          origin: effectSymbols(from, type, impact)[0].origin?.closest(
            "[data-reel]",
          )?.dataset.reel,
          type: impact.symbols[0].type,
        });
      return originalBeam(from, to, type, impact);
    };
    let rolls = 0;
    runMachine = async () => {
      rolls++;
      return [
        { type: "trick", tier: 1 },
        { type: "blank", tier: 1 },
        { type: "blank", tier: 1 },
      ];
    };
    await spin(0);
    return {
      rolls,
      flights,
      spins: h.stats.spins,
      count: e.countdown,
      burst: state.lastPunchline,
      meter: h.anticipation,
      same: purchased === JSON.stringify(h.reels),
      hp: h.hp,
      crit: state.lastCritical || null,
    };
  });
  assert.equal(r.rolls, 1);
  assert.deepEqual(
    r.flights.map((f) => f.reel),
    [0, 1, 2, 0, 1, 2],
  );
  assert.deepEqual(
    r.flights.map((f) => f.origin),
    ["0", "1", "2", "0", "1", "2"],
  );
  assert.equal(r.spins, 1);
  assert.equal(r.count, 19);
  assert.equal(r.burst.shots.length, 6);
  assert.deepEqual(
    r.burst.shots.map((x) => x.type),
    ["attack", "heal", "block", "attack", "heal", "block"],
  );
  assert.ok(r.burst.damage > 0 && r.burst.healing > 0 && r.burst.block > 0);
  assert.equal(r.meter, 0);
  assert.equal(r.same, true);
  assert.equal(r.crit, null);
});

test("Trick-only and sealed Jester bursts cannot chain, and killing during a burst stops shots before poison can kill the victor", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0],
      e = state.enemy;
    e.hp = e.maxHp = 1000;
    setEnemyBlock(0);
    h.reels = [0, 1, 2].map(() => [{ type: "trick", tier: 4, weight: 1 }]);
    h.anticipation = 0;
    await jesterMarkBurst(h);
    const trick = {
      shots: state.lastPunchline.shots.length,
      meter: h.anticipation,
    };
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 4, weight: 1 }]);
    h.crystalLocks = [0, 1, 2];
    await jesterMarkBurst(h);
    const sealed = state.lastPunchline.damage;
    h.crystalLocks = [];
    e.hp = 1;
    e.passive = null;
    h.hp = 1;
    applyPoison(h, 1, e);
    await jesterMarkBurst(h);
    await tickPoison();
    return {
      trick,
      sealed,
      shots: state.lastPunchline.shots.length,
      alive: alive(h),
      enemy: e.hp,
    };
  });
  assert.deepEqual(r.trick, { shots: 6, meter: 0 });
  assert.equal(r.sealed, 0);
  assert.equal(r.shots, 1);
  assert.equal(r.alive, true);
  assert.equal(r.enemy, 0);
});

test("weight purchases are unavailable; old paid weights refund once on load and preserve seals, tiers and banked gold", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 10;
    h.reels[0][0].weight = 4;
    h.reels[1].find((f) => f.type === "class").weight = 3;
    const bank = readProfile().gold;
    const bought = applyFaceEdit(h, 0, 0, "weight");
    save();
    load();
    const first = state.party[0].points;
    save();
    load();
    editor(0);
    return {
      bought,
      first,
      second: state.party[0].points,
      weights: state.party[0].reels.flat().map((f) => f.weight),
      ui: !!$("#face-weight"),
      tabs: [...document.querySelectorAll("[data-editor-operation]")].map(
        (n) => n.dataset.editorOperation,
      ),
      bankSame: bank === readProfile().gold,
      seals: state.party[0].reels.map(
        (r) => r.filter((f) => f.type === "class").length,
      ),
    };
  });
  assert.equal(r.bought, false);
  assert.equal(r.first, 52);
  assert.equal(r.second, 52);
  assert.ok(r.weights.every((w) => w === 1));
  assert.equal(r.ui, false);
  assert.deepEqual(r.tabs, ["power", "replace"]);
  assert.equal(r.bankSame, true);
  assert.deepEqual(r.seals, [0, 1, 0]);
});

test("class-specific complementary marks have exact bonuses; matching one-type criticals keep their original rules", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const pair = (job, types) =>
      complementaryEffects(
        makeHero(job, job),
        types.map((type) => ({ type, tier: 1 })),
      );
    return {
      tank: pair("fighter", ["attack", "block"]),
      rogue: pair("rogue", ["attack", "poison"]),
      mage: pair("mage", ["magic", "heal"]),
      ranger: pair("ranger", ["attack", "rally"]),
      berserker: pair("berserker", ["attack", "heal"]),
      jester: pair("jester", ["trick", "magic"]),
      same: pair("fighter", ["block", "block", "block"]),
    };
  });
  assert.deepEqual(r, {
    tank: { block: 2 },
    rogue: { attack: 1 },
    mage: { magic: 1, heal: 1 },
    ranger: { attack: 2 },
    berserker: { attack: 1 },
    jester: { trick: 1 },
    same: {},
  });
});

test("stimulants stop growing at six potency and legacy overflows normalise to the same cap", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    for (let i = 0; i < 20; i++) applyStimulant(h, 40);
    const fresh = { ...h.stimulant };
    h.stimulant = { power: 100, turns: 30 };
    normaliseStimulant(h);
    return {
      fresh,
      old: h.stimulant,
      attack: attackBonus(h),
      defence: defenceBonus(h),
    };
  });
  assert.equal(r.fresh.power, 6);
  assert.equal(r.fresh.turns, 3);
  assert.equal(r.old.power, 6);
  assert.equal(r.old.turns, 3);
  assert.equal(r.attack, 3);
  assert.equal(r.defence, 2);
});

test("Blood Price criticals multiply only Fury earned from real wounds and never multiply the HP cost or create charge at one HP", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("berserker");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    h.initiative = null;
    state.enemy.countdown = 99;
    runMachine = async () =>
      Array.from({ length: 3 }, () => ({ type: "selfharm", tier: 1 }));
    Math.random = () => 0;
    await spin(0);
    const first = {
      hp: h.hp,
      fury: h.fury,
      base: state.lastPlayerRoll.base.bloodFury,
      cost: state.lastPlayerRoll.totals.selfharm,
      boost: state.lastPlayerRoll.totals.bloodFury,
      multiplier: state.lastPlayerRoll.multiplier,
    };
    h.hp = 1;
    h.fury = 0;
    state.lastCritical = null;
    await spin(0);
    return {
      first,
      empty: {
        hp: h.hp,
        fury: h.fury,
        critical: state.lastCritical,
        multiplier: state.lastPlayerRoll.multiplier,
      },
    };
  });
  assert.equal(r.first.hp, 32);
  assert.equal(r.first.cost, 6);
  assert.equal(r.first.base, 15);
  assert.equal(r.first.boost, Math.ceil(15 * r.first.multiplier));
  assert.equal(r.first.fury, 24);
  assert.deepEqual(r.empty, { hp: 1, fury: 0, critical: null, multiplier: 1 });
});

test("ally healing, consumed tonics and level-up recovery all drain only actual Berserker healing; stun wards survive reload", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party = [makeHero("Fang", "berserker"), makeHero("Sage", "mage")];
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.countdown = 99;
    const h = state.party[0];
    h.hp = 10;
    h.fury = 24;
    state.target = 0;
    runMachine = async () => [
      { type: "heal", tier: 2 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(1);
    const ally = { hp: h.hp, fury: h.fury };
    state.bag.potion = 1;
    const oldHp = h.hp,
      oldFury = h.fury;
    await useItem("potion");
    const tonic = { restored: h.hp - oldHp, spent: oldFury - h.fury };
    h.hp = 10;
    h.fury = 20;
    h.xp = 0;
    addXP(h, 12);
    const level = { hp: h.hp, fury: h.fury };
    h.stunWard = 1;
    state.enemy.stunWard = 2;
    save();
    load();
    return {
      ally,
      tonic,
      level,
      heroWard: state.party[0].stunWard,
      enemyWard: state.enemy.stunWard,
    };
  });
  assert.deepEqual(r.ally, { hp: 14, fury: 20 });
  assert.ok(r.tonic.restored > 0);
  assert.equal(r.tonic.restored, r.tonic.spent);
  assert.deepEqual(r.level, { hp: 16, fury: 14 });
  assert.equal(r.heroWard, 1);
  assert.equal(r.enemyWard, 2);
});

test("AI complementary-mark estimates equal exhaustive real face probabilities for every class", async (t) => {
  const p = await game(t);
  const rows = await p.evaluate(() => {
    const types = [
      "attack",
      "magic",
      "heal",
      "block",
      "stun",
      "poison",
      "rally",
      "trick",
      "selfharm",
      "blank",
    ];
    return ["fighter", "rogue", "mage", "ranger", "berserker", "jester"].map(
      (job) => {
        const h = makeHero(job, job);
        // Unequal reel lengths and duplicate faces catch marginal/conditional errors.
        h.reels = [
          types.slice(0, 7),
          types.slice(1, 9).concat("heal"),
          types.slice(2).concat("attack"),
        ].map((r) => r.map((type) => ({ type, tier: 1, weight: 1 })));
        const actual = {};
        for (const a of h.reels[0])
          for (const b of h.reels[1])
            for (const c of h.reels[2]) {
              const effects = complementaryEffects(h, [a, b, c]);
              for (const [key, n] of Object.entries(effects)) {
                const k = ["attack", "magic"].includes(key) ? "damage" : key;
                actual[k] =
                  (actual[k] || 0) +
                  n /
                    (h.reels[0].length * h.reels[1].length * h.reels[2].length);
              }
            }
        return { job, actual, estimate: expectedComplementaryEffects(h) };
      },
    );
  });
  for (const row of rows)
    for (const key of new Set([
      ...Object.keys(row.actual),
      ...Object.keys(row.estimate),
    ]))
      assert.ok(
        Math.abs((row.actual[key] || 0) - (row.estimate[key] || 0)) < 1e-10,
        `${row.job}: ${key}`,
      );
});

test("Punchline marks cannot repeatedly trigger once-per-roll equipment gifts, and random marks remain visible in icon mode", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("jester");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0],
      e = state.enemy;
    e.countdown = 99;
    e.hp = e.maxHp = 1000;
    setEnemyBlock(0);
    h.equipment = "stormQuill";
    h.stats.spins = 12;
    h.reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1, weight: 1 }]);
    const mark = await planHeroRoll(h, [{ type: "blank", tier: 1 }], {
      singleMark: true,
    });
    const ordinary = await planHeroRoll(h, [{ type: "blank", tier: 1 }]);
    setPreference("combatEffects", "icons");
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 2, weight: 1 }]);
    await jesterMarkBurst(h);
    return {
      markRally: mark.rally,
      ordinaryRally: ordinary.rally,
      shots: state.lastPunchline.shots.length,
      damage: state.lastPunchline.damage,
    };
  });
  assert.equal(r.markRally, 0);
  assert.equal(r.ordinaryRally, 2);
  assert.equal(r.shots, 6);
  assert.ok(r.damage >= 12);
});

test("hostile Berserkers use the same actual-wound and healing accounting without double Fury or lethal Blood Price", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const e = state.enemy;
    Object.assign(e, {
      job: "berserker",
      hp: 30,
      maxHp: 100,
      passive: null,
      fury: 0,
      strikes: 1,
    });
    setEnemyBlock(0);
    runMachine = async () => [
      { type: "selfharm", tier: 2 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await enemyTurn(e);
    const paid = { hp: e.hp, fury: e.fury };
    runMachine = async () => [
      { type: "heal", tier: 2 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await enemyTurn(e);
    const healed = { hp: e.hp, fury: e.fury };
    e.hp = 2;
    e.fury = 0;
    e.vulnerable = { createdAction: 0, bonus: 0.25 };
    runMachine = async () => [
      { type: "selfharm", tier: 4 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await enemyTurn(e);
    return {
      paid,
      healed,
      last: { hp: e.hp, fury: e.fury, vulnerable: !!e.vulnerable },
    };
  });
  assert.deepEqual(r.paid, { hp: 26, fury: 12 });
  assert.deepEqual(r.healed, { hp: 28, fury: 10 });
  assert.deepEqual(r.last, { hp: 1, fury: 4, vulnerable: true });
});

test("restarting during Punchline cancels old marks and cannot write a report or advance combat in the new run", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const originalFX = punchlineFX,
      originalPause = feedbackPause;
    newRun("jester");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const old = state.party[0];
    old.name = "Old Jester";
    punchlineFX = async () => newRun("rogue");
    await jesterMarkBurst(old);
    const opening = {
      job: state.party[0].job,
      report: state.lastPunchline || null,
      enemy: state.enemy,
    };
    punchlineFX = originalFX;
    newRun("jester");
    setPace("skip");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    const h = state.party[0];
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1, weight: 1 }]);
    state.enemy.hp = 1000;
    feedbackPause = async (ms) => {
      if (state.lastPunchline?.shots.length === 1) {
        newRun("mage");
        return;
      }
      return originalPause(ms);
    };
    await jesterMarkBurst(h);
    return {
      opening,
      midway: {
        job: state.party[0].job,
        report: state.lastPunchline || null,
        enemy: state.enemy,
        spins: state.party[0].stats.spins,
      },
    };
  });
  assert.deepEqual(r.opening, { job: "rogue", report: null, enemy: null });
  assert.deepEqual(r.midway, {
    job: "mage",
    report: null,
    enemy: null,
    spins: 0,
  });
});
