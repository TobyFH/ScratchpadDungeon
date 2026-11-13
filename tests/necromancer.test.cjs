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
    const profile = emptyProfile();
    profile.dungeonCleared = true;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
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
test("earned Necromancer keeps its legal editable marks and permanent seal", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.points = 100;
      return {
        hp: h.maxHp,
        types: editableTypes(h),
        seals: h.reels.flat().filter((f) => f.type === "class").length,
        buy: purchaseUnlock("necromancer"),
        recruit: heroJobs(["necromancer"]),
        edit: applyFaceEdit(
          h,
          1,
          h.reels[1].findIndex((f) => f.type === "class"),
          "swap",
          "magic",
        ),
      };
    });
  assert.equal(r.hp, 22);
  assert.deepEqual(r.types, ["magic", "poison", "harvest", "blank"]);
  assert.equal(r.seals, 1);
  assert.ok(!r.buy && !r.edit && !r.recruit.includes("necromancer"));
});
test("five seeded summon builds have distinct art, fixed role marks and levels within one of their master", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.level = 9;
      return Object.keys(SUMMON_TYPES).map((kind) => {
        const rows = Array.from({ length: 24 }, (_, n) =>
          createSummon(h, { kind, seed: summonSeed("fixture-" + n) }),
        );
        const s = rows[0];
        s.points = 100;
        const before = JSON.stringify(s.reels);
        autoUpgradeHero(s);
        return {
          kind,
          job: s.job,
          levels: [...new Set(rows.map((s) => s.level))],
          builds: new Set(rows.map((s) => JSON.stringify(s.reels))).size,
          art: portraitArt(s.job, s).includes('data-summon-art="' + kind + '"'),
          edit: applyFaceEdit(s, 0, 0, "upgrade"),
          gear: canEquipGear(s, EQUIPMENT_DEFS.ironSignet),
          same: JSON.stringify(s.reels) === before,
          cap: s.reels.every((r) => r.every((f) => f.tier >= 1 && f.tier <= 4)),
          seals: s.reels.map((r) => r.filter((f) => f.type === "class").length),
        };
      });
    });
  assert.equal(r.length, 5);
  for (const x of r) {
    assert.ok(x.art && x.same && x.cap, JSON.stringify(x));
    assert.ok(!x.edit && !x.gear);
    assert.deepEqual(
      x.levels.sort((a, b) => a - b),
      [8, 9, 10],
    );
    assert.ok(x.builds > 10);
    assert.deepEqual(x.seals, [0, 1, 0]);
  }
});
test("full Soul bars add two selectable party actors then heal the same team without replacing it", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      grantSouls(h, soulCapacity(h));
      grantSouls(h, soulCapacity(h));
      const ids = summonsOf(h).map((s) => s.id);
      state.party.forEach((a) => (a.hp = 1));
      grantSouls(h, soulCapacity(h) * 8);
      return {
        ids,
        after: summonsOf(h).map((s) => s.id),
        hp: state.party.map((s) => s.hp),
        souls: h.souls,
        size: state.party.length,
        machines: document.querySelectorAll("#party .machine-shell").length,
        consume: document.querySelectorAll("[data-consume-summon]").length,
      };
    });
  assert.equal(r.size, 3);
  assert.deepEqual(r.ids, r.after);
  assert.ok(r.hp.every((n) => n > 1));
  assert.equal(r.souls, 0);
  assert.equal(r.machines, 3);
  assert.equal(r.consume, 2);
});
test("fractional damage Souls fill an exact bar without a floating-point extra hit", async (t) => {
  const p = await game(t);
  assert.deepEqual(
    await p.evaluate(() => {
      const h = state.party[0];
      for (let n = 0; n < 80; n++) grantSouls(h, 0.3);
      return { souls: h.souls, summons: summonsOf(h).length };
    }),
    { souls: 0, summons: 1 },
  );
});
test("rolling the master gives no automatic summon attack; rolling an ally spends exactly one ordinary action", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "blade", seed: 12 });
    state.party.push(s);
    render();
    runMachine = async () => [
      { type: "magic", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(0);
    const first = {
      clock: state.enemy.countdown,
      spins: s.stats.spins,
      hp: state.enemy.hp,
    };
    runMachine = async () => [
      { type: "attack", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(1);
    return {
      first,
      clock: state.enemy.countdown,
      master: h.stats.spins,
      summon: s.stats.spins,
      actor: state.lastPlayerRoll.actor,
      damage: s.stats.damageDealt,
    };
  });
  assert.equal(r.first.clock, 98);
  assert.equal(r.first.spins, 0);
  assert.equal(r.clock, 97);
  assert.equal(r.master, 1);
  assert.equal(r.summon, 1);
  assert.equal(r.actor, 1);
  assert.ok(r.damage > 0);
});
test("an enemy aimed at the Necromancer hits the master directly while summons remain alive", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "guard", seed: 3 });
    state.party.push(s);
    h.hp = h.maxHp = 100;
    const hp = s.hp;
    const e = state.enemy;
    e.intent = { targetId: h.id, goal: "attack" };
    e.strikes = 2;
    e.damage = 3;
    render();
    runMachine = async () => [
      { type: "attack", tier: 1 },
      { type: "block", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await enemyTurn(e);
    return {
      master: h.hp,
      summon: s.hp,
      old: hp,
      intercept: state.lastEnemyRoll.interceptorId,
    };
  });
  assert.ok(r.master < 100);
  assert.equal(r.summon, r.old);
  assert.equal(r.intercept, undefined);
});
test("summons can be enemy targets and receive normal healing while the master cannot", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "blade", seed: 4 });
    state.party.push(s);
    h.hp = 1;
    s.hp = 2;
    state.target = 0;
    render();
    const target = healingTarget();
    const masterHeal = healHero(0, 20),
      summonHeal = healHero(1, 3);
    const hp = s.hp;
    const e = state.enemy;
    e.intent = { targetId: s.id, goal: "attack" };
    e.strikes = 1;
    e.damage = 2;
    runMachine = async () => [
      { type: "attack", tier: 1 },
      { type: "block", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await enemyTurn(e);
    return {
      target,
      masterHeal,
      summonHeal,
      before: hp,
      after: s.hp,
      master: h.hp,
    };
  });
  assert.equal(r.target, 0);
  assert.equal(r.masterHeal, 0);
  assert.equal(r.summonHeal, 3);
  assert.ok(r.after < r.before);
  assert.equal(r.master, 1);
});
test("Consume trades one summon for exact master recovery and advances the enemy clock once, without a burial", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      a = createSummon(h, { kind: "guard", seed: 8 }),
      b = createSummon(h, { kind: "wisp", seed: 2 });
    state.party.push(a, b);
    h.hp = 1;
    const offer = consumeSummonHealing(a);
    render();
    const used = await consumeSummon(a.id);
    return {
      used,
      hp: h.hp,
      offer,
      clock: state.enemy.countdown,
      party: state.party.map((s) => s.id),
      b: b.id,
      a: a.id,
      pending: state.pendingDeaths.length,
      graves: state.graveyard.length,
      souls: h.souls,
      archive: state.summonArchive.length,
    };
  });
  assert.ok(r.used);
  assert.equal(r.hp, 1 + r.offer);
  assert.equal(r.clock, 98);
  assert.ok(!r.party.includes(r.a) && r.party.includes(r.b));
  assert.equal(r.pending, 0);
  assert.equal(r.graves, 0);
  assert.equal(r.souls, 0);
  assert.equal(r.archive, 1);
});
test("out-of-combat consumption frees a slot without a turn, and a stunned master cannot consume during battle", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "blade", seed: 5 });
    state.party.push(s);
    h.hp = 1;
    render();
    const serial = state.actionSerial;
    await consumeSummon(s.id);
    const free = {
      party: state.party.length,
      serial: state.actionSerial,
      old: serial,
    };
    const a = createSummon(h, { kind: "guard", seed: 8 });
    state.party.push(a);
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    h.stun = 1;
    h.hp = 1;
    render();
    return {
      free,
      blocked: await consumeSummon(a.id),
      alive: alive(a),
      auto: autoConsumeCandidate(),
    };
  });
  assert.equal(r.free.party, 1);
  assert.equal(r.free.serial, r.free.old);
  assert.equal(r.blocked, false);
  assert.ok(r.alive);
  assert.equal(r.auto, null);
});
test("Powderghoul Boneburst hits both foes and destroys only the summon after its action", async (t) => {
  const p = await game(t);
  await fight(p, 2);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "bomber", seed: 7 });
    state.party.push(s);
    render();
    runMachine = async () => [
      { type: "blank", tier: 1 },
      { type: "class", tier: 1, job: s.job, summonKind: s.summonKind },
      { type: "blank", tier: 1 },
    ];
    await spin(1);
    return {
      hp: state.enemies.map((e) => e.hp),
      master: alive(h),
      party: state.party.length,
      pending: state.pendingDeaths.length,
      archive: state.summonArchive[0].cause,
      clocks: state.enemies.map((e) => e.countdown),
    };
  });
  assert.ok(r.hp.every((n) => n < 1000));
  assert.ok(r.master);
  assert.equal(r.party, 1);
  assert.equal(r.pending, 0);
  assert.equal(r.archive, "Boneburst");
  assert.deepEqual(r.clocks, [98, 98]);
});
test("Bonecantor healing supports bound allies and shields the team without bypassing master healing restrictions", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "cantor", seed: 9 }),
      a = createSummon(h, { kind: "blade", seed: 2 });
    state.party.push(s, a);
    h.hp = 1;
    s.hp = a.hp = 1;
    render();
    runMachine = async () => [
      { type: "blank", tier: 1 },
      { type: "class", tier: 1, job: s.job, summonKind: s.summonKind },
      { type: "blank", tier: 1 },
    ];
    await spin(1);
    return {
      master: h.hp,
      cantor: s.hp,
      other: a.hp,
      block: state.block,
      seals: state.lastClassAbility.name,
    };
  });
  assert.equal(r.master, 1);
  assert.ok(r.cantor > 1 && r.other > 1 && r.block > 0);
  assert.match(r.seals, /MENDING CHANT/);
});
test("class seals and generated passives have distinct concrete effects, with one Second Wind per battle", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "cantor", seed: 9 });
    s.summonPassive = "secondWind";
    state.party.push(s);
    s.hp = 3;
    render();
    damageHero(1, 1, "Test");
    const first = s.hp;
    damageHero(1, 1, "Test again");
    const second = s.hp;
    const effects = Object.keys(SUMMON_TYPES).map((kind) => {
      const a = createSummon(h, { kind, seed: 4 }),
        base = calculate([]);
      summonSealEffects(a, base);
      return {
        kind,
        attack: base.attack,
        magic: base.magic,
        block: base.block,
        heal: base.teamHeal,
        blast: base.summonBlast,
      };
    });
    return { first, second, effects };
  });
  assert.ok(r.first > 2);
  assert.equal(r.second, r.first - 1);
  assert.ok(r.effects.find((e) => e.kind === "guard").block > 0);
  assert.ok(r.effects.find((e) => e.kind === "wisp").magic > 0);
  assert.ok(r.effects.find((e) => e.kind === "cantor").heal > 0);
  assert.ok(r.effects.find((e) => e.kind === "bomber").blast);
});
test("slain hostile adventurers can return once as named zombies with their class and freshly level-balanced reels", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.level = 9;
    const victim = makeHero("Wren", "rogue");
    beginEncounter(false, { count: 1, adventurer: victim });
    const e = state.enemy;
    e.hp = e.maxHp = 20;
    setEnemyBlock(0);
    damageEnemy(999, "Test", e, { piercing: true });
    const candidates = defeatedSummonCandidates(),
      old = Math.random;
    let z;
    try {
      Math.random = () => 0;
      z = createSummon(h, { seed: 101 });
    } finally {
      Math.random = old;
    }
    return {
      name: z.name,
      job: z.job,
      kind: z.summonKind,
      level: z.level,
      faces: z.reels.flat().map((f) => f.type),
      art: portraitArt(z.job, z).includes('data-summon-art="zombie"'),
      count: candidates.length,
      remaining: defeatedSummonCandidates().length,
      masterLevel: h.level,
    };
  });
  assert.equal(r.count, 1);
  assert.equal(r.remaining, 0);
  assert.match(r.name, /Wren/);
  assert.equal(r.kind, "zombie");
  assert.equal(r.job, "rogue");
  assert.ok(Math.abs(r.level - r.masterLevel) <= 1);
  assert.ok(r.art);
  assert.ok(
    r.faces.every((f) =>
      ["attack", "poison", "stun", "stimulant", "blank", "class"].includes(f),
    ),
  );
});
test("legacy Skeletons migrate into selectable allies without consuming gameplay RNG or losing HP or Souls", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.souls = 7.5;
    h.skeletons = [
      { id: "old-bones", hp: 5, name: "Skeleton", stats: { damageDealt: 9 } },
    ];
    const old = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    try {
      migrateNecromancerParty();
    } finally {
      Math.random = old;
    }
    return {
      calls,
      party: state.party.length,
      legacy: Object.hasOwn(h, "skeletons"),
      hp: state.party[1].hp,
      souls: h.souls,
      damage: state.party[1].stats.damageDealt,
      reels: state.party[1].reels.length,
    };
  });
  assert.equal(r.calls, 0);
  assert.equal(r.party, 2);
  assert.equal(r.legacy, false);
  assert.equal(r.hp, 5);
  assert.equal(r.souls, 7.5);
  assert.equal(r.damage, 9);
  assert.equal(r.reels, 3);
});
test("summons, their exact builds, wounds, passives and victim receipts survive reload; growth never grants free HP", async (t) => {
  const p = await game(t);
  const before = await p.evaluate(() => {
    const h = state.party[0];
    h.level = 6;
    h.xp = 71;
    const s = createSummon(h, { kind: "wisp", seed: 22 });
    s.hp = 3;
    state.party.push(s);
    state.necromancerVictims = [
      { id: "v", name: "V", job: "mage", raised: true },
    ];
    h.souls = 8;
    render();
    save();
    return {
      id: s.id,
      hp: s.hp,
      reels: JSON.stringify(s.reels),
      passive: s.summonPassive,
    };
  });
  await p.reload();
  await p.evaluate(() => CompanyIntro.skip(true));
  const after = await p.evaluate(() => {
    const h = state.party[0],
      s = state.party[1],
      snapshot = {
        id: s.id,
        hp: s.hp,
        reels: JSON.stringify(s.reels),
        passive: s.summonPassive,
      };
    const level = s.level,
      max = s.maxHp;
    addXP(h, 1);
    return {
      snapshot,
      level: s.level,
      old: level,
      max: s.maxHp,
      oldMax: max,
      hp: s.hp,
      points: s.points,
      masterHp: h.hp,
      souls: h.souls,
      victim: state.necromancerVictims[0].raised,
      version: state.version,
    };
  });
  assert.deepEqual(after.snapshot, before);
  assert.equal(after.level, after.old + 1);
  assert.ok(after.max > after.oldMax);
  assert.equal(after.hp, 3);
  assert.equal(after.points, 0);
  assert.equal(after.masterHp, 22);
  assert.equal(after.souls, 8);
  assert.ok(after.victim);
  assert.equal(after.version, 26);
});
test("dead summons leave no burial or revive prompt; master death ends the expedition despite surviving summons", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      s = createSummon(h, { kind: "blade", seed: 10 });
    state.party.push(s);
    state.artefacts = [
      { id: "stone", key: "revive", name: "Revive Stone", power: 1 },
    ];
    render();
    damageHero(1, 999, "Test", { piercing: true });
    pruneSummons();
    const lost = {
      party: state.party.length,
      pending: state.pendingDeaths.length,
      graves: state.graveyard.length,
      stone: state.artefacts.length,
    };
    state.party.push(createSummon(h, { kind: "guard", seed: 20 }));
    h.hp = 1;
    damageHero(0, 99, "Test", { piercing: true });
    return {
      lost,
      over: state.over,
      summons: state.party.filter(isSummon).length,
      graves: state.graveyard.map((d) => d.job),
      pending: state.pendingDeaths.length,
      stone: state.artefacts.length,
    };
  });
  assert.deepEqual(r.lost, { party: 1, pending: 0, graves: 0, stone: 1 });
  assert.ok(r.over);
  assert.equal(r.summons, 0);
  assert.deepEqual(r.graves, ["necromancer"]);
  assert.equal(r.pending, 0);
  assert.equal(r.stone, 1);
});
test("a stunned master does not cause automatic summon hits and a ready summon remains selectable", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "guard", seed: 15 });
    state.party.push(s);
    h.stun = 1;
    render();
    await spin(0);
    const before = {
      spins: s.stats.spins,
      hp: state.enemy.hp,
      clock: state.enemy.countdown,
    };
    runMachine = async () => [
      { type: "attack", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(1);
    return {
      before,
      spins: s.stats.spins,
      hp: state.enemy.hp,
      clock: state.enemy.countdown,
    };
  });
  assert.equal(r.before.spins, 0);
  assert.equal(r.before.hp, 1000);
  assert.equal(r.spins, 1);
  assert.ok(r.hp < 1000);
  assert.equal(r.clock, r.before.clock - 1);
});
test("autofight consumes a summon for an endangered master and never edits fixed builds", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      s = createSummon(h, { kind: "blade", seed: 41 });
    state.party.push(s);
    h.hp = 1;
    s.points = 100;
    const reels = JSON.stringify(s.reels);
    autoUpgradeHero(s);
    render();
    state.autoresolve = true;
    autoNextAt = 0;
    await autoresolveTick();
    state.autoresolve = false;
    return {
      hp: h.hp,
      party: state.party.length,
      same: reels === JSON.stringify(s.reels),
      archive: state.summonArchive?.length,
      clock: state.enemy.countdown,
    };
  });
  assert.ok(r.hp > 1);
  assert.equal(r.party, 1);
  assert.ok(r.same);
  assert.equal(r.archive, 1);
  assert.equal(r.clock, 98);
});
test("shop purchases retain the heading node and its settled animation; map announcements remain intentional", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    newRun("fighter");
    closeModal();
    state.gold = 10000;
    window.shopping = shopEncounter({
      shop: { potion: 2, ward: 1, reveal: 1 },
    });
    window.shopHeading = $("#modal-title");
    shopHeading.getAnimations().forEach((a) => a.finish());
  });
  const r = await p.evaluate(async () => {
    await buyShop("potion");
    await buyShop("ward");
    const ordinary = {
      same: $("#modal-title") === shopHeading,
      title: shopHeading.textContent,
      animations: shopHeading.getAnimations().length,
    };
    await buyShop("reveal");
    return { ordinary, reveal: $("#modal-title").textContent };
  });
  assert.ok(r.ordinary.same);
  assert.equal(r.ordinary.animations, 0);
  assert.equal(r.ordinary.title, "A shop between the lines");
  assert.equal(r.reveal, "The stairway is marked!");
});
for (const [width, height] of [
  [1920, 1080],
  [1280, 800],
  [390, 844],
  [320, 844],
])
  test(`summon reels, consume controls and three compact heal target spaces fit at ${width}`, async (t) => {
    const p = await game(t);
    await p.setViewportSize({ width, height });
    await fight(p);
    await p.evaluate(async () => {
      const h = state.party[0];
      h.level = 8;
      state.party.push(
        createSummon(h, { kind: "cantor", seed: 9 }),
        createSummon(h, { kind: "bomber", seed: 20 }),
      );
      render();
      await document.fonts.ready;
      fitNotebook(true);
    });
    const r = await p.evaluate(() => {
      const targets = $("#targets").getBoundingClientRect(),
        ribbon = $("#result-ribbon").getBoundingClientRect();
      return {
        actors: document.querySelectorAll("#party .hero").length,
        controls: document.querySelectorAll("[data-consume-summon]").length,
        slots: document.querySelectorAll(".target-picks > *").length,
        overflow: document.documentElement.scrollWidth > innerWidth,
        overlap: targets.bottom > ribbon.top + 2,
        cards: [...document.querySelectorAll(".summon-card")].map((n) => {
          const r = n.getBoundingClientRect(),
            button = n.querySelector(".consume-summon").getBoundingClientRect();
          return button.right <= r.right + 1 && button.bottom <= r.bottom + 1;
        }),
      };
    });
    assert.equal(r.actors, 3);
    assert.equal(r.controls, 2);
    assert.equal(r.slots, 3);
    assert.ok(
      !r.overflow && !r.overlap && r.cards.every(Boolean),
      JSON.stringify(r),
    );
    fs.mkdirSync(path.join(__dirname, "../test-results/summoned-party"), {
      recursive: true,
    });
    await p.screenshot({
      path: path.join(
        __dirname,
        `../test-results/summoned-party/party-${width}.png`,
      ),
      fullPage: width < 1260,
    });
    const solo = await p.evaluate(() => {
      state.party = state.party.filter((h) => !isSummon(h));
      renderTargets();
      return {
        slots: document.querySelectorAll(".target-picks > *").length,
        buttons: document.querySelectorAll(".target-picks button").length,
        height: $("#targets").getBoundingClientRect().height,
      };
    });
    assert.equal(solo.slots, 3);
    assert.equal(solo.buttons, 1);
    assert.ok(solo.height < 45);
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

test("a summon raised during a real attack stays idle until chosen and does not disturb the acting index", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.specialism = "offence";
    h.souls = soulCapacity(h) - 0.3;
    runMachine = async () => [
      { type: "magic", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ];
    await spin(0);
    return {
      party: state.party.length,
      actor: state.lastPlayerRoll.actor,
      spins: state.party[1].stats.spins,
      hp: state.enemy.hp,
      damage: state.lastPlayerRoll.actualDamage,
      clock: state.enemy.countdown,
      current: state.currentHero,
    };
  });
  assert.equal(r.party, 2);
  assert.equal(r.actor, 0);
  assert.equal(r.spins, 0);
  assert.equal(r.hp, 1000 - r.damage);
  assert.equal(r.clock, 98);
  assert.equal(r.current, null);
});
test("summon third-roll passives count their own actions and pencil art consumes no gameplay randomness", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      s = createSummon(h, { kind: "guard", seed: 20 });
    s.summonPassive = "ward";
    const blocks = [1, 2, 3].map((n) => {
      s.stats.spins = n;
      const base = calculate([]);
      summonPassiveEffects(s, base);
      return base.block;
    });
    const old = Math.random;
    let calls = 0;
    try {
      Math.random = () => {
        calls++;
        return 0.5;
      };
      for (const kind of Object.keys(SUMMON_TYPES)) {
        const s = {
          job: SUMMON_TYPES[kind].job,
          summonKind: kind,
          hp: 5,
          maxHp: 20,
        };
        portraitArt(s.job, s);
        s.hp = 0;
        portraitArt(s.job, s);
      }
    } finally {
      Math.random = old;
    }
    return { blocks, calls };
  });
  assert.deepEqual(r.blocks, [0, 0, 2]);
  assert.equal(r.calls, 0);
});

test("a full bar after a summon dies queues its replacement until the action boundary, keeping other indices stable", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      a = createSummon(h, { kind: "guard", seed: 5 }),
      b = createSummon(h, { kind: "blade", seed: 7 });
    state.party.push(a, b);
    render();
    busy = true;
    state.currentHero = 2;
    recordSummonDeath(a, "Test");
    grantSouls(h, soulCapacity(h));
    const during = {
      size: state.party.length,
      current: state.party[2].id,
      pending: h.pendingRaises,
    };
    state.currentHero = null;
    busy = false;
    pruneSummons();
    return {
      during,
      after: state.party.length,
      survivor: state.party.includes(b),
      removed: !state.party.includes(a),
      pending: h.pendingRaises,
      b: b.id,
    };
  });
  assert.equal(r.during.size, 3);
  assert.equal(r.during.current, r.b);
  assert.equal(r.during.pending, 1);
  assert.equal(r.after, 3);
  assert.ok(r.survivor && r.removed);
  assert.equal(r.pending, 0);
});

test("an interrupted death save cannot leave a dead master playable through surviving summons or a Revive Stone", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const h = state.party[0],
      s = createSummon(h, { kind: "guard", seed: 15 });
    state.party.push(s);
    state.artefacts = [
      { id: "r", key: "revive", name: "Revive Stone", power: 1 },
    ];
    h.hp = 0;
    h.dead = true;
    h.death = {
      id: h.id,
      name: h.name,
      job: h.job,
      level: h.level,
      xp: 0,
      maxHp: h.maxHp,
      stats: { ...h.stats },
      cause: "Interrupted death",
      depth: state.depth,
      tile: state.position,
      joinedAt: h.joinedAt,
      diedAt: Date.now(),
      stepsWithParty: 0,
      origin: h.origin,
    };
    state.pendingDeaths = [h.death];
    state.over = false;
    save();
  });
  await p.reload();
  await p.evaluate(() => CompanyIntro.skip(true));
  const r = await p.evaluate(() => ({
    over: state.over,
    summons: state.party.filter(isSummon).length,
    pending: state.pendingDeaths.length,
    stone: state.artefacts.length,
  }));
  assert.deepEqual(r, { over: true, summons: 0, pending: 0, stone: 1 });
});

test("saving during consume effects keeps the paid sacrifice and its healing together, without duplicate death records", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const h = state.party[0],
      s = createSummon(h, { kind: "guard", seed: 18 });
    state.party.push(s);
    h.hp = 1;
    render();
    window.offered = consumeSummonHealing(s);
    beam = () => new Promise(() => {});
    window.pendingConsume = consumeSummon(s.id);
  });
  await p.waitForFunction(() => busy && state.party[1].dead);
  const before = await p.evaluate(() => {
    save();
    return { hp: state.party[0].hp, archive: state.summonArchive.length };
  });
  await p.reload();
  await p.evaluate(() => CompanyIntro.skip(true));
  const after = await p.evaluate(() => ({
    hp: state.party[0].hp,
    archive: state.summonArchive.length,
    party: state.party.length,
    pending: state.pendingDeaths.length,
  }));
  assert.ok(before.hp > 1);
  assert.equal(after.hp, before.hp);
  assert.equal(before.archive, 1);
  assert.equal(after.archive, 1);
  assert.equal(after.party, 1);
  assert.equal(after.pending, 0);
});

test("summon cleanup leaves ordinary healing selections and shared-ID test heroes unchanged", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    newRun("mage");
    state.party.push(makeHero("Ally", "fighter"));
    state.party[1].id = state.party[0].id;
    state.target = 1;
    const before = state.party;
    pruneSummons();
    return { target: state.target, same: before === state.party };
  });
  assert.equal(r.target, 1);
  assert.ok(r.same);
});
