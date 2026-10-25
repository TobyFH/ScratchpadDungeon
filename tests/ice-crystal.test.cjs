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

function blankMap() {
  state.map = Array.from({ length: W * H }, (_, i) => ({
    wall: i % W === 0 || i % W === W - 1 || i < W || i >= W * (H - 1),
    seen: true,
    terrain: "floor",
    event: null,
    feature: null,
    corpses: [],
    room: null,
    visited: false,
    lastNearCommand: state.moveCommands || 0,
  }));
  state.map[0].biome = "cave";
  state.map[0].floorName = "Test cave";
  state.position = pos(1, 7);
  state.pursuerSpawned = true;
  state.lastMinorEventStep = 100000;
  render();
}

test("selecting known ice at the end of a known route slides onto and reveals its covered landing", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(async () => {
    state.map.forEach((c) => {
      c.wall = true;
      c.terrain = "stone";
      c.seen = false;
    });
    for (const x of [1, 2, 3, 4])
      Object.assign(state.map[pos(x, 7)], {
        wall: false,
        terrain: x === 3 ? "ice" : "floor",
        seen: x < 4,
      });
    render();
    const route = shortestPath(pos(3, 7));
    await move(pos(3, 7));
    return { route, pos: state.position, seen: state.map[pos(4, 7)].seen };
  });
  assert.ok(r.route);
  assert.equal(r.pos, 81);
  assert.equal(r.seen, true);
});
test("a covered landing can be selected across known ice, without routing through other unseen tiles", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(async () => {
    state.map[pos(2, 7)].terrain = "ice";
    state.map[pos(3, 7)].seen = false;
    state.map[pos(4, 7)].seen = false;
    render();
    const valid = shortestPath(pos(3, 7)),
      hidden = shortestPath(pos(4, 7));
    await move(pos(3, 7));
    return {
      valid,
      hidden,
      pos: state.position,
      seen: state.map[pos(3, 7)].seen,
    };
  });
  assert.deepEqual(r.valid, [79, 80]);
  assert.ok(!r.hidden || !r.hidden.includes(80));
  assert.equal(r.pos, 80);
  assert.equal(r.seen, true);
});
test("ice generation and crystal barriers preserve escapes to stairs from every traversable tile", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    let bad = 0,
      ice = 0,
      crystal = 0;
    for (let n = 0; n < 180; n++) {
      const depth = 3 + (n % 8),
        map = generateFloor(depth);
      if (!allTilesCanReachStairs(map)) bad++;
      const stairs = map.findIndex(c => c.event === "stairs");
      // Independently exercise the actual route planner from every approach.
      map.forEach((c, i) => { if (!c.wall && !movementRoute(map, i, stairs, {omniscient:true, directIce:false})) bad++; });
      ice += map.filter((c) => c.terrain === "ice").length;
      crystal += map.filter((c) => c.terrain === "crystal").length;
      if (
        map.some(
          (c) => c.terrain === "crystal" && (!c.wall || c.room || c.event),
        )
      )
        bad++;
    }
    return { bad, ice, crystal };
  });
  assert.equal(r.bad, 0);
  assert.ok(r.ice > 0);
  assert.ok(r.crystal > 0);
});
test("loading old ice crossroads repairs one-way approach traps without changing discoveries", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(() => {
    state.map.forEach((c) => {
      c.wall = true;
      c.terrain = "stone";
    });
    for (const [x, y] of [
      [2, 3],
      [3, 3],
      [4, 3],
      [3, 2],
      [3, 4],
    ])
      Object.assign(state.map[pos(x, y)], { wall: false, terrain: "floor" });
    state.map[pos(3, 3)].terrain = "ice";
    state.map[pos(2, 3)].event = "stairs";
    state.map[pos(3, 2)].event = "treasure";
    const before = allTilesCanReachStairs(state.map);
    normaliseBiome();
    return {
      before,
      after: allTilesCanReachStairs(state.map),
      treasure: state.map[pos(3, 2)].event,
    };
  });
  assert.equal(r.before, false);
  assert.equal(r.after, true);
  assert.equal(r.treasure, "treasure");
});
test("crystal aura seals two real reels every third roll and each hero cracks only their own gems", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(async () => {
    state.party.push(makeHero("Orin", "mage"));
    Object.assign(state.map[pos(2, 7)], { terrain: "crystal", wall: true });
    beginEncounter(false, { count: 1 });
    finishOpeningRoll();
    state.enemy.countdown = 99;
    state.enemy.hp = state.enemy.maxHp = 5000;
    state.enemy.passive = null;
    const old = Math.random;
    Math.random = () => 0;
    advanceCrystalAura();
    advanceCrystalAura();
    const early = state.party.flatMap((h) => h.crystalLocks || []).length;
    advanceCrystalAura();
    Math.random = old;
    render();
    const h = state.party.find((h) => h.crystalLocks?.length),
      i = state.party.indexOf(h),
      locks = [...h.crystalLocks],
      others = state.party
        .filter((a) => a !== h)
        .map((a) => [...(a.crystalLocks || [])]);
    const reels = giftedReels(h);
    let used;
    runMachine = async (id, r) => {
      used = r;
      return r.map((f) => ({ ...f[0] }));
    };
    await spin(i);
    const after = [...h.crystalLocks],
      rest = state.party
        .filter((a) => a !== h)
        .map((a) => [...(a.crystalLocks || [])]);
    clearBattleStatuses();
    return {
      early,
      locks,
      types: locks.map((k) => reels[k][0].type),
      used: locks.map((k) => used[k][0].type),
      after,
      others,
      rest,
      clear: state.party.every((a) => !a.crystalLocks.length),
    };
  });
  assert.equal(r.early, 0);
  assert.ok(r.locks.length);
  assert.ok(r.types.every((x) => x === "blank"));
  assert.deepEqual(r.used, r.types);
  assert.deepEqual(r.after, []);
  assert.deepEqual(r.rest, r.others);
  assert.equal(r.clear, true);
});
test("crystal aura respects range and walls and survives an ongoing fight reload", async (t) => {
  const p = await game(t);
  await p.evaluate(blankMap);
  const r = await p.evaluate(() => {
    Object.assign(state.map[pos(3, 7)], { terrain: "crystal", wall: true });
    state.map[pos(2, 7)].wall = true;
    const blocked = crystalSources().length;
    state.map[pos(2, 7)].wall = false;
    const near = crystalSources().length;
    beginEncounter(false, { count: 1 });
    state.party[0].crystalLocks = [0, 2];
    state.crystalRolls = 2;
    save();
    load();
    return {
      blocked,
      near,
      locks: state.party[0].crystalLocks,
      rolls: state.crystalRolls,
    };
  });
  assert.equal(r.blocked, 0);
  assert.equal(r.near, 1);
  assert.deepEqual(r.locks, [0, 2]);
  assert.equal(r.rolls, 2);
});
test("available and locked starter cards share aligned art, name, availability and stat rows", async (t) => {
  const p = await game(t);
  for (const width of [1920, 1280, 390]) {
    await p.setViewportSize({ width, height: width < 500 ? 844 : 1080 });
    await p.evaluate(() => chooseStartingClass());
    await p.waitForTimeout(600);
    const bad = await p.evaluate(() => {
      const cards = [...document.querySelectorAll(".starter-grid > button")],
        fail = [];
      for (const c of cards) {
        const b = c.getBoundingClientRect();
        for (const el of c.children) {
          const r = el.getBoundingClientRect();
          if (
            r.bottom > b.bottom + 2 ||
            r.right > b.right + 2 ||
            r.left < b.left - 2
          )
            fail.push(c.textContent + ":" + el.tagName);
        }
      }
      for (let i = 1; i < cards.length; i++) {
        if (Math.abs(cards[i].offsetTop - cards[i - 1].offsetTop) < 2)
          for (const sel of ["svg", "b", "strong", "small", "span"])
            if (
              Math.abs(
                cards[i].querySelector(sel).getBoundingClientRect().top -
                  cards[i - 1].querySelector(sel).getBoundingClientRect().top,
              ) > 2
            )
              fail.push(sel + " alignment");
      }
      return fail;
    });
    assert.deepEqual(bad, [], width + ":" + JSON.stringify(bad));
    await p.evaluate(() => closeModal());
  }
});
