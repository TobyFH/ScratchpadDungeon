const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { readFile, mkdir } = require("node:fs/promises");
const { existsSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");
let browser, server, url;
const output = path.resolve(__dirname, "../test-results");
before(async () => {
  const html = await readFile(path.resolve(__dirname, "../index.html"));
  server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    args: ["--no-sandbox"],
  });
  await mkdir(output, { recursive: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise((resolve) => server.close(resolve));
});
async function notebook(t) {
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
  });
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/*", (route) => {
    if (
      !route.request().url().startsWith(url) &&
      !route.request().url().startsWith("data:")
    ) {
      external.push(route.request().url());
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(url);
  await page.evaluate(async () => {
    newRun("rogue");
    setPace("skip");
    await document.fonts.ready;
  });
  t.after(async () => {
    await page.close();
    assert.deepEqual(errors, [], "no runtime or malformed SVG errors");
    assert.deepEqual(external, [], "art and fonts need no external requests");
  });
  return page;
}

async function assertMenuContrast(page, context) {
  const options = await page.locator("select option").evaluateAll((entries) => {
    const luminance = (color) => {
      const rgb = color
        .match(/[\d.]+/g)
        .slice(0, 3)
        .map((value) => {
          const v = Number(value) / 255;
          return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
        });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return entries.map((entry) => {
      const style = getComputedStyle(entry),
        ink = luminance(style.color),
        paper = luminance(style.backgroundColor);
      return {
        text: entry.textContent,
        background: style.backgroundColor,
        contrast: (Math.max(ink, paper) + 0.05) / (Math.min(ink, paper) + 0.05),
      };
    });
  });
  assert.ok(
    options.length > 0 && options.every((o) => o.contrast >= 7),
    `${context}: native dropdown options must have explicit readable colours: ${JSON.stringify(options)}`,
  );
}

test("pencil drawings cover every species and injury state without consuming gameplay randomness", async (t) => {
  const page = await notebook(t);
  const result = await page.evaluate(() => {
    const random = Math.random,
      before = JSON.stringify(state);
    const gallery = document.createElement("div");
    gallery.id = "art-review";
    gallery.style.cssText =
      "position:fixed;inset:12px;z-index:1000;background:var(--paper);padding:16px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px;color:var(--ink)";
    try {
      Math.random = () => {
        throw Error("Artwork consumed gameplay RNG");
      };
      for (const kind of [
        "fighter",
        "healer",
        "rogue",
        "mage",
        "skeleton",
        "rat",
        "ghost",
        "slime",
        "mimic",
        "gnawer",
        "bellkeeper",
        "widow",
        "oracle",
        "pageeater",
        "pursuer",
        "revenant",
        "demon",
        "lich",
        "abomination",
      ]) {
        const cell = document.createElement("section");
        cell.innerHTML = `<b>${kind}</b><div style="display:flex;gap:3px">${[100, 20, 0].map((hp) => portraitArt(kind, { hp, maxHp: 100 })).join("")}</div>`;
        cell
          .querySelectorAll("svg")
          .forEach((svg) => (svg.style.cssText = "width:30%;height:155px"));
        gallery.append(cell);
      }
      document.body.append(gallery);
    } finally {
      Math.random = random;
    }
    return {
      unchanged: JSON.stringify(state) === before,
      total: gallery.querySelectorAll("svg.pencil-art").length,
      injuries: gallery.querySelectorAll(".injury-marks").length,
      corpses: gallery.querySelectorAll(".corpse-art").length,
      accessible: [...gallery.querySelectorAll("svg")].every(
        (svg) => svg.getAttribute("aria-hidden") === "true",
      ),
      geometry: Object.values(paths).every((d) => {
        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path",
        );
        path.setAttribute("d", d);
        const original = path.getTotalLength();
        path.setAttribute("d", pencilPath(d, 0.32));
        const drawn = path.getTotalLength();
        return (
          Number.isFinite(drawn) &&
          drawn >= original * 0.98 &&
          drawn < original * 1.08
        );
      }),
    };
  });
  assert.deepEqual(result, {
    unchanged: true,
    total: 57,
    injuries: 19,
    corpses: 19,
    accessible: true,
    geometry: true,
  });
  assert.equal(
    await page
      .locator("#art-review .species-gnawer image")
      .first()
      .evaluate(async (el) => {
        const bitmap = new Image();
        bitmap.src = el.getAttribute("href");
        await bitmap.decode();
        return (
          bitmap.src.startsWith("data:image/png;base64,") &&
          bitmap.naturalWidth > 0 &&
          bitmap.naturalHeight > 0
        );
      }),
    true,
    "the graphite creature scan decodes from the offline HTML itself",
  );
  await page.screenshot({ path: path.join(output, "pencil-art-gallery.png") });
});

test("notebook palettes keep contrast, embedded typography, stable tabs and keyboard focus", async (t) => {
  const page = await notebook(t);
  assert.equal(
    await page.evaluate(() =>
      document.fonts.check('700 30px "Notebook Lettering"'),
    ),
    true,
  );
  for (const palette of ["default", "dark", "warm"]) {
    await page.evaluate((palette) => setPalette(palette), palette);
    await assertMenuContrast(page, `${palette} toolbar`);
    const contrast = await page.evaluate(() => {
      const probe = document.createElement("span");
      document.body.append(probe);
      function luminance(token) {
        probe.style.color = `var(${token})`;
        const rgb = getComputedStyle(probe)
          .color.match(/[\d.]+/g)
          .slice(0, 3)
          .map((x) => {
            x = Number(x) / 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      }
      const paper = luminance("--paper"),
        ink = luminance("--ink"),
        soft = luminance("--soft");
      probe.remove();
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { body: ratio(paper, ink), secondary: ratio(paper, soft) };
    });
    assert.ok(
      contrast.body >= 7 && contrast.secondary >= 4.5,
      JSON.stringify({ palette, contrast }),
    );
    assert.equal(
      await page
        .locator(".tier-symbol.attack svg")
        .first()
        .evaluate(
          (el) =>
            getComputedStyle(el).color ===
            getComputedStyle(document.body).color,
        ),
      true,
      `${palette} attack icons inherit the readable graphite colour`,
    );
  }
  await page.evaluate(() => setPalette("default"));
  await page.locator("#options-tab").hover();
  // A busy browser may not paint the CSS transition within a fixed 200ms.
  // Wait for the visible state we actually require, without weakening it.
  await page.waitForFunction(() => {
    const tab = document.querySelector("#options-tab");
    const matrix = new DOMMatrix(getComputedStyle(tab).transform);
    return tab.matches(":hover") && matrix.a > 1 && matrix.d > 1;
  });
  const transform = await page.locator("#options-tab").evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.a, y: m.d, skewX: m.b, skewY: m.c };
  });
  assert.ok(transform.x > 1 && transform.y > 1);
  assert.equal(transform.skewX, 0);
  assert.equal(transform.skewY, 0);
  await page.locator("#options-tab").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#option-speed");
  for (const palette of ["default", "dark", "warm"]) {
    await page.evaluate((palette) => setPalette(palette), palette);
    await assertMenuContrast(page, `${palette} options page`);
  }
  await page.evaluate(() => {
    setPalette("default");
    setPace("1");
  });
  await page.locator("#animation-speed").click();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  assert.equal(
    await page.locator("#animation-speed").inputValue(),
    "2",
    "the native expanded speed menu remains keyboard-selectable above a dialog",
  );
  await page.evaluate(() => setPace("skip"));
  assert.equal(await page.locator("#modal-title").textContent(), "Options");
  assert.equal(
    await page.locator("#animation-speed").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        ) === el
      );
    }),
    true,
    "the main animation control remains mouse-accessible above a popup",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.matches("button,select,input"),
    ),
    true,
  );
  const frames = await page.evaluate(() =>
    [".journal", ".inventory", "#modal"].map(
      (s) => getComputedStyle(document.querySelector(s)).borderImageSource,
    ),
  );
  assert.ok(
    frames.every((frame) =>
      frame.startsWith('url("data:image/svg+xml;base64,'),
    ),
  );
  assert.equal(
    await page
      .locator("#modal-title")
      .evaluate((el) => getComputedStyle(el).filter),
    "none",
    "lettering is never distressed with art filters",
  );
  await page.screenshot({ path: path.join(output, "pencil-options.png") });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => {
      const toolbar = document
        .querySelector(".desk-top")
        .getBoundingClientRect();
      const modal = document.querySelector("#modal").getBoundingClientRect();
      return modal.top >= toolbar.bottom && modal.bottom <= innerHeight;
    }),
    true,
    "a wrapped compact toolbar never covers dialog content",
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.evaluate(() => help());
  await page.waitForTimeout(150);
  assert.ok(
    await page.evaluate(() => {
      const flow = document.querySelector(".modal-flow");
      const text = document.querySelector(".guide-grid p");
      return (
        parseFloat(getComputedStyle(text).fontSize) *
          Number(flow.style.zoom || 1) >=
        14
      );
    }),
    "desktop field-guide text remains readable after fitting",
  );
});

test("paired encounters, party labels, satchel pockets and log fit desktop and compact notebooks", async (t) => {
  const page = await notebook(t);
  await page.evaluate(() => {
    state.party.push(makeHero("Mira", "healer"), makeHero("Alden", "fighter"));
    state.party[1].hp = 5;
    state.depth = 6;
    beginEncounter(false, { count: 2 });
    state.bag = { potion_4: 2, bomb_3: 1, firebomb_4: 1 };
    state.enemies[0].name = "Chainbound revenant";
    state.enemies[1].name = "Blind bellkeeper";
    render();
    particles = [];
  });
  for (const [width, height] of [
    [1920, 1080],
    [1280, 800],
    [1024, 900],
    [390, 844],
    [320, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const metrics = await page.evaluate(() => {
      const box = (el) => el.getBoundingClientRect();
      const inventory = box(document.querySelector(".inventory"));
      const targets = box(document.querySelector("#targets")),
        journal = box(document.querySelector(".journal"));
      return {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
        pockets: [
          ...document.querySelectorAll(".inventory-items button"),
        ].every((el) => box(el).bottom <= inventory.bottom + 1),
        pocketText: [
          ...document.querySelectorAll(
            ".inventory-items button > span, .inventory-items button small",
          ),
        ].every((el) => {
          const parent = box(el.closest("button")),
            text = box(el);
          return (
            text.top >= parent.top &&
            text.bottom <= parent.bottom &&
            text.left >= parent.left &&
            text.right <= parent.right
          );
        }),
        enemies: [
          ...document.querySelectorAll(".enemy-box .machine-shell"),
        ].every((el) => box(el).bottom < targets.top),
        titles: [...document.querySelectorAll(".enemy-info h4")].every(
          (el) => el.scrollHeight <= el.clientHeight + 1,
        ),
        classes: [...document.querySelectorAll(".hero-dossier")].every(
          (el) =>
            box(el.querySelector(".hero-name")).bottom <=
            box(el.querySelector(".equipment-slot")).top + 1,
        ),
        healthAboveReels: [...document.querySelectorAll(".hero")].every(
          (el) => {
            const hp = box(el.querySelector(".hp-bar")),
              reel = box(el.querySelector(".machine-face")),
              xp = box(el.querySelector(".healthbar.exp")),
              lever = box(el.querySelector(".lever")),
              edit = box(el.querySelector(".edit-line"));
            return (
              hp.height >= 5 &&
              hp.bottom <= reel.top &&
              xp.top >= reel.bottom &&
              xp.top >= lever.bottom &&
              edit.bottom <= box(el).bottom + 1 &&
              Math.abs(hp.left - reel.left) < 1 &&
              Math.abs(hp.right - reel.right) < 1
            );
          },
        ),
        log: box(document.querySelector("#log")).bottom <= journal.bottom - 3,
      };
    });
    assert.ok(
      metrics.width <= width &&
        (width < 1260 || metrics.height <= height + 1) &&
        metrics.pockets &&
        metrics.pocketText &&
        metrics.enemies &&
        metrics.titles &&
        metrics.classes &&
        metrics.healthAboveReels &&
        metrics.log,
      JSON.stringify({ width, height, ...metrics }),
    );
    await page.screenshot({
      path: path.join(output, `pencil-paired-${width}.png`),
    });
  }
});
