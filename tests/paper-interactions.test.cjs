const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  { chromium } = require("playwright");
let browser, server, url;
const out = path.join(__dirname, "../test-results/paper-interactions");
fs.mkdirSync(out, { recursive: true });
before(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"));
  server = http.createServer((_, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t, job = "bloodbinder", width = 1920, height = 1080) {
  const p = await browser.newPage({ viewport: { width, height } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate((job) => {
    const profile = emptyProfile();
    profile.dungeonCleared = true;
    profile.gold = 99999;
    profile.owned = ["bloodbinder", "ranger", "berserker", "jester"];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    newRun(job);
    closeModal();
    closeSpotlight();
    setPace("skip");
    setPreference("skipCriticals", true);
    setPreference("shake", 0);
    characterLuck = () => 0.99999;
    state.runRules = [];
    scheduleStunRecovery = () => {};
  }, job);
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
      Object.assign(e, { hp: 1000, maxHp: 1000, countdown: 99, passive: null }),
    );
    setEnemyBlock(0);
    render();
  }, count);
}
test("heal hitboxes persist through busy travel and immune targets stay selectable", async (t) => {
  const p = await game(t, "necromancer");
  const r = await p.evaluate(() => {
    const h = state.party[0];
    state.party.push(createSummon(h, { kind: "guard", seed: 20 }));
    render();
    const button = $('[data-target="0"]');
    busy = true;
    travel = { goal: state.position };
    renderTargets();
    const same = button === $('[data-target="0"]');
    state.target = 1;
    renderTargets();
    $('[data-target="0"]').click();
    const result = {
      same,
      enabled: !button.disabled,
      selected: state.target,
      skulls: !!$(".immune-skulls"),
      text: $(".current-heal-target").textContent,
    };
    busy = false;
    travel = null;
    return result;
  });
  assert.ok(r.same && r.enabled && r.skulls);
  assert.equal(r.selected, 0);
  assert.match(r.text, /heals fail/);
});
test("ordinary healing flies to an immune Necromancer, then visibly bounces away", async (t) => {
  const p = await game(t, "necromancer");
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.hp = 5;
    state.party.push(createSummon(h, { kind: "cantor", seed: 8 }));
    render();
    const result = healHero(0, 10);
    let rejected = false;
    const observer = new MutationObserver(() => {
      if ($(".rejected-heal")) rejected = true;
    });
    observer.observe(document.body, { childList: true });
    const promise = beam(entityArt(state.party[1]), entityArt(h), "heal");
    const green = !!$(".rolled-projectile.heal");
    await promise;
    observer.disconnect();
    return { result, hp: h.hp, green, rejected, target: healingTarget(0) };
  });
  assert.equal(r.result, 0);
  assert.equal(r.hp, 5);
  assert.equal(r.target, 0);
  assert.ok(r.green && r.rejected);
});
test("reduced recovery keeps its healing and rejects only the reduced part", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.hp = 1;
    h.healingPenalty = 0.5;
    render();
    const n = healHero(0, 10);
    let rejected;
    const observer = new MutationObserver(() => {
      if ($(".rejected-heal")) rejected = $(".rejected-heal").textContent;
    });
    observer.observe(document.body, { childList: true });
    await beam($("#inventory-title"), entityArt(h), "heal");
    observer.disconnect();
    return { n, hp: h.hp, rejected };
  });
  assert.equal(r.n, 5);
  assert.equal(r.hp, 6);
  assert.match(r.rejected, /REDUCED/);
});
for (const [width, height] of [
  [1920, 1080],
  [1280, 800],
  [390, 844],
  [320, 844],
])
  test(`large artefact collection stays two-column and scrollable at ${width}`, async (t) => {
    const p = await game(t, "fighter", width, height);
    await p.evaluate(async () => {
      state.artefacts = Array.from({ length: 24 }, (_, i) => ({
        id: "a" + i,
        name: "An unusually long artefact name " + i,
        key: i % 2 ? "heal" : "block",
        power: i + 1,
        depth: 9,
      }));
      inspectArtefacts();
      await document.fonts.ready;
      fitDialogs();
    });
    const r = await p.evaluate(() => {
      const el = $(".artefact-library"),
        b = el.getBoundingClientRect(),
        modal = $("#modal").getBoundingClientRect();
      return {
        overflow: getComputedStyle(el).overflowY,
        columns: getComputedStyle(el).gridTemplateColumns.split(" ").length,
        scroll: el.scrollHeight > el.clientHeight,
        titleFits:
          $("#modal-title").getBoundingClientRect().bottom <=
          $(".artefact-intro").getBoundingClientRect().top + 1,
        topFits: modal.top >= $(".desk-top").getBoundingClientRect().bottom - 1,
        font: parseFloat(getComputedStyle(el.querySelector("p")).fontSize),
        zoom: $(".modal-flow").style.zoom,
        cardFits: [...el.querySelectorAll(".artefact-card")].every((n) => {
          const r = n.getBoundingClientRect();
          return r.left >= b.left - 1 && r.right <= b.right + 1;
        }),
        b: JSON.parse(JSON.stringify(b)),
        modal: JSON.parse(JSON.stringify(modal)),
      };
    });
    assert.equal(r.overflow, "auto");
    assert.equal(r.columns, 2);
    assert.ok(r.scroll);
    assert.ok(r.cardFits, "Cards must fit horizontally, not be clipped");
    assert.ok(
      r.titleFits && r.topFits,
      "Title/intro must stay clear of the toolbar",
    );
    assert.ok(r.font >= 16);
    assert.equal(r.zoom, "1");
    assert.ok(r.modal.width <= width + 1);
    await p.screenshot({
      path: path.join(out, `artefacts-${width}.png`),
      fullPage: width < 1260,
    });
  });
test("unseen quartz paints a single field and seals reels in nearby battles", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    state.map = Array.from({ length: W * H }, (_, i) => ({
      wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
      terrain: "floor",
      seen: true,
      visited: false,
      event: null,
      feature: null,
      corpses: [],
    }));
    const source = pos(4, 4),
      near = pos(4, 5);
    state.map[source] = {
      ...state.map[source],
      terrain: "crystal",
      wall: true,
      seen: false,
    };
    state.position = near;
    renderMap();
    const zone =
        $(".quartz-zone")?.dataset.zoneCells.split(",").map(Number) || [],
      flow = $(".quartz-flow")?.getAttribute("d");
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.hp = 100;
    state.crystalRolls = 2;
    advanceCrystalAura();
    return {
      zone,
      near,
      source,
      seen: state.map[source].seen,
      locks: state.party.reduce((n, h) => n + (h.crystalLocks?.length || 0), 0),
      flow,
    };
  });
  assert.ok(r.zone.includes(r.near));
  assert.ok(!r.seen);
  assert.ok(r.locks > 0);
  assert.match(r.flow, /L/);
});
test("Blood Bloom first adds level-scaled Seeds to both foes, then doubles damage and base recovery", async (t) => {
  const p = await game(t);
  await fight(p, 2);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.specialism = "offence";
    h.level = 9;
    h.maxHp = 200;
    h.hp = 1;
    state.enemies[0].bloodSeeds = { count: 8, sourceId: h.id };
    state.enemies[1].bloodSeeds = { count: 3, sourceId: h.id };
    render();
    const expected = state.enemies.map((e) => ({
      count: bloodSeedCount(e) + bloomSeedsAdded(h),
    }));
    const result = await detonateBloodSeeds(h);
    return {
      expected,
      result,
      hp: state.enemies.map((e) => e.hp),
      seeds: state.enemies.map(bloodSeedCount),
      stats: h.stats.healingDone,
    };
  });
  assert.equal(
    r.result.seeds,
    r.expected.reduce((n, e) => n + e.count, 0),
  );
  assert.equal(r.result.damage, r.result.seeds * 2);
  assert.ok(r.result.healing >= r.result.seeds * 2);
  assert.equal(r.stats, r.result.healing);
  assert.deepEqual(r.seeds, [0, 0]);
  assert.deepEqual(
    r.hp,
    r.expected.map((e) => 1000 - e.count * 2),
  );
});
test("same-roll magic hits before newly planted Blood Seeds", async (t) => {
  const p = await game(t);
  await fight(p);
  await p.evaluate(() => {
    const h = state.party[0];
    h.specialism = "offence";
    h.reels = [
      [{ type: "magic", tier: 2, weight: 1 }],
      [{ type: "bloodseed", tier: 2, weight: 1 }],
      [{ type: "blank", tier: 1, weight: 1 }],
    ];
    render();
  });
  await p.evaluate(() => spin(0));
  const r = await p.evaluate(() => ({
    count: bloodSeedCount(state.enemy),
    power: state.lastPlayerRoll.totals.bloodseed,
    hp: state.enemy.hp,
  }));
  assert.equal(r.count, r.power);
  assert.ok(r.hp < 1000);
});
test("Seed recovery is attributed to its caster and scales the shared pool only once", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.level = 12;
    h.specialism = "offence";
    h.equipment = "crimsonPhial";
    h.hp = 1;
    h.maxHp = 300;
    state.party.push(makeHero("T", "fighter"));
    state.party[1].hp = 1;
    const e = state.enemy;
    e.bloodSeeds = { count: 10, sourceId: h.id };
    const offer = seedHealingOffered(10, h);
    damageEnemy(10, "fixture", e, { piercing: true });
    return {
      offer,
      healing: h.stats.healingDone,
      gained: state.party.reduce((n, a) => n + a.hp - 1, 0),
      remaining: bloodSeedCount(e),
    };
  });
  assert.ok(r.offer > 10);
  assert.equal(r.healing, r.offer);
  assert.equal(r.gained, r.offer);
  assert.equal(r.remaining, 0);
});
test("ally stimulant follows the selected heal target even when another ally acted more", async (t) => {
  const p = await game(t, "mage");
  await fight(p);
  await p.evaluate(() => {
    const h = state.party[0];
    state.party.push(makeHero("R", "rogue"), makeHero("T", "fighter"));
    state.target = 2;
    state.party[1].stats.spins = 99;
    h.reels = [
      [{ type: "rally", tier: 3, weight: 1 }],
      [{ type: "blank", tier: 1, weight: 1 }],
      [{ type: "blank", tier: 1, weight: 1 }],
    ];
    render();
  });
  await p.evaluate(() => spin(0));
  const r = await p.evaluate(() => ({
    target: state.party[2].stimulant,
    other: state.party[1].stimulant,
    text: faceDescription({ type: "rally", tier: 2 }, state.party[0]),
    high: stimulantDamageBonus({ stimulant: { power: 8 } }),
    low: stimulantDamageBonus({ stimulant: { power: 2 } }),
  }));
  assert.ok(r.target && !r.other);
  assert.match(r.text, /selected heal target/);
  assert.ok(r.high >= r.low + 6);
});
test("block critical growth is compressed and shield breaking doubles shield cost only", async (t) => {
  const p = await game(t, "fighter");
  await fight(p);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      e = state.enemy;
    const cap = partyBlockCap(),
      block = criticalBlockGain(8, 3);
    setEnemyBlock(12);
    const hp = e.hp;
    damageEnemy(5, "maul", e, { shieldFactor: 2 });
    const enemy = { block: enemyBlock(), lost: hp - e.hp };
    state.block = 12;
    const before = h.hp;
    damageHero(0, 5, "heavy", { shieldFactor: 2 });
    return { cap, block, enemy, partyBlock: state.block, hp: before - h.hp };
  });
  assert.ok(r.cap > 30 && r.block < 24);
  assert.equal(r.enemy.block, 2);
  assert.equal(r.enemy.lost, 0);
  assert.equal(r.partyBlock, 2);
  assert.equal(r.hp, 0);
});
test("bandits always form two non-Necromancer classes and can be paid without a fight", async (t) => {
  const p = await game(t, "fighter");
  await p.evaluate(() => {
    state.depth = 4;
    state.gold = 1000;
    window.banditDone = banditEncounter();
  });
  await p.locator("#bandit-pay").click();
  await p.evaluate(() => window.banditDone);
  const paid = await p.evaluate(() => ({
    gold: state.gold,
    count: state.banditEncounters,
    enemy: !!state.enemy,
  }));
  assert.equal(paid.gold, 1000 - (35 + 4 * 22));
  assert.equal(paid.count, 1);
  assert.equal(paid.enemy, false);
  await p.evaluate(() => {
    window.banditDone = banditEncounter();
  });
  await p.locator("#bandit-fight").click();
  await p.waitForSelector("#stage-confirm");
  const r = await p.evaluate(() => ({
    count: state.enemies.length,
    arts: state.enemies.map((e) => e.art),
    reels: state.enemies.map((e) => e.reels.flat().map((f) => f.type)),
    preview: document.querySelectorAll(".encounter-enemy").length,
  }));
  assert.equal(r.count, 2);
  assert.ok(r.arts.every((a) => a !== "necromancer"));
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.banditDone);
});
test("all ten fairy pranks communicate exact outcomes and consume next-fight receipts once", async (t) => {
  const p = await game(t, "fighter");
  for (const id of [
    "rusty",
    "nap",
    "dizzy",
    "pep",
    "pockets",
    "thorns",
    "chalk",
    "brittle",
    "ward",
    "cotton",
  ]) {
    await p.evaluate((id) => {
      closeSpotlight();
      state.enemy = null;
      state.enemies = [];
      state.party = state.party.slice(0, 1);
      const h = state.party[0];
      h.level = 3;
      h.hp = h.maxHp = 80;
      state.gold = 1000;
      window.prank = fairyPrank(id);
    }, id);
    await p.locator("#stage-confirm").click();
    await p.evaluate(() => window.prank);
    const r = await p.evaluate(() => {
      beginEncounter(false, { count: 2 });
      const h = state.party[0],
        r = {
          pending: state.fairyPranks.length,
          level: h.level,
          sleep: h.fairySleep,
          stun: h.stun,
          buff: state.enemies[0].stimulant,
          poison: h.poison,
          locks: h.blackout,
          vulnerable: !!h.vulnerable,
          block: enemyBlock(),
          penalty: healingAcceptance(h),
          gold: state.gold,
        };
      clearBattleStatuses();
      state.enemy = null;
      state.enemies = [];
      return r;
    });
    assert.equal(r.pending, 0, id);
    if (id === "rusty") assert.equal(r.level, 2);
    if (id === "nap") assert.equal(r.sleep, 1);
    if (id === "dizzy") assert.equal(r.stun, 1);
    if (id === "pep") assert.ok(r.buff);
    if (id === "pockets") assert.equal(r.gold, 900);
    if (id === "thorns") assert.ok(r.poison);
    if (id === "chalk") assert.equal(r.locks.length, 1);
    if (id === "brittle") assert.ok(r.vulnerable);
    if (id === "ward") assert.ok(r.block >= 6);
    if (id === "cotton") assert.equal(r.penalty, 0.5);
  }
});
test("keyboard focus mode confirms menus and yields its highlight immediately to mouse use", async (t) => {
  const p = await game(t, "fighter");
  await p.locator(".keyboard-context:not([inert]) [data-input-mode]").click();
  assert.equal(await p.evaluate(() => preferences().navigationMode), true);
  await p.keyboard.press("ArrowRight");
  assert.equal(await p.locator(".controller-focus").count(), 1);
  await p.mouse.move(400, 450);
  assert.equal(await p.locator(".controller-focus").count(), 0);
  await p.evaluate(() => openUtilityPage("options"));
  await p.keyboard.press("Tab");
  assert.ok(await p.locator("#modal .controller-focus").count());
  await p.keyboard.press("Escape");
  assert.equal(await p.evaluate(() => $("#overlay").hidden), true);
  await p.screenshot({ path: path.join(out, "focus-mode.png") });
});
test("new release abandons an older expedition while preserving settings and camp progress", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    state.release = "old-release";
    save();
    const profile = localStorage.getItem(PROFILE_KEY),
      settings = localStorage.getItem("scratchpad-dungeon-settings"),
      reset = prepareUpdatedNotebook();
    const result = {
      reset,
      profile: localStorage.getItem(PROFILE_KEY) === profile,
      settings:
        localStorage.getItem("scratchpad-dungeon-settings") === settings,
      save: localStorage.getItem(SAVE_KEY),
    };
    newRun("fighter");
    result.second = prepareUpdatedNotebook();
    return result;
  });
  assert.ok(r.reset && r.profile && r.settings);
  assert.equal(r.save, null);
  assert.equal(r.second, false);
});
test("pun identity and biome hints are meaningful, short and leave gameplay RNG untouched", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    const random = Math.random;
    Math.random = () => {
      throw Error("Cosmetic work used world RNG");
    };
    try {
      const hints = Object.keys(BIOMES).map((b) => biomeSummary(b));
      return {
        name: PUN_ENEMIES.postit,
        art: portraitArt("postit"),
        hints,
        tool: $("#floor-name").dataset.tooltip,
      };
    } finally {
      Math.random = random;
    }
  });
  assert.equal(r.name, "Sticky Bandit");
  assert.ok(r.hints.every((s) => s.length > 20 && s.length < 150));
  assert.ok(r.tool.length > 20);
});

test("two Bloodbinders retain their own Seed healing credits across another caster’s planting and reload", async (t) => {
  const p = await game(t);
  await fight(p);
  const r = await p.evaluate(() => {
    const a = state.party[0],
      b = makeHero("Crimson", "bloodbinder");
    a.id = "seed-owner-a";
    b.id = "seed-owner-b";
    a.specialism = b.specialism = "offence";
    a.level = 1;
    b.level = 12;
    b.equipment = "crimsonPhial";
    a.hp = b.hp = 1;
    a.maxHp = b.maxHp = 200;
    state.party.push(b);
    const e = state.enemy;
    appendBloodSeeds(e, 3, a);
    appendBloodSeeds(e, 4, b);
    save();
    load();
    const loaded = state.enemy.bloodSeeds.sources.map((p) => ({ ...p }));
    const [first, second] = state.party;
    damageEnemy(5, "ally strike", state.enemy, { piercing: true });
    return {
      loaded,
      first: first.stats.healingDone,
      second: second.stats.healingDone,
      expected: seedHealingOffered(2, second),
      left: state.enemy.bloodSeeds.sources,
    };
  });
  assert.deepEqual(r.loaded, [
    { sourceId: "seed-owner-a", count: 3 },
    { sourceId: "seed-owner-b", count: 4 },
  ]);
  assert.equal(r.first, 3);
  assert.equal(r.second, r.expected);
  assert.deepEqual(r.left, [{ sourceId: "seed-owner-b", count: 2 }]);
});
test("fairy sleep blocks the chosen hero, counts party actions and cannot deadlock a solo survivor", async (t) => {
  const p = await game(t, "fighter");
  await fight(p);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      ally = makeHero("Ready", "rogue");
    state.party.push(ally);
    h.fairySleep = 2;
    const locked = heroCannotRoll(h);
    advanceFairySleep();
    const one = h.fairySleep;
    state.party = [h];
    const solo = heroCannotRoll(h);
    await spin(0);
    return {
      locked,
      one,
      solo,
      left: h.fairySleep,
      spins: h.stats.spins,
      missed: h.stats.turnsMissed,
      clock: state.enemy.countdown,
    };
  });
  assert.ok(r.locked);
  assert.equal(r.one, 1);
  assert.equal(r.solo, false);
  assert.equal(r.left, 0);
  assert.equal(r.spins, 0);
  assert.equal(r.missed, 1);
  assert.equal(r.clock, 98);
});
test("slot tooltips and critical payoff use the same compressed block result as actual rolls", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    const base = { block: 12 },
      details = effectDetails(base);
    return {
      actual: scaleEffects(base, 3).block,
      figure: criticalFigures(details, 3).total,
      offered: criticalEffectValue(details[0], 3),
      tooltip: faceDescription({ type: "rally", tier: 2 }, state.party[0]),
    };
  });
  assert.equal(r.actual, r.figure);
  assert.equal(r.actual, r.offered);
  assert.match(r.tooltip, /3 actions.*2 surplus doses/);
});
test("normal and premium shop stock scale by depth and premium receipts survive repeated visits", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    const random = Math.random;
    try {
      Math.random = () => 0;
      const rows = [1, 4, 8].map((depth) => {
        state.depth = depth;
        const c = { shop: {} };
        addPremiumShopStock(c);
        const key = c.premium;
        return {
          depth,
          key,
          grade: ITEM_DEFS[key].quality,
          price: shopPrices(c)[key],
          normal: shopItemForDepth("potion"),
        };
      });
      return rows;
    } finally {
      Math.random = random;
    }
  });
  assert.ok(r.every((row) => row.grade > 1 && row.price > 80));
  assert.ok(r[2].grade >= r[1].grade && r[1].grade >= r[0].grade);
});
test("rare trait rolls are lower overall and Bookish has its own extra gate", async (t) => {
  const p = await game(t, "fighter");
  const r = await p.evaluate(() => {
    const original = Math.random,
      grant = grantTrait,
      candidate = traitCandidate,
      pickOriginal = pick;
    let total = 0,
      bookish = 0,
      seed = 4321;
    Math.random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    grantTrait = (h, id) => {
      total++;
      if (id === "bookish") bookish++;
      return true;
    };
    const h = state.party[0];
    try {
      traitCandidate = () => ({ h, id: "heroic", reason: "fixture" });
      for (let n = 0; n < 5000; n++) awardTraitOccurrence("victory", [{ h }]);
      const regular = total;
      total = 0;
      traitCandidate = () => ({ h, id: "bookish", reason: "fixture" });
      for (let n = 0; n < 5000; n++) awardTraitOccurrence("beacon", [{ h }]);
      return { regular, bookish, chance: TRAIT_CHANCE };
    } finally {
      Math.random = original;
      grantTrait = grant;
      traitCandidate = candidate;
    }
  });
  assert.equal(r.chance, 0.16);
  assert.ok(r.regular > 600 && r.regular < 1000);
  assert.ok(r.bookish < r.regular * 0.45);
});
