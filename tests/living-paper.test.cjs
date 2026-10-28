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

test("Mage recovery grows modestly after level four and fountains receive a small depth-strengthened recovery increase", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => ({
    mage: [1, 4, 5, 7, 10, 20].map((level) => ({
      level,
      heal: classHealingPower({ job: "mage", level }, 24),
    })),
    tank: classHealingPower({ job: "fighter", level: 10 }, 24),
    wells: Array.from({ length: 10 }, (_, i) => ({
      floor: i + 1,
      base: fountainBaseRate(i + 1),
      roll: fountainRollRate(i + 1),
    })),
  }));
  assert.deepEqual(
    r.mage.map((h) => h.heal),
    [24, 24, 25, 26, 28, 28],
  );
  assert.equal(r.tank, 24);
  for (const f of r.wells) {
    const d = f.floor - 1;
    assert.ok(f.base >= 0.165 + d * 0.007 - 1e-9);
    assert.ok(f.roll >= 0.5 + d * 0.018 - 1e-9);
    if (f.floor <= 4) assert.ok(Math.abs(f.base - (0.165 + d * 0.007)) < 1e-9);
  }
  assert.ok(Math.abs(r.wells[9].base - 0.252) < 1e-9);
  assert.ok(Math.abs(r.wells[9].roll - 0.752) < 1e-9);
});

test("a late Mage's actual heal restores the advertised extra HP", async (t) => {
  const p = await game(t);
  await fight(p, ["mage"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.level = 10;
    h.maxHp = 100;
    h.hp = 1;
    const real = runMachine;
    runMachine = (id, reels, opts) =>
      real(
        id,
        reels,
        id === "hero-0"
          ? {
              results: [
                { type: "heal", tier: 4 },
                { type: "blank", tier: 1 },
                { type: "blank", tier: 1 },
              ],
            }
          : opts,
      );
    await spin(0);
    return { hp: h.hp, healing: h.stats.healingDone };
  });
  assert.deepEqual(r, { hp: 10, healing: 9 });
});

test("an empty-bar Ranger seal fires its own shot and is recognised as solo offence", async (t) => {
  const p = await game(t);
  await fight(p, ["ranger"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.reels = [
      [{ type: "blank", tier: 1 }],
      [{ type: "class", job: "ranger", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    const score = autoOffenceScore(h);
    await spin(0);
    return {
      score,
      hp: state.enemy.hp,
      charge: h.charge,
      last: state.lastPlayerRoll.actualDamage,
    };
  });
  assert.ok(r.score > 0);
  assert.equal(r.hp, 998);
  assert.equal(r.charge, 0);
  assert.equal(r.last, 2);
});

test("full patience plus Execute pays separate capped damage, with no critical squaring or final-boss one-shot", async (t) => {
  const p = await game(t);
  await fight(p, ["ranger"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0];
    h.level = 10;
    h.charge = 6;
    state.enemy.maxHp = state.enemy.hp = 205;
    const real = runMachine;
    runMachine = (id, reels, opts) =>
      real(
        id,
        reels,
        id === "hero-0"
          ? {
              results: [
                { type: "attack", tier: 4 },
                { type: "class", job: "ranger", tier: 1 },
                { type: "attack", tier: 4 },
              ],
            }
          : opts,
      );
    criticalPool = () => [4];
    await spin(0);
    return {
      hits: state.lastPlayerRoll.hits,
      damage: state.lastPlayerRoll.actualDamage,
      execution: state.lastExecution,
      charge: h.charge,
      hp: state.enemy.hp,
    };
  });
  assert.equal(r.execution.bonus, 17);
  assert.equal(r.execution.actual, 17);
  assert.equal(r.damage, 69);
  assert.equal(r.hp, 136);
  assert.equal(r.charge, 0);
  assert.deepEqual(
    r.hits.map((h) => h.actual),
    [13, 39, 17],
  );
  assert.equal(r.hits.at(-1).execute, true);
});

test("wounded targets reward patience while Execute stays within its level budget", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() =>
    Array.from({ length: 10 }, (_, n) => {
      const h = { job: "ranger", level: n + 1, charge: 6 };
      return {
        level: n + 1,
        healthy: executionBonus(h, { hp: 205, maxHp: 205 }),
        wounded: executionBonus(h, { hp: 100, maxHp: 205 }),
        seal: executionBonus(h, { hp: 100, maxHp: 205 }, 6, true),
        cap: executionBonus(h, { hp: 0, maxHp: 205 }, 6, true),
      };
    }),
  );
  for (const row of r) {
    assert.ok(row.wounded > row.healthy);
    assert.ok(row.seal > row.wounded);
    assert.ok(row.cap <= 12 + row.level * 3);
    assert.ok(row.seal < 100);
  }
});

test("patience charges between party actions and once per whole enemy turn, never per strike", async (t) => {
  const p = await game(t);
  await fight(p, ["ranger", "fighter"]);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      e = state.enemy;
    h.charge = 0;
    advanceRangerPatience(state.party[1], false);
    const first = h.charge;
    advanceRangerPatience(h, true);
    const spent = h.charge;
    h.charge = 0;
    e.strikes = 3;
    e.reels = [0, 1, 2].map(() => [{ type: "blank", tier: 1 }]);
    await enemyTurn(e);
    const enemy = h.charge;
    advanceRangerPatience(h, false);
    const support = h.charge;
    for (let k = 0; k < 8; k++) advanceRangerEnemyTurn();
    return { first, spent, enemy, support, full: h.charge };
  });
  assert.deepEqual(r, { first: 2, spent: 2, enemy: 1, support: 3, full: 6 });
});

test("only a simultaneous Wildcard and filled Trick bar launches the jack-in-the-box", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  const r = await p.evaluate(async () => {
    let calls = 0;
    jackInTheBoxFX = async () => {
      calls++;
    };
    jesterWildcard = async () => {};
    const real = runMachine;
    let rolls = [
      { type: "trick", tier: 1 },
      { type: "class", job: "jester", tier: 1 },
      { type: "attack", tier: 1 },
    ];
    runMachine = (id, reels, opts) =>
      real(id, reels, id === "hero-0" ? { results: rolls } : opts);
    state.party[0].anticipation = 5;
    await spin(0);
    const first = calls;
    state.party[0].anticipation = 0;
    await spin(0);
    const second = calls;
    state.party[0].anticipation = 5;
    rolls = [
      { type: "trick", tier: 1 },
      { type: "blank", tier: 1 },
      { type: "attack", tier: 1 },
    ];
    await spin(0);
    return {
      first,
      second,
      third: calls,
      shots: state.lastPunchline.shots.length,
    };
  });
  assert.deepEqual(r, { first: 1, second: 1, third: 1, shots: 6 });
});

test("the drawn spring crosses from the machine to its target, consumes no gameplay RNG and cleans up on restart", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  await p.evaluate(() => {
    setPace("1");
    window.fxRandomCalls = 0;
    Math.random = () => {
      window.fxRandomCalls++;
      return 0.5;
    };
    window.box = jackInTheBoxFX(state.party[0], state.enemy);
  });
  await p.waitForSelector(".jack-in-the-box[data-progress]");
  await p.waitForFunction(
    () =>
      Number(document.querySelector(".jack-in-the-box")?.dataset.progress) >
      0.3,
  );
  const r = await p.evaluate(() => ({
    path: document.querySelector(".jack-spring").getAttribute("d"),
    target: document.querySelector(".jack-in-the-box").dataset.target,
    calls: window.fxRandomCalls,
    enemy: state.enemy.id,
  }));
  assert.equal(r.calls, 0);
  assert.equal(r.target, r.enemy);
  assert.ok(r.path.split(" L").length >= 20);
  await p.evaluate(async () => {
    newRun("fighter");
    await window.box;
  });
  assert.equal(await p.locator(".jack-in-the-box").count(), 0);
});

test("Skip retains a Punchline burst without creating a spring overlay", async (t) => {
  const p = await game(t);
  await fight(p, ["jester"]);
  const r = await p.evaluate(async () => {
    let bursts = 0;
    const real = burst;
    burst = (el, kind, n) => {
      if (kind === "jester") bursts++;
      return real(el, kind, n);
    };
    await jackInTheBoxFX(state.party[0], state.enemy);
    return {
      bursts,
      boxes: document.querySelectorAll(".jack-in-the-box").length,
    };
  });
  assert.ok(r.bursts >= 2);
  assert.equal(r.boxes, 0);
});

test("status motes keep their tooltip badges, enemy species idle differently, and the movement slider stops them", async (t) => {
  const p = await game(t);
  await fight(p, ["mage"]);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.poison = { turns: 3, damage: 1 };
    h.stimulant = { turns: 3, power: 3 };
    state.enemy.art = "ghost";
    render();
    const before = {
      motes: document.querySelectorAll("#portrait-0 .status-motes").length,
      poison: document.querySelector("#portrait-0 .poison-badge").dataset
        .tooltip,
      buff: document.querySelector("#portrait-0 .buff-badge").dataset.tooltip,
      idle: document.querySelector(".enemy-box").dataset.idle,
      animation: getComputedStyle(document.querySelector(".enemy-art>svg"))
        .animationName,
    };
    setPreference("portraitMotion", 0);
    return {
      before,
      after: getComputedStyle(document.querySelector(".enemy-art>svg"))
        .animationName,
      motes: getComputedStyle(document.querySelector(".status-motes")).display,
    };
  });
  assert.equal(r.before.motes, 2);
  assert.match(r.before.poison, /3 more turns/);
  assert.match(r.before.buff, /3\/3 turns/);
  assert.equal(r.before.idle, "float");
  assert.match(r.before.animation, /float/);
  assert.equal(r.after, "none");
  assert.equal(r.motes, "none");
});

test("all equipped run treasures keep their full rules accessible and text inside fixed cards", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 844],
  ]) {
    await p.setViewportSize({ width, height });
    const bad = await p.evaluate(async () => {
      const failures = [];
      for (const def of [...ARTEFACT_TYPES, null]) {
        state.artefacts = def
          ? [
              {
                ...def,
                id: "test",
                name: def.name + " · IV",
                power: 99,
                depth: 10,
              },
            ]
          : [];
        state.equippedArtefact = def ? "test" : null;
        render();
        fitNotebook();
        await document.fonts.ready;
        const el = document.querySelector("#artefact-slot"),
          bounds = el.getBoundingClientRect();
        for (const node of el.querySelectorAll("b,small,em")) {
          const range = document.createRange();
          range.selectNodeContents(node);
          const r = range.getBoundingClientRect();
          if (
            r.bottom > bounds.bottom + 1 ||
            r.right > bounds.right + 1 ||
            r.left < bounds.left - 1
          )
            failures.push({
              name: def?.name,
              text: node.textContent,
              width: innerWidth,
              rect: { top: r.top, bottom: r.bottom, right: r.right },
              bounds: {
                top: bounds.top,
                bottom: bounds.bottom,
                right: bounds.right,
                height: bounds.height,
              },
              font: getComputedStyle(node).fontSize,
              line: getComputedStyle(node).lineHeight,
              margin: getComputedStyle(node).margin,
              span: el.querySelector("span").getBoundingClientRect().toJSON(),
            });
        }
        if (!el.dataset.tooltip) failures.push("missing rules");
      }
      return failures;
    });
    assert.deepEqual(bad, [], width + "px");
  }
});

test("heavy enemy attacks anticipate each strike and blackout uses its own portrait pose", async (t) => {
  const p = await game(t);
  await fight(p, ["mage"]);
  const r = await p.evaluate(async () => {
    const e = state.enemy,
      h = state.party[0],
      trace = [];
    h.hp = h.maxHp = 100;
    e.boss = true;
    e.strikes = 2;
    e.damage = 1;
    e.reels = [
      [{ type: "attack", tier: 1 }],
      [{ type: "blank", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    enemyWindup = async () => trace.push("windup");
    const realDamage = damageHero;
    damageHero = (...args) => {
      trace.push("damage");
      return realDamage(...args);
    };
    await enemyTurn(e);
    let passivePose = false;
    const realMotion = portraitMotion;
    portraitMotion = (el, kind, enemy) => {
      if (kind === "passive" && enemy) passivePose = true;
      return realMotion(el, kind, enemy);
    };
    pencilBlackout(e);
    syncEnemy(e);
    const retained = enemyArtEl(e)
      .querySelector(":scope > svg")
      .getAnimations()
      .some((a) => a.portraitMotion);
    return { trace, passivePose, retained, covered: h.blackout.length };
  });
  assert.deepEqual(r.trace, ["windup", "damage", "windup", "damage"]);
  assert.equal(r.passivePose, true);
  assert.equal(r.retained, true);
  assert.equal(r.covered, 2);
});
