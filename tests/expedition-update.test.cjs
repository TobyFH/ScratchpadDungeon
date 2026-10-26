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
    newRun("fighter", { specialism: "offence" });
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

test("hero faces remain equally likely; old authored weights vanish without a refund and retired purchases stay disabled", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      fresh = h.reels.map((reel) => reel.map((f) => f.weight));
    h.reels[0][0].tier = 4;
    h.points = 50;
    h.reels[0][0].weight = 9;
    state.version = 17;
    save();
    load();
    const migrated = {
      version: state.version,
      tier: state.party[0].reels[0][0].tier,
      points: state.party[0].points,
      weights: state.party[0].reels.flat().map((f) => f.weight),
    };
    applyFaceEdit(state.party[0], 0, 0, "weight");
    save();
    const loaded = load();
    return {
      loaded,
      fresh,
      migrated,
      weight: state.party[0].reels[0][0].weight,
      points: state.party[0].points,
    };
  });
  assert.equal(r.loaded, true);
  assert.ok(r.fresh.flat().every((w) => w === 1));
  assert.equal(r.migrated.version, 21);
  assert.equal(r.migrated.tier, 4);
  assert.equal(r.migrated.points, 50);
  assert.ok(r.migrated.weights.every((w) => w === 1));
  assert.equal(r.weight, 1);
  assert.equal(r.points, 50);
});

test("weight purchases are rejected for ordinary faces and seals; critical chances match exhaustive equal-face rolls", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0];
    h.points = 100;
    const before = heroCriticalOdds(h).find(
      (r) => r.type === "attack" && r.tier === 1,
    ).chance;
    const cost = faceEditCost(h, 0, 0, "weight");
    applyFaceEdit(h, 0, 0, "weight");
    const after = heroCriticalOdds(h).find(
      (r) => r.type === "attack" && r.tier === 1,
    ).chance;
    const middle = h.reels[1].findIndex((f) => f.type === "class"),
      sealWeighted = applyFaceEdit(h, 1, middle, "weight"),
      cannotSwap = applyFaceEdit(h, 1, middle, "swap", "attack");
    let exact = 0;
    const sums = h.reels.map((r) => r.reduce((n, f) => n + f.weight, 0));
    for (const a of h.reels[0])
      for (const b of h.reels[1])
        for (const c of h.reels[2])
          if (matchCount([a, b, c]) === 3)
            exact +=
              (a.weight * b.weight * c.weight) / (sums[0] * sums[1] * sums[2]);
    return {
      before,
      after,
      cost,
      sealWeighted,
      cannotSwap,
      exact,
      shown: heroCriticalOdds(h).reduce((n, r) => n + r.chance, 0),
    };
  });
  assert.equal(r.cost, undefined);
  assert.equal(r.after, r.before);
  assert.equal(r.sealWeighted, false);
  assert.equal(r.cannotSwap, false);
  assert.ok(Math.abs(r.shown - r.exact) < 1e-12);
  await p.evaluate(() => editor(0));
  await p.locator('[data-workshop-view="crits"]').click();
  assert.match(
    await p.locator(".workshop-critpage").innerText(),
    /Three of a kind/,
  );
});

test("Ranger, Berserker and Jester remain visible but locked; purchasing Berserker unlocks starts and recruits and its initial wheel contains healing", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const profile = emptyProfile();
    profile.gold = 5000;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    chooseStartingClass();
  });
  assert.equal(await p.locator("[data-unlock-class]").count(), 3);
  assert.equal(await p.locator('[data-start-job="berserker"]').count(), 0);
  await p.locator('[data-unlock-class="berserker"]').click();
  await p.locator('[data-camp-buy="berserker"]').click();
  await p.locator("#camp-return").click();
  assert.equal(await p.locator('[data-start-job="berserker"]').count(), 1);
  await p.locator('[data-start-job="berserker"]').click();
  const r = await p.evaluate(() => ({
    job: state.party[0].job,
    pool: heroJobs(),
    gold: campProfile().gold,
    heals: state.party[0].reels.every((r) => r.some((f) => f.type === "heal")),
  }));
  assert.equal(r.job, "berserker");
  assert.ok(r.pool.includes("berserker"));
  assert.equal(r.gold, 4250);
  assert.equal(r.heals, true);
});

test("spending curves are meaningful and permanent training enforces increasing tier costs without changing existing expedition health", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const original = state.party[0].maxHp,
      profile = emptyProfile();
    profile.gold = 50000;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    campPage("training");
    const skip = purchaseUnlock("vitality2");
    purchaseUnlock("vitality1");
    const first = makeHero("Test", "fighter", null, expeditionRules()).maxHp;
    for (let n = 2; n <= 5; n++) purchaseUnlock("vitality" + n);
    const full = makeHero("Test", "fighter", null, expeditionRules()).maxHp;
    return {
      skip,
      original,
      current: state.party[0].maxHp,
      first,
      full,
      costs: [1, 2, 3, 4, 5].map((n) => CAMP_UNLOCKS["vitality" + n].cost),
      prices: shopPrices(),
      enabled: campProfile().enabled,
    };
  });
  assert.equal(r.skip, false);
  assert.equal(r.current, r.original);
  assert.equal(r.first, Math.round(r.original * 1.25));
  assert.equal(r.full, Math.round(r.original * 2.25));
  assert.ok(r.costs.every((c, i) => !i || c > r.costs[i - 1]));
  assert.ok(
    r.prices.potion >= 90 && r.prices.heal >= 150 && r.prices.reveal >= 100,
  );
  assert.deepEqual(r.enabled, []);
});

test("Ranger Execute charges faster and has a stronger meaningful payoff at both full and wounded enemy health", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = makeHero("Rowan", "ranger"),
      other = state.party[0];
    state.party.push(h);
    beginEncounter();
    h.charge = 0;
    advanceRangerPatience(other, false);
    const fill = h.charge;
    h.charge = 6;
    state.enemy.hp = state.enemy.maxHp;
    const fresh = executionBonus(h);
    state.enemy.hp = Math.ceil(state.enemy.maxHp * 0.2);
    return {
      fill,
      fresh,
      wounded: executionBonus(h),
      seal: executionBonus(h, state.enemy, 6, true),
    };
  });
  assert.equal(r.fill, 2);
  assert.ok(r.fresh >= 2);
  assert.ok(r.wounded >= 8);
  assert.ok(r.seal > r.wounded);
});

test("a stun costs one missed go without advancing enemy clocks, while background recovery takes at most two checks", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    beginEncounter();
    state.enemy.countdown = 9;
    const h = state.party[0];
    h.stun = 1;
    h.stunAge = 0;
    const random = Math.random;
    Math.random = () => 0.99;
    const attempts = [];
    for (let n = 0; n < 1; n++) {
      await spin(0);
      attempts.push({
        stun: h.stun,
        count: state.enemy.countdown,
        spins: h.stats.spins,
      });
    }
    Math.random = random;
    let seed = 17,
      total = 0;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let n = 0; n < 1000; n++) {
      const entity = { hp: 20, stun: 1, stunAge: 0 };
      while (entity.stun) {
        tryBreakStun(entity);
        total++;
      }
    }
    Math.random = random;
    return { attempts, mean: total / 1000 };
  });
  assert.deepEqual(
    r.attempts.map((x) => x.stun),
    [0],
  );
  assert.ok(r.attempts.every((x) => x.count === 9 && x.spins === 0));
  assert.ok(r.mean > 1.3 && r.mean < 1.5);
});

test("a final enemy killing blow ends combat before poison can kill the surviving Ranger, and poison never ticks after either faction is gone", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    newRun("ranger");
    setPace("skip");
    setPreference("skipCriticals", true);
    beginEncounter();
    const h = state.party[0],
      e = state.enemy;
    e.hp = 2;
    e.passive = null;
    e.countdown = 99;
    h.hp = 1;
    h.poison = { turns: 3, damage: 2, appliedAt: -1 };
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    treasureRoll = async () => {};
    render();
    await spin(0);
    const survivor = {
      hp: h.hp,
      dead: h.dead,
      poison: h.poison,
      battles: state.battlesWon,
    };
    beginEncounter();
    state.party[0].hp = 0;
    const foe = state.enemy;
    foe.poison = { turns: 3, damage: 9, appliedAt: -1 };
    const before = foe.hp;
    await tickPoison();
    return { survivor, enemyLoss: before - foe.hp };
  });
  assert.ok(r.survivor.hp > 0);
  assert.equal(r.survivor.dead, false);
  assert.equal(r.survivor.poison, null);
  assert.equal(r.survivor.battles, 1);
  assert.equal(r.enemyLoss, 0);
});

test("the Graphite Gaoler blackouts arrive after its portrait transfer and affected reels have no effects until rolled clean", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.depth = 6;
    beginEncounter(true, { stairBoss: true, count: 1 });
    state.enemy.countdown = 99;
    state.enemy.hp = state.enemy.maxHp = 2000;
    render();
    window.intro = encounterEntrance();
  });
  await p.waitForSelector("#stage-confirm");
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.intro);
  assert.ok((await p.locator(".blacked-out").count()) > 0);
  const r = await p.evaluate(async () => {
    const h = state.party[0],
      covered = [...h.blackout];
    h.reels = [0, 1, 2].map(() => [{ type: "attack", tier: 1 }]);
    await spin(0);
    return {
      covered,
      blackout: h.blackout,
      last: h.last.map((f) => f.type),
      art: state.enemy.art,
      passive: state.enemy.passive.key,
    };
  });
  assert.equal(r.art, "smudger");
  assert.equal(r.passive, "blackout");
  assert.deepEqual(r.blackout, []);
  assert.ok(r.covered.every((i) => r.last[i] === "blank"));
  assert.equal(await p.locator(".blacked-out").count(), 0);
});

test("paired foes share one large protection control and portrait badges are icons with complete tooltips rather than overflowing text", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    beginEncounter(false, { count: 2 });
    setEnemyBlock(27);
    state.party[0].poison = { turns: 3, damage: 2 };
    state.party[0].stun = 1;
    state.enemy.passive = { key: "secondWind" };
    render();
  });
  assert.equal(await p.locator(".enemy-team-block").count(), 1);
  assert.equal(await p.locator(".enemy-team-block strong").textContent(), "20");
  assert.equal(await p.locator(".specialism-badge").innerText(), "");
  assert.equal(await p.locator(".portrait-conditions").first().innerText(), "");
  assert.ok(
    await p
      .locator(".portrait-conditions b")
      .first()
      .getAttribute("data-tooltip"),
  );
  assert.match(
    await p.evaluate(() => heroStatsMarkup(state.party[0])),
    /Temperament/,
  );
  const size = await p
    .locator(".enemy-team-block strong")
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(size >= 28);
  await p.locator('#machine-hero-0 [data-reel="0"]').hover();
  await p.waitForSelector("#status-tooltip:not([hidden])");
  assert.match(
    await p.locator("#status-tooltip").textContent(),
    /physical damage/,
  );
});

test("every species has its own collapsed silhouette rather than the same human corpse", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const signatures = {};
    for (const kind of Object.keys(ENEMY_PROFILES)) {
      const node = document.createElement("div");
      node.innerHTML = corpseArt(kind);
      signatures[kind] = [...node.querySelectorAll(".fallen-silhouette path")]
        .map((p) => p.getAttribute("d"))
        .join("|");
    }
    return { signatures, unique: new Set(Object.values(signatures)).size };
  });
  assert.equal(r.unique, Object.keys(r.signatures).length);
  assert.ok(
    r.signatures.gnawer !== r.signatures.lich &&
      r.signatures.moth !== r.signatures.rat,
  );
});

test("lava remains an impassable barrier and a thousand generated floors keep a valid distant stair route; bridges show faded water", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let lava = 0,
      tunnels = 0;
    for (let n = 0; n < 1000; n++) {
      const map = generateFloor(5 + (n % 6)),
        stair = map.findIndex((c) => c.event === "stairs"),
        distance = mapDistances(map);
      if (!distance.has(stair) || distance.get(stair) < 8)
        throw Error("Stair path failed");
      for (const c of map) {
        if (c.terrain === "lava") {
          lava++;
          if (!c.wall) throw Error("Walkable lava");
        }
        if (c.event === "tunnel") tunnels++;
      }
    }
    return {
      lava,
      tunnels,
      water: icon("bridge").includes("var(--water-ink)"),
      fade: icon("bridge").includes('opacity=".45"'),
    };
  });
  assert.ok(r.lava > 100);
  assert.ok(r.tunnels > 100);
  assert.equal(r.water, true);
  assert.equal(r.fade, true);
});

test("tunnels are rare reciprocal pairs at least three cells apart, allow declining and teleport without recursively prompting at the far end", async (t) => {
  const p = await game(t);
  const distribution = await p.evaluate(() => {
    let seed = 91517;
    Math.random = () => ((seed = (Math.imul(seed,1664525)+1013904223)>>>0) / 4294967296);
    let bearing = 0,
      doubles = 0;
    for (let n = 0; n < 1000; n++) {
      const map = generateFloor(3),
        ends = map
          .map((c, i) => ({ c, i }))
          .filter(({ c }) => c.event === "tunnel");
      if (ends.length) bearing++;
      if (ends.length === 4) doubles++;
      if (ends.length > 4 || ends.length % 2) throw Error("Invalid pair count");
      for (const { c, i } of ends) {
        if (map[c.tunnelTo].tunnelTo !== i || map[c.tunnelTo].wall)
          throw Error("Broken tunnel");
        if (
          Math.abs((i % W) - (c.tunnelTo % W)) +
            Math.abs(Math.floor(i / W) - Math.floor(c.tunnelTo / W)) <
          3
        )
          throw Error("Tunnel too short");
      }
    }
    return { bearing, doubles };
  });
  assert.ok(distribution.bearing > 110 && distribution.bearing < 250);
  assert.ok(distribution.doubles > 0 && distribution.doubles < 35);
  await p.evaluate(() => {
    const a = state.position,
      b = pos(7, 2);
    Object.assign(state.map[a], {
      event: "tunnel",
      feature: "tunnel",
      tunnelTo: b,
    });
    Object.assign(state.map[b], {
      wall: false,
      terrain: "floor",
      event: "tunnel",
      feature: "tunnel",
      tunnelTo: a,
      seen: false,
    });
    window.tunnel = tunnelEncounter(state.map[a]);
  });
  await p.locator("#tunnel-leave").click();
  await p.evaluate(() => window.tunnel);
  assert.equal(
    await p.evaluate(() => state.map[state.position].event),
    "tunnel",
  );
  await p.evaluate(() => {
    window.tunnel = tunnelEncounter(state.map[state.position]);
  });
  await p.locator("#tunnel-use").click();
  await p.evaluate(() => window.tunnel);
  assert.equal(await p.evaluate(() => state.position), 29);
  assert.equal(await p.locator("#spotlight").isHidden(), true);
  assert.equal(await p.evaluate(() => state.map[state.position].seen), true);
});

test("a revealed live trap kills the chasing Unwritten and becomes treasure without EXP or a battle reward", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(async () => {
    state.depth = 4;
    state.map.forEach((c) =>
      Object.assign(c, {
        wall: true,
        seen: true,
        event: null,
        terrain: "stone",
      }),
    );
    for (const x of [2, 3, 4])
      Object.assign(state.map[pos(x, 2)], { wall: false, terrain: "floor" });
    state.position = pos(4, 2);
    state.map[pos(3, 2)].event = "trap";
    state.pursuer = { position: pos(2, 2), beat: 0 };
    state.pursuerSpawned = true;
    const xp = state.party[0].xp,
      gold = state.gold;
    const battle = await advancePursuer();
    return {
      battle,
      pursuer: state.pursuer,
      event: state.map[pos(3, 2)].event,
      xp: state.party[0].xp - xp,
      gold: state.gold - gold,
    };
  });
  assert.equal(r.battle, false);
  assert.equal(r.pursuer, null);
  assert.equal(r.event, "treasure");
  assert.equal(r.xp, 0);
  assert.equal(r.gold, 0);
});

test("a fallen companion may return once on a later floor as a named zombie without resurrecting or removing the memorial", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const dead = { id: 17, name: "Mira", job: "mage", depth: 1 };
    state.graveyard.push(dead);
    state.depth = 3;
    const random = Math.random;
    Math.random = () => 0;
    const chosen = chooseReturnedHero(3);
    beginEncounter(false, { zombie: chosen, count: 1 });
    const again = chooseReturnedHero(3);
    Math.random = random;
    return {
      name: state.enemy.name,
      art: state.enemy.art,
      chosen: chosen.name,
      again,
      memorial: state.graveyard.length,
      party: state.party.length,
      returned: dead.returnedAsZombie,
    };
  });
  assert.equal(r.name, "Mira, returned");
  assert.equal(r.art, "zombie");
  assert.equal(r.chosen, "Mira");
  assert.equal(r.again, null);
  assert.equal(r.memorial, 1);
  assert.equal(r.party, 1);
  assert.equal(r.returned, true);
});

test("bestiary conceals unknown creatures, records actual encounter stats and defeats across runs, and clicking a known sketch plays its cry", async (t) => {
  const p = await game(t);
  await p.evaluate(() => bestiaryPage(0));
  assert.equal(await p.locator("#bestiary-cry").isDisabled(), true);
  assert.match(
    await p.locator(".bestiary-record h3").textContent(),
    /unwritten creature/,
  );
  await p.evaluate(() => {
    closeModal();
    beginEncounter(false, { count: 1 });
    state.enemy.passive = null;
    window.metId = bestiaryId(state.enemy);
    damageEnemy(9999, "Fixture", state.enemy, { piercing: true });
    bestiaryPage(BESTIARY_ENTRIES.findIndex((e) => e.id === metId));
  });
  assert.equal(await p.locator("#bestiary-cry").isEnabled(), true);
  const cries = await p.evaluate(() => GameSound.stats.cries);
  await p.locator("#bestiary-cry").click();
  await p.waitForFunction((n) => GameSound.stats.cries > n, cries);
  const record = await p.evaluate(() => readBestiary()[metId]);
  assert.equal(record.seen, 1);
  assert.equal(record.defeated, 1);
  await p.evaluate(() => newRun());
  assert.equal(await p.evaluate(() => readBestiary()[metId].defeated), 1);
});

test("options and guide remain clickable during a real reel spin, pause its progress, and restore the unresolved event when closed", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    busy = true;
    setPace("1");
    setPreference("shake", 0);
    setPreference("skipCriticals", false);
    window.loot = treasureRoll();
    document.querySelector("#options-tab").click();
  });
  await p.waitForSelector("#machine-treasure.rolling");
  assert.equal(await p.evaluate(() => utilityOpen), true);
  const gold = await p.evaluate(() => state.gold);
  await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => state.gold), gold);
  await p.locator("#tab-display").click();
  await p.locator("#setting-portraitMotion").fill("0");
  await p.locator("#guide-tab").click();
  await p.locator("#guide-next").click();
  await p.locator("#modal [data-close]").last().click();
  assert.equal(await p.evaluate(() => utilityOpen), false);
  assert.equal(await p.locator("#machine-treasure").count(), 1);
  await p.locator("#animation-speed").selectOption("skip");
  await p.waitForSelector("#stage-confirm:not(:disabled)");
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.loot);
  assert.ok(await p.evaluate((before) => state.gold > before, gold));
  assert.equal(await p.evaluate(() => preferences().portraitMotion), 0);
});

test("guide and camp navigation remain in the same position on every topic/tab at desktop and compact sizes", async (t) => {
  const p = await game(t);
  for (const width of [1920, 1280, 390, 320]) {
    await p.setViewportSize({
      width,
      height: width === 1920 ? 1080 : width === 1280 ? 800 : 844,
    });
    await p.evaluate(async () => {
      help();
      // Measure changes between notebook pages after the viewport's scheduled
      // fit has painted; the initial resize itself is allowed to reposition it.
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      fitDialogs();
    });
    const guide = [];
    for (let i = 0; i < (await p.locator("#guide-topic option").count()); i++) {
      await p.locator("#guide-topic").selectOption(String(i));
      guide.push(
        await p
          .locator("#guide-next")
          .evaluate((el) => el.getBoundingClientRect().y),
      );
    }
    assert.ok(
      Math.max(...guide) - Math.min(...guide) < 1,
      JSON.stringify({ width, guide }),
    );
    const camp = [];
    for (const tab of [
      "classes",
      "boons",
      "training",
      "challenges",
      "oddities",
    ]) {
      await p.evaluate((tab) => campPage(tab), tab);
      camp.push(
        await p
          .locator('[data-camp-tab="classes"]')
          .evaluate((el) => el.getBoundingClientRect().y),
      );
    }
    assert.ok(
      Math.max(...camp) - Math.min(...camp) < 1,
      JSON.stringify({ width, camp }),
    );
  }
});

test("portrait movement has independent persistent magnitude and zero disables it without changing shake or gameplay", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    setPreference("portraitMotion", 0);
    const el = $("#portrait-0");
    lunge(el, false);
    speech(el, "Hello");
    const none = el
      .querySelector("svg")
      .getAnimations()
      .filter((a) => a.portraitMotion).length;
    setPreference("portraitMotion", 1.5);
    lunge(el, false);
    const playing = el
      .querySelector("svg")
      .getAnimations()
      .some((a) => a.portraitMotion);
    save();
    load();
    return {
      none,
      playing,
      value: preferences().portraitMotion,
      shake: preferences().shake,
    };
  });
  assert.equal(r.none, 0);
  assert.equal(r.playing, true);
  assert.equal(r.value, 1.5);
  assert.equal(r.shake, 1);
});

test("all four tiers, class marks and blank icons are centred within party reel windows without clipping", async (t) => {
  const p = await game(t);
  for (const type of [
    "attack",
    "magic",
    "heal",
    "block",
    "stun",
    "poison",
    "blank",
    "class",
  ]) {
    await p.evaluate((type) => {
      state.party[0].last = [1, 3, 4].map((tier) => ({
        type,
        tier,
        job: "fighter",
      }));
      render();
    }, type);
    const positions = await p
      .locator("#machine-hero-0 .slot-window")
      .evaluateAll((windows) =>
        windows.map((win) => {
          const w = win.getBoundingClientRect(),
            icons = [...win.querySelectorAll("svg")].map((e) =>
              e.getBoundingClientRect(),
            );
          const left = Math.min(...icons.map((r) => r.left)),
            right = Math.max(...icons.map((r) => r.right)),
            top = Math.min(...icons.map((r) => r.top)),
            bottom = Math.max(...icons.map((r) => r.bottom));
          return {
            dx: (left + right - w.left - w.right) / 2,
            dy: (top + bottom - w.top - w.bottom) / 2,
            inside:
              left >= w.left - 1 &&
              right <= w.right + 1 &&
              top >= w.top - 1 &&
              bottom <= w.bottom + 1,
          };
        }),
      );
    assert.ok(
      positions.every(
        (r) => Math.abs(r.dx) < 2 && Math.abs(r.dy) < 2 && r.inside,
      ),
      JSON.stringify({ type, positions }),
    );
  }
});

test("treasure reserves its artwork, reels, result and confirm positions throughout an inline critical", async (t) => {
  const p = await game(t);
  // Measure reserved layout, independently of the deliberate paper-entry transform.
  await p.addStyleTag({
    content:
      "#stage-card { animation: none !important; transition: none !important; }",
  });
  await p.evaluate(() => {
    setPace("1");
    setPreference("shake", 0);
    setPreference("skipCriticals", false);
    const original = runMachine;
    runMachine = (id, reels, options = {}) =>
      original(
        id,
        reels,
        id === "treasure"
          ? { results: [0, 1, 2].map(() => ({ type: "coin", tier: 1 })) }
          : options,
      );
    busy = true;
    window.chest = treasureRoll();
  });
  await p.waitForSelector("#machine-treasure.rolling");
  await p.waitForTimeout(500);
  const measure = () =>
    p.evaluate(() => {
      const art = document
          .querySelector(".trap-art svg")
          .getBoundingClientRect(),
        machine = document
          .querySelector("#machine-treasure .machine-face")
          .getBoundingClientRect(),
        actions = document
          .querySelector("#stage-actions")
          .getBoundingClientRect();
      return {
        art: [art.x, art.y, art.width, art.height],
        machine: [machine.x, machine.y, machine.width, machine.height],
        actions: [actions.y, actions.height],
      };
    });
  const first = await measure();
  await p.locator("#stage-skip").click();
  await p.waitForSelector("#machine-critical.rolling");
  await p.waitForTimeout(80);
  const critical = await measure();
  await p.locator("#stage-skip").click();
  await p.waitForSelector("#stage-confirm");
  const result = await measure();
  for (const phase of [critical, result])
    for (const key of ["art", "machine", "actions"])
      assert.ok(
        phase[key].every((n, i) => Math.abs(n - first[key][i]) < 2),
        JSON.stringify({ key, first, phase }),
      );
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.chest);
});

test("three safe trap faces produce no meaningless critical animation or multiplier", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const original = runMachine;
    runMachine = (id, reels, options = {}) =>
      original(
        id,
        reels,
        id === "trap"
          ? { results: [0, 1, 2].map(() => ({ type: "safe", tier: 1 })) }
          : options,
      );
    window.trap = trapRoll();
  });
  await p.waitForSelector("#stage-confirm");
  assert.equal(await p.locator("#machine-critical").count(), 0);
  assert.equal(await p.evaluate(() => state.lastCritical), undefined);
  await p.locator("#stage-confirm").click();
  await p.evaluate(() => window.trap);
});

test("healthy autoplay takes a nearby low-risk battle for EXP even when it is already above the expected level and knows the stairs", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    state.map.forEach((c) =>
      Object.assign(c, {
        seen: true,
        wall: false,
        terrain: "floor",
        event: null,
        feature: null,
      }),
    );
    state.position = pos(1, 7);
    state.party[0].level = 20;
    state.party[0].reels = [0, 1, 2].map(() => [
      { type: "attack", tier: 4, weight: 1 },
    ]);
    state.map[pos(3, 7)].event = "enemy";
    state.map[pos(1, 5)].event = "stairs";
    state.exitFound = true;
    const ready = autoReadiness();
    return {
      ready,
      lowRisk: autoLowRiskEncounter(),
      goal: autoplayGoal(),
      enemy: pos(3, 7),
    };
  });
  assert.equal(r.ready.underlevelled, false);
  assert.equal(r.lowRisk, true);
  assert.equal(r.goal, r.enemy);
});

test("opening side pages over a shop preserves its live buttons, purchase callback and pending shop promise", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.gold = 1000;
    busy = true;
    window.shop = shopEncounter(state.map[state.position]);
  });
  await p.waitForSelector('[data-buy="potion"]');
  await p.locator("#options-tab").click();
  await p.locator("#guide-tab").click();
  await p.locator("#modal [data-close]").last().click();
  assert.equal(await p.evaluate(() => modalKind), "shop");
  await p.locator('[data-buy="potion"]').click();
  assert.equal(await p.evaluate(() => state.bag.potion), 1);
  assert.equal(await p.evaluate(() => state.gold), 908);
  await p.locator("#modal [data-close]").last().click();
  await p.evaluate(() => window.shop);
});

test("older ongoing guardian encounters fill the correct bestiary page once and reloading never duplicates sightings", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    state.depth = 6;
    beginEncounter(true, { stairBoss: true, count: 1 });
    delete state.enemy.journalSeen;
    delete state.enemy.stairBossDepth;
    state.version = 17;
    localStorage.removeItem(BESTIARY_KEY);
    save();
  });
  await p.reload();
  assert.equal(await p.evaluate(() => readBestiary()["boss-6"].seen), 1);
  await p.reload();
  assert.equal(await p.evaluate(() => readBestiary()["boss-6"].seen), 1);
  await p.evaluate(() => {
    setPreference("punMode", true);
    bestiaryPage(BESTIARY_ENTRIES.findIndex((e) => e.id === "boss-6"));
  });
  assert.match(
    await p.locator(".bestiary-record h3").textContent(),
    /Sticky Goat/,
  );
  assert.equal(
    await p.locator(".bestiary-record .species-pun-goat").count(),
    1,
  );
});

test("compact workshop face selection and fixed operation pages stay legible and preserve edits", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    await p.evaluate(() => {
      newRun("mage");
      state.party[0].points = 80;
      editor(0);
    });
    await p.locator("#workshop-face-picker").selectOption("3");
    const footers = [];
    for (const mode of ["power", "replace"]) {
      await p.locator(`[data-editor-operation="${mode}"]`).click();
      await p.waitForTimeout(100);
      footers.push(
        await p
          .locator("#modal .modal-actions")
          .evaluate((el) => el.getBoundingClientRect().top),
      );
      const detail = await p.locator(".workshop-detail").evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const overflow = [...el.querySelectorAll("button,select,p,small")]
          .filter((node) => {
            const r = node.getBoundingClientRect();
            return (
              r.height > 0 &&
              (r.bottom > rect.bottom + 1 || r.right > rect.right + 1)
            );
          })
          .map((node) => node.className || node.id);
        const text = el.querySelector(".face-effect"),
          style = getComputedStyle(text),
          font =
            (Number.parseFloat(style.fontSize) *
              text.getBoundingClientRect().height) /
            text.offsetHeight;
        return { overflow, font };
      });
      assert.deepEqual(
        detail.overflow,
        [],
        `${width} ${mode} ${JSON.stringify(detail)}`,
      );
      assert.ok(
        detail.font >= 11,
        `${width}: readable effect text ${detail.font}`,
      );
    }
    assert.ok(
      Math.max(...footers) - Math.min(...footers) < 2,
      "operation footer does not jump",
    );
    assert.equal(await p.locator("#face-weight").count(), 0);
    assert.equal(await p.locator("#workshop-face-picker").inputValue(), "3");
    assert.equal(await p.evaluate(() => state.party[0].reels[0][3].weight), 1);
    assert.equal(await p.evaluate(() => state.party[0].points), 80);
    await p.evaluate(() => closeModal());
  }
});

test("new guardians immediately discover their own depth-specific bestiary record rather than the previous encounter's species", async (t) => {
  const p = await game(t);
  const records = await p.evaluate(() => {
    localStorage.removeItem(BESTIARY_KEY);
    const entries = [];
    for (let depth = 1; depth <= 10; depth++) {
      state.depth = depth;
      state.encounterReward = null;
      beginEncounter(true, { stairBoss: true, count: 1 });
      entries.push({
        depth: state.enemy.stairBossDepth,
        id: bestiaryId(state.enemy),
        seen: readBestiary()["boss-" + depth]?.seen,
      });
    }
    bestiaryPage(BESTIARY_ENTRIES.findIndex((e) => e.id === "boss-6"));
    return entries;
  });
  assert.deepEqual(
    records,
    Array.from({ length: 10 }, (_, n) => ({
      depth: n + 1,
      id: "boss-" + (n + 1),
      seen: 1,
    })),
  );
  assert.match(
    await p.locator(".bestiary-record h3").textContent(),
    /Graphite Gaoler/i,
  );
  assert.equal(await p.locator("#bestiary-cry").isEnabled(), true);
});

test("all six possible edited critical combinations fit the reserved odds page without reaching its footer", async (t) => {
  const p = await game(t);
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 800],
  ]) {
    await p.setViewportSize({ width, height });
    await p.evaluate(() => {
      newRun("mage");
      const h = state.party[0];
      h.reels = [0, 1, 2].map((k) =>
        ["attack", "magic", "heal", "block", "stun", "poison"]
          .map((type) => ({ type, tier: 1, weight: 1 }))
          .concat(
            k === 1 ? [{ type: "class", tier: 1, weight: 1, job: h.job }] : [],
          ),
      );
      editor(0);
      editorView = "crits";
      editor(0);
      fitDialogs();
    });
    const r = await p.evaluate(() => {
      const page = document.querySelector(".workshop-critpage"),
        list = document.querySelector(".crit-odds-grid"),
        footer = document.querySelector("#modal .modal-actions");
      return {
        rows: list.children.length,
        page: page.getBoundingClientRect().bottom,
        list: list.getBoundingClientRect().bottom,
        footer: footer.getBoundingClientRect().top,
      };
    });
    assert.equal(r.rows, 6);
    assert.ok(
      r.list <= r.page + 1 && r.list < r.footer,
      `${width}: ${JSON.stringify(r)}`,
    );
    await p.evaluate(() => closeModal());
  }
});

test("every supported pre-equal-weight save migration restores the middle class mark at the same weight as ordinary faces", async (t) => {
  const p = await game(t);
  const saves = await p.evaluate(() => {
    const results = [];
    for (let version = 1; version < 18; version++) {
      newRun("fighter");
      state.version = version;
      state.party[0].points = 13;
      state.party[0].reels.flat().forEach((face) => (face.weight = 3));
      save();
      const loaded = load(),
        h = state.party[0];
      results.push({
        version,
        loaded,
        points: h.points,
        weights: [...new Set(h.reels.flat().map((face) => face.weight))],
        seals: h.reels.map(
          (reel) => reel.filter((face) => face.type === "class").length,
        ),
      });
    }
    return results;
  });
  for (const save of saves) {
    assert.equal(save.loaded, true, JSON.stringify(save));
    assert.equal(save.points, 13);
    assert.deepEqual(save.weights, [1], JSON.stringify(save));
    assert.deepEqual(save.seals, [0, 1, 0]);
  }
});
