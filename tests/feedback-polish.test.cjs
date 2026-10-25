const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
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
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
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
  await p.addInitScript(() => {
    window.addEventListener("DOMContentLoaded", () => {
      characterLuck = () => 0.999999;
    });
  });
  await p.goto(url);
  await p.evaluate(async () => {
    newRun("fighter");
    setPace("skip");
    setPreference("skipCriticals", true);
    await document.fonts.ready;
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, [], "no runtime errors");
  });
  return p;
}

test("critical rolls reuse a fixed original-value readout, pulse to the final number, and never insert calculation boxes", async (t) => {
  const p = await game(t);
  await p.addStyleTag({
    content: "#stage-card {animation:none!important;transition:none!important}",
  });
  await p.evaluate(() => {
    setPace("1");
    setPreference("shake", 0);
    setPreference("skipCriticals", false);
    window.crit = rollCritical(
      "Test",
      [0, 1, 2].map(() => ({ type: "attack", tier: 1 })),
      false,
      { details: [{ icon: "sword", value: 12, label: "Damage" }] },
    );
  });
  await p.waitForSelector("#machine-critical.rolling");
  const before = await p.evaluate(() => {
    window.valueNode = document.querySelector("#critical-result strong");
    const r = valueNode.getBoundingClientRect();
    return {
      value: valueNode.textContent,
      rect: [r.x, r.y, r.width, r.height],
    };
  });
  assert.equal(before.value, "12");
  assert.equal(await p.locator("#critical-math").count(), 0);
  await p.locator("#stage-skip").click();
  await p.waitForSelector(".critical-locked");
  const result = await p.evaluate(() => {
    const n = document.querySelector("#critical-result strong"),
      r = n.getBoundingClientRect();
    return {
      same: n === valueNode,
      value: Number(n.textContent),
      original: Number(n.parentElement.dataset.before),
      total: Number(n.parentElement.dataset.after),
      rect: [r.x, r.y, r.width, r.height],
      effects: state.lastCritical,
    };
  });
  assert.equal(result.same, true);
  assert.equal(result.original, 12);
  assert.equal(result.value, result.total);
  assert.equal(result.value, Math.ceil(12 * result.effects.multiplier));
  assert.equal(await p.locator("#critical-result .stage-result").count(), 0);
  await p.locator("#stage-skip").click();
  await p.evaluate(() => window.crit);
});

test("chest and battle-skull art stay centred and reward criticals retain their original sheet with a blank reserved region", async (t) => {
  const p = await game(t);
  await p.addStyleTag({
    content: "#stage-card {animation:none!important;transition:none!important}",
  });
  for (const [source, width] of [
    ["chest", 1920],
    ["battle", 1920],
    ["chest", 390],
    ["battle", 320],
  ]) {
    await p.setViewportSize({ width, height: width > 760 ? 1080 : 844 });
    await p.evaluate((source) => {
      setPace("1");
      setPreference("shake", 0);
      setPreference("skipCriticals", false);
      const real = runMachine;
      window.restoreMachine = real;
      runMachine = (id, reels, options = {}) =>
        real(
          id,
          reels,
          id === "treasure"
            ? { results: [0, 1, 2].map(() => ({ type: "coin", tier: 1 })) }
            : options,
        );
      busy = true;
      window.loot = treasureRoll(source);
      window.sheet = document.querySelector("#stage-card");
    }, source);
    await p.waitForSelector("#machine-treasure.rolling");
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => {
      const a = document.querySelector(".trap-art svg").getBoundingClientRect(),
        b = document.querySelector(".scene-layout").getBoundingClientRect(),
        blank = document.querySelector("#event-critical");
      return {
        offset: a.left + a.width / 2 - (b.left + b.width / 2),
        empty: blank.childElementCount,
        border: getComputedStyle(blank).borderWidth,
      };
    });
    assert.ok(Math.abs(r.offset) < 1, JSON.stringify(r));
    assert.equal(r.empty, 0);
    assert.equal(r.border, "0px");
    await p.locator("#stage-skip").click();
    await p.waitForSelector("#machine-critical.rolling");
    assert.equal(
      await p.evaluate(
        () => document.querySelector("#stage-card") === window.sheet,
      ),
      true,
    );
    assert.equal(await p.locator("#critical-math").count(), 0);
    const rows = await p.evaluate(() => {
      const rect = (selector) =>
        document.querySelector(selector).getBoundingClientRect();
      return {
        lootCaption: rect("#machine-treasure .machine-footnote").bottom,
        criticalTitle: rect(".inline-critical-title").top,
        titleBottom: rect(".inline-critical-title").bottom,
        multiplier: rect("#machine-critical").top,
        readout: rect(".critical-summary").top,
      };
    });
    assert.ok(
      rows.lootCaption <= rows.criticalTitle - 1 &&
        rows.titleBottom <= Math.min(rows.multiplier, rows.readout) + 1,
      `${width}px ${source}: loot and critical rows stay separate: ${JSON.stringify(rows)}`,
    );
    await p.locator("#stage-skip").click();
    await p.waitForSelector("#stage-confirm");
    await p.locator("#stage-confirm").click();
    await p.evaluate(async () => {
      await window.loot;
      runMachine = window.restoreMachine;
      busy = false;
    });
  }
});

test("Berserker starts with more healing and Bloodrush heals its caster while a different ally remains the selected target", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("berserker", { specialism: "offence" });
    setPace("skip");
    setPreference("skipCriticals", true);
    const h = state.party[0],
      heals = h.reels.map(
        (reel) => reel.filter((f) => f.type === "heal").length,
      );
    state.party.push(makeHero("Mira", "mage"));
    state.party[1].hp = 2;
    state.target = 1;
    beginEncounter(false, { count: 1 });
    state.opening = null;
    h.initiative = null;
    const e = state.enemy;
    e.hp = e.maxHp = 1000;
    e.countdown = 99;
    e.passive = null;
    h.hp = 8;
    h.reels = [
      [{ type: "blank", tier: 1 }],
      [{ type: "class", tier: 1, job: "berserker" }],
      [{ type: "blank", tier: 1 }],
    ];
    render();
    await spin(0);
    return {
      heals,
      hp: h.hp,
      ally: state.party[1].hp,
      self: state.lastPlayerRoll.selfHealing,
      bar: h.fury,
      leech: state.lastPlayerRoll.actualLifesteal,
      furySpent: state.lastLifesteal.furySpent,
    };
  });
  assert.deepEqual(r.heals, [2, 2, 2]);
  assert.equal(r.ally, 2);
  assert.equal(r.self, 4);
  assert.equal(r.bar, 4 - r.furySpent);
  assert.ok(r.hp >= 12);
  assert.ok(r.leech > 0);
});

test("Fury lifesteal waits for outgoing damage symbols, returns healing from the victim and applies only real unblocked damage", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    newRun("berserker", { specialism: "offence" });
    setPace("1");
    setPreference("skipCriticals", true);
    setPreference("combatEffects", "icons");
    const h = state.party[0];
    h.hp = 10;
    beginEncounter(false, { count: 1 });
    state.opening = null;
    h.initiative = null;
    h.fury = 20;
    h.reels = [
      [{ type: "attack", tier: 2 }],
      [{ type: "blank", tier: 1 }],
      [{ type: "blank", tier: 1 }],
    ];
    state.enemy.hp = state.enemy.maxHp = 1000;
    state.enemy.countdown = 99;
    state.enemy.passive = null;
    render();
    window.attack = spin(0);
  });
  await p.waitForSelector('.rolled-projectile[data-target="enemy-art"]');
  assert.equal(
    await p.locator('.rolled-projectile[data-effect="lifesteal"]').count(),
    0,
  );
  assert.equal(await p.evaluate(() => state.party[0].hp), 10);
  await p.waitForSelector(
    '.rolled-projectile[data-effect="lifesteal"][data-target="portrait-0"]',
  );
  assert.equal(
    await p.evaluate(() => state.party[0].hp),
    10,
    "healing waits for the returning mark",
  );
  await p.evaluate(() => window.attack);
  const r = await p.evaluate(() => ({
    h: state.party[0].hp,
    drain: state.lastLifesteal,
    hits: state.lastPlayerRoll.actualDamage,
  }));
  assert.equal(r.drain.actual, Math.ceil(r.hits * 0.225));
  assert.equal(r.h, 10 + r.drain.actual);
  assert.ok(
    r.drain.healedAt > r.drain.returnStartedAt &&
      r.drain.returnStartedAt >= r.drain.outboundArrivedAt,
  );
  const blocked = await p.evaluate(async () => {
    setPace("skip");
    const h = state.party[0];
    h.hp = 10;
    setEnemyBlock(100);
    await spin(0);
    return {
      hp: h.hp,
      drain: state.lastPlayerRoll.actualLifesteal,
      damage: state.lastPlayerRoll.actualDamage,
    };
  });
  assert.deepEqual(blocked, { hp: 10, drain: 0, damage: 0 });
});

test("poison has purple POISON callouts on both sides and healing/poison never consume Vulnerable", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter(false, { count: 1 });
    state.opening = null;
    state.actionSerial = 5;
    const h = state.party[0],
      e = state.enemy;
    h.hp = 15;
    h.vulnerable = { createdAction: 0, bonus: 0.25 };
    e.vulnerable = { createdAction: 0, bonus: 0.25 };
    e.passive = null;
    h.poison = { turns: 3, damage: 1, appliedAt: 0, sourceName: "Test" };
    e.poison = { turns: 3, damage: 1, appliedAt: 0, sourceName: "Test" };
    render();
    const seenLabels = [],
      seenKinds = [];
    const observer = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (node.matches?.('.combat-number[data-kind="poison"]')) {
            seenLabels.push(node.querySelector(".poison-label")?.textContent);
            seenKinds.push(node.dataset.target);
          }
        }
    });
    observer.observe(document.body, { childList: true });
    healHero(0, 3);
    const hp = h.hp,
      enemy = e.hp;
    await tickPoison();
    observer.disconnect();
    return {
      heroLoss: hp - h.hp,
      enemyLoss: enemy - e.hp,
      heroVuln: !!h.vulnerable,
      enemyVuln: !!e.vulnerable,
      labels: seenLabels,
      kinds: seenKinds,
      allFloats: [...document.querySelectorAll(".combat-float")].map((n) => ({
        text: n.textContent,
        classes: n.className,
      })),
      falseHit: [...document.querySelectorAll(".combat-callout")].some(
        (n) => n.textContent === "VULNERABLE HIT!",
      ),
    };
  });
  assert.equal(r.heroLoss, 1);
  assert.equal(r.enemyLoss, 1);
  assert.equal(r.heroVuln, true);
  assert.equal(r.enemyVuln, true);
  assert.equal(r.falseHit, false);
  assert.deepEqual(r.labels, ["POISON", "POISON"], JSON.stringify(r));
  assert.deepEqual(r.kinds, ["portrait-0", "enemy-art"]);
});

test("Graphite blackouts poof into each covered reel and poof away when that hero rolls them clear", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.depth = 6;
    beginEncounter(true, { stairBoss: true, count: 1 });
    const real = smokePoof,
      smoke = [];
    smokePoof = (el, big) => {
      smoke.push(el?.dataset.reel);
      real(el, big);
    };
    pencilBlackout(state.enemy);
    const count = state.party[0].blackout.length,
      formed = document.querySelectorAll(".blackout-forming").length;
    clearRolledBlackout(state.party[0], 0);
    return {
      count,
      formed,
      smoke: smoke.length,
      cleared: state.party[0].blackout.length,
    };
  });
  assert.ok(r.count > 0);
  assert.equal(r.formed, r.count);
  assert.equal(r.smoke, 2 * r.count);
  assert.equal(r.cleared, 0);
});

test("automated dual encounters receive a reading hold and an arrival hold at Skip without an early combat action", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    setPace("skip");
    setAutoresolve(true);
    beginEncounter(false, { count: 2 });
    state.opening = null;
    window.watch = {
      offered: 0,
      confirmed: 0,
      closed: 0,
      ready: 0,
      spinsAtReady: 0,
      firstSpin: 0,
    };
    const layer = document.querySelector("#spotlight");
    new MutationObserver(() => {
      if (
        !watch.offered &&
        !layer.hidden &&
        document.querySelector("#stage-confirm")
      )
        watch.offered = performance.now();
      if (watch.offered && layer.hidden && !watch.closed)
        watch.closed = performance.now();
    }).observe(layer, { attributes: true, childList: true, subtree: true });
    document.addEventListener(
      "click",
      (event) => {
        if (event.target.id === "stage-confirm")
          watch.confirmed = performance.now();
      },
      true,
    );
    const realSpin = spin;
    spin = (i) => {
      watch.firstSpin ||= performance.now();
      return realSpin(i);
    };
    window.intro = (async () => {
      busy = true;
      await encounterEntrance();
      watch.ready = performance.now();
      watch.spinsAtReady = state.party[0].stats.spins;
      busy = false;
    })();
  });
  await p.waitForFunction(() => window.watch.ready > 0, null, {
    timeout: 15000,
  });
  const r = await p.evaluate(() => {
    setAutoresolve(false);
    setPace("5");
    const five = automaticReadDelay("enemy-intro");
    setPace("skip");
    return {
      ...watch,
      delay: automaticReadDelay("enemy-intro"),
      opening: automaticReadDelay("opening"),
      five,
      skip: automaticReadDelay("enemy-intro"),
    };
  });
  assert.ok(r.confirmed - r.offered >= r.delay - 20, JSON.stringify(r));
  assert.ok(r.ready - r.closed >= r.opening - 20, JSON.stringify(r));
  assert.equal(r.spinsAtReady, 0);
  if (r.firstSpin) assert.ok(r.firstSpin >= r.ready);
  assert.equal(r.five, r.skip);
});

test("bridge terrain keeps the same opacity before visiting and after resolving a discovery, and uses the ordinary river pattern", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const ids = [pos(3, 3), pos(4, 3), pos(5, 3)];
    ids.forEach((i, k) =>
      Object.assign(state.map[i], {
        wall: false,
        seen: true,
        terrain: "bridge",
        event: null,
        feature: k === 2 ? "treasure" : k === 1 ? "bridge" : null,
        visited: k > 0,
        corpses: [],
      }),
    );
    renderMap();
    const styles = ids.map((i) => {
      const el = document.querySelector(`[data-tile="${i}"]`);
      return {
        opacity: getComputedStyle(el.querySelector(".bridge-layer svg"))
          .opacity,
        background: getComputedStyle(el).backgroundImage,
        used: el.dataset.state,
      };
    });
    const probe = document.createElement("div");
    probe.innerHTML = icon("bridge") + icon("river");
    return {
      styles,
      same:
        probe
          .querySelector(".bridge-water path:last-child")
          .getAttribute("d") ===
        probe.querySelector("svg:last-child path:last-child").getAttribute("d"),
    };
  });
  assert.ok(r.styles.every((s) => s.opacity === "1"));
  assert.equal(new Set(r.styles.map((s) => s.background)).size, 1);
  assert.deepEqual(
    r.styles.map((s) => s.used),
    ["empty", "empty", "used"],
  );
  assert.equal(r.same, true);
});

test("workshop explanatory text and Done stay below all edits, including long class descriptions and compact operation pages", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    for (const job of ["mage", "berserker", "jester"]) {
      await p.evaluate((job) => {
        newRun(job);
        state.party[0].points = 60;
        editor(0);
        editorSelection.reel = 1;
        editorSelection.face = 6;
        editor(0);
      }, job);
      await p.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      await p.evaluate(async () => {
        await Promise.all(
          document
            .querySelector("#modal-title")
            .getAnimations()
            .map((a) => a.finished.catch(() => {})),
        );
      });
      const result = await p.evaluate(() => {
        const title = document.querySelector("#modal-title"),
          range = document.createRange();
        range.selectNodeContents(title);
        const text = range.getBoundingClientRect(),
          close = document
            .querySelector("#modal .close")
            .getBoundingClientRect();
        const headerClear =
          text.bottom <= close.top ||
          text.top >= close.bottom ||
          text.right <= close.left - 1;
        const note = document
            .querySelector(".workshop-note")
            .getBoundingClientRect(),
          footer = document
            .querySelector("#modal .modal-actions")
            .getBoundingClientRect(),
          controls = [...document.querySelectorAll(".workshop-detail")]
            .filter((e) => getComputedStyle(e).visibility === "visible")
            .flatMap((e) => [
              e,
              ...e.querySelectorAll(
                "button, select, .face-effect, [data-class-seal]",
              ),
            ])
            .filter((e) => e.getClientRects().length)
            .map((e) => e.getBoundingClientRect().bottom);
        const seal = document.querySelector("[data-class-seal]"),
          detail = document.querySelector(".workshop-detail");
        return {
          headerClear,
          meaningful: !document
            .querySelector("#modal")
            .textContent.includes("undefined"),
          sealFits:
            seal.getBoundingClientRect().bottom <=
            detail.getBoundingClientRect().bottom + 1,
          note: note.top,
          noteBottom: note.bottom,
          footer: footer.top,
          controls: Math.max(...controls),
        };
      });
      assert.equal(
        result.meaningful,
        true,
        `${width} ${job}: class summary is defined`,
      );
      assert.ok(
        result.headerClear,
        `${width} ${job}: close button clears title`,
      );
      assert.ok(
        result.sealFits,
        `${width} ${job}: class seal stays inside the edit panel`,
      );
      assert.ok(
        result.note >= result.controls - 1 &&
          result.footer >= result.noteBottom - 1,
        `${width} ${job}: ${JSON.stringify(result)}`,
      );
      await p.evaluate(() => closeModal());
    }
  }
});

test("Autoplay's event reading clock pauses for side pages and a manual click still confirms immediately", async (t) => {
  const p = await game(t);
  const initial = await p.evaluate(() => {
    setPace("1");
    busy = true;
    showSpotlight(
      "A beacon",
      "The lantern waits.",
      '<div class="stage-art">' + icon("beacon") + "</div>",
      "beacon",
    );
    window.choice = eventChoice([
      { id: "stage-confirm", label: "Wake the beacon", value: true },
    ]);
    setAutoplay(true);
    const immediate = autoplayPrompt();
    window.readStart = automaticReading.shownAt;
    document.querySelector("#options-tab").click();
    window.pausedStart = performance.now();
    return immediate;
  });
  assert.equal(initial, false);
  await p.waitForTimeout(150);
  const r = await p.evaluate(() => {
    const pause = performance.now() - window.pausedStart;
    closeUtilityPage();
    const shifted = automaticReading.shownAt - window.readStart;
    const button = document.querySelector("#stage-confirm"),
      enabled = !button.disabled;
    const started = performance.now();
    button.click();
    const elapsed = performance.now() - started;
    setAutoplay(false);
    return {
      pause,
      shifted,
      enabled,
      elapsed,
      required: automaticReadDelay("reward"),
    };
  });
  assert.equal(r.enabled, true);
  assert.ok(r.shifted >= r.pause - 10, JSON.stringify(r));
  assert.ok(r.elapsed < r.required);
  assert.equal(await p.evaluate(() => window.choice), "true");
  await p.evaluate(() => {
    closeSpotlight();
    busy = false;
  });
});

test("Fury returns the same modest healing in beam-only and combined feedback modes", async (t) => {
  const p = await game(t);
  for (const mode of ["beams", "both"]) {
    const r = await p.evaluate(async (mode) => {
      newRun("berserker", { specialism: "offence" });
      setPace("skip");
      setPreference("combatEffects", mode);
      const h = state.party[0];
      beginEncounter(false, { count: 1 });
      state.opening = null;
      h.initiative = null;
      h.hp = 10;
      h.fury = 20;
      h.reels = [
        [{ type: "attack", tier: 2 }],
        [{ type: "blank", tier: 1 }],
        [{ type: "blank", tier: 1 }],
      ];
      state.enemy.hp = state.enemy.maxHp = 1000;
      state.enemy.countdown = 99;
      state.enemy.passive = null;
      render();
      await spin(0);
      return {
        health: h.hp,
        actual: state.lastLifesteal.actual,
        damage: state.lastPlayerRoll.actualDamage,
        returned:
          state.lastLifesteal.healedAt >= state.lastLifesteal.returnStartedAt,
      };
    }, mode);
    assert.equal(r.actual, Math.ceil(r.damage * 0.225));
    assert.equal(r.health, 10 + r.actual);
    assert.equal(r.returned, true);
  }
});
