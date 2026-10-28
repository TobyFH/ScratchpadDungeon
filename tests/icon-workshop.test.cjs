const { test, before, after } = require("node:test");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  http = require("node:http"),
  path = require("node:path");
const { chromium } = require("playwright");
let browser, server, url;
const out = path.resolve(__dirname, "../test-results/icon-workshop");
before(async () => {
  fs.mkdirSync(out, { recursive: true });
  const html = fs.readFileSync(path.resolve(__dirname, "../index.html"));
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
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.evaluate(async () => {
    newRun("fighter");
    setPace("skip");
    closeModal();
    closeSpotlight();
    characterLuck = () => 0.99999;
    state.party[0].points = 100;
    await document.fonts.ready;
    editor(0);
  });
  t.after(async () => {
    await p.close();
    assert.deepEqual(errors, []);
  });
  return p;
}
test("rank buttons quote the complete unchanged upgrade cost and paid downgrade refund, with atomic affordability", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      face = { type: "attack", tier: 1, weight: 1 };
    h.reels[0][0] = face;
    const before = JSON.stringify(h),
      up = quoteFaceTier(h, 0, 0, 4),
      untouched = before === JSON.stringify(h);
    const expected = [2, 3, 4].reduce(
      (n, t) => n + classFacePrice(h, "attack", FACE_COST[t]),
      0,
    );
    h.points = up.cost - 1;
    const broke = JSON.stringify(h),
      rejected = setFaceTier(h, 0, 0, 4),
      atomic = broke === JSON.stringify(h);
    h.points = 100;
    setFaceTier(h, 0, 0, 4);
    const down = quoteFaceTier(h, 0, 0, 1),
      refund = [2, 3, 4].reduce(
        (n, t) => n + Math.max(1, Math.floor(h.reels[0][0].investments[t] / 2)),
        0,
      );
    setFaceTier(h, 0, 0, 1);
    return {
      up: up.cost,
      expected,
      untouched,
      rejected,
      atomic,
      down: down.cost,
      refund,
      points: h.points,
      tier: h.reels[0][0].tier,
    };
  });
  assert.equal(r.up, r.expected);
  assert.ok(r.untouched && r.atomic);
  assert.equal(r.rejected, false);
  assert.equal(r.down, -r.refund);
  assert.equal(r.points, 100 - r.up + r.refund);
  assert.equal(r.tier, 1);
});
test("clicking a symbol replaces it immediately and clicking any rank applies that rank without a dropdown", async (t) => {
  const p = await game(t);
  await p.locator('[data-set-face-type="block"]').click();
  let r = await p.evaluate(() => ({
    type: state.party[0].reels[0][0].type,
    points: state.party[0].points,
  }));
  assert.equal(r.type, "block");
  assert.ok(r.points < 100);
  await p.locator('[data-set-face-tier="4"]').click();
  assert.equal(await p.evaluate(() => state.party[0].reels[0][0].tier), 4);
  const before = await p.evaluate(() => state.party[0].points);
  await p.locator('[data-set-face-tier="1"]').click();
  assert.ok((await p.evaluate(() => state.party[0].points)) > before);
  assert.equal(await p.locator("#face-destination").count(), 0);
  assert.equal(await p.locator("[data-upgrade]").count(), 0);
  assert.equal(await p.locator("[data-weaken]").count(), 0);
});
test("class and mystery marks stay immutable; blank inscription requires an explicit type and all class palettes are correct", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const result = [];
    for (const job of [
      "fighter",
      "rogue",
      "mage",
      "ranger",
      "berserker",
      "jester",
    ]) {
      newRun(job);
      state.party[0].points = 100;
      const h = state.party[0];
      editorSelection = {
        heroId: h.id,
        reel: 1,
        face: h.reels[1].findIndex((f) => f.type === "class"),
      };
      editor(0);
      if (
        ![
          ...document.querySelectorAll(
            "[data-set-face-type],[data-set-face-tier]",
          ),
        ].every((b) => b.disabled)
      )
        throw Error(job + " seal editable");
      if (quoteFaceTier(h, 1, editorSelection.face, 4) !== null)
        throw Error("class tier quote");
      const index = h.reels[0].findIndex((f) => f.type === "blank");
      editorSelection = { heroId: h.id, reel: 0, face: index };
      editor(0);
      if (
        ![...document.querySelectorAll("[data-set-face-tier]")].every(
          (b) => b.disabled,
        )
      )
        throw Error("blank tier before explicit inscription");
      const types = [...document.querySelectorAll("[data-set-face-type]")].map(
        (b) => b.dataset.setFaceType,
      );
      result.push({ job, types });
    }
    return result;
  });
  const b = r.find((x) => x.job === "berserker");
  assert.ok(b.types.includes("selfheal") && !b.types.includes("heal"));
  assert.ok(r.find((x) => x.job === "mage").types.includes("heal"));
  assert.ok(!r.some((x) => x.types.includes("class")));
});
test("the previous editor can be restored with one layout switch without changing saved reels or prices", async (t) => {
  const p = await game(t);
  const r = await p.evaluate(() => {
    const h = state.party[0],
      before = JSON.stringify(h.reels);
    reelWorkshopLayout = "legacy";
    editor(0);
    const legacy = !!$("#face-destination") && !$(".icon-workshop");
    reelWorkshopLayout = "icons";
    editor(0);
    return {
      legacy,
      icons: !!$(".icon-workshop"),
      unchanged: before === JSON.stringify(h.reels),
    };
  });
  assert.deepEqual(r, { legacy: true, icons: true, unchanged: true });
});
test("every class, permanent face and workshop page fits without scrolling/overlap at desktop, Deck and small phone sizes", async (t) => {
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
    ]) {
      await p.evaluate(async (job) => {
        closeModal();
        newRun(job);
        state.party[0].points = 100;
        editor(0);
        await document.fonts.ready;
        fitDialogs();
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
      }, job);
      const result = await p.evaluate(() => {
        const modal = $("#modal"),
          m = modal.getBoundingClientRect(),
          footer = $(".modal-actions").getBoundingClientRect(),
          flow = $(".modal-flow"),
          f = flow.getBoundingClientRect();
        const outside = [
          ...document.querySelectorAll(
            "[data-set-face-type],[data-set-face-tier]",
          ),
        ]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return (
              r.left < m.left - 1 ||
              r.right > m.right + 1 ||
              r.bottom > footer.top + 1 ||
              r.top < f.top - 1
            );
          })
          .map((b) => b.textContent);
        const badText = [];
        for (const b of document.querySelectorAll(
          "[data-set-face-type],[data-set-face-tier]",
        )) {
          const rect = b.getBoundingClientRect(),
            walker = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (!walker.currentNode.textContent.trim()) continue;
            const range = document.createRange();
            range.selectNodeContents(walker.currentNode);
            for (const t of range.getClientRects())
              if (
                t.left < rect.left - 1 ||
                t.right > rect.right + 1 ||
                t.bottom > rect.bottom + 1 ||
                t.top < rect.top - 1
              )
                badText.push(b.textContent);
          }
        }
        return {
          outside,
          badText,
          flowFits:
            $(".icon-workshop-pages").getBoundingClientRect().bottom <=
            footer.top + 1,
          bounds: m.toJSON(),
          font:
            parseFloat(
              getComputedStyle($("[data-set-face-type] .choice-name")).fontSize,
            ) * Number(flow.style.zoom || 1),
        };
      });
      if (
        result.outside.length ||
        result.badText.length ||
        !result.flowFits ||
        result.font < 12
      )
        failures.push({ width, job, ...result });
      await p.screenshot({
        path: path.join(out, `${job}-${width}.png`),
        animations: "disabled",
      });
    }
  }
  fs.writeFileSync(path.join(out, "geometry.json"), JSON.stringify(failures, null, 2));
    assert.deepEqual(failures, []);
});
test("page tabs and Done stay fixed, permanent marks retain edit geometry and long effect summaries do not overlap", async (t) => {
  const p = await game(t);
  for (const width of [1280, 390, 320]) {
    await p.setViewportSize({ width, height: width > 500 ? 800 : 844 });
    for (const job of ["fighter", "mage", "berserker", "jester"]) {
      await p.evaluate((job) => {
        closeModal();
        newRun(job);
        state.party[0].points = 100;
        editor(0);
        fitDialogs();
      }, job);
      const position = () =>
          p.evaluate(() => {
            fitDialogs();
            return {
              tab: $('[data-workshop-view="edit"]').getBoundingClientRect().top,
              done: $(".modal-actions").getBoundingClientRect().top,
            };
          }),
        before = await position();
      for (const view of ["crits", "prices", "edit"]) {
        await p.locator(`[data-workshop-view="${view}"]`).click();
        const after = await position();
        assert.ok(
          Math.abs(after.tab - before.tab) < 2 &&
            Math.abs(after.done - before.done) < 2,
          JSON.stringify({ width, job, view, before, after }),
        );
      }
      await p.evaluate(() => {
        const h = state.party[0];
        editorSelection = {
          heroId: h.id,
          reel: 1,
          face: h.reels[1].findIndex((f) => f.type === "class"),
        };
        editor(0);
        fitDialogs();
      });
      const locked = await p.evaluate(() => {
        const p = $(".face-effect"),
          r = document.createRange();
        r.selectNodeContents(p);
        const text = r.getBoundingClientRect(),
          box = p.getBoundingClientRect();
        return {
          fits: text.bottom <= box.bottom + 1,
          locked: [
            ...document.querySelectorAll(
              "[data-set-face-type],[data-set-face-tier]",
            ),
          ].every((b) => b.disabled),
          text: p.textContent,
        };
      });
      assert.ok(
        locked.fits && locked.locked,
        JSON.stringify({ width, job, ...locked }),
      );
      await p.screenshot({
        path: path.join(out, `${job}-seal-${width}.png`),
        animations: "disabled",
      });
    }
  }
});
