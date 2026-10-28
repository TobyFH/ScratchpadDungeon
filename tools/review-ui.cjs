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
    await page.evaluate(() => {
      characterLuck = () => 0.999999;
      // Retained rollback editor; default icons have separate focused captures.
      reelWorkshopLayout = "legacy";
    });
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
    if (process.env.UI_REVIEW_SCOPE !== "identity") {
    if (process.env.UI_REVIEW_SCOPE !== "biomes") {
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
    await page.evaluate(() => setPalette("default"));
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot("03-gnawer-1280");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("03-gnawer-mobile", true);
    await page.setViewportSize({ width: 1920, height: 1080 });
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => help("statuses"));
    await shot("09-field-guide-statuses-1280");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => help("heroes"));
    await shot("09-field-guide-heroes-mobile");
    await page.setViewportSize({ width: 320, height: 844 });
    await page.evaluate(() => help("statuses"));
    await shot("09-field-guide-statuses-320");
    await page.setViewportSize({ width: 1920, height: 1080 });
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
    for (const tab of ["training", "challenges", "oddities"]) {
      await page.locator(`[data-camp-tab="${tab}"]`).click();
      await shot("20-camp-" + tab);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("21-camp-mobile");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.evaluate(() => {
      newRun("ranger");
      state.party[0].charge = 4;
      state.party[0].equipment = "trailBow";
      state.depth = 4;
      beginEncounter(true, { stairBoss: true });
      state.party[0].charge = 4;
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
    await page.locator("#portrait-0").hover({ position: { x: 40, y: 20 } });
    await shot("33-hero-statistics");
    await page.setViewportSize({ width: 320, height: 800 });
    await page.locator("#portrait-0").hover({ position: { x: 40, y: 20 } });
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
    // Current build system, shared shields, symbolic impacts and optional puns.
    await page.evaluate(() => {
      newRun("mage", { specialism: "defence" });
      setPace("skip");
      state.party.push(
        makeHero("Rowan", "ranger", null, [], { specialism: "offence" }),
        makeHero("Alden", "fighter", null, [], { specialism: "offence" }),
      );
      state.party[0].points = 28;
      state.party[0].hp = 12;
      state.party[1].charge = 4;
      state.depth = 6;
      beginEncounter(false, { count: 2 });
      setEnemyBlock(12);
      state.party[1].charge = 4;
      state.block = 8;
      render();
      particles = [];
    });
    await shot("37-hero-builds-shared-block");
    await page.evaluate(() => {
      setPace("1");
      setPreference("combatEffects", "icons");
      state.party[0].last = [
        { type: "heal", tier: 1 },
        { type: "class", tier: 1, job: "mage", mageRole: "heal" },
        { type: "heal", tier: 2 },
      ];
      state.currentHero = 0;
      render();
      beam($("#portrait-0"), $("#portrait-1"), "heal");
      combatNumber($("#portrait-1"), 9, "heal");
    });
    await page.evaluate(() =>
      document
        .querySelectorAll(".rolled-projectile,.fx-beam,.combat-number")
        .forEach((n) =>
          n.getAnimations().forEach((a) => {
            a.pause();
            a.currentTime = 180;
          }),
        ),
    );
    await shot("38-rolled-healing-symbols", false, "allow");
    await page.evaluate(() =>
      document
        .querySelectorAll(".rolled-projectile,.fx-beam,.combat-number")
        .forEach((n) => n.getAnimations().forEach((a) => a.play())),
    );
    await page.evaluate(() => {
      document
        .querySelectorAll(".combat-number,.symbol-arrival,.rolled-projectile")
        .forEach((n) => n.remove());
      setPreference("combatEffects", "both");
      state.party[1].last = [
        { type: "attack", tier: 1 },
        { type: "attack", tier: 2 },
        { type: "attack", tier: 3 },
      ];
      state.currentHero = 1;
      render();
      beam($("#portrait-1"), enemyArtEl(state.enemy), "attack", {
        critical: true,
      });
      combatNumber(enemyArtEl(state.enemy), 13, "attack");
    });
    await page.evaluate(() =>
      document
        .querySelectorAll(".rolled-projectile,.fx-beam,.combat-number")
        .forEach((n) =>
          n.getAnimations().forEach((a) => {
            a.pause();
            a.currentTime = 180;
          }),
        ),
    );
    await shot("38-symbols-and-beam-critical", false, "allow");
    await page.evaluate(() =>
      document
        .querySelectorAll(".rolled-projectile,.fx-beam,.combat-number")
        .forEach((n) => n.getAnimations().forEach((a) => a.play())),
    );
    await page.evaluate(() => {
      state.currentHero = null;
      setPace("skip");
      editor(0);
    });
    await page.locator('[data-editor-face="1"]').click();
    await page.locator("#face-destination").selectOption("poison");
    await shot("39-workshop-upgrade-refund-swap");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("39-workshop-mobile");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('[data-editor-reel="1"]').click();
    await page.locator('[data-editor-face="6"]').click();
    await shot("40-permanent-class-seal");
    await page.evaluate(() => {
      closeModal();
      optionsPage("play");
    });
    await shot("41-effects-pun-options");
    await page.evaluate(() => {
      closeModal();
      setPreference("punMode", true);
      setPace("1");
      window.reviewArrival = encounterEntrance();
    });
    await page.waitForSelector("#stage-confirm:not(:disabled)");
    await shot("42-paired-pun-arrival");
    await page.locator("#stage-confirm").click();
    await shot("42-two-portrait-flights", false, "allow");
    await page.evaluate(() => window.reviewArrival);
    await page.evaluate(() => {
      const gallery = document.createElement("div");
      gallery.id = "pun-gallery";
      gallery.style.cssText =
        "position:fixed;inset:12px;z-index:9000;background:var(--paper);color:var(--ink);display:grid;grid-template-columns:repeat(9,1fr);grid-template-rows:repeat(3,1fr);gap:12px;padding:20px";
      gallery.innerHTML = Object.entries(PUN_ENEMIES)
        .map(
          ([id, name]) =>
            `<section class="pencil-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px"><div style="height:210px;width:160px">${pencilIllustration(punEnemyArt(id))}</div><b style="font-size:20px;text-align:center">${name}</b></section>`,
        )
        .join("");
      document.body.append(gallery);
    });
    await shot("43-stationery-enemy-sketches");
    await page.evaluate(() => {
      $("#pun-gallery").remove();
      setPace("skip");
      state.depth = 10;
      state.enemies = [state.enemies[0]];
      state.enemy = state.enemies[0];
      state.enemy.boss = true;
      applyEnemyPresentation(state.enemy);
      state.enemy.hp = 211;
      state.enemy.maxHp = 500;
      state.invulnerable = { enemyId: null };
      setEnemyBlock(18);
      render();
      particles = [];
    });
    await shot("44-full-stop-and-unbroken-page");
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot("44-full-stop-1280");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      newRun("berserker", { specialism: "offence" });
      setPace("skip");
      setPreference("skipCriticals", true);
      state.party.push(
        makeHero("Mira", "mage", null, [], { specialism: "defence" }),
        makeHero("Wren", "rogue", null, [], { specialism: "offence" }),
      );
      state.depth = 5;
      beginEncounter(false, { count: 2 });
      state.party[0].fury = 16;
      state.party[0].points = 22;
      state.party[0].hp = 18;
      state.party[1].poison = { turns: 3, damage: 3 };
      state.party[2].vulnerable = { createdAction: 0 };
      state.opening = { firstRoll: true, pending: true, resolved: true };
      state.party[0].initiative = { multiplier: 1.25 };
      state.party[1].surprised = true;
      state.enemies.forEach((e, i) => {
        e.elite = true;
        e.passive = { key: i ? "secondWind" : "carapace", used: false };
      });
      setEnemyBlock(14);
      render();
      particles = [];
    });
    await shot("45-berserker-tactical-party-1920");
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot("45-berserker-tactical-party-1280");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      editor(0);
      editorSelection.face = 3;
      editor(0);
    });
    await shot("46-blood-price-workshop");
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await shot("46-blood-price-workshop-" + width);
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      setPace("1");
      setPreference("combatEffects", "both");
      state.party[0].last = [
        { type: "attack", tier: 4 },
        { type: "attack", tier: 3 },
        { type: "attack", tier: 2 },
      ];
      render();
      beam($("#portrait-0"), enemyArtEl(state.enemy), "attack", {
        critical: true,
      });
      document.querySelectorAll(".rolled-projectile,.fx-beam").forEach((el) =>
        el.getAnimations().forEach((a) => {
          a.pause();
          a.currentTime = 210;
        }),
      );
    });
    await shot("47-large-launched-marks", false, "allow");
    await page.evaluate(() =>
      document
        .querySelectorAll(".rolled-projectile,.fx-beam")
        .forEach((el) => el.remove()),
    );
    await page.evaluate(() => {
      setPreference("skipCriticals", false);
      window.reviewBigCrit = rollCritical(
        "Bram",
        [0, 1, 2].map(() => ({ type: "attack", tier: 3 })),
        false,
        { details: [{ label: "Damage power", icon: "sword", value: 38 }] },
      );
    });
    await page.waitForSelector(".critical-locked .critical-payoff");
    await page.waitForTimeout(450);
    await shot("48-critical-big-payoff", false, "allow");
    await page.evaluate(() => window.reviewBigCrit);
    await page.evaluate(() => {
      state.opening = {
        pending: true,
        firstRoll: true,
        resolved: true,
        surprise: true,
      };
      state.party[0].surprised = true;
      setPace("1");
      window.reviewTacticalArrival = encounterEntrance();
    });
    await page.waitForSelector("#stage-confirm:not(:disabled)");
    await shot("49-elite-dual-surprise-arrival");
    await page.locator("#stage-confirm").click();
    await page.evaluate(() => window.reviewTacticalArrival);
    await page.evaluate(() => {
      newRun("mage", { specialism: "defence" });
      setPace("skip");
      state.depth = 6;
      state.map = generateFloor(6);
      const i = pos(5, 4);
      state.map.forEach((c) => {
        c.seen = c.wall;
        c.room = null;
      });
      [i, ...neighbors(i)].forEach((j) =>
        Object.assign(state.map[j], {
          wall: false,
          event: null,
          feature: null,
          terrain: "floor",
        }),
      );
      Object.assign(state.map[i], { wall: true, terrain: "lava", seen: false });
      state.map[i + 1].event = "treasure";
      state.map[i + 1].feature = "treasure";
      markSeen(i - 1);
      state.map[state.position].seen = true;
      render();
      particles = [];
    });
    await shot("50-lava-light-cross");
    await page.evaluate(() => {
      state.gold = 1000;
      state.bag = { bomb: 1, ward: 1, antidote: 1 };
      render();
      window.reviewShop = shopEncounter({ shop: { potion: 1 } });
    });
    await page.locator('[data-buy="potion"]').click();
    await page.waitForSelector("#shop-cancel");
    await shot("51-shop-bag-warning-before-payment");
    await page.locator("#shop-cancel").click();
    await page.evaluate(() => closeModal());
    await page.evaluate(() => window.reviewShop);
    await page.evaluate(() => {
      window.reviewTravel = choiceTravelEvent("altar");
    });
    await page.waitForSelector("#travel-leave");
    await shot("52-offering-bowl-choice");
    await page.locator("#travel-leave").click();
    await page.evaluate(() => window.reviewTravel);
    await page.evaluate(() => {
      newRun("fighter", { specialism: "offence" });
      setPace("skip");
      setPalette("default");
      setPreference("punMode", false);
      const profile = emptyProfile();
      profile.gold = 12000;
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      chooseStartingClass();
    });
    await shot("53-locked-class-invitations");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("53-locked-class-invitations-mobile");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      campPage("training");
      purchaseUnlock("vitality1");
    });
    await shot("54-tiered-camp-training");
    await page.setViewportSize({ width: 320, height: 844 });
    await shot("54-tiered-camp-training-320");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      state.party[0].points = 99;
      editorView = "edit";
      editor(0);
    });
    await shot("55-equal-face-reels");
    await page.locator('[data-workshop-view="crits"]').click();
    await shot("55-live-critical-odds");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("55-live-critical-odds-mobile");
    await page.locator('[data-workshop-view="edit"]').click();
    await shot("55-equal-face-reels-mobile");
    await page.locator('[data-editor-operation="replace"]').click();
    await shot("55-replacement-controls-mobile");
    await page.locator('[data-editor-operation="power"]').click();
    await shot("55-power-controls-mobile");
    await page.evaluate(() => {
      window.reviewOriginalReels = state.party[0].reels;
      const h = state.party[0];
      h.reels = [0, 1, 2].map((k) =>
        ["attack", "magic", "heal", "block", "stun", "poison"]
          .map((type) => ({ type, tier: 1, weight: 1 }))
          .concat(
            k === 1 ? [{ type: "class", tier: 1, weight: 1, job: h.job }] : [],
          ),
      );
      editorView = "crits";
      editor(0);
    });
    await shot("55-maximum-critical-combinations-mobile");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot("55-maximum-critical-combinations-desktop");
    await page.evaluate(() => {
      state.party[0].reels = window.reviewOriginalReels;
    });
    await page.evaluate(() => {
      closeModal();
      localStorage.removeItem(BESTIARY_KEY);
      bestiaryPage(0);
    });
    await shot("56-bestiary-unknown");
    await page.evaluate(() => {
      closeModal();
      state.depth = 6;
      state.party.push(makeHero("Mira", "mage"));
      beginEncounter(true, { stairBoss: true });
      render();
      window.gaolerArrival = encounterEntrance();
    });
    await page.waitForSelector("#stage-confirm");
    await page.locator("#stage-confirm").click();
    await page.evaluate(() => window.gaolerArrival);
    await shot("57-graphite-gaoler-blackout");
    await page.evaluate(() =>
      bestiaryPage(BESTIARY_ENTRIES.findIndex((e) => e.id === "boss-6")),
    );
    await shot("56-bestiary-discovered");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("56-bestiary-discovered-mobile");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      newRun("mage");
      setPace("skip");
      state.depth = 6;
      state.map = generateFloor(6);
      state.map.forEach((c) => {
        c.seen = true;
      });
      const a = state.position,
        b = pos(7, 2);
      Object.assign(state.map[a], {
        event: "tunnel",
        feature: "tunnel",
        tunnelTo: b,
        tunnelPair: 0,
      });
      Object.assign(state.map[b], {
        wall: false,
        terrain: "floor",
        event: "tunnel",
        feature: "tunnel",
        tunnelTo: a,
        tunnelPair: 0,
      });
      Object.assign(state.map[pos(4, 4)], {
        wall: true,
        terrain: "lava",
        event: null,
        feature: null,
      });
      Object.assign(state.map[pos(4, 5)], {
        wall: false,
        terrain: "bridge",
        event: null,
        feature: null,
      });
      render();
      window.tunnelReview = tunnelEncounter(state.map[a]);
    });
    await page.waitForSelector("#tunnel-leave");
    await shot("58-optional-tunnel-passage");
    await page.locator("#tunnel-leave").click();
    await page.evaluate(() => window.tunnelReview);
    await shot("59-lava-barrier-and-water-bridge");
    await page.evaluate(() => {
      const gallery = document.createElement("section");
      gallery.id = "remains-review";
      gallery.style.cssText =
        "position:fixed;inset:12px;z-index:9000;background:var(--paper);color:var(--ink);display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:20px";
      gallery.innerHTML = [
        ...Object.keys(ENEMY_PROFILES),
        "fighter",
        "rogue",
        "mage",
        "ranger",
        "berserker",
      ]
        .map(
          (kind) =>
            `<article class="pencil-card" style="padding:5px;text-align:center"><b>${SPECIES_LORE[kind]?.[0] || className(kind)}</b><div style="height:140px">${corpseArt(kind)}</div></article>`,
        )
        .join("");
      gallery
        .querySelectorAll("svg")
        .forEach((svg) => (svg.style.cssText = "width:100%;height:100%"));
      document.body.append(gallery);
    });
    await shot("60-species-specific-remains");
    await page.evaluate(() => $("#remains-review").remove());
    await page.evaluate(() => {
      beginEncounter(false, { count: 2 });
      state.enemies[0].passive = { key: "secondWind", used: false };
      state.enemies[0].vulnerable = { createdAction: 0, bonus: 0.25 };
      setEnemyBlock(20);
      if (state.party.length < 2) state.party.push(makeHero("Mira", "mage"));
      state.party[0].poison = { turns: 3, damage: 2 };
      state.party[1].stun = 1;
      render();
    });
    await shot("61-icon-only-statuses-and-shared-block");
    await page.evaluate(() => setPalette("dark"));
    await shot("61-shared-block-dark");
    await page.evaluate(() => setPalette("default"));
    await page.evaluate(() => {
      showSpotlight(
        "Critical!",
        "Three of a kind.",
        drawMachine("critical", [{ type: "multiplier", value: 3, tier: 1 }], {
          one: true,
        }),
        "critical",
      );
      busy = true;
      openUtilityPage("options");
    });
    await page.locator("#tab-display").click();
    await shot("62-options-during-critical");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("62-options-during-critical-mobile");
    await page.locator("#guide-tab").click();
    await shot("63-fixed-guide-navigation-mobile");
    await page.locator("#modal [data-close]").last().click();
    await page.evaluate(() => {
      busy = false;
      closeSpotlight();
      closeModal();
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      setPace("1");
      setPreference("shake", 0);
      setPreference("skipCriticals", false);
      sceneFast = false;
      setAutoresolve(false);
      setAutoplay(false);
      // Hold the real payoff while taking a still: captures can outlast its
      // normal automatic linger on a busy browser worker.
      window.reviewCriticalHold = criticalHold;
      criticalHold = () =>
        new Promise((resolve) => {
          window.releaseReviewCritical = resolve;
        });
      window.numberReview = rollCritical(
        "Alden",
        [0, 1, 2].map(() => ({ type: "attack", tier: 1 })),
        false,
        { details: [{ icon: "sword", label: "Damage", value: 18 }] },
      );
    });
    await page.waitForSelector("#machine-critical.rolling");
    await shot("64-critical-original-number", false, "allow");
    await page.locator("#stage-skip").click();
    await page.waitForSelector(".critical-locked");
    await shot("65-critical-transformed-number", false, "allow");
    await page.evaluate(() => {
      window.releaseReviewCritical();
      return window.numberReview;
    });
    await page.evaluate(() => {
      sceneFast = false;
      window.reviewMachine = runMachine;
      runMachine = (id, reels, options = {}) =>
        window.reviewMachine(
          id,
          reels,
          id === "treasure"
            ? { results: [0, 1, 2].map(() => ({ type: "coin", tier: 1 })) }
            : options,
        );
      busy = true;
      window.spoilsReview = treasureRoll("battle");
    });
    await page.waitForSelector("#machine-treasure.rolling");
    await shot("66-centred-battle-spoils");
    await page.locator("#stage-skip").click();
    await page.waitForSelector("#machine-critical.rolling");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("66-spoils-critical-original-mobile", false, "allow");
    await page.locator("#stage-skip").click();
    await page.waitForSelector(".critical-locked");
    await shot("66-spoils-critical-payoff-mobile", false, "allow");
    await page.evaluate(() => window.releaseReviewCritical());
    await page.waitForSelector("#stage-confirm");
    await page.locator("#stage-confirm").click();
    await page.evaluate(async () => {
      await window.spoilsReview;
      runMachine = window.reviewMachine;
      criticalHold = window.reviewCriticalHold;
      busy = false;
      setPace("skip");
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      newRun("berserker", { specialism: "offence" });
      setPace("1");
      setPreference("skipCriticals", true);
      setPreference("combatEffects", "icons");
      beginEncounter(false, { count: 1 });
      state.opening = null;
      const h = state.party[0];
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
      window.furyReview = spin(0);
    });
    await page.waitForSelector('.rolled-projectile[data-effect="lifesteal"]');
    await shot("67-berserker-returning-lifesteal", false, "allow");
    await page.evaluate(() => window.furyReview);
    await page.evaluate(() => {
      setPace("skip");
      state.actionSerial = 5;
      state.party[0].poison = {
        turns: 3,
        damage: 1,
        appliedAt: 0,
        sourceName: "Venom",
      };
      state.enemy.poison = {
        turns: 3,
        damage: 1,
        appliedAt: 0,
        sourceName: "Venom",
      };
      window.poisonReview = tickPoison();
    });
    await page.waitForSelector(".combat-number.poison");
    await shot("68-poison-feedback", false, "allow");
    await page.evaluate(() => window.poisonReview);
    await page.evaluate(() => {
      state.enemy = null;
      state.enemies = [];
      clearBattleStatuses();
      const ids = [pos(3, 5), pos(4, 5), pos(5, 5)];
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
      Object.assign(state.map[pos(3, 4)], {
        wall: true,
        seen: true,
        terrain: "river",
        event: null,
        feature: null,
      });
      render();
    });
    await shot("69-bridges-retain-their-terrain");
    await page.evaluate(() => {
      newRun("mage");
      state.party[0].points = 60;
      editor(0);
      editorSelection.reel = 1;
      editorSelection.face = 6;
      editor(0);
    });
    await shot("70-workshop-class-note-fit");
    await page.setViewportSize({ width: 320, height: 800 });
    await shot("70-workshop-class-note-fit-320");
    await page.evaluate(() => closeModal());
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      beginEncounter(false, { count: 2 });
      window.reviewReadDelay = automaticReadDelay;
      automaticReadDelay = (kind) =>
        kind === "enemy-intro" ? 5000 : window.reviewReadDelay(kind);
      setAutoresolve(true);
      window.spectatorReview = (async () => {
        busy = true;
        await encounterEntrance();
        busy = false;
      })();
    });
    await page.waitForSelector("#stage-confirm");
    await shot("71-autofight-reads-dual-arrivals");
    await page.evaluate(() => {
      setAutoresolve(false);
      automaticReadDelay = window.reviewReadDelay;
    });
    if (await page.locator("#stage-confirm").isVisible())
      await page.locator("#stage-confirm").click();
    await page.evaluate(() => window.spectatorReview);
    // Campfire edition: real source components, fixed layout and unusual rules.
    await page.evaluate(() => {
      newRun("fighter", { specialism: "defence" });
      setPace("skip");
      const profile = emptyProfile();
      profile.gold = 90000;
      profile.owned = Object.keys(CAMP_UNLOCKS);
      profile.enabled = ["glass", "richFoes"];
      profile.activeTraining = Object.fromEntries(
        Object.keys(CAMP_LESSONS).map((f) => [f, 3]),
      );
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      campInitial = false;
      campPage("classes");
    });
    await shot("72-equal-camp-adventurers-1920");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("72-equal-camp-adventurers-390");
    await page.evaluate(() => campPage("training", 0));
    await shot("73-active-lessons-390");
    await page.locator("#camp-next").click();
    await shot("73-more-lessons-390");
    await page.setViewportSize({ width: 320, height: 800 });
    await shot("73-active-lessons-320");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => campPage("training", 0));
    await shot("73-active-lessons-1920");
    await page.evaluate(() => campPage("training", 1));
    await shot("73-eight-lesson-families");
    await page.evaluate(() => campPage("challenges", 1));
    await shot("74-eight-untiered-challenges");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => help("statuses"));
    await shot("75-scannable-guide-390");
    await page.evaluate(() => help("jester"));
    await shot("75-jester-guide-390");
    await page.evaluate(() => {
      closeModal();
      newRun("jester");
      setPace("skip");
      beginEncounter(false, { count: 1 });
      state.opening = null;
      render();
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot("76-jester-and-combat-round");
    await page.evaluate(() => {
      state.enemy = null;
      state.enemies = [];
      render();
    });
    await shot("76-round-hidden-between-fights");
    await page.evaluate(() => {
      newRun("mage");
      setPace("skip");
      setPreference("ambientEffects", true);
      const lava = pos(2, 7);
      Object.assign(state.map[lava], {
        terrain: "lava",
        wall: true,
        seen: true,
        event: null,
        feature: null,
      });
      render();
    });
    await shot("77-lava-boundary-and-warm-edge");
    await page.evaluate(() => setPalette("dark"));
    await shot("77-lava-dark-palette");
    await page.evaluate(() => {
      newRun("fighter");
      setPace("skip");
      setPalette("default");
      setPreference("skipCriticals", true);
      state.party.push(makeHero("Mira", "mage"), makeHero("Wren", "rogue"));
      state.party.forEach((h) => (h.hp = 2));
      render();
      window.reviewWellMachine = runMachine;
      runMachine = (id, reels, options = {}) =>
        id === "fountain"
          ? new Promise((r) => (window.finishReviewWell = r))
          : window.reviewWellMachine(id, reels, options);
      window.reviewWell = wellEncounter({ event: "well" });
    });
    await page.locator("#well-use").click();
    await page.waitForSelector("#fountain-result .well-heal-total");
    await shot("78-well-reserved-recipients");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("78-well-reserved-recipients-390");
    await page.evaluate(() =>
      window.finishReviewWell([
        { type: "heal", tier: 1 },
        { type: "heal", tier: 1 },
        { type: "heal", tier: 1 },
      ]),
    );
    await page.waitForSelector("#stage-confirm");
    await shot("78-well-calculated-recipients-390");
    await page.locator("#stage-confirm").click();
    await page.evaluate(async () => {
      await window.reviewWell;
      runMachine = window.reviewWellMachine;
      busy = false;
      state.exitFound = state.exitReached = state.floorBossDefeated = true;
      stairs();
    });
    await shot("79-illustrated-descent-390");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await shot("79-illustrated-descent-1920");
    await page.evaluate(() => {
      closeModal();
      newRun("jester");
      setPace("1");
      setPreference("shake", 0.5);
      setPreference("skipCriticals", false);
      beginEncounter(false, { count: 2 });
      state.opening = null;
      render();
      window.reviewOrdinaryCriticalHold = criticalHold;
      criticalHold = () => new Promise((r) => (window.releaseOrdinaryCritical = r));
      window.reviewOrdinaryCritical = rollCritical(
        "Quill",
        [
          { type: "attack", tier: 1 },
          { type: "attack", tier: 1 },
          { type: "attack", tier: 1 },
        ],
        false,
        {
          actor: state.party[0],
          details: [{ icon: "sword", label: "Damage", value: 8 }],
        },
      );
    });
    await page.waitForSelector("#machine-critical.rolling");
    await shot("80-jester-normal-critical-original-number", false, "allow");
    await page.locator("#stage-skip").click();
    await page.waitForSelector(".critical-locked");
    await shot("80-jester-normal-critical-payoff", false, "allow");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("80-jester-normal-critical-payoff-390", false, "allow");
    await page.evaluate(async () => {
      window.releaseOrdinaryCritical();
      await window.reviewOrdinaryCritical;
      criticalHold = window.reviewOrdinaryCriticalHold;
      setPace("skip");
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(async () => {
      const real = Math.random;
      Math.random = () => 0.01;
      await jesterWildcard(state.party[0]);
      Math.random = () => 0.18;
      await jesterWildcard(state.party[0]);
      Math.random = real;
      render();
    });
    await shot("81-gilded-party-reel-and-enemy-blackout");
    await page.evaluate(() => {
      newRun("fighter");
      setPace("skip");
      beginEncounter(false, { count: 1 });
      state.opening = null;
      render();
      characterLuck = () => 0;
      damageHero(0, 1000, "A guardian's blow", { piercing: true });
      characterLuck = () => 0.999999;
    });
    await shot("82-heroic-last-stand", false, "allow");
    await page.evaluate(() => {
      newRun("fighter");
      setPace("skip");
      optionsPage("play");
    });
    await shot("83-options-progress-reset");
    await page.evaluate(() => confirmProgressReset());
    await shot("83-confirm-progress-reset");
    await page.evaluate(() => {
      closeModal();
      setPace("1");
      const from = state.position,
        to = pos(7, 2);
      markSeen(to);
      renderMap();
      window.reviewTunnel = tunnelTransit(from, to);
    });
    await shot("84-directed-tunnel-travel", false, "allow");
    await page.evaluate(() => window.reviewTunnel);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal(); newRun("jester"); setPace("1"); setPreference("shake", .7);
      state.party.push(makeHero("Orin", "mage", null, [], { specialism: "defence" }));
      state.party.push(makeHero("Wren", "rogue", null, [], { specialism: "offence" }));
      beginEncounter(false, { count: 2 }); finishOpeningRoll();
      state.enemies.forEach(e => { e.hp = e.maxHp = 10000; e.countdown = 20; });
      state.party[0].anticipation = 5;
      state.block = 10; setEnemyBlock(6);
      applyStimulant(state.party[2], 3); render(); particles = [];
    });
    await shot("85-anticipation-and-support-1920");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("85-anticipation-and-support-390", true);
    await page.evaluate(() => { editor(0); editorSelection.reel=0; editorSelection.face=4; editor(0); });
    await shot("85-trick-workshop-390");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      window.savedPunchlineMachine = runMachine;
      window.savedPunchlineFX = punchlineFX;
      punchlineFX = async h => {
        await savedPunchlineFX(h);
        await new Promise(resolve => window.releasePunchlinePreview = resolve);
      };
      runMachine = async (id, reels, options) => id.startsWith("hero-")
        ? [{type:"trick",tier:1},{type:"blank",tier:1},{type:"blank",tier:1}]
        : savedPunchlineMachine(id,reels,options);
      window.reviewPunchline = spin(0);
    });
    await page.waitForFunction(() => !!window.releasePunchlinePreview);
    await shot("86-punchline-toybox-1920", false, "allow");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("86-punchline-toybox-390", true, "allow");
    await page.evaluate(() => { setPace("skip"); releasePunchlinePreview(); });
    await page.evaluate(() => window.reviewPunchline);
    await page.evaluate(() => { runMachine=savedPunchlineMachine; punchlineFX=savedPunchlineFX; });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      newRun("fighter"); setPace("skip"); beginEncounter(false, {count:2});
      state.enemy.ambush=true;
      state.opening.surprise=true;
      render(); window.reviewSurprise=encounterEntrance();
    });
    await page.waitForSelector("#stage-confirm");
    await shot("87-centred-surprise-1920");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("87-centred-surprise-390");
    await page.locator("#stage-confirm").click();
    await page.evaluate(() => window.reviewSurprise);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      newRun("fighter"); setPace("skip");
      for(let n=0;n<1000;n++) {
        const map=generateFloor(4,1,0,["echoes"]), goal=map.findIndex(c=>c.event==="stairs");
        if(!mapDistances(map,pos(1,7),false).has(goal)) {state.map=map;break;}
      }
      state.map.forEach(c=>c.seen=true); render(); particles=[];
    });
    await shot("88-tunnel-only-crossing-1920");
    await page.evaluate(() => help("buffs"));
    await shot("89-support-guide-1920");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("89-support-guide-390");
    await page.evaluate(() => help("jester"));
    await shot("89-punchline-guide-390");
    await page.setViewportSize({ width: 1920, height: 1080 });
    }
    for(const width of [1920,1280,390]) {
      await page.setViewportSize({width,height:width<500?844:1080});
      await page.evaluate(()=>{closeSpotlight();chooseStartingClass();});
      await shot("96-aligned-starters-"+width);
      await page.evaluate(()=>closeModal());
    }
    // Version-21 fixtures: natural generated biomes, not a visual-only repaint.
    for (const theme of ["cave", "overgrown", "fungal", "ice", "lava", "crystal"]) {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.evaluate((theme) => {
        closeModal(); newRun("fighter"); setPace("skip"); state.depth = 8;
        let map;
        for (let n = 0; n < 1500; n++) {
          map = generateFloor(8, 1, 0, []);
          if (floorBiome(map) === theme) break;
        }
        if (floorBiome(map) !== theme) throw Error("Missing review biome " + theme);
        state.map = map; state.map.forEach(c => c.seen = true);
        state.pursuerSpawned = true; render(); particles = [];
      }, theme);
      await shot("90-biome-" + theme + "-1920");
      await page.setViewportSize({ width: 1280, height: 800 });
      await shot("90-biome-" + theme + "-1280");
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      const gallery = document.createElement("section");
      gallery.id = "biome-art-review";
      gallery.style.cssText = "position:fixed;inset:20px;z-index:5000;background:var(--paper);color:var(--ink);padding:20px;display:grid;grid-template-columns:repeat(5,1fr);gap:12px";
      for (const [kind, d] of Object.entries(BIOME_ENEMIES)) {
        const cell = document.createElement("article");
        cell.className = "pencil-card";
        cell.style.cssText = "padding:8px;text-align:center;display:grid;align-content:start;gap:3px";
        cell.innerHTML = `<h2>${d.name}</h2><p>${d.biome} · Floors ${d.minDepth}–${d.maxDepth}</p>${portraitArt(kind, {hp:100,maxHp:100})}${corpseArt(kind)}`;
        cell.querySelectorAll("svg").forEach(svg => {svg.style.height="125px";svg.style.width="100%";});
        gallery.append(cell);
      }
      document.body.append(gallery);
    });
    await shot("91-biome-creatures-and-corpses");
    await page.evaluate(() => {
      $("#biome-art-review").remove(); newRun("berserker"); setPace("skip");
      state.party.push(makeHero("Rowan", "ranger"), makeHero("Quill", "jester"));
      state.party[0].level = 8; state.party[0].fury = 38; state.party[0].hp = 18;
      state.party[1].charge = 6; state.party[2].anticipation = 5;
      beginEncounter(false, {count:1}); finishOpeningRoll();
      Object.assign(state.enemy, {art:"powderimp",name:"Powder imp",passive:{key:"detonate"},fuseLeft:1,frequency:2,countdown:1,damage:5,hp:28,maxHp:28});
      state.party[0].fury=38;state.party[1].charge=6;state.party[2].anticipation=5;
      state.block=8; render(); particles=[];
    });
    await shot("92-powder-fuse-and-charged-party-1920");
    await page.setViewportSize({ width: 1280, height: 800 });
    await shot("92-powder-fuse-and-charged-party-1280");
    await page.setViewportSize({ width: 390, height: 844 });
    await shot("92-powder-fuse-and-charged-party-390", true);
    await page.evaluate(()=>{
      Object.assign(state.map[neighbors(state.position)[0]],{wall:true,terrain:"crystal",event:null,seen:true});
      state.crystalRolls=2;advanceCrystalAura();render();particles=[];
    });
    await shot("97-crystal-seals-390",true);
    await page.setViewportSize({width:1280,height:800});
    await shot("97-crystal-seals-1280");
    await page.setViewportSize({width:390,height:844});

    await page.evaluate(() => {editor(0); editorSelection.reel=1;editorSelection.face=0;editor(0);});
    await shot("93-ordinary-mark-workshop-390");
    await page.evaluate(() => {editorSelection.face=state.party[0].reels[1].findIndex(f=>f.type==="class");editor(0);});
    await shot("93-permanent-mark-workshop-390");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal();
      const [type,d] = Object.entries(ITEM_DEFS).filter(([,d])=>d.equipment).sort((a,b)=>b[1].description.length-a[1].description.length)[0];
      showSpotlight("Spoils of battle", "The last foe falls. Something gleams in the dust.", `<div class="trap-art">${icon("skull")}</div>${drawMachine("treasure",[{type:"coin",tier:1},{type:"coin",tier:1},{type:"coin",tier:1}],{title:"Fortune favours the curious"})}${criticalSpace()}<div id="treasure-result" class="stage-result">180 gold · 60 ×3 · CRITICAL GOLD</div><div id="artefact-loot"></div>`, "treasure");
      lootFindCarousel([`<div class="item-find">${icon(d.icon)}<div><b>${d.name} ×12</b><p><b class="equipment-scope">${equipmentScope(d)}</b><br>${d.description}</p></div></div>`]);
      window.reviewLootChoice=eventChoice([{id:"stage-confirm",label:"Collect spoils",value:true}]);
    });
    await shot("94-gold-payoff-and-long-item-1920");
    await page.setViewportSize({ width: 320, height: 844 });
    await shot("94-gold-payoff-and-long-item-320");
    await page.locator("#stage-confirm").click();
    await page.evaluate(()=>window.reviewLootChoice);
    await page.evaluate(() => {closeSpotlight();help("biomes");});
    await shot("95-biome-guide-320");
    await page.evaluate(() => help("ice"));
    await shot("95-ice-guide-320");
    }
    // Current combat resources: real effects and current panels, not alternate art.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => {
      closeModal(); closeSpotlight(); newRun("fighter"); setPace("1");
      setPreference("combatEffects", "icons");
      state.party.push(makeHero("Fang", "berserker"), makeHero("Quill", "jester"));
      beginEncounter(false, {count:2}); finishOpeningRoll();
      state.enemies.forEach(e => { e.hp=e.maxHp=1000; e.passive=null; e.countdown=30; });
      state.party[1].hp=12; state.party[1].fury=18;
      state.party[2].hp=12; state.party[2].anticipation=5;
      grantStunWard(state.party[0]); grantStunWard(state.enemies[0]);
      state.block=30; setEnemyBlock(20); render(); particles=[];
    });
    await shot("identity-caps-and-steady-1920");
    await page.evaluate(() => {
      const h=state.party[2];
      h.reels=[
        [{type:"attack",tier:3,weight:1}],
        [{type:"heal",tier:2,weight:1},{type:"class",tier:1,weight:1,job:"jester"}],
        [{type:"block",tier:2,weight:1}],
      ];
      state.block=8; render();
      window.identityBurst=jesterMarkBurst(h);
    });
    await page.waitForSelector('.rolled-projectile[data-effect="punchline"]');
    await shot("identity-six-mark-burst-1920", false, "allow");
    await page.evaluate(() => window.identityBurst);
    await page.evaluate(() => {
      const h=state.party[1]; setPace("skip"); h.fury=0;
      damageHero(1,4,"Blood Price",{piercing:true,selfInflicted:true,bloodPriceTier:4});
      render();
    });
    await shot("identity-blood-price-fury-1920");
    await page.evaluate(() => {healHero(1,5);render();});
    await shot("identity-healing-spends-fury-1920");
    await page.evaluate(() => {state.party[0].points=50;editor(0);});
    await shot("identity-equal-face-workshop-1920");
    await page.setViewportSize({width:320,height:844});
    await page.locator('[data-editor-operation="replace"]').click();
    await shot("identity-workshop-320");
    await page.evaluate(() => {closeModal();help("combos");});
    await shot("identity-mixed-builds-guide-320");
    await page.setViewportSize({width:1280,height:800});
    await page.evaluate(() => help("statuses"));
    await shot("identity-steady-guide-1280");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => optionsPage("play"));
    const download = page.waitForEvent("download");
    await page.locator("#option-download").click();
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
      path.join(output, process.env.UI_REVIEW_SCOPE === "identity" ? "identity-report.json" : "report.json"),
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
