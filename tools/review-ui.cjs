#!/usr/bin/env node
// Reproducible visual fixtures. Nothing in this script is shipped in the game.
const { chromium } = require("playwright");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "..");
const output = path.join(root, "test-results/ui-review");

(async () => {
  await fs.mkdir(output, { recursive: true });
  const html = await fs.readFile(path.join(root, "index.html"));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    });
    const page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
    });
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("request", (request) => requests.push(request.url()));
    await page.addInitScript(() => {
      let seed = 107;
      Math.random = () =>
        ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const shots = [];
    async function shot(name, fullPage = false, animations = "disabled") {
      await page.evaluate(async () => {
        await document.fonts.ready;
        fitNotebook();
        requestFitUI();
      });
      await page.waitForTimeout(180);
      await page.screenshot({
        path: path.join(output, name + ".png"),
        fullPage,
        animations,
      });
      shots.push(name);
    }
    await page.waitForTimeout(1300);
    await shot("01-starting-class");
    await page.locator('[data-start-job="rogue"]').click();
    await page.evaluate(() => {
      setPace("skip");
      state.steps = 17;
      // Art-review fixture: expose the boundary and a few lower-left passages.
      state.map.forEach((cell, i) => {
        if (cell.wall || (i % W <= 5 && Math.floor(i / W) >= 5))
          cell.seen = true;
      });
      state.gold = 15;
      render();
      particles = [];
    });
    await shot("02-exploration");
    await page.evaluate(() => {
      beginEncounter();
      Object.assign(state.enemy, {
        art: "gnawer",
        name: "Candle gnawer",
        hp: 10,
        maxHp: 21,
        damage: 2,
        frequency: 3,
        countdown: 2,
        elite: false,
        affix: null,
      });
      render();
      particles = [];
    });
    await shot("03-combat-default-1920");
    for (const palette of ["dark", "warm"]) {
      await page.evaluate((value) => setPalette(value), palette);
      await shot("04-combat-" + palette);
    }
    await page.evaluate(() => {
      setPalette("default");
      state.party.push(
        makeHero("Mira", "healer"),
        makeHero("Alden", "fighter"),
      );
      state.party[1].hp = 5;
      state.party[2].hp = 27;
      state.depth = 6;
      beginEncounter(false, { count: 2 });
      state.bag = { potion: 2, bomb: 1, ward: 1 };
      render();
      particles = [];
    });
    await shot("05-paired-1920");
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot("06-paired-1280");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("07-mobile", true);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      optionsPage();
      particles = [];
    });
    await shot("08-options");
    for (const tab of ["audio", "display", "future"]) {
      await page.locator("#tab-" + tab).click();
      await shot("08-options-" + tab);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("08-options-mobile");
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.evaluate(() => help());
    await shot("09-field-guide");
    await page.evaluate(() => {
      closeModal();
      editor(0);
    });
    await shot("10-reel-editor");
    await page.evaluate(() => {
      closeModal();
      newRun("rogue");
      setPace("skip");
      window.reviewRandom = Math.random;
      Math.random = () => 0;
      window.reviewLoot = treasureRoll();
    });
    await page.waitForSelector("#stage-confirm", { timeout: 15000 });
    await shot("11-treasure-critical");
    await page.locator("#stage-confirm").click();
    await page.evaluate(async () => {
      await window.reviewLoot;
      Math.random = window.reviewRandom;
    });
    await page.evaluate(() => {
      state.party.push(
        makeHero("Mira", "healer"),
        makeHero("Alden", "fighter"),
      );
      state.depth = 8;
      state.floorStart = floorSnapshot();
      beginEncounter(false, { count: 2 });
      state.enemies[0].passive = { key: "summoner", turns: 1 };
      state.enemies[1].passive = { key: "carapace" };
      state.party[1].hp = 6;
      state.party[0].trait = {
        id: "heroic",
        reason: "Defeated a guardian alone.",
        step: 0,
        battles: 0,
      };
      state.party[1].trait = {
        id: "merciful",
        reason: "Mended the party through a long fight.",
        step: 0,
        battles: 0,
      };
      state.party[2].trait = {
        id: "stubborn",
        reason: "Held firm under pressure.",
        step: 0,
        battles: 0,
      };
      state.party[0].equipment = "silentBoots";
      state.party[1].equipment = "glassRosary";
      state.party[2].equipment = "bulwarkBadge";

      state.party[1].poison = { turns: 4, damage: 1 };
      state.party[2].stun = 1;
      state.bag = { potion_3: 1, bomb_3: 1, firebomb_3: 1 };
      for (const i of [pos(7, 5), pos(8, 5), pos(9, 5)])
        Object.assign(state.map[i], {
          wall: true,
          seen: true,
          terrain: "river",
          event: null,
          feature: null,
        });
      render();
      particles = [];
    });
    await shot("12-status-and-passives");
    await page.evaluate(() => setPalette("dark"));
    await shot("13-status-dark");
    await page.evaluate(() => {
      setPalette("default");
      clearBattleStatuses();
      state.enemy = null;
      state.enemies = [];
      state.steps = 42;
      state.battlesWon = 5;
      state.gold = 90;
      state.floorBossDefeated = true;
      state.party[0].stats.damageDealt = 185;
      state.party[0].stats.xpEarned = 70;
      state.floorStart.depth = 8;
      window.reviewClear = celebrateFloorClear();
    });
    await page.waitForSelector("#stage-confirm");
    await shot("14-floor-clear");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("15-floor-clear-mobile");
    await page.locator("#stage-confirm").click();
    await page.evaluate(() => window.reviewClear);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      state.depth = 10;
      state.floorStart = floorSnapshot();
      state.steps += 22;
      state.battlesWon += 4;
      state.party[0].stats.damageDealt += 240;
      finishVictory();
    });
    await shot("16-victory-records");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("17-victory-mobile");
    await page.evaluate(() => closeModal());
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      const p = emptyProfile();
      p.gold = 315;
      p.owned = ["ranger", "springs"];
      p.enabled = ["springs"];
      localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
      chooseStartingClass(false);
    });
    await shot("18-five-starting-classes");
    await page.locator("#camp-open").click();
    await shot("19-camp-adventurers");
    for (const tab of ["boons", "challenges", "oddities"]) {
      await page.locator(`[data-camp-tab="${tab}"]`).click();
      await shot("20-camp-" + tab);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("21-camp-mobile");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      newRun("ranger");
      state.party[0].charge = 9;
      state.party[0].equipment = "trailBow";
      state.depth = 4;
      beginEncounter(true, { stairBoss: true });
      state.party[0].charge = 9;
      render();
      particles = [];
    });
    await shot("22-ranger-guardian-1280");
    await page.locator("#portrait-0 .aim-badge").hover();
    await shot("23-status-tooltip");
    await page.mouse.move(1, 1);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      window.reviewCritRandom = Math.random;
      Math.random = () => 0.999;
      window.reviewEnemyCrit = rollCritical(
        state.enemy.name,
        [0, 1, 2].map(() => ({ type: "attack", tier: 4 })),
        true,
        { details: [{ label: "Damage", icon: "sword", value: 13 }] },
      );
    });
    await page.waitForFunction(() => !!criticalHoldResolver);
    await shot("24-enemy-critical");
    await page.evaluate(async () => {
      fastForward();
      await window.reviewEnemyCrit;
      Math.random = window.reviewCritRandom;
    });
    await page.evaluate(() => {
      const gallery = document.createElement("section");
      gallery.id = "new-enemy-review";
      gallery.style.cssText =
        "position:fixed;inset:30px;z-index:5000;background:var(--paper);color:var(--ink);padding:30px;display:grid;grid-template-columns:repeat(5,1fr);gap:25px";
      for (const kind of [
        "moth",
        "rustmite",
        "sporepilgrim",
        "mirrorhound",
        "ashcolossus",
      ]) {
        const d = ENEMY_PROFILES[kind],
          cell = document.createElement("article");
        cell.className = "pencil-card";
        cell.style.cssText =
          "padding:16px;text-align:center;display:grid;align-content:start;gap:10px";
        cell.innerHTML = `<h2>${d.name}</h2><p>Floors ${d.minDepth}–${d.maxDepth}</p>${portraitArt(kind, { hp: 100, maxHp: 100 })}${portraitArt(kind, { hp: 20, maxHp: 100 })}${corpseArt(kind)}`;
        cell.querySelectorAll("svg").forEach((svg) => {
          svg.style.height = "190px";
          svg.style.width = "100%";
        });
        gallery.append(cell);
      }
      document.body.append(gallery);
    });
    await shot("25-five-new-enemy-sketches");
    await page.evaluate(() =>
      document.querySelector("#new-enemy-review").remove(),
    );
    for (const kind of ["damage", "heal", "critical"]) {
      await page.evaluate((kind) => {
        screenFX(kind, 1.2);
        const effect = document
          .querySelector("#screen-edge-fx")
          .getAnimations()[0];
        effect.pause();
        effect.currentTime = 90;
      }, kind);
      await shot("26-screen-edges-" + kind, false, "allow");
    }
    await page.evaluate(() => {
      clearScreenFX();
      state.party.push(makeHero("Mira", "healer"), makeHero("Wren", "rogue"));
      render();
    });
    await shot("29-ranger-party-1920");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await shot("30-ranger-party-" + width, true);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => optionsPage("display"));
    await shot("27-display-edge-toggle");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("28-display-edge-toggle-mobile");
    await page.evaluate(() => closeModal());
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const block of [0, 10, 20]) {
      await page.evaluate((block) => {
        state.block = block;
        renderBlock();
      }, block);
      await shot("31-protection-" + block);
    }
    await page.evaluate(() => setPalette("dark"));
    await shot("32-protection-dark");
    await page.evaluate(() => {
      setPalette("default");
      Object.assign(state.party[0].stats, {
        kills: 12,
        damageDealt: 345,
        damageTaken: 48,
        healingReceived: 62,
        criticals: 9,
      });
      render();
    });
    await page.locator("#portrait-0").hover({ position: { x: 10, y: 10 } });
    await shot("33-hero-statistics");
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator("#portrait-0").hover({ position: { x: 10, y: 10 } });
    await shot("34-hero-statistics-mobile");
    await page.mouse.move(1, 1);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      state.block = 20;
      renderBlock();
      damageHero(0, 6, "The Bell Below", { attacker: state.enemy });
    });
    await shot("35-shield-interception", false, "allow");
    await page.evaluate(() => {
      state.depth = 10;
      state.gold = 235;
      state.floorBossDefeated = true;
      finishVictory();
    });
    await shot("36-victory-bank-fireworks");
    await page.evaluate(() => closeModal());
    const download = page.waitForEvent("download");
    await page.locator("#download").click();
    await (
      await download
    ).saveAs(path.join(output, "ScratchpadDungeon-pencil-notebook.html"));
    const report = {
      screenshots: shots,
      errors,
      externalRequests: requests.filter(
        (url) =>
          !url.startsWith("http://127.0.0.1:") && !url.startsWith("data:"),
      ),
    };
    await fs.writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (report.errors.length || report.externalRequests.length)
      throw Error(JSON.stringify(report));
    console.log(
      `Saved ${shots.length} UI screenshots and a playable HTML backup to ${output}`,
    );
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
