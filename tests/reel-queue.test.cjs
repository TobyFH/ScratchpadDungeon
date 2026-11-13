const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path"),
  { chromium } = require("playwright");
let browser, server, url;
const out = path.join(__dirname, "../test-results/reel-queue");
before(async () => {
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.join(__dirname, "../index.html"));
  server = http.createServer((_, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((r) => server.close(r));
});
async function game(t, job = "fighter") {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(() => CompanyIntro.skip(true));
  await p.evaluate((job) => {
    newRun(job);
    closeModal();
    closeSpotlight();
    setPace("skip");
    characterLuck = () => 0.99999;
    state.runRules = [];
    const h = state.party[0];
    h.points = 0;
    h.reels[0] = h.reels[0].map(() => ({ type: "attack", tier: 1, weight: 1 }));
    editor(0);
  }, job);
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("unaffordable workshop choices explicitly queue without paying or changing a face, with several plans and individual cancellation", async (t) => {
  const p = await game(t);
  assert.equal(await p.locator("#queue-reel-changes").isChecked(), true);
  const choice = p.locator('[data-set-face-tier="4"]');
  assert.equal(await choice.isEnabled(), true);
  assert.match(await choice.innerText(), /Queue/);
  await choice.click();
  assert.match(
    await p.locator(".workshop-queue-status").innerText(),
    /Queued: rank IV/,
  );
  assert.match(await p.locator(".workshop-receipt").innerText(), /unpaid/);
  assert.equal(
    await p.locator('[data-set-face-tier="4"]').getAttribute("data-queued"),
    "true",
  );
  await p.locator('[data-editor-face="1"]').click();
  await p.locator('[data-set-face-type="block"]').click();
  let r = await p.evaluate(() => ({
    points: state.party[0].points,
    queue: state.party[0].reelQueue.length,
    types: state.party[0].reels[0].slice(0, 2),
  }));
  assert.equal(r.points, 0);
  assert.equal(r.queue, 2);
  assert.ok(r.types.every((f) => f.type === "attack" && f.tier === 1));
  assert.equal(await p.locator(".queued-face").count(), 2);
  await p.locator("#cancel-face-queue").click();
  assert.equal(await p.evaluate(() => state.party[0].reelQueue.length), 1);
  await p.locator('[data-editor-face="0"]').click();
  await p.locator('[data-set-face-tier="4"]').click();
  assert.equal(await p.evaluate(() => state.party[0].reelQueue.length), 0);
});
test("disabling queuing clears every hero's plans and disables unaffordable choices; the toggle persists across new runs", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    const h = state.party[0];
    requestFaceChange(h, 0, 0, "tier", 4);
    const ally = makeHero("Other", "fighter");
    ally.points = 0;
    state.party.push(ally);
    requestFaceChange(ally, 0, 0, "swap", "block");
    editor(0);
  });
  await p.locator("#queue-reel-changes").uncheck();
  assert.equal(await p.locator('[data-set-face-tier="4"]').isDisabled(), true);
  assert.deepEqual(
    await p.evaluate(() => state.party.map((h) => h.reelQueue.length)),
    [0, 0],
  );
  await p.evaluate(() => {
    closeModal();
    newRun("fighter");
    closeModal();
    state.party[0].points = 0;
    editor(0);
  });
  assert.equal(await p.locator("#queue-reel-changes").isChecked(), false);
  await p.locator("#queue-reel-changes").check();
  assert.equal(await p.evaluate(() => state.party[0].reelQueue.length), 0);
});
test("cheapest affordable plans buy first; equal-cost plans choose randomly only at purchase time", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      requestFaceChange(h, 0, 0, "tier", 4);
      requestFaceChange(h, 0, 1, "tier", 2);
      requestFaceChange(h, 0, 2, "tier", 2);
      const cheap = quoteFaceTier(h, 0, 1, 2).cost,
        expensive = quoteFaceTier(h, 0, 0, 4).cost;
      const original = Math.random;
      let calls = 0;
      Math.random = () => {
        calls++;
        return 0.999999;
      };
      try {
        processQueuedReelChanges(h);
        normaliseReelQueue(h);
        iconReelEditor(0);
        const before = calls;
        h.points = cheap;
        const count = processQueuedReelChanges(h);
        return {
          before,
          calls,
          count,
          cheap,
          expensive,
          points: h.points,
          tiers: h.reels[0].slice(0, 3).map((f) => f.tier),
          queue: h.reelQueue.length,
        };
      } finally {
        Math.random = original;
      }
    });
  assert.equal(r.before, 0);
  assert.equal(r.calls, 1);
  assert.equal(r.count, 1);
  assert.ok(r.expensive > r.cheap);
  assert.equal(r.points, 0);
  assert.deepEqual(r.tiers, [1, 1, 2]);
  assert.equal(r.queue, 2);
});
test("level-up points auto-buy atomically at the action boundary and preserve real downgrade receipts", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0],
        cost = quoteFaceTier(h, 0, 0, 4).cost;
      requestFaceChange(h, 0, 0, "tier", 4);
      h.points = cost - 4;
      busy = true;
      addXP(h, 12);
      save();
      const spinning = { tier: h.reels[0][0].tier, points: h.points };
      busy = false;
      render();
      save();
      const bought = {
        tier: h.reels[0][0].tier,
        points: h.points,
        queue: h.reelQueue.length,
      };
      const refund = quoteFaceTier(h, 0, 0, 1).cost;
      setFaceTier(h, 0, 0, 1);
      return {
        cost,
        spinning,
        bought,
        refund,
        points: h.points,
        receipt: h.reels[0][0].investments,
      };
    });
  assert.deepEqual(r.spinning, { tier: 1, points: r.cost });
  assert.deepEqual(r.bought, { tier: 4, points: 0, queue: 0 });
  assert.ok(r.refund < 0);
  assert.equal(r.points, -r.refund);
  assert.deepEqual(r.receipt, {});
});
test("refunds can pay another queued face and autoplay saves personal points for a player's plans", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.points = 100;
      setFaceTier(h, 0, 1, 4);
      h.points = 0;
      requestFaceChange(h, 0, 0, "tier", 2);
      const before = JSON.stringify(h.reels),
        ai = autoUpgradeHero(h),
        unchanged = before === JSON.stringify(h.reels);
      requestFaceChange(h, 0, 1, "tier", 1);
      save();
      return {
        ai,
        unchanged,
        tier: h.reels[0][0].tier,
        queue: h.reelQueue.length,
        points: h.points,
      };
    });
  assert.equal(r.ai, 0);
  assert.ok(r.unchanged);
  assert.equal(r.tier, 2);
  assert.equal(r.queue, 0);
  assert.ok(r.points >= 0);
});
test("queue settings and unpaid plans survive a real reload, then buy on a later point award", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    requestFaceChange(state.party[0], 0, 0, "tier", 3);
    save();
  });
  await p.reload();
  await p.evaluate(() => CompanyIntro.skip(true));
  const r = await p.evaluate(() => {
    closeModal();
    const h = state.party[0],
      pending = h.reelQueue.length,
      allowed = preferences().queueReelChanges;
    h.points = quoteFaceTier(h, 0, 0, 3).cost;
    save();
    return {
      pending,
      allowed,
      tier: h.reels[0][0].tier,
      points: h.points,
      queue: h.reelQueue.length,
    };
  });
  assert.deepEqual(r, {
    pending: 1,
    allowed: true,
    tier: 3,
    points: 0,
    queue: 0,
  });
});
test("stale, malformed, duplicate, forbidden class and summon plans cannot spend points or alter immutable marks", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      requestFaceChange(h, 0, 0, "tier", 4);
      h.reels[0][0].tier = 2;
      const seal = h.reels[1].findIndex((f) => f.type === "class"),
        original = JSON.stringify(h.reels[1][seal]);
      h.reelQueue.push(
        null,
        { reel: -1, index: 0, kind: "tier", target: 4, expected: "bad" },
        {
          reel: 1,
          index: seal,
          kind: "swap",
          target: "attack",
          expected: facePlanStamp(h.reels[1][seal]),
        },
      );
      h.points = 100;
      processQueuedReelChanges(h);
      const master = makeHero("Master", "necromancer"),
        summon = createSummon(master, { kind: "guard", seed: 12 });
      state.party.push(summon);
      summon.points = 100;
      const f = summon.reels[0].findIndex(
        (f) => !["class", "mystery", "blank"].includes(f.type),
      );
      summon.reelQueue = [
        {
          reel: 0,
          index: f,
          kind: "tier",
          target: 4,
          expected: facePlanStamp(summon.reels[0][f]),
        },
      ];
      const fixed = JSON.stringify(summon.reels);
      processQueuedReelChanges(summon);
      return {
        summonQueue: summon.reelQueue.length,
        summonFixed: fixed === JSON.stringify(summon.reels),
        summonRejected: requestFaceChange(summon, 0, f, "tier", 4),
        points: h.points,
        queue: h.reelQueue.length,
        seal: original === JSON.stringify(h.reels[1][seal]),
        protected: requestFaceChange(h, 1, seal, "tier", 4),
        illegal: requestFaceChange(h, 0, 0, "swap", "harvest"),
      };
    });
  assert.equal(r.points, 100);
  assert.equal(r.queue, 0);
  assert.ok(r.seal);
  assert.equal(r.protected, null);
  assert.equal(r.illegal, null);
  assert.equal(r.summonQueue, 0);
  assert.ok(r.summonFixed);
  assert.equal(r.summonRejected, null);
});
test("valid plans survive adjacent malformed and duplicate save entries without mutating during quotes", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      requestFaceChange(h, 0, 0, "tier", 3);
      h.reelQueue.push(null, { ...h.reelQueue[0] });
      const before = JSON.stringify(h.reelQueue),
        quote = quoteFaceChange(h, 0, 0, "tier", 3),
        pure = before === JSON.stringify(h.reelQueue);
      normaliseReelQueue(h);
      const kept = h.reelQueue.length;
      h.points = quote.cost;
      const bought = processQueuedReelChanges(h);
      return {
        pure,
        kept,
        bought,
        points: h.points,
        tier: h.reels[0][0].tier,
        queue: h.reelQueue.length,
      };
    });
  assert.deepEqual(r, {
    pure: true,
    kept: 1,
    bought: 1,
    points: 0,
    tier: 3,
    queue: 0,
  });
});
test("retired weighting, invalid operations and downgrading an empty face cannot create a queued replacement", async (t) => {
  const p = await game(t),
    r = await p.evaluate(() => {
      const h = state.party[0];
      h.points = 100;
      h.reels[0][0] = { type: "blank", tier: 1, weight: 1 };
      const before = JSON.stringify(h);
      for (const op of ["weight", "unknown", "weaken", "swap"])
        editFace("0,0,0", op);
      return {
        unchanged: before === JSON.stringify(h),
        points: h.points,
        queue: h.reelQueue.length,
      };
    });
  assert.deepEqual(r, { unchanged: true, points: 100, queue: 0 });
});
test("the reversible legacy editor queues the same paid edit and can cancel its pending plan", async (t) => {
  const p = await game(t);
  await p.evaluate(() => {
    reelWorkshopLayout = "legacy";
    editor(0);
  });
  await p.locator("[data-upgrade]").click();
  assert.equal(await p.evaluate(() => state.party[0].reelQueue.length), 1);
  assert.equal(await p.locator(".queued-face").count(), 1);
  await p.locator("#cancel-face-queue").click();
  assert.equal(await p.evaluate(() => state.party[0].reelQueue.length), 0);
});
test("all class palettes keep queue controls, symbol labels and fixed footer inside desktop and compact sheets", async (t) => {
  const p = await game(t),
    failures = [];
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [390, 844],
    [320, 844],
  ]) {
    await p.setViewportSize({ width, height });
    for (const job of [
      "fighter",
      "rogue",
      "mage",
      "ranger",
      "berserker",
      "jester",
      "bloodbinder",
      "necromancer",
    ]) {
      await p.evaluate(async (job) => {
        closeModal();
        newRun(job);
        closeModal();
        state.party[0].points = 0;
        editor(0);
        await document.fonts.ready;
        fitDialogs();
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      }, job);
      const r = await p.evaluate(() => {
        const m = $("#modal").getBoundingClientRect(),
          flow = $(".modal-flow").getBoundingClientRect(),
          footer = $(".modal-actions").getBoundingClientRect();
        const outside = [
          ...document.querySelectorAll(
            '.workshop-page:not([aria-hidden="true"]) button,.workshop-queue-controls,.workshop-queue-status,.modal-actions',
          ),
        ]
          .filter((e) => {
            const b = e.getBoundingClientRect();
            return (
              b.width &&
              b.height &&
              (b.left < m.left - 1 ||
                b.right > m.right + 1 ||
                b.bottom > flow.bottom + 1)
            );
          })
          .map((e) => e.textContent.slice(0, 35));
        return { outside, top: m.top, bottom: m.bottom, footer: footer.bottom };
      });
      if (r.outside.length || r.top < 0 || r.bottom > height + 1)
        failures.push({ job, width, ...r });
      if (job === "fighter" || job === "bloodbinder")
        await p.screenshot({ path: path.join(out, `${job}-${width}.png`) });
    }
  }
  assert.deepEqual(failures, []);
});
