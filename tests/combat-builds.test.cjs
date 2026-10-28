const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync, existsSync } = require("node:fs");
const path = require("node:path"),
  http = require("node:http");
const { chromium } = require("playwright");
let browser, server, url;
before(async () => {
  const html = readFileSync(path.resolve(__dirname, "../index.html"));
  server = http.createServer((q, r) => {
    r.writeHead(200, { "Content-Type": "text/html" });
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t, { width = 1920, height = 1080 } = {}) {
  const page = await browser.newPage({ viewport: { width, height } }),
    errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (r) => {
    if (
      !r.request().url().startsWith(url) &&
      !r.request().url().startsWith("data:")
    ) {
      external.push(r.request().url());
      return r.abort();
    }
    return r.continue();
  });
  await page.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      characterLuck = () => 0.999999;
    });
  });
  await page.goto(url);
  // Explicitly retain rollback-editor regressions; default icon controls have their own suite.
  await page.evaluate(() => { reelWorkshopLayout = "legacy"; });
  await page.evaluate(() => {
    newRun("fighter", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    setupBattleOpening = () => {
      state.opening = null;
    };
    maybeVulnerable = () => false;
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
  });
  return page;
}

test("five unlocked starting classes, fixed temperaments and naturally built Mages; old healers preserve their build and gain one locked middle seal", async (t) => {
  const p = await game(t);
  const result = await p.evaluate(() => {
    const profile = emptyProfile();
    profile.owned = ["ranger", "berserker"];
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    chooseStartingClass();
    const starters = [...document.querySelectorAll("[data-start-job]")].map(
      (b) => b.dataset.startJob,
    );
    closeModal();
    const old = makeHero("Mira", "healer");
    old.job = "healer";
    old.hp = 12;
    old.points = 27;
    old.equipment = "prayerBell";
    old.reels[0][0] = { type: "class", tier: 1, weight: 7 };
    old.reels[1] = old.reels[1].filter((f) => f.type !== "class");
    state.party = [old];
    state.version = 15;
    save();
    const loaded = load(),
      h = state.party[0];
    return {
      starters,
      loaded,
      job: h.job,
      role: h.mageRole,
      hp: h.hp,
      points: h.points,
      specialism: h.specialism,
      weights: h.reels[0][0].weight,
      seals: h.reels.map((r) => r.filter((f) => f.type === "class").length),
      outer: h.reels[0][0].type,
    };
  });
  assert.deepEqual(result.starters, [
    "fighter",
    "rogue",
    "mage",
    "ranger",
    "berserker",
  ]);
  assert.equal(result.loaded, true);
  assert.equal(result.job, "mage");
  assert.equal(result.role, undefined);
  assert.equal(result.hp, 12);
  assert.equal(result.points, 27);
  assert.ok(["offence", "defence"].includes(result.specialism));
  assert.equal(result.weights, 1);
  assert.deepEqual(result.seals, [0, 1, 0]);
  assert.equal(result.outer, "blank");
  await p.evaluate(() => chooseStartingClass());
  await p.locator("#starter-specialism").selectOption("defence");
  assert.equal(await p.locator("#starter-role").count(), 0);
  await p.locator('[data-start-job="mage"]').click();
  assert.deepEqual(
    await p.evaluate(() => ({
      job: state.party[0].job,
      role: state.party[0].mageRole,
      specialism: state.party[0].specialism,
    })),
    { job: "mage", role: undefined, specialism: "defence" },
  );
});

test("downgrades refund one tier, repeated respecs cannot manufacture points, swaps choose their destination and class seals cannot be changed or copied", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 100;
    const face = h.reels[0][0];
    face.type = "attack";
    face.tier = 1;
    const initial = h.points;
    applyFaceEdit(h, 0, 0, "upgrade");
    applyFaceEdit(h, 0, 0, "upgrade");
    applyFaceEdit(h, 0, 0, "upgrade");
    const spent = initial - h.points;
    const refunds = [];
    while (face.tier > 1) {
      const before = h.points;
      applyFaceEdit(h, 0, 0, "weaken");
      refunds.push(h.points - before);
    }
    const afterRefund = h.points;
    applyFaceEdit(h, 0, 0, "upgrade");
    applyFaceEdit(h, 0, 0, "weaken");
    const afterLoop = h.points;
    const chosen = applyFaceEdit(h, 0, 0, "swap", "stun"),
      type = face.type,
      weight = face.weight;
    const j = h.reels[1].findIndex((f) => f.type === "class"),
      before = JSON.stringify(h.reels[1][j]),
      points = h.points;
    const sealActions = ["upgrade", "weaken", "cycle", "swap"].map((op) =>
      applyFaceEdit(h, 1, j, op, "attack"),
    );
    const copy = applyFaceEdit(h, 0, 0, "swap", "class");
    return {
      spent,
      refunds,
      afterRefund,
      afterLoop,
      chosen,
      type,
      weight,
      sealActions,
      copy,
      sealUnchanged:
        before === JSON.stringify(h.reels[1][j]) && points === h.points,
      seals: h.reels.map((r) => r.filter((f) => f.type === "class").length),
    };
  });
  assert.equal(r.spent, 28);
  assert.deepEqual(r.refunds, [7, 4, 2]);
  assert.ok(r.afterLoop < r.afterRefund);
  assert.equal(r.chosen, true);
  assert.equal(r.type, "stun");
  assert.equal(r.weight, 1);
  assert.deepEqual(r.sealActions, [false, false, false, false]);
  assert.equal(r.copy, false);
  assert.equal(r.sealUnchanged, true);
  assert.deepEqual(r.seals, [0, 1, 0]);
});

test("workshop exposes large explicit controls, keeps the selected face after edits, and portraits/point prompts open it while combat targeting remains available", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.party[0].points = 40;
    beginEncounter(false, { count: 1 });
    render();
  });
  await p.locator("#portrait-0").click();
  await p.locator('[data-editor-face="1"]').click();
  assert.match(
    await p.locator("[data-weaken]").textContent(),
    /get 2 pts back/,
  );
  const before = await p.evaluate(() => state.party[0].points);
  await p.locator("[data-weaken]").click();
  assert.equal(await p.evaluate(() => state.party[0].points), before + 2);
  await p.locator("#face-destination").selectOption("stun");
  await p.locator("#face-swap").click();
  assert.equal(await p.evaluate(() => state.party[0].reels[0][1].type), "stun");
  assert.equal(
    await p.locator('[data-editor-face="1"]').getAttribute("aria-pressed"),
    "true",
  );
  await p.locator('[data-editor-reel="1"]').click();
  await p.locator('[data-editor-face="6"]').click();
  assert.match(
    await p.locator('[data-class-seal="true"]').textContent(),
    /Permanent mark.*Cannot edit/,
  );
  assert.equal(await p.locator("#face-destination").count(), 0);
  await p.locator("#modal .primary[data-close]").click();
  assert.equal(await p.locator(".points-prompt").count(), 1);
  await p.locator(".points-prompt").click();
  assert.equal(await p.evaluate(() => modalKind), "editor");
});

test("temperament adds its relevant flat bonuses without editing face powers or odds", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const symbols = [
        { type: "attack", tier: 1 },
        { type: "heal", tier: 1 },
        { type: "block", tier: 1 },
      ],
      h = state.party[0],
      reels = JSON.stringify(h.reels);
    h.specialism = null;
    const neutral = await planHeroRoll(h, symbols);
    h.specialism = "offence";
    const attack = await planHeroRoll(h, symbols);
    h.specialism = "defence";
    const guard = await planHeroRoll(h, symbols);
    return {
      neutral: {
        attack: neutral.attack,
        heal: neutral.heal,
        block: neutral.block,
      },
      attack: { attack: attack.attack, heal: attack.heal, block: attack.block },
      guard: { attack: guard.attack, heal: guard.heal, block: guard.block },
      same: reels === JSON.stringify(h.reels),
    };
  });
  assert.equal(r.attack.attack, r.neutral.attack + 1);
  assert.equal(r.attack.heal, r.neutral.heal);
  assert.equal(r.guard.attack, r.neutral.attack);
  assert.equal(r.guard.heal, r.neutral.heal + 1);
  assert.equal(r.guard.block, r.neutral.block + 1);
  assert.equal(r.same, true);
});

test("Mage resonance echoes four rolled powers to the correct whole side; support marks do not spread ordinary damage", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const results = {};
    for (const role of ["heal", "block", "poison", "magic"]) {
      newRun("mage", { mageRole: role, specialism: "defence" });
      setPace("skip");
      setPreference("skipCriticals", true);
      state.party.push(makeHero("Ally", "fighter"));
      state.party.forEach((h) => (h.hp -= 10));
      const h = state.party[0];
      h.specialism = null;
      h.reels = [
        [{ type: role, tier: 1, weight: 1 }],
        [{ type: "class", job: "mage", tier: 1, weight: 1 }],
        [{ type: "blank", tier: 1, weight: 1 }],
      ];
      beginEncounter(false, { count: 2 });
      state.enemies.forEach((e) => {
        e.countdown = 99;
        e.hp = e.maxHp = 100;
        e.passive = null;
      });
      setEnemyBlock(0);
      render();
      const before = state.enemies.map((e) => e.hp),
        health = state.party.map((h) => h.hp);
      await spin(0);
      results[role] = {
        health: state.party.map((h, i) => h.hp - health[i]),
        damage: state.enemies.map((e, i) => before[i] - e.hp),
        poison: state.enemies.map((e) => e.poison?.turns || 0),
        block: state.block,
        area: state.lastPlayerRoll.area,
      };
    }
    return results;
  });
  assert.deepEqual(r.heal.health, [6, 4]);
  assert.deepEqual(r.heal.damage, [0, 0]);
  assert.equal(r.heal.block, 0);
  assert.equal(r.heal.area, false);
  assert.equal(r.block.block, 6);
  assert.deepEqual(r.block.health, [0, 0]);
  assert.ok(r.poison.poison.every((n) => n === 3));
  assert.ok(r.magic.damage.every((n) => n === 5));
});

test("Execute builds while other heroes act, scales with patience and missing enemy health, and consumes charge only on a damaging Ranger roll", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    const ranger = makeHero("Rowan", "ranger"),
      ally = state.party[0];
    state.party.push(ranger);
    beginEncounter(false, { count: 1 });
    state.enemy.hp = state.enemy.maxHp = 100;
    state.enemy.countdown = 99;
    setEnemyBlock(0);
    ranger.specialism = null;
    render();
    for (let n = 0; n < 6; n++) advanceRangerPatience(ally, false);
    const full = ranger.charge,
      fresh = executionBonus(ranger);
    state.enemy.hp = 25;
    const wounded = executionBonus(ranger);
    const base = await planHeroRoll(ranger, [
      { type: "attack", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "blank", tier: 1 },
    ]);
    const consumed = ranger.charge,
      record = state.lastExecution;
    advanceRangerPatience(ranger, false, true);
    const sealed = ranger.charge;
    clearBattleStatuses();
    return {
      full,
      fresh,
      wounded,
      damage: base.attack,
      consumed,
      record,
      sealed,
      cleared: ranger.charge,
    };
  });
  assert.equal(r.full, 6);
  assert.ok(r.wounded > r.fresh);
  assert.equal(r.damage, 1); // Stored Execute is a separate, non-critical hit.
  assert.equal(r.consumed, 0);
  assert.equal(r.record.bonus, r.wounded);
  assert.equal(r.sealed, 2);
  assert.equal(r.cleared, 0);
});

test("enemy block is one obvious shared consumable pool, including stun and piercing damage behaviour", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) => {
      e.hp = e.maxHp = 100;
      e.passive = null;
    });
    setEnemyBlock(9);
    render();
    const [a, b] = state.enemies,
      first = damageEnemy(5, "Fixture", a),
      after = enemyBlock(),
      second = damageEnemy(6, "Fixture", b),
      remainder = enemyBlock();
    gainEnemyBlock(3);
    const stun = stunEnemy(1, a),
      afterStun = enemyBlock();
    gainEnemyBlock(7);
    const piercing = damageEnemy(2, "Poison", b, { piercing: true });
    return {
      first,
      after,
      second,
      remainder,
      stun,
      afterStun,
      piercing,
      pool: enemyBlock(),
      copies: state.enemies.map((e) => e.block),
      label: $("#enemy-team-block").textContent,
    };
  });
  assert.equal(r.first, 0);
  assert.equal(r.after, 4);
  assert.equal(r.second, 2);
  assert.equal(r.remainder, 0);
  assert.match(r.stun, /blocked/);
  assert.equal(r.afterStun, 0);
  assert.equal(r.piercing, 2);
  assert.equal(r.pool, 7);
  assert.deepEqual(r.copies, [7, 7]);
  assert.match(r.label, /7.*TEAM BLOCK/);
});

test("Unbroken page blocks a whole multi-strike enemy turn without spending team block, then expires before the next enemy acts", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.party[0].specialism = null;
    state.party[0].hp = state.party[0].maxHp = 100;
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) => {
      e.damage = 8;
      e.strikes = 3;
      e.passive = null;
      e.affix = null;
      e.reels = [
        [{ type: "attack", tier: 1, weight: 1 }],
        [{ type: "attack", tier: 2, weight: 1 }],
        [{ type: "blank", tier: 1, weight: 1 }],
      ];
    });
    state.block = 5;
    state.bag = { aegis: 1 };
    render();
    await useItem("aegis");
    const protectedLabel = $("#block").textContent,
      canWaste = canUseItem("aegis");
    await enemyTurn(state.enemies[0]);
    const after = {
      hp: state.party[0].hp,
      block: state.block,
      ward: state.invulnerable,
      absorbed: state.party[0].stats.damageBlocked,
      rolls: state.lastEnemyRoll,
    };
    await enemyTurn(state.enemies[1]);
    return {
      protectedLabel,
      canWaste,
      after,
      nextHp: state.party[0].hp,
      used: state.bag.aegis || 0,
    };
  });
  assert.match(r.protectedLabel, /UNBROKEN PAGE/);
  assert.equal(r.canWaste, false);
  assert.equal(r.after.hp, 100);
  assert.equal(r.after.block, 5);
  assert.equal(r.after.ward, null);
  assert.ok(r.after.absorbed > 0);
  assert.ok(r.nextHp < 100);
  assert.equal(r.used, 0);
});

test("Pun-nishing Mode is cosmetic and persistent, gives each species a named pencil identity and makes the tenth guardian an angry dot", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 2 });
    render();
    const before = state.enemies.map((e) => ({
      hp: e.hp,
      maxHp: e.maxHp,
      damage: e.damage,
      reels: JSON.stringify(e.reels),
      frequency: e.frequency,
    }));
    const random = Math.random;
    let calls = 0;
    Math.random = () => {
      calls++;
      return 0.5;
    };
    setPreference("punMode", true);
    const names = state.enemies.map((e) => e.name),
      art = [...document.querySelectorAll(".enemy-art>svg")].map((e) =>
        e.getAttribute("class"),
      );
    const after = state.enemies.map((e) => ({
      hp: e.hp,
      maxHp: e.maxHp,
      damage: e.damage,
      reels: JSON.stringify(e.reels),
      frequency: e.frequency,
    }));
    Math.random = random;
    state.depth = 10;
    state.enemy.boss = true;
    applyEnemyPresentation(state.enemy);
    render();
    const boss = state.enemy.name,
      dot = !!document.querySelector(".species-pun-fullstop");
    save();
    load();
    return {
      before,
      after,
      names,
      art,
      calls,
      boss,
      dot,
      persisted: preferences().punMode,
      count: Object.keys(PUN_ENEMIES).length,
    };
  });
  assert.deepEqual(r.before, r.after);
  assert.equal(r.calls, 0);
  assert.ok(r.names.every((n) => typeof n === "string"));
  assert.ok(r.art.every((n) => n.includes("species-pun-")));
  assert.equal(r.boss, "THE FULL STOP");
  assert.equal(r.dot, true);
  assert.equal(r.persisted, true);
  assert.ok(r.count >= 25);
});

test("paired arrivals name and show both enemies, then transfer two portraits to their own combat targets", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("1");
    beginEncounter(false, { count: 2 });
    state.enemies[0].name = "First foe";
    state.enemies[1].name = "Second foe";
    render();
    window.arrival = encounterEntrance();
  });
  await p.waitForSelector("#stage-confirm:not(:disabled)");
  assert.equal(await p.locator("#entrance-art .entrance-member").count(), 2);
  assert.equal(
    await p.locator("#entrance-art .entrance-portrait>svg").count(),
    2,
  );
  assert.match(
    await p.locator("#stage-title").textContent(),
    /First foe & Second foe/,
  );
  await p.locator("#stage-confirm").click();
  assert.equal(await p.locator(".encounter-ghost").count(), 2);
  await p.evaluate(() => window.arrival);
  assert.equal(await p.locator(".encounter-ghost").count(), 0);
  assert.equal(
    await p.locator("#enemy-art").evaluate((e) => e.style.visibility),
    "",
  );
  assert.equal(
    await p.locator("#enemy-art-2").evaluate((e) => e.style.visibility),
    "",
  );
});

test("icon, beam and combined feedback modes are distinct, launch marks from reels in an arc and preserve an arrival burst when skipped", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    render();
    state.party[0].last = [
      { type: "attack", tier: 1 },
      { type: "attack", tier: 2 },
      { type: "heal", tier: 1 },
    ];
    const from = $("#portrait-0"),
      to = enemyArtEl(state.enemy),
      out = {};
    setPace("1");
    for (const mode of ["icons", "beams", "both"]) {
      document
        .querySelectorAll(".rolled-projectile,.fx-beam")
        .forEach((e) => e.remove());
      setPreference("combatEffects", mode);
      beam(from, to, "attack");
      const nodes = [...document.querySelectorAll(".rolled-projectile")];
      out[mode] = {
        icons: nodes.length,
        beams: document.querySelectorAll(".fx-beam").length,
        types: nodes.map((n) => n.dataset.symbol),
        frames: nodes[0]?.getAnimations()[0].effect.getKeyframes().length || 0,
      };
    }
    window.skippedArrivals = 0;
    new MutationObserver((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.classList?.contains("symbol-arrival")) window.skippedArrivals++;
        }),
      ),
    ).observe(document.body, { childList: true });
    setPreference("combatEffects", "icons");
    setPace("skip");
    beam(from, to, "attack");
    return out;
  });
  assert.equal(r.icons.icons, 2);
  assert.equal(r.icons.beams, 0);
  assert.deepEqual(r.icons.types, ["attack", "attack"]);
  assert.ok(r.icons.frames >= 10);
  assert.equal(r.beams.icons, 0);
  assert.equal(r.beams.beams, 1);
  assert.equal(r.both.icons, 2);
  assert.equal(r.both.beams, 1);
  await p.waitForFunction(() => window.skippedArrivals > 0);
  assert.ok(await p.evaluate(() => window.skippedArrivals >= 1));
});

test("damage and healing have readable totals plus offset unsummed sub-values which add to the real applied amount", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    beginEncounter(false, { count: 1 });
    state.currentHero = 0;
    state.party[0].last = [
      { type: "attack", tier: 1 },
      { type: "attack", tier: 2 },
      { type: "attack", tier: 3 },
    ];
    render();
    combatNumber(enemyArtEl(state.enemy), 11, "attack");
    const numbers = [...document.querySelectorAll(".combat-number")].map(
      (n) => ({
        value: Number(n.dataset.value),
        sum: n.dataset.summed,
        left: n.style.left,
        animation: getComputedStyle(n).animationName,
      }),
    );
    state.party[0].last = [
      { type: "heal", tier: 1 },
      { type: "heal", tier: 2 },
      { type: "blank", tier: 1 },
    ];
    combatNumber($("#portrait-0"), 5, "heal");
    return {
      numbers,
      heal: [...document.querySelectorAll(".combat-number.healing.minor")].map(
        (n) => Number(n.dataset.value),
      ),
    };
  });
  assert.equal(r.numbers.filter((n) => n.sum === "true")[0].value, 11);
  assert.equal(
    r.numbers.filter((n) => n.sum === "false").reduce((n, v) => n + v.value, 0),
    11,
  );
  assert.ok(new Set(r.numbers.map((n) => n.left)).size >= 3);
  assert.ok(r.numbers.every((n) => n.animation === "impact-number-rise"));
  assert.equal(
    r.heal.reduce((a, b) => a + b, 0),
    5,
  );
});

test("all normal and pun enemy cries play on both moods even under a full FX pool, without gameplay randomness", async (t) => {
  const p = await game(t);
  await p.locator("#options-tab").click();
  const r = await p.evaluate(async () => {
    setPreference("musicVolume", 0);
    setPreference("ambienceVolume", 0);
    await GameSound.unlock();
    const random = Math.random;
    let randomCalls = 0;
    Math.random = () => {
      randomCalls++;
      return 0.5;
    };
    const before = GameSound.stats.cries,
      normal = Object.keys(ENEMY_PROFILES),
      puns = Object.keys(PUN_ENEMIES);
    try {
      for (const id of [...normal, ...puns.map((n) => "pun-" + n)]) {
        GameSound.cry(id, "appear");
        GameSound.cry(id, "death");
      }
      return {
        delta: GameSound.stats.cries - before,
        expected: (normal.length + puns.length) * 2,
        randomCalls,
        peak: GameSound.stats.peakVoices,
      };
    } finally {
      Math.random = random;
    }
  });
  assert.equal(r.delta, r.expected);
  assert.equal(r.randomCalls, 0);
  assert.ok(r.peak <= 20);
});

test("wells have lower base healing and smaller critical multipliers; depth makes traps stronger and solo early-floor recruitment is slightly more likely", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.party[0].hp = 1;
    window.savedRandom = Math.random;
    Math.random = () => 0;
    window.well = wellEncounter({ event: "well" });
  });
  await p.locator("#well-use").click();
  await p.waitForSelector("#stage-confirm");
  const r = await p.evaluate(() => ({
    roll: state.lastWellRoll,
    trap1: trapPower(1),
    trap10: trapPower(10),
    solo: recruitChance(1, 0, 1),
    party: recruitChance(2, 0, 1),
  }));
  assert.equal(r.roll.multiplier, 1.25);
  assert.equal(r.roll.bonus, 3);
  assert.equal(r.roll.base[0].value, 12);
  assert.equal(r.roll.planned[0].value, 15);
  assert.ok(r.trap10 > r.trap1);
  assert.ok(r.trap10 > 2);
  assert.equal(r.solo, 0.55);
  assert.ok(Math.abs(r.party - 0.43) < 0.00001);
  await p.locator("#stage-confirm").click();
  await p.evaluate(async () => {
    await window.well;
    Math.random = window.savedRandom;
  });
  assert.equal(await p.evaluate(() => state.party[0].hp), 16);
});

test("declined adventurers can leave peacefully, offer confirmed gold, or become a real hostile encounter", async (t) => {
  const p = await game(t);
  const peaceful = await p.evaluate(async () => {
    const random = Math.random;
    Math.random = () => 0.9;
    try {
      await declinedRecruit(makeHero("Guest", "rogue"));
      return !state.enemy && state.logs[0];
    } finally {
      Math.random = random;
    }
  });
  assert.match(peaceful, /says goodbye/);
  await p.evaluate(() => {
    window.rng = Math.random;
    Math.random = () => 0.2;
    window.decline = declinedRecruit(makeHero("Gift giver", "mage"));
  });
  await p.waitForSelector("#stage-confirm");
  const gold = await p.evaluate(() => state.gold);
  await p.waitForTimeout(100);
  assert.equal(await p.locator("#spotlight").getAttribute("hidden"), null);
  await p.locator("#stage-confirm").click();
  await p.evaluate(async () => {
    await window.decline;
    Math.random = window.rng;
  });
  assert.equal(await p.evaluate(() => state.gold), gold + 6);
  await p.evaluate(() => {
    Math.random = () => 0;
    window.decline = declinedRecruit(makeHero("Angry guest", "fighter"));
  });
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.evaluate(() => state.enemy.hostileRecruit), true);
  assert.match(await p.locator("#stage-title").textContent(), /Angry guest/);
  await p.locator("#stage-confirm").click();
  await p.evaluate(async () => {
    await window.decline;
    Math.random = window.rng;
  });
});

test("workshop fits desktop, Deck and a compact screen without internal scrolling or hidden actions", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    await p.evaluate(() => {
      newRun("mage", { specialism: "defence", mageRole: "heal" });
      state.party[0].points = 40;
      render();
      editor(0);
    });
    await p.waitForTimeout(150);
    const r = await p.locator("#modal").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left,
        y: r.top,
        right: r.right,
        bottom: r.bottom,
        overflow: [...el.querySelectorAll("*")]
          .filter(
            (e) =>
              ["scroll", "auto"].includes(getComputedStyle(e).overflowY) &&
              e.scrollHeight > e.clientHeight + 2,
          )
          .map((e) => e.className),
      };
    });
    assert.ok(
      r.x >= -1 && r.right <= width + 1 && r.y >= -1 && r.bottom <= height + 1,
      `${width}: ${JSON.stringify(r)}`,
    );
    assert.deepEqual(r.overflow, []);
    const notice = await p.locator(".points-prompt").boundingBox(),
      health = await p.locator("#hero-0 .hp-info").boundingBox();
    assert.ok(
      notice.x + notice.width <= health.x,
      `${width}: point notice must not cover HP`,
    );
    if (width <= 760)
      await p.locator('[data-editor-operation="replace"]').click();
    assert.ok((await p.locator("#face-swap").boundingBox()).height >= 20);
    await p.evaluate(() => closeModal());
  }
});

test("class icons travel only to their own effect recipients and blocked player hits strike the common enemy shield before HP overflow", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    newRun("mage", { mageRole: "heal", specialism: "defence" });
    setPace("1");
    setPreference("combatEffects", "icons");
    beginEncounter(false, { count: 2 });
    state.enemies.forEach((e) => {
      e.hp = e.maxHp = 100;
      e.passive = null;
    });
    setEnemyBlock(3);
    const h = state.party[0];
    h.last = [
      { type: "attack", tier: 1 },
      { type: "class", job: "mage", mageRole: "heal", tier: 1 },
      { type: "heal", tier: 1 },
    ];
    render();
    const from = $("#portrait-0"),
      heal = effectSymbols(from, "heal").map((v) => v.symbol.type),
      attack = effectSymbols(from, "attack").map((v) => v.symbol.type);
    const n = damageEnemy(5, "Mage", state.enemy, {
      attacker: h,
      impact: { type: "attack" },
    });
    return {
      heal,
      attack,
      n,
      pool: enemyBlock(),
      targets: [...document.querySelectorAll(".rolled-projectile")].map(
        (n) => n.dataset.target,
      ),
    };
  });
  assert.deepEqual(r.heal, ["class", "heal"]);
  assert.deepEqual(r.attack, ["attack"]);
  assert.equal(r.n, 2);
  assert.equal(r.pool, 0);
  assert.ok(r.targets.includes("enemy-team-block"));
  assert.ok(r.targets.includes("enemy-art"));
});

test("instant-speed combat still has arriving icon pulses after the final UI redraw", async (t) => {
  const p = await game(t);
  await p.evaluate(async () => {
    setPreference("combatEffects", "icons");
    beginEncounter(false, { count: 1 });
    state.enemy.hp = state.enemy.maxHp = 200;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    setEnemyBlock(0);
    const h = state.party[0];
    h.reels = [
      [{ type: "attack", tier: 1, weight: 1 }],
      [{ type: "attack", tier: 2, weight: 1 }],
      [{ type: "blank", tier: 1, weight: 1 }],
    ];
    render();
    window.impactRecipients = [];
    new MutationObserver((records) =>
      records.forEach((r) =>
        r.addedNodes.forEach((n) => {
          if (n.classList?.contains("symbol-arrival"))
            window.impactRecipients.push(n.dataset.target);
        }),
      ),
    ).observe(document.body, { childList: true });
    await spin(0);
  });
  await p.waitForFunction(() => window.impactRecipients.includes("enemy-art"));
  assert.ok(await p.evaluate(() => particles.length > 0));
});

test("new workshop navigation is keyboard operable and the Mage seal has no selectable role", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    newRun("mage", { mageRole: "heal" });
    state.party[0].last[1] = {
      type: "class",
      job: "mage",
      mageRole: "heal",
      tier: 1,
    };
    editor(0);
  });
  await p.locator('[data-editor-reel="0"]').focus();
  await p.keyboard.press("ArrowRight");
  assert.equal(
    await p.locator('[data-editor-reel="1"]').getAttribute("aria-selected"),
    "true",
  );
  await p.locator('[data-editor-face="0"]').focus();
  await p.keyboard.press("ArrowDown");
  assert.equal(
    await p.locator('[data-editor-face="1"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await p.locator("#mage-role").count(), 0);
  assert.equal(
    await p.evaluate(
      () => state.party[0].reels[1].find((f) => f.type === "class").mageRole,
    ),
    undefined,
  );
  await p.evaluate(() => {
    closeModal();
    beginEncounter(false, { count: 1 });
    setPreference("punMode", true);
    optionsPage("play");
  });
  await p.locator("#option-reset").click();
  assert.equal(
    await p.evaluate(() => state.enemy.name === state.enemy.baseName),
    true,
  );
});
